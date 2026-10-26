"use client";

/**
 * Incident Control Center — research item #13.
 *
 * Lists incidents with scope, affected tenants, affected services, started,
 * current impact, owner, status, related alerts, runbook.
 *
 * Actions: open incident, assign operator, add note, escalate, resolve.
 */

import { useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle2, Clock, User, ShieldAlert, BookOpen, ArrowRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { recordAudit, useConsoleStore, type OperatorRef } from "@/lib/platform/console-store";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { usePlatform } from "@/lib/platform/platform-context";

interface Incident {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "resolved";
  affectedTenants: string[];
  affectedServices: string[];
  started: string;
  currentImpact: string;
  owner: string;
  runbook: string;
  relatedAlerts: string[];
}

const incidents: Incident[] = [
  {
    id: "INC-001",
    title: "MT5 Bridge latency degradation",
    severity: "high",
    affectedTenants: ["Alpha Capital", "Beta Trading"],
    affectedServices: ["MT5 Bridge", "Account Sync"],
    started: "12m ago",
    currentImpact: "Account sync delayed by 30s. Trading unaffected.",
    owner: "Sarah Chen",
    runbook: "RB-MT5-001",
    relatedAlerts: ["ALT-101 (MT5 latency >200ms)", "ALT-104 (Sync job failures: 3)"],
  },
  {
    id: "INC-002",
    title: "Postmark email delivery slow",
    severity: "medium",
    affectedTenants: ["All tenants"],
    affectedServices: ["Notification Service"],
    started: "45m ago",
    currentImpact: "Email delivery latency 680ms (normal <200ms). No emails lost.",
    owner: "Marcus Webb",
    runbook: "RB-POSTMARK-001",
    relatedAlerts: ["ALT-202 (Postmark latency >500ms)"],
  },
  {
    id: "INC-003",
    title: "Payment provider timeout (resolved)",
    severity: "resolved",
    affectedTenants: ["Gamma Futures"],
    affectedServices: ["Payment Processor"],
    started: "3h ago",
    currentImpact: "Resolved — provider restored after restart. Monitoring for recurrence.",
    owner: "Priya Nair",
    runbook: "RB-PAY-001",
    relatedAlerts: ["ALT-301 (NOWPayments timeout)"],
  },
];

const severityTone = (s: Incident["severity"]) =>
  s === "critical" ? "danger" : s === "high" ? "warning" : s === "medium" ? "info" : "muted";

export function IncidentCenterPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; local
  // interactive state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { user } = usePlatform();
  const consoleStore = useConsoleStore();
  const operator: OperatorRef = { id: user.id, name: user.name };

  const [selected, setSelected] = useState<Incident | null>(incidents[0]);
  const [note, setNote] = useState("");
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  // Per-incident operator overrides layered over the seed data.
  const [overrides, setOverrides] = useState<Record<string, Partial<Incident>>>({});

  const effective: Incident | null = selected
    ? { ...selected, ...overrides[selected.id] }
    : null;

  // Escalation ladder (docs/21 CON-15 incident ladder).
  const LADDER: Array<Incident["severity"]> = ["medium", "high", "critical"];

  const severityOf = (i: Incident): Incident["severity"] =>
    overrides[i.id]?.severity ?? i.severity;

  const applyOverride = (id: string, patch: Partial<Incident>) =>
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...patch } }));

  const handleAssign = () => {
    if (!effective) return;
    applyOverride(effective.id, { owner: user.name });
    recordAudit({
      actor: user.name,
      action: "console.operator_action",
      target: effective.id,
      severity: "info",
      detail: `Assigned incident ${effective.id} to ${user.name}`,
    });
    toast({ title: "Operator assigned", description: `${effective.id} is now owned by ${user.name}.` });
  };

  const handleEscalateExecute = (reason: string) => {
    if (!effective) return;
    const idx = LADDER.indexOf(effective.severity);
    const next = LADDER[Math.min(idx + 1, LADDER.length - 1)];
    applyOverride(effective.id, { severity: next });
    recordAudit({
      actor: user.name,
      action: "console.escalate_incident",
      target: effective.id,
      severity: "critical",
      detail: `Escalated ${effective.id} to ${next} — ${reason}`,
    });
    toast({ title: "Incident escalated", description: `${effective.id} raised to ${next}. Reason recorded.`, variant: "destructive" });
  };

  const handleResolveExecute = (reason: string) => {
    if (!effective) return;
    applyOverride(effective.id, { severity: "resolved" });
    recordAudit({
      actor: user.name,
      action: "console.resolve_incident",
      target: effective.id,
      severity: "info",
      detail: `Resolved ${effective.id} — post-incident note: ${reason}`,
    });
    toast({ title: "Incident resolved", description: `${effective.id} resolved. Post-incident note recorded (CON-28).` });
  };

  const handleAddNote = () => {
    if (!effective || !note.trim()) return;
    recordAudit({
      actor: user.name,
      action: "console.operator_action",
      target: effective.id,
      severity: "info",
      detail: `Note on ${effective.id}: ${note.trim()}`,
    });
    toast({ title: "Note added", description: `Note on ${effective.id} logged to the audit trail.` });
    setNote("");
  };

  const countBy = (sev: Incident["severity"]) =>
    incidents.filter((i) => severityOf(i) === sev).length;
  const critical = countBy("critical");
  const high = countBy("high");
  const medium = countBy("medium");
  const resolved = countBy("resolved");

  return (
    <Page>
      <PageHeader
        title="Incident Control Center"
        description="Active and resolved incidents. Each item links to the affected service and runbook."
        icon={ShieldAlert}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading incidents…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Critical" value={critical} icon={AlertTriangle} tone={critical > 0 ? "negative" : "positive"} />
          <MetricCard label="High" value={high} icon={AlertTriangle} tone={high > 0 ? "warning" : "positive"} />
          <MetricCard label="Medium" value={medium} icon={Clock} tone={medium > 0 ? "warning" : "positive"} />
          <MetricCard label="Resolved (24h)" value={resolved} icon={CheckCircle2} tone="positive" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* Incident list */}
          <div className="space-y-2">
            {incidents.map((inc) => {
              const sev = severityOf(inc);
              return (
                <Card
                  key={inc.id}
                  className={cn(
                    "cursor-pointer transition hover:shadow-md",
                    selected?.id === inc.id && "ring-2 ring-primary",
                    sev === "critical" && "border-rose-500/40",
                    sev === "high" && "border-amber-500/40",
                  )}
                  onClick={() => setSelected(inc)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={severityTone(sev)}>{sev}</StatusBadge>
                      <Badge variant="outline" className="text-[10px]">{inc.id}</Badge>
                      <span className="text-[10px] text-muted-foreground">{inc.started}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium">{inc.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{inc.currentImpact}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Incident detail */}
          {selected && effective && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{effective.title}</h3>
                    <StatusBadge tone={severityTone(effective.severity)}>{effective.severity}</StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">{effective.id} · Started {effective.started}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Affected tenants</p>
                    <p className="font-medium">{effective.affectedTenants.join(", ")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Affected services</p>
                    <p className="font-medium">{effective.affectedServices.join(", ")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</p>
                    <p className="flex items-center gap-1 font-medium"><User className="h-3 w-3" />{effective.owner}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Runbook</p>
                    <p className="flex items-center gap-1 font-mono"><BookOpen className="h-3 w-3" />{effective.runbook}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current impact</p>
                  <p className="text-xs">{effective.currentImpact}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Related alerts</p>
                  <ul className="space-y-0.5">
                    {effective.relatedAlerts.map((a) => (
                      <li key={a} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />{a}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Operator actions */}
                <div className="border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="default" onClick={handleAssign}>
                      <User className="mr-1 h-3 w-3" /> Assign to me
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEscalateOpen(true)}>
                      <AlertTriangle className="mr-1 h-3 w-3" /> Escalate
                    </Button>
                    {effective.severity !== "resolved" && (
                      <Button size="sm" variant="outline" className="text-emerald-700 hover:text-emerald-700" onClick={() => setResolveOpen(true)}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                      </Button>
                    )}
                  </div>
                </div>

                {/* Add note */}
                <div>
                  <Textarea
                    placeholder="Add an incident note (visible to all operators, audited)…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    disabled={!note.trim()}
                    onClick={handleAddNote}
                  >
                    <MessageSquare className="mr-1 h-3 w-3" /> Add note
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Escalate — 2FA + reason, audited as console.escalate_incident */}
        {effective && (
          <SensitiveActionDialog
            open={escalateOpen}
            onOpenChange={setEscalateOpen}
            actionKey="console.escalate_incident"
            title={`Escalate ${effective.id}`}
            consequence={`Raises this incident one rung on the ladder to ${LADDER[Math.min(LADDER.indexOf(effective.severity) + 1, LADDER.length - 1)]}. All operators and the on-call are paged.`}
            blastRadius={[
              "Pages the on-call operator immediately",
              "Notifies every console operator via the ops channel",
              "Adds the incident to the criticals rail on the overview",
            ]}
            detail={`Runbook ${effective.runbook} · ${effective.affectedServices.join(", ")}`}
            requireReason
            onExecute={handleEscalateExecute}
          />
        )}

        {/* Resolve — 2FA + mandatory post-incident note (CON-28) */}
        {effective && (
          <SensitiveActionDialog
            open={resolveOpen}
            onOpenChange={setResolveOpen}
            actionKey="console.resolve_incident"
            title={`Resolve ${effective.id}`}
            consequence="Marks the incident resolved and files a post-incident note to the audit trail. Monitoring stays on for recurrence."
            blastRadius={[
              "Removes the incident from the active rail",
              "Files a post-incident note (required — CON-28)",
              "Alerts linked to this incident stop firing",
            ]}
            detail={`Runbook ${effective.runbook} · ${effective.affectedServices.join(", ")}`}
            requireReason
            onExecute={handleResolveExecute}
          />
        )}
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
