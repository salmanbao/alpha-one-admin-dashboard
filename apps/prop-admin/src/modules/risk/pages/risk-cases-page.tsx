"use client";

/**
 * Risk Cases Queue — research items #17, #18.
 *
 * Dedicated operational queue for risk cases (distinct from the Breaches
 * table which only shows rule violations). Risk cases are investigation
 * workspaces with severity, signals, evidence, payout impact, and
 * actions (investigate/escalate/mark action required/resolve/dismiss).
 *
 * List-only view: the case detail (badges, assignment, notes, workflow
 * actions) lives in modules/risk/pages/risk-case-detail-page.tsx and
 * opens via the detail-overlay pattern — row click → sheet
 * (?panel=risk-case-detail&id=…), 3-dot menu → new tab.
 *
 * All workflow mutations go through the session risk-case-store (PRD
 * §4.11 / §4.17): cases are seeded once per tenant and persist across
 * actions instead of rebuilding every render.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useDetailOverlay } from "@/components/platform/detail-overlay";
import { openViewInNewTab } from "@/lib/platform/view-links";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/platform/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ShieldAlert, AlertTriangle, Eye, DollarSign, Plus,
  ExternalLink, MoreVertical,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getTenantTraders } from "@/lib/platform/mock-data";
import {
  createRiskCase,
  getRiskCases,
  useRiskCaseVersion,
  type RiskCase,
  type RiskSeverity,
} from "@/modules/risk/risk-case-store";

export const sevTone = (s: RiskCase["severity"]) =>
  s === "critical" ? "danger" : s === "high" ? "warning" : s === "medium" ? "info" : "muted";

export const statusTone = (s: RiskCase["status"]) =>
  s === "open" ? "danger" : s === "investigating" ? "warning" : s === "escalated" ? "danger" : s === "action-required" ? "warning" : s === "resolved" ? "success" : "muted";

/* ------------------------------------------------------------------ */
/* New case dialog                                                     */
/* ------------------------------------------------------------------ */

function NewCaseDialog({
  open,
  onOpenChange,
  tid,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tid: string;
  onCreated: (c: RiskCase) => void;
}) {
  const traders = getTenantTraders(tid);
  const [severity, setSeverity] = useState<RiskSeverity>("medium");
  const [traderId, setTraderId] = useState("");
  const [signal, setSignal] = useState("");
  const [detail, setDetail] = useState("");

  const reset = () => {
    setSeverity("medium");
    setTraderId("");
    setSignal("");
    setDetail("");
  };
  const valid = signal.trim().length > 0 && traderId.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open new risk case</DialogTitle>
          <DialogDescription>
            Manually open an investigation workspace for a trader signal (PRD POST /risk/cases).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rc-trader" className="text-xs">Trader *</Label>
            <Select value={traderId} onValueChange={setTraderId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a trader…" />
              </SelectTrigger>
              <SelectContent>
                {traders.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rc-severity" className="text-xs">Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as RiskSeverity)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["critical", "high", "medium", "low"] as RiskSeverity[]).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rc-signal" className="text-xs">Signal *</Label>
              <Input
                id="rc-signal"
                value={signal}
                onChange={(e) => setSignal(e.target.value)}
                placeholder="e.g. Velocity withdrawal pattern"
                maxLength={80}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rc-detail" className="text-xs">Signal detail</Label>
            <Textarea
              id="rc-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="What was observed? Links to accounts, trades or payouts."
              className="min-h-[72px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              const t = traders.find((x) => x.id === traderId);
              if (!t) return;
              const c = createRiskCase(tid, {
                severity,
                traderId: t.id,
                traderName: t.name,
                signal: signal.trim(),
                signalDetail: detail.trim() || "Manually opened for review.",
              });
              toast({ title: "Risk case opened", description: `${c.id} — ${c.signal}` });
              onCreated(c);
              onOpenChange(false);
            }}
          >
            Open case
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function RiskCasesPage() {
  const { runtime, navigate } = usePlatform();
  const { openPanel } = useDetailOverlay();
  const tid = runtime.tenant?.id ?? "platform";
  useRiskCaseVersion(); // queue + KPIs react to workflow actions

  const allCases = getRiskCases(tid);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);

  const filtered = statusFilter === "all" ? allCases : allCases.filter((c) => c.status === statusFilter);
  const open = allCases.filter((c) => c.status === "open").length;
  const investigating = allCases.filter((c) => c.status === "investigating").length;
  const escalated = allCases.filter((c) => c.status === "escalated").length;
  const actionRequired = allCases.filter((c) => c.status === "action-required").length;
  const totalHoldAmount = allCases.filter((c) => c.payoutHold).reduce((s, c) => s + c.payoutHoldAmount, 0);

  const onView = (c: RiskCase) => openPanel("risk-case-detail", { id: c.id });

  const columns: Column<RiskCase>[] = [
    { key: "severity", header: "Severity", cell: (c) => <StatusBadge tone={sevTone(c.severity)}>{c.severity}</StatusBadge>, sortValue: (c) => c.severity, width: "100px" },
    { key: "traderName", header: "Trader", cell: (c) => (
      <button onClick={(e) => { e.stopPropagation(); navigate("trader-detail", { id: c.traderId }); }} className="font-medium text-primary hover:underline">
        {c.traderName}
      </button>
    ), sortValue: (c) => c.traderName },
    { key: "signal", header: "Signal", cell: (c) => <span className="text-xs">{c.signal}</span>, sortValue: (c) => c.signal },
    { key: "exposure", header: "Exposure", cell: (c) => <span className="text-xs tabular-nums">${c.currentExposure.toLocaleString()}</span>, sortValue: (c) => c.currentExposure, numeric: true },
    { key: "payoutHold", header: "Payout Hold", cell: (c) => c.payoutHold ? <Badge variant="outline" className="border-amber-500/30 text-amber-700 text-[10px] dark:text-amber-400">${c.payoutHoldAmount.toLocaleString()}</Badge> : <span className="text-xs text-muted-foreground">—</span> },
    { key: "age", header: "Age", cell: (c) => <span className="text-xs text-muted-foreground tabular-nums">{c.age}</span>, sortValue: (c) => c.age },
    { key: "status", header: "Status", cell: (c) => <StatusBadge tone={statusTone(c.status)}>{c.status}</StatusBadge>, sortValue: (c) => c.status },
    {
      // Pattern pair: primary click (row) → overlay detail; the menu offers
      // the same detail in the sheet (View) or a new browser tab (New tab).
      key: "actions",
      header: "",
      cell: (c) => (
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Actions for risk case ${c.id}`}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Risk case actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onView(c)}>
                <Eye className="h-3.5 w-3.5" /> View case
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openViewInNewTab("risk-case-detail", { id: c.id })}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      width: "60px",
    },
  ];

  return (
    <Page>
      <PageHeader title="Risk Cases" description="Operational risk investigation queue. Investigate, decide, and act on risk signals." icon={ShieldAlert} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <MetricCard label="Open" value={open} icon={AlertTriangle} tone={open > 0 ? "negative" : "positive"} />
          <MetricCard label="Investigating" value={investigating} icon={Eye} tone={investigating > 0 ? "warning" : "positive"} />
          <MetricCard label="Escalated" value={escalated} icon={ShieldAlert} tone={escalated > 0 ? "negative" : "positive"} />
          <MetricCard label="Action Required" value={actionRequired} icon={AlertTriangle} tone={actionRequired > 0 ? "warning" : "positive"} />
          <MetricCard label="Payouts Held" value={allCases.filter((c) => c.payoutHold).length} icon={DollarSign} tone="warning" />
          <MetricCard label="Hold Amount" value={`$${totalHoldAmount.toLocaleString()}`} icon={DollarSign} tone="warning" />
        </div>

        {/* Queue */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="escalated">Escalated</option>
              <option value="action-required">Action Required</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
              <Plus className="mr-1 h-3 w-3" /> New case
            </Button>
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(c) => c.id}
            onRowClick={(c) => onView(c)}
            searchableText={(c) => `${c.traderName} ${c.signal} ${c.id}`}
            searchPlaceholder="Search risk cases…"
            pageSize={10}
            emptyTitle="No risk cases"
            emptyDescription="Risk cases will appear here when signals are detected."
          />
        </div>

        {/* New case dialog — onCreated opens the detail overlay for the new case */}
        <NewCaseDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          tid={tid}
          onCreated={(c) => onView(c)}
        />
      </PageContent>
    </Page>
  );
}
