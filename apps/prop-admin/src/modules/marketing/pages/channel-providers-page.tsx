"use client";

/**
 * N1 — Channel Providers & Senders (Wave 1, P0, spec card).
 * Connect provider accounts (email/SMS/WhatsApp/push), sender identities,
 * API keys/creds via vault references, health checks, default sender per
 * channel. Uses integrations-hub pattern feel; M2 completion surface.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { relativeTime } from "@/modules/integrations/format";
import { recordAudit } from "@/lib/audit";
import { Server, Plus, RefreshCw, ShieldCheck, KeyRound, Send } from "lucide-react";
import { listProviders, listSenders, testProvider, toggleProvider, type ProviderConfig, type Channel } from "../channel-infra-store";

const CHANNELS: Channel[] = ["email", "sms", "whatsapp", "push"];
const tone = (s: string): "success" | "danger" | "warning" | "muted" => s === "connected" || s === "ok" || s === "verified" ? "success" : s === "error" || s === "down" || s === "suspended" ? "danger" : s === "testing" || s === "degraded" || s === "pending" ? "warning" : "muted";

export function ChannelProvidersPage() {
  const [, tick] = useState(0);
  const refresh = () => tick(n => n + 1);
  const providers = listProviders();
  const senders = listSenders();
  const [chFilter, setChFilter] = useState<Channel | "all">("all");
  const [drawer, setDrawer] = useState<ProviderConfig | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "email" as Channel, credsRef: "vault/new/provider" });

  const filtered = useMemo(() => providers.filter(p => chFilter === "all" || p.channel === chFilter), [providers, chFilter]);
  const healthy = providers.filter(p => p.health === "ok" && p.status === "connected").length;

  function runTest(p: ProviderConfig) {
    const r = testProvider(p.id);
    toast({ title: r.ok ? "Health check passed" : "Health check failed", description: r.msg });
    recordAudit({ action: "channel.provider.test", entity: "provider", entityId: p.id, summary: `Health check ${r.ok ? "passed" : "failed"} for ${p.name}.`, module: "marketing" });
    refresh();
  }

  const cols: Column<ProviderConfig>[] = [
    { key: "name", header: "Provider", sortValue: p => p.name, cell: p => <span className="font-medium">{p.name}<span className="block text-[10px] text-muted-foreground">{p.channel} · {p.apiVersion ?? "—"}</span></span> },
    { key: "status", header: "Status", cell: p => <StatusBadge tone={tone(p.status)}>{p.status}</StatusBadge> },
    { key: "health", header: "Health", cell: p => <StatusBadge tone={tone(p.health)}>{p.health}</StatusBadge> },
    { key: "default", header: "Default sender", cell: p => <span className="font-mono text-xs">{p.defaultSender ?? "—"}</span> },
    { key: "usage", header: "Usage today", cell: p => <span className="text-xs tabular-nums">{(p.usedToday ?? 0).toLocaleString()} / {(p.dailyCap ?? 0).toLocaleString()}</span> },
    { key: "check", header: "Last check", sortValue: p => p.lastCheck, cell: p => <span className="text-xs">{relativeTime(p.lastCheck)}</span> },
    { key: "actions", header: "", cell: p => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => runTest(p)}><RefreshCw className="mr-1 h-3 w-3" />Test</Button>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setDrawer(p)}>Details</Button>
      </div>
    )},
  ];

  const senderCols: Column<typeof senders[number]>[] = [
    { key: "id", header: "Sender", cell: s => <span className="font-mono text-xs">{s.identity}</span> },
    { key: "ch", header: "Channel", cell: s => <Badge variant="outline" className="text-[9px]">{s.channel}</Badge> },
    { key: "prov", header: "Provider", cell: s => <span className="text-xs">{providers.find(p => p.id === s.providerId)?.name ?? s.providerId}</span> },
    { key: "st", header: "Status", cell: s => <StatusBadge tone={tone(s.status)}>{s.status}</StatusBadge> },
    { key: "def", header: "Default", cell: s => s.isDefault ? <Badge variant="secondary" className="text-[9px]">default</Badge> : <span className="text-xs text-muted-foreground">—</span> },
  ];

  return (
    <Page>
      <PageHeader title="Channel Providers & Senders" description="Connect email/SMS/WhatsApp/push providers, manage sender identities and credentials (vault-referenced)." icon={Server}
        actions={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-4 w-4" />Connect provider</Button>} />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Providers" value={String(providers.length)} />
          <MetricCard label="Healthy & connected" value={String(healthy)} tone={healthy === providers.filter(p=>p.status!=="disconnected").length ? "positive" : "warning"} />
          <MetricCard label="Senders" value={String(senders.length)} />
          <MetricCard label="Channels ready" value={String(new Set(providers.filter(p=>p.status==="connected").map(p=>p.channel)).size)} tone="info" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Channel:</span>
          {(["all", ...CHANNELS] as const).map(c => (
            <button key={c} type="button" onClick={() => setChFilter(c as any)} className={`rounded-full border px-2.5 py-1 text-xs ${chFilter===c?"border-primary bg-primary/10 text-primary":"text-muted-foreground"}`}>{c}</button>
          ))}
        </div>

        {filtered.length === 0 ? <EmptyState title="No providers for this channel" description="Connect a provider to enable sending." icon={Server} /> :
          <DataTable columns={cols} data={filtered} rowKey={p => p.id} searchableText={p => `${p.name} ${p.channel} ${p.defaultSender ?? ""}`} pageSize={8} />}

        <div className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold flex items-center gap-1.5"><Send className="h-4 w-4" />Sender identities</p>
          <DataTable columns={senderCols} data={senders} rowKey={s => s.id} pageSize={6} emptyTitle="No senders" />
        </div>
      </PageContent>

      <Sheet open={!!drawer} onOpenChange={o => !o && setDrawer(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {drawer && <>
            <SheetHeader><SheetTitle>{drawer.name}</SheetTitle><SheetDescription>{drawer.channel} · {drawer.apiVersion ?? "—"} · last check {relativeTime(drawer.lastCheck)}</SheetDescription></SheetHeader>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded border p-2"><span>Connected</span><Switch checked={drawer.status==="connected"} onCheckedChange={v=>{ toggleProvider(drawer.id,v); recordAudit({action:"channel.provider.toggle",entity:"provider",entityId:drawer.id,summary:`${v?"Connected":"Disconnected"} ${drawer.name}`,module:"marketing"}); toast({title:v?"Provider connected":"Provider disconnected"}); setDrawer({...drawer,status:v?"connected":"disconnected"}); refresh(); }} /></div>
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Credentials (vault reference)</p><p className="font-mono text-xs flex items-center gap-1"><KeyRound className="h-3 w-3" />{drawer.credsRef ?? "not set"}</p><p className="mt-1 text-[10px] text-muted-foreground">Secrets stored as vault references (no raw keys in UI).</p></div>
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Default sender</p><p className="font-mono text-xs">{drawer.defaultSender ?? "—"}</p></div>
              <div className="rounded border p-2"><p className="text-xs text-muted-foreground">Quota</p><p className="text-xs">{(drawer.usedToday??0).toLocaleString()} / {(drawer.dailyCap??0).toLocaleString()} today · ${drawer.costPerUnit ?? 0}/unit</p></div>
              <Button className="w-full" variant="outline" onClick={() => runTest(drawer)}><ShieldCheck className="mr-1 h-4 w-4" />Run health check</Button>
            </div>
          </>}
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Connect provider</DialogTitle><DialogDescription>Add a channel provider (dummy). Credentials are stored as vault references.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Provider name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="mt-1" placeholder="e.g. Mailgun" /></div>
            <div><Label className="text-xs">Channel</Label><Select value={form.channel} onValueChange={v=>setForm({...form,channel:v as Channel})}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{CHANNELS.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Credential vault reference</Label><Input value={form.credsRef} onChange={e=>setForm({...form,credsRef:e.target.value})} className="mt-1 font-mono text-xs" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button><Button disabled={!form.name.trim()} onClick={()=>{ toast({title:"Provider added",description:`${form.name} connected (simulated).`}); recordAudit({action:"channel.provider.add",entity:"provider",entityId:form.name,summary:`Added provider ${form.name} (${form.channel})`,module:"marketing"}); setAddOpen(false); }}>Connect</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
