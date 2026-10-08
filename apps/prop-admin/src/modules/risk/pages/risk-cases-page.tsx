"use client";

/**
 * Risk Cases Queue + Detail — research items #17, #18.
 *
 * Dedicated operational queue for risk cases (distinct from the Breaches
 * table which only shows rule violations). Risk cases are investigation
 * workspaces with severity, signals, evidence, payout impact, and
 * actions (investigate/escalate/resolve/dismiss).
 *
 * Master-detail layout: queue on the left, case detail on the right.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/platform/data-table";
import {
  ShieldAlert, AlertTriangle, Eye, CheckCircle2, XCircle, Clock,
  User, FileText, DollarSign, Activity, ArrowRight, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getTenantTraders, getTenantAccounts, getTenantBreaches, getTenantPayouts, hashStr } from "@/lib/platform/mock-data";

interface RiskCase {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "action-required" | "resolved" | "dismissed";
  traderId: string;
  traderName: string;
  accountIds: string[];
  signal: string;
  signalDetail: string;
  currentExposure: number;
  payoutHold: boolean;
  payoutHoldAmount: number;
  opened: string;
  age: string;
  assignedTo: string;
  evidence: string[];
  notes: string[];
}

function buildRiskCases(tid: string): RiskCase[] {
  const traders = getTenantTraders(tid);
  const breaches = getTenantBreaches(tid);
  const payouts = getTenantPayouts(tid);
  const cases: RiskCase[] = [];

  // Case 1: Drawdown anomaly from breach data
  if (breaches.length > 0) {
    const b = breaches[0];
    cases.push({
      id: `RC-${hashStr(tid + "rc1") % 9000 + 1000}`,
      severity: "critical",
      status: "open",
      traderId: b.traderId,
      traderName: b.traderName,
      accountIds: [b.accountId],
      signal: "Drawdown anomaly",
      signalDetail: `Account breached ${b.rule} — ${b.severity} severity. Triggered ${new Date(b.triggeredAt).toLocaleDateString()}.`,
      currentExposure: 25000,
      payoutHold: true,
      payoutHoldAmount: 4200,
      opened: "2h ago",
      age: "2h",
      assignedTo: "Unassigned",
      evidence: [
        `${b.rule} triggered on ${b.accountId}`,
        `Severity: ${b.severity}`,
        `Status: ${b.status}`,
        `Triggered at: ${new Date(b.triggeredAt).toLocaleString()}`,
      ],
      notes: [],
    });
  }

  // Case 2: Trading pattern anomaly
  if (traders.length > 3) {
    const t = traders[3];
    cases.push({
      id: `RC-${hashStr(tid + "rc2") % 9000 + 1000}`,
      severity: "high",
      status: "investigating",
      traderId: t.id,
      traderName: t.name,
      accountIds: [`acct-${t.id}`],
      signal: "Trading pattern anomaly",
      signalDetail: "Correlation with another trader's positions exceeds 87%. Possible copy-trading or shared strategy.",
      currentExposure: 15000,
      payoutHold: false,
      payoutHoldAmount: 0,
      opened: "6h ago",
      age: "6h",
      assignedTo: "Sarah Chen",
      evidence: [
        "Position correlation 87% with trader TRD-10294",
        "Same symbols: EURUSD, XAUUSD, SP500",
        "Entry times within 30s of each other",
        "Account age: 45 days",
      ],
      notes: ["Investigating IP/device overlap — no match found yet."],
    });
  }

  // Case 3: Multiple account behavior
  if (traders.length > 5) {
    const t = traders[5];
    cases.push({
      id: `RC-${hashStr(tid + "rc3") % 9000 + 1000}`,
      severity: "medium",
      status: "action-required",
      traderId: t.id,
      traderName: t.name,
      accountIds: [`acct-${t.id}-1`, `acct-${t.id}-2`],
      signal: "Multiple account behavior",
      signalDetail: "Trader has 2 funded accounts with identical trading patterns. Possible account farming.",
      currentExposure: 50000,
      payoutHold: true,
      payoutHoldAmount: 8200,
      opened: "1d ago",
      age: "1d",
      assignedTo: "Marcus Webb",
      evidence: [
        "2 funded accounts on same broker (MT5)",
        "Same leverage and position sizing",
        "Entries correlate 94%",
        "Both accounts passed Phase 2 within 2 days of each other",
      ],
      notes: ["Awaiting compliance review.", "Payout held pending investigation."],
    });
  }

  // Case 4: Suspicious payout pattern
  if (payouts.length > 0) {
    const p = payouts[0];
    cases.push({
      id: `RC-${hashStr(tid + "rc4") % 9000 + 1000}`,
      severity: "high",
      status: "open",
      traderId: p.traderId,
      traderName: p.traderName,
      accountIds: [],
      signal: "Suspicious payout pattern",
      signalDetail: `Payout request of $${p.amount.toLocaleString()} shortly after funding. Profit split ${p.profitSplit}%. Unusual withdrawal velocity.`,
      currentExposure: p.amount,
      payoutHold: true,
      payoutHoldAmount: p.amount,
      opened: "3h ago",
      age: "3h",
      assignedTo: "Unassigned",
      evidence: [
        `Payout requested ${p.amount} ${p.currency} via ${p.method}`,
        `Account funded 2 days ago`,
        `Profit split: ${p.profitSplit}%`,
        `No prior payout history`,
      ],
      notes: [],
    });
  }

  // Case 5: Resolved
  cases.push({
    id: `RC-${hashStr(tid + "rc5") % 9000 + 1000}`,
    severity: "low",
    status: "resolved",
    traderId: traders[0]?.id ?? "unknown",
    traderName: traders[0]?.name ?? "Unknown",
    accountIds: [],
    signal: "False positive — device cluster",
    signalDetail: "Device fingerprint matched across 2 accounts — confirmed to be same trader with legitimate multi-device setup.",
    currentExposure: 0,
    payoutHold: false,
    payoutHoldAmount: 0,
    opened: "3d ago",
    age: "3d",
    assignedTo: "Sarah Chen",
    evidence: ["Device fingerprint match confirmed", "Same trader, different devices (desktop + mobile)", "IP addresses from same household"],
    notes: ["False positive confirmed. No action needed."],
  });

  return cases;
}

const sevTone = (s: RiskCase["severity"]) =>
  s === "critical" ? "danger" : s === "high" ? "warning" : s === "medium" ? "info" : "muted";

const statusTone = (s: RiskCase["status"]) =>
  s === "open" ? "danger" : s === "investigating" ? "warning" : s === "action-required" ? "warning" : s === "resolved" ? "success" : "muted";

export function RiskCasesPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const allCases = buildRiskCases(tid);
  const [selected, setSelected] = useState<RiskCase | null>(allCases[0] ?? null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [note, setNote] = useState("");

  const filtered = statusFilter === "all" ? allCases : allCases.filter((c) => c.status === statusFilter);
  const open = allCases.filter((c) => c.status === "open").length;
  const investigating = allCases.filter((c) => c.status === "investigating").length;
  const actionRequired = allCases.filter((c) => c.status === "action-required").length;
  const totalHoldAmount = allCases.filter((c) => c.payoutHold).reduce((s, c) => s + c.payoutHoldAmount, 0);

  const columns: Column<RiskCase>[] = [
    { key: "severity", header: "Severity", cell: (c) => <StatusBadge tone={sevTone(c.severity)}>{c.severity}</StatusBadge>, sortValue: (c) => c.severity, width: "100px" },
    { key: "traderName", header: "Trader", cell: (c) => (
      <button onClick={() => navigate("trader-detail", { id: c.traderId })} className="font-medium text-primary hover:underline">
        {c.traderName}
      </button>
    ), sortValue: (c) => c.traderName },
    { key: "signal", header: "Signal", cell: (c) => <span className="text-xs">{c.signal}</span>, sortValue: (c) => c.signal },
    { key: "exposure", header: "Exposure", cell: (c) => <span className="text-xs tabular-nums">${c.currentExposure.toLocaleString()}</span>, sortValue: (c) => c.currentExposure, numeric: true },
    { key: "payoutHold", header: "Payout Hold", cell: (c) => c.payoutHold ? <Badge variant="outline" className="border-amber-500/30 text-amber-700 text-[10px] dark:text-amber-400">${c.payoutHoldAmount.toLocaleString()}</Badge> : <span className="text-xs text-muted-foreground">—</span> },
    { key: "age", header: "Age", cell: (c) => <span className="text-xs text-muted-foreground tabular-nums">{c.age}</span>, sortValue: (c) => c.age },
    { key: "status", header: "Status", cell: (c) => <StatusBadge tone={statusTone(c.status)}>{c.status}</StatusBadge>, sortValue: (c) => c.status },
  ];

  return (
    <Page>
      <PageHeader title="Risk Cases" description="Operational risk investigation queue. Investigate, decide, and act on risk signals." icon={ShieldAlert} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Open" value={open} icon={AlertTriangle} tone={open > 0 ? "negative" : "positive"} />
          <MetricCard label="Investigating" value={investigating} icon={Eye} tone={investigating > 0 ? "warning" : "positive"} />
          <MetricCard label="Action Required" value={actionRequired} icon={AlertTriangle} tone={actionRequired > 0 ? "warning" : "positive"} />
          <MetricCard label="Payouts Held" value={allCases.filter((c) => c.payoutHold).length} icon={DollarSign} tone="warning" />
          <MetricCard label="Hold Amount" value={`$${totalHoldAmount.toLocaleString()}`} icon={DollarSign} tone="warning" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          {/* Queue */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="action-required">Action Required</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> New case</Button>
            </div>
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(c) => c.id}
              onRowClick={(c) => setSelected(c)}
              searchableText={(c) => `${c.traderName} ${c.signal} ${c.id}`}
              searchPlaceholder="Search risk cases…"
              pageSize={10}
              emptyTitle="No risk cases"
              emptyDescription="Risk cases will appear here when signals are detected."
            />
          </div>

          {/* Case Detail */}
          {selected && (
            <Card className={cn(selected.severity === "critical" && "border-rose-500/40", selected.severity === "high" && "border-amber-500/40")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={sevTone(selected.severity)}>{selected.severity}</StatusBadge>
                    <StatusBadge tone={statusTone(selected.status)}>{selected.status}</StatusBadge>
                    <Badge variant="outline" className="text-[10px] font-mono">{selected.id}</Badge>
                  </div>
                  <p className="mt-1 text-sm font-semibold">{selected.signal}</p>
                  <p className="text-xs text-muted-foreground">Opened {selected.opened} · Assigned to {selected.assignedTo}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Trader */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Trader</p>
                    <button onClick={() => navigate("trader-detail", { id: selected.traderId })} className="flex items-center gap-1 font-medium text-primary hover:underline">
                      <User className="h-3 w-3" />{selected.traderName}
                    </button>
                  </div>
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Accounts</p>
                    <p className="font-medium">{selected.accountIds.length > 0 ? selected.accountIds.join(", ") : "—"}</p>
                  </div>
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Exposure</p>
                    <p className="font-medium tabular-nums">${selected.currentExposure.toLocaleString()}</p>
                  </div>
                  <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payout hold</p>
                    {selected.payoutHold ? <Badge variant="outline" className="border-amber-500/30 text-amber-700 text-[10px] dark:text-amber-400">${selected.payoutHoldAmount.toLocaleString()} held</Badge> : <span className="text-muted-foreground">None</span>}
                  </div>
                </div>

                {/* Signal detail */}
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Signal</p>
                  <p className="text-xs">{selected.signalDetail}</p>
                </div>

                {/* Evidence */}
                <div>
                  <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground"><FileText className="h-3 w-3" />Evidence</p>
                  <ul className="space-y-0.5">
                    {selected.evidence.map((e, i) => (
                      <li key={i} className="flex items-start gap-1 text-[11px] text-muted-foreground">
                        <ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0" />{e}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Notes */}
                {selected.notes.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Internal notes</p>
                    <div className="space-y-1">
                      {selected.notes.map((n, i) => (
                        <div key={i} className="rounded-md border bg-muted/30 p-2 text-[11px]">{n}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add note */}
                <div>
                  <Textarea placeholder="Add internal note…" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="text-xs" />
                  <Button size="sm" variant="outline" className="mt-1" disabled={!note.trim()} onClick={() => {
                    toast({ title: "Note added", description: `Note on ${selected.id} logged.` });
                    setNote("");
                  }}>Add note</Button>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t pt-2">
                  {selected.status !== "resolved" && selected.status !== "dismissed" && (
                    <>
                      <Button size="sm" variant="outline"><Eye className="mr-1 h-3 w-3" /> Investigate</Button>
                      <Button size="sm" variant="outline" className="text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" /> Escalate</Button>
                      {selected.status !== "action-required" && (
                        <Button size="sm" variant="outline" className="text-rose-700"><AlertTriangle className="mr-1 h-3 w-3" /> Mark action required</Button>
                      )}
                      <Button size="sm" variant="outline" className="text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" /> Resolve</Button>
                      <Button size="sm" variant="ghost" className="text-muted-foreground"><XCircle className="mr-1 h-3 w-3" /> Dismiss</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
