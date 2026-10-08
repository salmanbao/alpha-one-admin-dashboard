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
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  ShieldAlert,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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
  const [selected, setSelected] = useState<Incident | null>(incidents[0]);
  const [note, setNote] = useState("");

  const critical = incidents.filter((i) => i.severity === "critical").length;
  const high = incidents.filter((i) => i.severity === "high").length;
  const medium = incidents.filter((i) => i.severity === "medium").length;
  const resolved = incidents.filter((i) => i.severity === "resolved").length;

  return (
    <Page>
      <PageHeader
        title="Incident Control Center"
        description="Active and resolved incidents. Each item links to the affected service and runbook."
        icon={ShieldAlert}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Critical" value={critical} icon={AlertTriangle} tone={critical > 0 ? "negative" : "positive"} />
          <MetricCard label="High" value={high} icon={AlertTriangle} tone={high > 0 ? "warning" : "positive"} />
          <MetricCard label="Medium" value={medium} icon={Clock} tone={medium > 0 ? "warning" : "positive"} />
          <MetricCard label="Resolved (24h)" value={resolved} icon={CheckCircle2} tone="positive" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* Incident list */}
          <div className="space-y-2">
            {incidents.map((inc) => (
              <Card
                key={inc.id}
                className={cn(
                  "cursor-pointer transition hover:shadow-md",
                  selected?.id === inc.id && "ring-2 ring-primary",
                  inc.severity === "critical" && "border-rose-500/40",
                  inc.severity === "high" && "border-amber-500/40",
                )}
                onClick={() => setSelected(inc)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={severityTone(inc.severity)}>{inc.severity}</StatusBadge>
                    <Badge variant="outline" className="text-[10px]">{inc.id}</Badge>
                    <span className="text-[10px] text-muted-foreground">{inc.started}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{inc.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{inc.currentImpact}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Incident detail */}
          {selected && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{selected.title}</h3>
                    <StatusBadge tone={severityTone(selected.severity)}>{selected.severity}</StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">{selected.id} · Started {selected.started}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Affected tenants</p>
                    <p className="font-medium">{selected.affectedTenants.join(", ")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Affected services</p>
                    <p className="font-medium">{selected.affectedServices.join(", ")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</p>
                    <p className="flex items-center gap-1 font-medium"><User className="h-3 w-3" />{selected.owner}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Runbook</p>
                    <p className="flex items-center gap-1 font-mono"><BookOpen className="h-3 w-3" />{selected.runbook}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current impact</p>
                  <p className="text-xs">{selected.currentImpact}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Related alerts</p>
                  <ul className="space-y-0.5">
                    {selected.relatedAlerts.map((a) => (
                      <li key={a} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3" />{a}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Operator actions */}
                <div className="border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="default">
                      <User className="mr-1 h-3 w-3" /> Assign operator
                    </Button>
                    <Button size="sm" variant="outline">
                      <AlertTriangle className="mr-1 h-3 w-3" /> Escalate
                    </Button>
                    {selected.severity !== "resolved" && (
                      <Button size="sm" variant="outline" className="text-emerald-700 hover:text-emerald-700">
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
                    onClick={() => {
                      toast({ title: "Note added", description: `Note on ${selected.id} logged to the audit trail.` });
                      setNote("");
                    }}
                  >
                    Add note
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
