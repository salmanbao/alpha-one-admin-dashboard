"use client";
/**
 * R3-05 — Ad Budget Approvals (four-eyes queue for ad-spend caps).
 *
 * Replaces "no raise/approve path" on ad spend with the payout-style
 * dual-control workflow:
 *
 *  • Approval queue — budget-change requests (ad account, campaign,
 *    current → requested daily/monthly cap, requester, reason, effective
 *    date) with a live SLA clock (48h), reviewer comments, approve/reject.
 *  • AC-1 — raises above the threshold require marketing.budget.approve;
 *    the Request dialog auto-applies (and N11-logs) under-threshold raises.
 *  • Four-eyes — the requester can never decide their own request.
 *  • Rejections notify the requester in-app (pushNotification) and are
 *    audit-logged; approved changes write through to the budget store the
 *    ad-spend page reads.
 */
import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { relativeTime } from "@/modules/integrations/format";
import { DollarSign, Clock, CheckCircle2, XCircle, Plus, MessageSquare } from "lucide-react";
import {
  listBudgets, listRequests, requestBudgetChange, approveRequest, rejectRequest,
  slaHours, isAutoApprovable,
  AUTO_APPROVE_DAILY_RAISE, AUTO_APPROVE_MONTHLY_RAISE,
  useBudgetVersion, type BudgetRequest, type RequestState,
} from "../ad-budget-store";

const STATE_TONE: Record<RequestState, "success" | "warning" | "danger" | "info"> = {
  approved: "success",
  auto_approved: "info",
  pending: "warning",
  rejected: "danger",
};

const STATE_LABEL: Record<RequestState, string> = {
  approved: "approved",
  auto_approved: "auto-approved",
  pending: "pending",
  rejected: "rejected",
};

export function AdBudgetApprovalsPage() {
  const { user, navigate, pushNotification } = usePlatform();
  const actor = user?.name ?? "operator";
  const canApprove = hasPermission(user, "marketing.budget.approve");
  const canRequest = hasPermission(user, "marketing.ads.manage");
  const gateApprove = canApprove ? undefined : "Requires marketing.budget.approve";
  const gateRequest = canRequest ? undefined : "Requires marketing.ads.manage";

  useBudgetVersion(); // approvals re-apply caps → re-render queue + metrics

  const [stateFilter, setStateFilter] = useState<"all" | RequestState>("all");
  const [detail, setDetail] = useState<BudgetRequest | null>(null);
  const [decision, setDecision] = useState<{ req: BudgetRequest; mode: "approve" | "reject" } | null>(null);
  const [comment, setComment] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  const rows = useMemo(
    () => listRequests().filter(r => stateFilter === "all" || r.state === stateFilter),
    [stateFilter],
  );
  const all = listRequests();
  const pending = all.filter(r => r.state === "pending");
  const overdue = pending.filter(r => slaHours(r) < 0);
  const autoRecent = all.filter(r => r.state === "auto_approved" && Date.now() - new Date(r.decidedAt ?? r.submittedAt).getTime() < 7 * 86_400_000);
  const budgetTotal = listBudgets().reduce((s, b) => s + b.monthlyCap, 0);

  /* ---------------------------------------------------------------- */
  /* Approve / reject with comments                                    */
  /* ---------------------------------------------------------------- */

  function runDecision() {
    if (!decision || !comment.trim()) return;
    const { req, mode } = decision;
    const res = mode === "approve" ? approveRequest(req.id, actor, comment) : rejectRequest(req.id, actor, comment);
    if (!res.ok) {
      toast({ title: "Not decided", description: res.error, variant: "destructive" });
      setDecision(null);
      setComment("");
      return;
    }
    if (mode === "approve") {
      toast({
        title: "Budget raise approved",
        description: `${req.campaign}: $${req.currentDaily}→$${req.requestedDaily}/day, $${req.currentMonthly}→$${req.requestedMonthly}/month applied to the budget store and audit-logged (N11).`,
      });
    } else {
      // Rejections notify the requester in-app.
      pushNotification({
        title: "Budget request rejected",
        message: `${actor} rejected your raise for ${req.campaign} (${req.adAccountId}): $${req.currentDaily}→${req.requestedDaily}/day. Comment: ${comment.trim()}`,
        severity: "warning",
        module: "marketing",
        actionLabel: "Open queue",
        actionHref: "ad-budget-approvals",
      });
      toast({ title: "Rejected", description: `${req.requester} notified in-app; the decision is audit-logged.`, variant: "destructive" });
    }
    setDecision(null);
    setComment("");
    setDetail(null);
  }

  /* ---------------------------------------------------------------- */
  /* Columns                                                           */
  /* ---------------------------------------------------------------- */

  const cols: Column<BudgetRequest>[] = [
    {
      key: "req", header: "Request", cell: r => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDetail(r)}>
          {r.campaign}
          <span className="block text-[10px] font-normal text-muted-foreground">{r.id} · {r.provider}</span>
        </button>
      ),
    },
    { key: "acct", header: "Ad account", cell: r => <span className="font-mono text-xs">{r.adAccountId}</span> },
    {
      key: "change", header: "Current → requested", cell: r => (
        <span className="text-xs tabular-nums">
          ${r.currentDaily} → <strong>${r.requestedDaily}</strong>/day
          <span className="block text-[10px] text-muted-foreground">${r.currentMonthly} → ${r.requestedMonthly}/mo</span>
        </span>
      ),
    },
    {
      key: "req_by", header: "Requester", cell: r => (
        <span className="text-xs">{r.requester}
          <span className="block text-[10px] text-muted-foreground">{relativeTime(r.submittedAt)}</span>
        </span>
      ),
    },
    { key: "reason", header: "Reason", cell: r => <span className="line-clamp-2 max-w-[220px] text-[11px] text-muted-foreground">{r.reason}</span> },
    { key: "eff", header: "Effective", cell: r => <span className="text-xs">{r.effectiveDate}</span> },
    {
      key: "sla", header: "SLA clock", cell: r => {
        if (r.state !== "pending") return <span className="text-[10px] text-muted-foreground">closed</span>;
        const h = slaHours(r);
        return (
          <span className={`flex items-center gap-1 text-[11px] font-medium ${h < 0 ? "text-destructive" : h < 6 ? "text-amber-600" : "text-muted-foreground"}`}>
            <Clock className="h-3 w-3" />
            {h < 0 ? `overdue ${Math.abs(h)}h` : `due in ${h}h`}
          </span>
        );
      },
    },
    { key: "state", header: "State", cell: r => <StatusBadge tone={STATE_TONE[r.state]}>{STATE_LABEL[r.state]}</StatusBadge> },
    {
      key: "a", header: "", cell: r => {
        if (r.state !== "pending") return null;
        const isOwn = r.requester === actor;
        const title = !canApprove ? gateApprove : isOwn ? "Four-eyes: you raised this request" : undefined;
        return (
          <div className="flex justify-end gap-1">
            <Button size="sm" className="h-6 text-[10px]" disabled={!canApprove || isOwn} title={title}
              onClick={() => { setDecision({ req: r, mode: "approve" }); setComment(""); }}>
              <CheckCircle2 className="mr-1 h-3 w-3" />Approve
            </Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px] text-destructive" disabled={!canApprove || isOwn} title={title}
              onClick={() => { setDecision({ req: r, mode: "reject" }); setComment(""); }}>
              <XCircle className="mr-1 h-3 w-3" />Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Ad Budget Approvals"
        description="Four-eyes queue for ad-spend caps — requests carry current → requested caps, an SLA clock and reviewer comments. Under-threshold raises auto-approve and log (AC-1)."
        icon={DollarSign}
        actions={
          <Button size="sm" disabled={!canRequest} title={gateRequest} onClick={() => setComposeOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />Request change
          </Button>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Pending approvals" value={String(pending.length)} tone={pending.length ? "warning" : "positive"} icon={Clock} />
          <MetricCard label="SLA overdue" value={String(overdue.length)} tone={overdue.length ? "negative" : "default"} />
          <MetricCard label="Auto-approved (7d)" value={String(autoRecent.length)} tone="info" action={<span className="text-[10px] text-muted-foreground">≤ ${AUTO_APPROVE_DAILY_RAISE}/day &amp; ≤ ${AUTO_APPROVE_MONTHLY_RAISE}/mo raises</span>} />
          <MetricCard label="Approved budget (monthly)" value={`$${budgetTotal.toLocaleString()}`} action={<span className="text-[10px] text-muted-foreground">sum of approved caps</span>} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["all", "pending", "approved", "auto_approved", "rejected"] as const).map(s => (
            <button key={s} type="button" onClick={() => setStateFilter(s)}
              className={`rounded-full border px-2.5 py-1 text-xs ${stateFilter === s ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              {s === "all" ? "All" : STATE_LABEL[s]}
            </button>
          ))}
        </div>

        <DataTable
          columns={cols} data={rows} rowKey={r => r.id} pageSize={10}
          searchableText={r => `${r.campaign} ${r.requester} ${r.adAccountId} ${r.reason} ${r.state}`}
          emptyTitle="No requests in this state" emptyDescription="Switch the filter or raise a budget change from the ad-spend screen."
        />

        <p className="text-[11px] text-muted-foreground">
          Threshold rule: raises ≤ ${AUTO_APPROVE_DAILY_RAISE}/day and ≤ ${AUTO_APPROVE_MONTHLY_RAISE}/month apply immediately and are logged;
          larger raises wait here under a 48h SLA and need marketing.budget.approve (four-eyes — requesters cannot decide their own request).
          Every decision writes to the N11 Marketing Audit Log.
        </p>
      </PageContent>

      {/* Decision dialog — approve/reject with required comments */}
      <Dialog open={!!decision} onOpenChange={o => { if (!o) { setDecision(null); setComment(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.mode === "approve" ? "Approve budget raise" : "Reject budget raise"}</DialogTitle>
            <DialogDescription>
              {decision && `${decision.req.campaign} (${decision.req.adAccountId}) — $${decision.req.currentDaily}→$${decision.req.requestedDaily}/day, $${decision.req.currentMonthly}→$${decision.req.requestedMonthly}/month. Requested by ${decision.req.requester}.`}
              {decision?.mode === "approve" ? " The cap is applied to the budget store and audit-logged." : " The requester is notified in-app."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
            placeholder={decision?.mode === "approve" ? "Approval comment (required) — pacing, envelope, conditions…" : "Rejection reason (required) — the requester sees this in-app"} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDecision(null); setComment(""); }}>Cancel</Button>
            <Button disabled={!comment.trim()} variant={decision?.mode === "reject" ? "destructive" : "default"} onClick={runDecision}>
              {decision?.mode === "approve" ? "Approve & apply" : "Reject & notify"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose — request a budget change (marketing.ads.manage) */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        actor={actor}
      />

      {/* Detail sheet — request trail + comments */}
      <Sheet open={!!detail} onOpenChange={o => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.campaign}</SheetTitle>
                <SheetDescription>{detail.id} · {detail.provider} · {detail.adAccountId}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 px-4 pb-4 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={STATE_TONE[detail.state]}>{STATE_LABEL[detail.state]}</StatusBadge>
                  {detail.state === "pending" && (
                    <Badge variant={slaHours(detail) < 0 ? "destructive" : "outline"} className="text-[10px]">
                      <Clock className="mr-1 h-3 w-3" />
                      {slaHours(detail) < 0 ? `SLA overdue ${Math.abs(slaHours(detail))}h` : `SLA due in ${slaHours(detail)}h`}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">effective {detail.effectiveDate}</span>
                </div>

                <Card><CardContent className="space-y-1 p-3">
                  <p className="font-semibold">Current → requested</p>
                  <p className="tabular-nums">Daily cap: ${detail.currentDaily} → <strong>${detail.requestedDaily}</strong> (+${detail.requestedDaily - detail.currentDaily})</p>
                  <p className="tabular-nums">Monthly cap: ${detail.currentMonthly} → <strong>${detail.requestedMonthly}</strong> (+${detail.requestedMonthly - detail.currentMonthly})</p>
                  <p className="text-muted-foreground">
                    {isAutoApprovable(detail.requestedDaily, detail.currentDaily, detail.requestedMonthly, detail.currentMonthly)
                      ? "Under the auto-approval threshold."
                      : "Above the auto-approval threshold — requires marketing.budget.approve."}
                  </p>
                </CardContent></Card>

                <Card><CardContent className="space-y-1 p-3">
                  <p className="font-semibold">Request</p>
                  <p><span className="text-muted-foreground">By:</span> {detail.requester} · {relativeTime(detail.submittedAt)}</p>
                  <p><span className="text-muted-foreground">Reason:</span> {detail.reason}</p>
                  {detail.decidedAt && <p><span className="text-muted-foreground">Decided:</span> {detail.decidedBy} · {relativeTime(detail.decidedAt)}</p>}
                  {detail.resolution && <p className="text-muted-foreground">{detail.resolution}</p>}
                </CardContent></Card>

                <Card><CardContent className="space-y-1.5 p-3">
                  <p className="flex items-center gap-1 font-semibold"><MessageSquare className="h-3 w-3" />Comments ({detail.comments.length})</p>
                  {detail.comments.length === 0 && <p className="text-muted-foreground">No comments yet.</p>}
                  {detail.comments.map((c, i) => (
                    <div key={i} className="rounded border p-2">
                      <p className="text-[10px] text-muted-foreground">{c.by} · {relativeTime(c.at)}</p>
                      <p>{c.text}</p>
                    </div>
                  ))}
                </CardContent></Card>

                {detail.state === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" disabled={!canApprove || detail.requester === actor}
                      title={!canApprove ? gateApprove : detail.requester === actor ? "Four-eyes: you raised this request" : undefined}
                      onClick={() => { setDecision({ req: detail, mode: "approve" }); setComment(""); }}>
                      <CheckCircle2 className="mr-1 h-3 w-3" />Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-destructive" disabled={!canApprove || detail.requester === actor}
                      title={!canApprove ? gateApprove : detail.requester === actor ? "Four-eyes: you raised this request" : undefined}
                      onClick={() => { setDecision({ req: detail, mode: "reject" }); setComment(""); }}>
                      <XCircle className="mr-1 h-3 w-3" />Reject
                    </Button>
                  </div>
                )}
                <Button size="sm" variant="ghost" className="w-full" onClick={() => navigate("marketing-ad-spend")}>
                  View budgets on Ad Spend →
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Compose — new budget-change request                                 */
/* ------------------------------------------------------------------ */

function ComposeDialog({ open, onOpenChange, actor }: { open: boolean; onOpenChange: (o: boolean) => void; actor: string }) {
  const budgets = listBudgets();
  const [capId, setCapId] = useState(budgets[0]?.id ?? "");
  const [daily, setDaily] = useState("");
  const [monthly, setMonthly] = useState("");
  const [reason, setReason] = useState("");
  const [effective, setEffective] = useState(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));

  const cap = budgets.find(b => b.id === capId) ?? budgets[0];
  const d = Number(daily), m = Number(monthly);
  const valid = !!cap && d > 0 && m > 0 && reason.trim().length >= 8;
  const auto = cap ? isAutoApprovable(d, cap.dailyCap, m, cap.monthlyCap) : false;

  function submit() {
    if (!cap || !valid) return;
    const res = requestBudgetChange({ capId: cap.id, requestedDaily: d, requestedMonthly: m, reason: reason.trim(), effectiveDate: effective }, actor);
    if (!res.ok) {
      toast({ title: "Request not submitted", description: res.error, variant: "destructive" });
      return;
    }
    if (res.autoApproved) {
      toast({
        title: "Auto-approved under threshold",
        description: `${cap.campaign}: $${cap.dailyCap}→${d}/day, $${cap.monthlyCap}→${m}/mo applied immediately and logged to the N11 audit log (AC-1).`,
      });
    } else {
      toast({
        title: "Submitted for approval",
        description: `${cap.campaign}: $${d}/day, $${m}/mo is above the threshold — it waits in the queue under a 48h SLA for marketing.budget.approve.`,
      });
    }
    onOpenChange(false);
    setDaily(""); setMonthly(""); setReason("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request budget change</DialogTitle>
          <DialogDescription>
            Raises ≤ ${AUTO_APPROVE_DAILY_RAISE}/day and ≤ ${AUTO_APPROVE_MONTHLY_RAISE}/month auto-approve and log;
            anything larger joins the four-eyes queue (raised by {actor}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Budget (ad account · campaign)</label>
            <Select value={capId} onValueChange={setCapId}>
              <SelectTrigger><SelectValue placeholder="Select a budget" /></SelectTrigger>
              <SelectContent>
                {budgets.map(b => <SelectItem key={b.id} value={b.id}>{b.campaign} · {b.adAccountId} (${b.dailyCap}/day)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Requested daily cap ($)</label>
              <Input type="number" min={1} value={daily} onChange={e => setDaily(e.target.value)} placeholder={cap ? String(cap.dailyCap) : ""} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Requested monthly cap ($)</label>
              <Input type="number" min={1} value={monthly} onChange={e => setMonthly(e.target.value)} placeholder={cap ? String(cap.monthlyCap) : ""} />
            </div>
          </div>
          {cap && d > 0 && m > 0 && (
            <p className={`rounded border p-2 text-xs ${auto ? "border-emerald-400/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"}`}>
              {auto
                ? `Under threshold (+$${d - cap.dailyCap}/day, +$${m - cap.monthlyCap}/mo) — will auto-approve and log on submit.`
                : `Above threshold (+$${d - cap.dailyCap}/day, +$${m - cap.monthlyCap}/mo) — requires marketing.budget.approve in the queue (48h SLA).`}
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reason (min. 8 chars)</label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why the raise is needed — pacing, CPA, seasonality…" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Effective date</label>
            <Input type="date" value={effective} onChange={e => setEffective(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid} onClick={submit}>{auto ? "Submit (auto-applies)" : "Submit for approval"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
