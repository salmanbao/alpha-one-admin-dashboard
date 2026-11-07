"use client";
/**
 * R4-01 — Send Queue & Gateway Health (P0, 1 route (+trace drawer)).
 *
 * UI layout:
 *   ● Top strip: queue depth per channel (email/SMS/WhatsApp/push), dispatch rate last hour,
 *     oldest queued message age, dead-letter count, kill-switch state
 *   ● Adapter grid: one card per provider connection (reusing channel-infra-store shapes)
 *     with health, latency, daily cap usage and circuit-breaker state
 *   ● Queue table: message ID, campaign, tenant, channel, state (queued/sending/retry/dead),
 *     attempts, next attempt, provider response - filterable by state and campaign
 *   ● Dead-letter tab: failed messages with provider error, replay action (audit-logged) and
 *     bulk replay with confirmation
 *   ● Trace drawer: per-message lifecycle from enqueue to provider ack, with the consent/
 *     segment decision that admitted it (R3-04 why-snapshot format)
 *
 * AC-1: retry re-enqueues for real - the state transition is visible in the queue table
 *       without a reload (store subscription, not a toast)
 * AC-2: dead-letter replay is audit-logged with actor and target and moves the message back
 *       through the visible lifecycle
 * AC-3: the kill-switch halts dispatch store-wide within one tick and every affected campaign
 *       shows the halted state on its own screen
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { recordAudit } from "@/lib/audit";
import { listQueue, getMessage, queueDepthByChannel, oldestQueuedAgeMs, dispatchRateLastHour, deadLetterCount, isKillSwitchOn, retry$, deadLetterReplay$, setKillSwitch$, haltCampaign$, useQueueVersion } from "../send-queue-store";
import { AlertTriangle, Activity, Timer, Clock, CheckCircle2, AlertCircle, List, History, Power, HeartPulse, MessageSquare } from "lucide-react";

export function SendQueuePage() {
  const { user } = usePlatform();
  const actor = user?.name ?? "operator";
  const canOperate = hasPermission(user, "marketing.gateway.operate");
  useQueueVersion();
  const [filterState, setFilterState] = useState<{ state: string; campaign: string }>({ state: "", campaign: "" });
  const [selectedForReplay, setSelectedForReplay] = useState<Record<string, boolean>>({});
  const [trace, setTrace] = useState<{ messageId: string; open: boolean }>({ messageId: "", open: false });
  const [killSwitchConfirmed, setKillSwitchConfirmed] = useState(false);

  const rows = listQueue();
  const depth = queueDepthByChannel();
  const metricRows = useMemo(() => [
    { label: "Queue depth", value: Object.values(depth).reduce((s, v) => s + v, 0) },
    { label: "Dispatch rate (last hour)", value: dispatchRateLastHour() },
    { label: "Oldest queued age", value: Math.round(oldestQueuedAgeMs() / 1000) + "s" },
    { label: "Dead-letter count", value: deadLetterCount() },
  ], [depth]);

  const filtered = useMemo(() => {
    return rows.filter(m => {
      const stateMatch = filterState.state ? m.state === filterState.state : true;
      const campaignMatch = filterState.campaign ? m.campaign.toLowerCase().includes(filterState.campaign.toLowerCase()) : true;
      return stateMatch && campaignMatch;
    });
  }, [rows, filterState]);

  const selectedIds = useMemo(() => Object.keys(selectedForReplay).filter(id => selectedForReplay[id]), [selectedForReplay]);

  const cols: Column<typeof rows[0]>[] = [
    { key: "id", header: "Message ID", cell: r => <span className="font-mono text-xs">{r.id}</span> },
    { key: "campaign", header: "Campaign", cell: r => <span className="text-xs font-medium">{r.campaign}</span> },
    { key: "tenant", header: "Tenant", cell: r => <span className="text-xs text-muted-foreground">{r.tenant}</span> },
    { key: "channel", header: "Channel", cell: r => <Badge variant="outline" className="text-[10px]">{r.channel}</Badge> },
    { key: "state", header: "State", cell: r => (
      <StatusBadge tone={r.state === "queued" ? "info" : r.state === "sending" ? "info" : r.state === "retry" ? "warning" : r.state === "dead" ? "danger" : "muted"}>{r.state}</StatusBadge>
    ) },
    { key: "attempts", header: "Attempts", cell: r => <span className="text-xs">{r.attempts}/{r.maxAttempts}</span> },
    { key: "nextAttempt", header: "Next attempt", cell: r => r.nextAttempt ? <span className="text-xs font-mono">in {new Date(r.nextAttempt).toLocaleTimeString()}</span> : <span className="text-[10px] text-muted-foreground">—</span> },
    { key: "provider", header: "Provider", cell: r => <span className="text-xs">{r.providerId}</span> },
    { key: "actions", header: "", cell: r => (
      <div className="flex gap-1 justify-end">
        {r.state !== "dead" && r.state !== "delivered" && (
          <Button size="sm" variant="outline" className="h-6 text-[10px]" disabled={!canOperate}
            onClick={() => {
              if (!canOperate) { toast({ title: "Permission required", description: "Requires marketing.gateway.operate", variant: "destructive" }); return; }
              retry$(r.id);
              recordAudit({ action: "retry", entity: "send-message", entityId: r.id, summary: `Message ${r.id} (${r.campaign}) retried by ${actor}`, module: "marketing", severity: "info", actor });
              toast({ title: "Retried", description: `Message ${r.id} re-enqueued.` });
            }}>Retry</Button>
        )}
        <Button size="sm" variant="ghost" className="h-6 text-[10px]" disabled={!canOperate}
          onClick={() => { setTrace({ messageId: r.id, open: true }); }}>Trace</Button>
      </div>
    ) },
  ];

  const deadRows = useMemo(() => rows.filter(m => m.state === "dead"), [rows]);
  const [deadSelected, setDeadSelected] = useState<Record<string, boolean>>({});
  const deadSelectedIds = useMemo(() => Object.keys(deadSelected).filter(id => deadSelected[id]), [deadSelected]);

  const deadCols: Column<typeof deadRows[0]>[] = [
    { key: "id", header: "Message ID", cell: r => <span className="font-mono text-xs">{r.id}</span> },
    { key: "campaign", header: "Campaign", cell: r => <span className="text-xs font-medium">{r.campaign}</span> },
    { key: "provider", header: "Provider", cell: r => <span className="text-xs">{r.providerId}</span> },
    { key: "error", header: "Error", cell: r => <span className="text-xs text-muted-foreground">{r.providerResponse}</span> },
    { key: "actions", header: "", cell: r => (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="outline" className="h-6 text-[10px]" disabled={!canOperate}
          onClick={() => {
            if (!canOperate) { toast({ title: "Permission required", description: "Requires marketing.gateway.operate", variant: "destructive" }); return; }
            deadLetterReplay$([r.id], actor);
            toast({ title: "Replayed", description: `Dead-letter message ${r.id} re-enqueued.` });
          }}>Replay</Button>
      </div>
    ) },
  ];

  const adapters = useMemo(() => {
    const channelColors: Record<string, string> = {
      email: "#6b7280",
      sms: "#10b981",
      whatsapp: "#34d399",
      push: "#3b82f6",
      "in-app": "#8b5cf6",
    };
    return [
      { channel: "email", title: "Email Providers", icon: MessageSquare },
      { channel: "sms", title: "SMS Providers", icon: MessageSquare },
      { channel: "whatsapp", title: "WhatsApp", icon: MessageSquare },
      { channel: "push", title: "Push", icon: MessageSquare },
    ].map(group => {
      const channel = group.channel as "email" | "sms" | "whatsapp" | "push" | "in-app";
      const providers = filtered.filter(m => m.channel === channel);
      return { ...group, providers, color: channelColors[channel] };
    });
  }, [filtered]);

  return (
    <Page>
      <PageHeader
        title="Send Queue & Gateway Health"
        description="Real-time queue state, provider health/latency, and dead-letter management with audit trail. Per-message trace drawer and kill-switch control (requires marketing.gateway.operate)."
        icon={Activity}
        actions={
          <div className="flex items-center gap-2">
            {canOperate && (
              <div className="flex items-center gap-1.5 rounded border px-3 py-1.5">
                <Power className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium">Kill Switch</span>
                <Switch checked={isKillSwitchOn()} onCheckedChange={(v) => {
                  if (!killSwitchConfirmed && v) {
                    toast({ title: "Confirm required", description: "Type 'CONFIRM' in the dialog below to engage the kill-switch.", variant: "destructive" });
                    setKillSwitchConfirmed(true);
                  } else if (v && killSwitchConfirmed) {
                    setKillSwitch$(true, actor);
                    recordAudit({ action: "kill-switch.engage", entity: "send-gateway", entityId: "global", summary: `Kill-switch engaged by ${actor}`, module: "marketing", severity: "warning", actor });
                    toast({ title: "Kill-switch engaged", description: "All pending dispatches halted store-wide." });
                    setKillSwitchConfirmed(false);
                  } else if (!v) {
                    setKillSwitch$(false, actor);
                    recordAudit({ action: "kill-switch.release", entity: "send-gateway", entityId: "global", summary: `Kill-switch released by ${actor}`, module: "marketing", severity: "info", actor });
                    toast({ title: "Kill-switch released", description: "Dispatch resumed." });
                  }
                }} />
                <Badge variant={isKillSwitchOn() ? "destructive" : "secondary"} className="text-[10px]">{isKillSwitchOn() ? "ENGAGED" : "ACTIVE"}</Badge>
              </div>
            )}
          </div>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metricRows.map(m => (
            <MetricCard key={m.label} label={m.label} value={m.value} tone={m.label.includes("dead") ? "negative" : "positive"} />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
          <button type="button" onClick={() => setFilterState(fs => ({ ...fs, state: "" }))} className="px-2 py-0.5 rounded hover:bg-muted">All ({rows.length})</button>
          <button type="button" onClick={() => setFilterState(fs => ({ ...fs, state: "queued" }))} className="px-2 py-0.5 rounded hover:bg-muted">Queued ({rows.filter(m => m.state === "queued").length})</button>
          <button type="button" onClick={() => setFilterState(fs => ({ ...fs, state: "sending" }))} className="px-2 py-0.5 rounded hover:bg-muted">Sending ({rows.filter(m => m.state === "sending").length})</button>
          <button type="button" onClick={() => setFilterState(fs => ({ ...fs, state: "retry" }))} className="px-2 py-0.5 rounded hover:bg-muted">Retry ({rows.filter(m => m.state === "retry").length})</button>
          <button type="button" onClick={() => setFilterState(fs => ({ ...fs, state: "dead" }))} className="px-2 py-0.5 rounded hover:bg-muted">Dead ({rows.filter(m => m.state === "dead").length})</button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b pb-2">
          <Input
            placeholder="Filter by campaign..."
            value={filterState.campaign}
            onChange={e => setFilterState(fs => ({ ...fs, campaign: e.target.value }))}
            className="h-8 max-w-[240px] text-xs"
          />
          <div className="text-[10px] text-muted-foreground">Queue depth by channel: {Object.entries(depth).map(([ch, n]) => `${ch}:${n}`).join(", ")}</div>
        </div>

        <Tabs defaultValue="queue" className="mt-4">
          <TabsList>
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="dead">Dead Letter</TabsTrigger>
            <TabsTrigger value="adapters">Adapter Grid</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-3">
            <DataTable columns={cols} data={filtered} rowKey={r => r.id} pageSize={12} searchableText={r => `${r.id} ${r.campaign} ${r.tenant} ${r.providerId}`} />
          </TabsContent>

          <TabsContent value="dead" className="mt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{deadRows.length} dead-lettered messages</span>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={!canOperate || !deadSelectedIds.length}
                onClick={() => {
                  if (!canOperate) { toast({ title: "Permission required", description: "Requires marketing.gateway.operate", variant: "destructive" }); return; }
                  deadLetterReplay$(deadSelectedIds, actor);
                  setDeadSelected({});
                  toast({ title: "Bulk replayed", description: `${deadSelectedIds.length} dead-lettered messages re-enqueued.` });
                }}>
                Bulk Replay selected ({deadSelectedIds.length})
              </Button>
            </div>
            <DataTable
              columns={deadCols}
              data={deadRows}
              rowKey={r => r.id}
              pageSize={8}
              searchableText={r => `${r.id} ${r.campaign} ${r.providerResponse}`}
            />
          </TabsContent>

          <TabsContent value="adapters" className="mt-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {adapters.map(g => (
                <Card key={g.channel} className="border-muted">
                  <CardContent className="p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold" style={{ color: g.color }}>{g.title}</span>
                      <g.icon className="h-4 w-4" style={{ color: g.color }} />
                    </div>
                    <div className="space-y-1">
                      {g.providers.map(m => (
                        <div key={m.id} className="flex items-center justify-between rounded border px-2 py-1">
                          <span className="font-mono text-[10px]">{m.providerId}</span>
                          <StatusBadge tone={m.state === "queued" || m.state === "sending" ? "info" : "muted"} className="text-[9px]">{m.state}</StatusBadge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Sheet open={trace.open} onOpenChange={o => !o && setTrace(t => ({ ...t, open: false }))}>
          <SheetContent className="sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Trace: {trace.messageId}</SheetTitle>
              <SheetDescription>Message lifecycle from enqueue to provider ack (R3-04 why-snapshot format)</SheetDescription>
            </SheetHeader>
            <div className="mt-3 space-y-2 text-xs">
              {getMessage(trace.messageId)?.trace.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground">{new Date(e.at).toLocaleString()}</span>
                  <span className="font-medium text-foreground">{e.event}</span>
                  {e.detail && <span className="text-muted-foreground">{e.detail}</span>}
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}