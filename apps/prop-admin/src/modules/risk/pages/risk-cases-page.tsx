"use client";

/**
 * Risk Cases Queue + Detail — research items #17, #18.
 *
 * Dedicated operational queue for risk cases (distinct from the Breaches
 * table which only shows rule violations). Risk cases are investigation
 * workspaces with severity, signals, evidence, payout impact, and
 * actions (investigate/escalate/mark action required/resolve/dismiss).
 *
 * Master-detail layout: queue on the left, case detail on the right.
 *
 * All workflow mutations go through the session risk-case-store (PRD
 * §4.11 / §4.17): cases are seeded once per tenant and persist across
 * actions instead of rebuilding every render.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ShieldAlert, AlertTriangle, Eye, CheckCircle2, XCircle,
  User, FileText, DollarSign, ArrowRight, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { getTenantTraders } from "@/lib/platform/mock-data";
import {
  addRiskCaseNote,
  assignRiskCase,
  createRiskCase,
  dismissRiskCase,
  getRiskCases,
  resolveRiskCase,
  setRiskCaseStatus,
  useRiskCaseVersion,
  type RiskActionTaken,
  type RiskCase,
  type RiskSeverity,
} from "@/modules/risk/risk-case-store";

const sevTone = (s: RiskCase["severity"]) =>
  s === "critical" ? "danger" : s === "high" ? "warning" : s === "medium" ? "info" : "muted";

const statusTone = (s: RiskCase["status"]) =>
  s === "open" ? "danger" : s === "investigating" ? "warning" : s === "escalated" ? "danger" : s === "action-required" ? "warning" : s === "resolved" ? "success" : "muted";

const actionTakenLabel: Record<RiskActionTaken, string> = {
  warned: "Warned trader",
  account_closed: "Account closed",
  payout_blocked: "Payout blocked",
  none: "No action needed",
};

const REVIEWERS = ["Unassigned", "Sarah Chen", "Marcus Webb"];

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
  const { runtime, navigate, user } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useRiskCaseVersion(); // queue + KPIs + detail react to workflow actions

  const allCases = getRiskCases(tid);
  const [selectedId, setSelectedId] = useState<string | null>(allCases[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [note, setNote] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [actionTaken, setActionTaken] = useState<RiskActionTaken>("none");

  const selected = allCases.find((c) => c.id === selectedId) ?? null;
  const filtered = statusFilter === "all" ? allCases : allCases.filter((c) => c.status === statusFilter);
  const open = allCases.filter((c) => c.status === "open").length;
  const investigating = allCases.filter((c) => c.status === "investigating").length;
  const escalated = allCases.filter((c) => c.status === "escalated").length;
  const actionRequired = allCases.filter((c) => c.status === "action-required").length;
  const totalHoldAmount = allCases.filter((c) => c.payoutHold).reduce((s, c) => s + c.payoutHoldAmount, 0);

  const reviewers = user?.name && !REVIEWERS.includes(user.name) ? [...REVIEWERS, user.name] : REVIEWERS;

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <MetricCard label="Open" value={open} icon={AlertTriangle} tone={open > 0 ? "negative" : "positive"} />
          <MetricCard label="Investigating" value={investigating} icon={Eye} tone={investigating > 0 ? "warning" : "positive"} />
          <MetricCard label="Escalated" value={escalated} icon={ShieldAlert} tone={escalated > 0 ? "negative" : "positive"} />
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
              onRowClick={(c) => setSelectedId(c.id)}
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
                  <p className="text-xs text-muted-foreground">Opened {selected.opened}</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Reviewer assignment (PRD assigned_to) */}
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Assigned to</p>
                  <Select
                    value={selected.assignedTo}
                    onValueChange={(v) => {
                      assignRiskCase(tid, selected.id, v);
                      toast({ title: "Reviewer assigned", description: `${v} assigned to ${selected.id}.` });
                    }}
                  >
                    <SelectTrigger className="h-7 w-[160px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reviewers.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

                {/* Resolution (visible once resolved — PRD resolution + action taken) */}
                {selected.status === "resolved" && selected.resolution ? (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 p-2 dark:bg-emerald-950/20">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Resolution</p>
                    <p className="text-xs">{selected.resolution}</p>
                    {selected.actionTaken ? (
                      <p className="mt-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        Action taken: {actionTakenLabel[selected.actionTaken]}
                      </p>
                    ) : null}
                  </div>
                ) : selected.status === "dismissed" ? (
                  <div className="rounded-md border p-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Dismissed</p>
                    <p className="text-xs text-muted-foreground">Closed without further action.</p>
                  </div>
                ) : null}

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
                    addRiskCaseNote(tid, selected.id, note);
                    toast({ title: "Note added", description: `Note on ${selected.id} logged.` });
                    setNote("");
                  }}>Add note</Button>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t pt-2">
                  {selected.status !== "resolved" && selected.status !== "dismissed" && (
                    <>
                      {selected.status !== "investigating" && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setRiskCaseStatus(tid, selected.id, "investigating");
                          if (selected.assignedTo === "Unassigned" && user?.name) {
                            assignRiskCase(tid, selected.id, user.name);
                          }
                          toast({ title: "Investigation started", description: `${selected.id} is now under investigation.` });
                        }}>
                          <Eye className="mr-1 h-3 w-3" /> Investigate
                        </Button>
                      )}
                      {selected.status !== "escalated" && (
                        <Button size="sm" variant="outline" className="text-amber-700" onClick={() => {
                          setRiskCaseStatus(tid, selected.id, "escalated");
                          toast({ title: "Case escalated", description: `${selected.id} escalated to senior risk review.` });
                        }}>
                          <AlertTriangle className="mr-1 h-3 w-3" /> Escalate
                        </Button>
                      )}
                      {selected.status !== "action-required" && (
                        <Button size="sm" variant="outline" className="text-rose-700" onClick={() => {
                          setRiskCaseStatus(tid, selected.id, "action-required");
                          toast({ title: "Action required", description: `${selected.id} marked as action required.` });
                        }}>
                          <AlertTriangle className="mr-1 h-3 w-3" /> Mark action required
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-emerald-700" onClick={() => setResolveOpen(true)}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Resolve
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-muted-foreground">
                            <XCircle className="mr-1 h-3 w-3" /> Dismiss
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Dismiss {selected.id}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Close “{selected.signal}” for {selected.traderName} without further action.
                              The case stays visible under the Dismissed filter and the closure is logged.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              dismissRiskCase(tid, selected.id);
                              toast({ title: "Case dismissed", description: `${selected.id} closed without action.` });
                            }}>
                              Dismiss case
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* New case dialog */}
        <NewCaseDialog
          open={newOpen}
          onOpenChange={setNewOpen}
          tid={tid}
          onCreated={(c) => setSelectedId(c.id)}
        />

        {/* Resolve dialog — resolution text + action-taken selector (PRD §4.5) */}
        <AlertDialog
          open={resolveOpen}
          onOpenChange={(o) => {
            setResolveOpen(o);
            if (!o) {
              setResolution("");
              setActionTaken("none");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resolve {selected?.id}?</AlertDialogTitle>
              <AlertDialogDescription>
                Record the outcome of this investigation. Resolution text and action taken are
                stored on the case for the audit trail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="case-resolution" className="text-xs text-muted-foreground">
                  Resolution (required)
                </Label>
                <Textarea
                  id="case-resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="What did the investigation conclude?"
                  className="min-h-[72px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Action taken</Label>
                <Select value={actionTaken} onValueChange={(v) => setActionTaken(v as RiskActionTaken)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No action needed</SelectItem>
                    <SelectItem value="warned">Warned trader</SelectItem>
                    <SelectItem value="account_closed">Account closed</SelectItem>
                    <SelectItem value="payout_blocked">Payout blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!resolution.trim()}
                onClick={() => {
                  if (!selected) return;
                  resolveRiskCase(tid, selected.id, resolution.trim(), actionTaken);
                  toast({
                    title: "Case resolved",
                    description: `${selected.id} resolved — ${actionTakenLabel[actionTaken]}.`,
                  });
                }}
              >
                Resolve case
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageContent>
    </Page>
  );
}
