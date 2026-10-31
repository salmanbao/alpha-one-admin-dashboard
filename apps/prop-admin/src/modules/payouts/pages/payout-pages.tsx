"use client";

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { makeTermResolver, plural, resolveTermsInString } from "@/lib/platform/terminology";
import { getTenantPayouts, getTraderPayouts, getTraderForUser, getTenantTraders, type Payout } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import { applyPayoutDecision, effectivePayoutStatus, payoutEscalated, usePayoutVersion } from "@/modules/payouts/payout-store";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { DemoDataStamp } from "@/components/platform/demo-data";
import { PayoutReviewActions } from "@/components/platform/contextual-actions";
import { AttentionCenter } from "@/components/platform/attention-center";
import { EmptyState } from "@/components/platform/guards";
import { Wallet, Banknote, Clock, CheckCircle2, Timer, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDetailOverlay } from "@/components/platform/detail-overlay";
import { openViewInNewTab } from "@/lib/platform/view-links";
import { toast } from "@/hooks/use-toast";
import {
  PayoutRejectDialog,
  type PayoutRejectTarget,
  type PayoutRejectResult,
} from "@/components/platform/payout-reject-dialog";
import { TraderPerformanceChip } from "@/components/platform/trader-performance-chip";

/**
 * PRD §4.9 — Reject requires a reason (onReject(reason)). Uses the
 * shared PayoutRejectDialog (audit fix #3): structured category +
 * required detail + optional internal comment + notify-trader toggle,
 * so every reject surface records the same audit-trail shape.
 */
function PayoutRejectButton({ p }: { p: Payout }) {
  const { user, pushNotification } = usePlatform();
  const [rejectTarget, setRejectTarget] = useState<PayoutRejectTarget | null>(null);
  // In-page guard — rejecting is a payout decision, not just a view.
  const canDecide = hasPermission(user, "payout.approve");

  const confirmReject = (result: PayoutRejectResult) => {
    applyPayoutDecision(p.reference, "rejected", { reason: result.reason });
    if (result.notifyTrader) {
      pushNotification({
        title: "Payout rejected",
        message: `Your payout ${p.reference} (${formatCurrency(p.amount, p.currency)}) was rejected: ${result.reason}`,
        severity: "critical",
        module: "payouts",
      });
    }
    toast({
      title: "Payout rejected",
      description: `${p.traderName}'s payout was rejected — ${result.reason}${result.notifyTrader ? "" : " (trader not notified)"}`,
      variant: "destructive",
    });
    setRejectTarget(null);
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={!canDecide}
        title={canDecide ? undefined : "Requires payout.approve"}
        className="text-rose-600 hover:text-rose-700"
        onClick={() =>
          setRejectTarget({
            reference: p.reference,
            traderName: p.traderName,
            amount: p.amount,
            currency: p.currency,
            count: 1,
          })
        }
      >
        Reject
      </Button>
      <PayoutRejectDialog
        target={rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        onConfirm={confirmReject}
      />
    </>
  );
}

const payoutExportColumns = (
  traderTerm: string,
): Array<{ key: string; header: string; value: (p: Payout) => string | number }> => [
  { key: "reference", header: "Reference", value: (p: Payout) => p.reference },
  { key: "traderName", header: traderTerm, value: (p: Payout) => p.traderName },
  { key: "amount", header: "Amount", value: (p: Payout) => p.amount },
  { key: "currency", header: "Currency", value: (p: Payout) => p.currency },
  { key: "method", header: "Method", value: (p: Payout) => p.method },
  { key: "profitSplit", header: "Profit Split %", value: (p: Payout) => p.profitSplit },
  { key: "status", header: "Status", value: (p: Payout) => p.status },
  { key: "createdAt", header: "Requested", value: (p: Payout) => p.createdAt },
  { key: "processedAt", header: "Processed", value: (p: Payout) => p.processedAt ?? "" },
];

function PayoutsTable({ filter }: { filter: (p: Payout) => boolean }) {
  const { runtime, tenant, user } = usePlatform();
  const { openPanel } = useDetailOverlay();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  // In-page guard — the queue is visible with payout.read, but every
  // decision button (approve/reject/escalate/process) needs payout.approve.
  const canDecide = hasPermission(user, "payout.approve");
  const decideTitle = canDecide ? undefined : "Requires payout.approve";
  // Round 7: trader application users see only THEIR OWN payouts; admins
  // see the whole-tenant list.
  const trader = getTraderForUser(user);
  // Subscribe to in-session decisions so approve/reject from any surface
  // (review cards, dashboard widget, other tables) re-renders here.
  usePayoutVersion();
  const pays = (trader ? getTraderPayouts(trader.id) : getTenantPayouts(tid))
    .map((p) => ({ ...p, status: effectivePayoutStatus(p) }))
    .filter(filter);
  // Trader performance lookup — payout reviewers see recent performance
  // inline (audit #3 fix #2) instead of cross-referencing trader screens.
  const perfByTrader = useMemo(() => {
    const m = new Map<string, ReturnType<typeof getTenantTraders>[number]>();
    for (const t of getTenantTraders(tid)) m.set(t.id, t);
    return m;
  }, [tid]);

  const columns: Column<Payout>[] = [
    { key: "reference", header: "Reference", cell: (p) => <span className="font-mono text-xs">{p.reference}</span>, sortValue: (p) => p.reference },
    { key: "account", header: term("account"), cell: (p) => <span className="font-medium">{p.accountName}</span>, sortValue: (p) => p.accountName ?? "" },
    { key: "amount", header: "Amount", cell: (p) => <span className="font-semibold">{formatCurrency(p.amount, p.currency)}</span>, sortValue: (p) => p.amount },
    {
      // Audit #3 fix #2 — performance context for the payout decision.
      key: "performance",
      header: "Performance",
      cell: (p) => <TraderPerformanceChip trader={perfByTrader.get(p.traderId)} compact />,
      sortValue: (p) => perfByTrader.get(p.traderId)?.totalPnl ?? 0,
    },
    { key: "method", header: "Method", cell: (p) => p.method, sortValue: (p) => p.method },
    { key: "split", header: "Split", cell: (p) => `${p.profitSplit}%`, sortValue: (p) => p.profitSplit },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <div className="flex flex-wrap items-center gap-1">
          <ExplainableStateBadge status={p.status} entityType="payout" />
          {payoutEscalated(p.reference) ? (
            <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-700 dark:text-amber-400">
              Escalated
            </Badge>
          ) : null}
        </div>
      ),
      sortValue: (p) => p.status,
    },
    { key: "created", header: "Requested", cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-US")}</span>, sortValue: (p) => p.createdAt },
    {
      // PRD §4.9 — row drill-down into the payout detail view (audit trail,
      // timeline, reverse-payout action). Primary click → overlay sheet on
      // top of the queue; the icon → same screen in a new browser tab.
      key: "detail",
      header: "",
      cell: (p) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); openPanel("payout-detail", { id: p.reference }); }}>
            Details
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Open payout ${p.reference} in a new tab`}
            title="Open in new tab"
            className="h-7 w-7 p-0"
            onClick={(e) => { e.stopPropagation(); openViewInNewTab("payout-detail", { id: p.reference }); }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (p) =>
        p.status === "pending" ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="default"
              disabled={!canDecide}
              title={decideTitle}
              onClick={() => {
                // Mutate the shared decision store — the row leaves the
                // pending queue everywhere (table, cards, widget).
                applyPayoutDecision(p.reference, "approved");
                toast({ title: "Approved", description: `${p.traderName} payout approved.` });
              }}
            >
              Approve
            </Button>
            {/* §24 Destructive Actions — Reject is high-consequence (notifies
                trader, reverses pending fees, forces re-request). AlertDialog
                friction matches PayoutReviewActions inline pattern; PRD
                requires a captured reason (onReject(reason)). */}
            <PayoutRejectButton p={p} />
            {/* Escalate → PRD multi-level approval: payout stays pending
                but requires senior sign-off (badge on the status cell). */}
            {!payoutEscalated(p.reference) ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={!canDecide}
                title={decideTitle}
                className="text-amber-700 hover:text-amber-800"
                onClick={() => {
                  applyPayoutDecision(p.reference, "escalated");
                  toast({
                    title: "Payout escalated",
                    description: `${p.traderName}'s payout escalated for senior approval.`,
                  });
                }}
              >
                Escalate
              </Button>
            ) : null}
          </div>
        ) : p.status === "approved" ? (
          /* PRD POST /payouts/:id/process — send the approved payout to
             the payment processor (approved → processing everywhere). */
          <Button
            size="sm"
            disabled={!canDecide}
            title={decideTitle}
            onClick={() => {
              applyPayoutDecision(p.reference, "processing");
              toast({
                title: "Payout processing",
                description: `${p.traderName}'s payout sent to the payment processor.`,
              });
            }}
          >
            Process
          </Button>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={pays}
      rowKey={(p) => p.id}
      onRowClick={(p) => openPanel("payout-detail", { id: p.reference })}
      searchableText={(p) => `${p.reference} ${p.traderName} ${p.method} ${p.status}`}
      searchPlaceholder={resolveTermsInString("Search payouts…", tenant)}
      emptyTitle="No payouts yet"
      emptyDescription="Withdrawal requests will appear here once traders submit them."
    />
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function PayoutsOverviewPage() {
  const { runtime, tenant, user } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  // Round 7: trader sees only their own payouts.
  const trader = getTraderForUser(user);
  usePayoutVersion(); // KPIs recompute when decisions change
  const currency = runtime.tenant?.currency ?? "USD";
  const pays = (trader ? getTraderPayouts(trader.id) : getTenantPayouts(tid)).map((p) => ({ ...p, status: effectivePayoutStatus(p) }));
  const pending = pays.filter((p) => p.status === "pending").length;
  const paid = pays.filter((p) => p.status === "paid");
  const totalPaid = paid.reduce((s, p) => s + p.amount, 0);
  // Real average profit split — was hardcoded "80%", contradicting the data.
  const avgSplit = pays.length ? Math.round(pays.reduce((s, p) => s + p.profitSplit, 0) / pays.length) : 0;
  // Paid within the last 30 days, so the label matches the number.
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const paid30d = paid.filter((p) => new Date(p.createdAt).getTime() >= thirtyDaysAgo);

  // Avg Processing Time — hours between request and approval for paid payouts.
  // Falls back to a deterministic baseline if no processedAt exists.
  const paidWithDuration = paid.filter((p) => p.processedAt);
  const avgMs = paidWithDuration.length
    ? paidWithDuration.reduce(
        (s, p) => s + (new Date(p.processedAt!).getTime() - new Date(p.createdAt).getTime()),
        0,
      ) / paidWithDuration.length
    : 18.5 * 60 * 60 * 1000; // 18.5h baseline
  const avgHours = avgMs / 3_600_000;

  const handleExport = () => {
    exportToCsv(
      pays,
      payoutExportColumns(term("account")),
      `payouts-overview-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title={plural(term("payout"))}
        description={`${term("account")} withdrawal requests and approvals.`}
        icon={Wallet}
        actions={
          <>
            <DemoDataStamp label="Simulated queue" />
            <Button size="sm" variant="outline" onClick={handleExport}>Export</Button>
          </>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="Pending" value={pending} icon={Clock} tone="warning" />
          <MetricCard label="Paid (30d)" value={paid30d.length} icon={CheckCircle2} tone="positive" />
          <MetricCard label={`Total ${term("payout")}`} value={formatCurrency(totalPaid, currency)} icon={Banknote} tone="positive" />
          <MetricCard label="Avg Split" value={`${avgSplit}%`} icon={Wallet} />
          <MetricCard
            label="Avg Processing Time"
            value={`${avgHours.toFixed(1)}h`}
            icon={Timer}
            tone={avgHours > 24 ? "warning" : "positive"}
            deltaLabel="from request to approval"
          />
        </div>

        {/* Attention Center — §11 centralized attention model */}
        <AttentionCenter />

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">All {plural(term("payout"))}</p>
          <PayoutsTable filter={() => true} />
        </div>
      </PageContent>
    </Page>
  );
}

export function PendingPayoutsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  usePayoutVersion(); // review cards + table react to decisions
  const pendingPayouts = getTenantPayouts(tid)
    .map((p) => ({ ...p, status: effectivePayoutStatus(p) }))
    .filter((p) => p.status === "pending");
  // Audit #3 fix #2 — performance context shown with each approval card.
  const perfByTrader = useMemo(() => {
    const m = new Map<string, ReturnType<typeof getTenantTraders>[number]>();
    for (const t of getTenantTraders(tid)) m.set(t.id, t);
    return m;
  }, [tid]);

  return (
    <Page>
      <PageHeader title={`Pending ${plural(term("payout"))}`} description="Awaiting approval." icon={Clock} />
      <PageContent>
        {/* Contextual Action Panel — inline approve/reject with one primary action (§22-23).
            Previously the SAME pending payouts were ALSO rendered in the
            PayoutsTable below — duplicating data on one screen. The
            contextual cards already have Approve/Reject buttons, so the
            table is now redundant. Kept the EmptyState when there are no
            pending payouts so the operator sees a clean "nothing to do"
            state instead of an empty list. */}
        {pendingPayouts.length > 0 ? (
          <div className="space-y-2">
            {pendingPayouts.map((p) => {
              const perf = perfByTrader.get(p.traderId);
              return (
                <div key={p.id} className="space-y-1">
                  {/* Trader performance summary — profit target progress,
                      drawdown usage proxy (PnL vs balance), trading activity.
                      Reviewers approve with context instead of cross-referencing. */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs">
                    <span className="font-medium text-foreground">{p.traderName}</span>
                    {perf ? (
                      <>
                        <TraderPerformanceChip trader={perf} compact />
                        <span className="text-muted-foreground">
                          Balance <span className="tabular-nums text-foreground">{formatCurrency(perf.accountBalance, p.currency)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Net PnL{" "}
                          <span className={`tabular-nums font-medium ${perf.totalPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {formatCurrency(perf.totalPnl, p.currency)}
                          </span>
                        </span>
                        {perf.challengePhase ? (
                          <span className="text-muted-foreground capitalize">{perf.challengePhase.replace("-", " ")}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground">No performance data on file</span>
                    )}
                  </div>
                  <PayoutReviewActions
                    payoutId={p.reference}
                    traderName={p.traderName}
                    amount={p.amount}
                    currency={p.currency}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={`No pending ${plural(term("payout")).toLowerCase()}`}
            description={`When ${plural(term("account")).toLowerCase()} request ${plural(term("payout")).toLowerCase()}, they will appear here for review.`}
            icon={Clock}
            hint={`Enable ${plural(term("payout")).toLowerCase()} requests from your ${term("challenge").toLowerCase()} settings`}
          />
        )}
      </PageContent>
    </Page>
  );
}

export function PayoutHistoryPage() {
  const { runtime, tenant, user } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  // Round 7: trader sees only their own payout history.
  const trader = getTraderForUser(user);
  usePayoutVersion();
  const historyPayouts = (trader ? getTraderPayouts(trader.id) : getTenantPayouts(tid))
    .map((p) => ({ ...p, status: effectivePayoutStatus(p) }))
    .filter((p) => p.status === "paid" || p.status === "rejected");

  const handleExport = () => {
    exportToCsv(
      historyPayouts,
      payoutExportColumns(term("account")),
      `payout-history-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader title={`${term("payout")} History`} description="All processed payouts." icon={CheckCircle2} actions={<Button size="sm" variant="outline" onClick={handleExport}>Export</Button>} />
      <PageContent>
        <PayoutsTable filter={(p) => p.status === "paid" || p.status === "rejected"} />
      </PageContent>
    </Page>
  );
}
