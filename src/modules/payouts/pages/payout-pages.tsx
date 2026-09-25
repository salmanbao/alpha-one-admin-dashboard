"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural, resolveTermsInString } from "@/lib/platform/terminology";
import { getTenantPayouts, type Payout } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import { applyPayoutDecision, effectivePayoutStatus, usePayoutVersion } from "@/modules/payouts/payout-store";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { PayoutReviewActions } from "@/components/platform/contextual-actions";
import { AttentionCenter } from "@/components/platform/attention-center";
import { EmptyState } from "@/components/platform/guards";
import { Wallet, Banknote, Clock, CheckCircle2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";

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
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  // Subscribe to in-session decisions so approve/reject from any surface
  // (review cards, dashboard widget, other tables) re-renders here.
  usePayoutVersion();
  const pays = getTenantPayouts(tid)
    .map((p) => ({ ...p, status: effectivePayoutStatus(p) }))
    .filter(filter);

  const columns: Column<Payout>[] = [
    { key: "reference", header: "Reference", cell: (p) => <span className="font-mono text-xs">{p.reference}</span>, sortValue: (p) => p.reference },
    { key: "trader", header: term("trader"), cell: (p) => <span className="font-medium">{p.traderName}</span>, sortValue: (p) => p.traderName },
    { key: "amount", header: "Amount", cell: (p) => <span className="font-semibold">{formatCurrency(p.amount, p.currency)}</span>, sortValue: (p) => p.amount },
    { key: "method", header: "Method", cell: (p) => p.method, sortValue: (p) => p.method },
    { key: "split", header: "Split", cell: (p) => `${p.profitSplit}%`, sortValue: (p) => p.profitSplit },
    {
      key: "status",
      header: "Status",
      cell: (p) => <ExplainableStateBadge status={p.status} entityType="payout" />,
      sortValue: (p) => p.status,
    },
    { key: "created", header: "Requested", cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString("en-US")}</span>, sortValue: (p) => p.createdAt },
    {
      key: "actions",
      header: "Actions",
      cell: (p) =>
        p.status === "pending" ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="default"
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
                friction matches PayoutReviewActions inline pattern. */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700">
                  Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject this payout?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to reject the payout of {formatCurrency(p.amount, p.currency)} for {p.traderName}.
                  </AlertDialogDescription>
                  <div className="rounded-md border border-rose-500/20 bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                    <span className="font-medium">Consequence:</span> Rejecting this payout will notify the trader and reverse any pending fees. The trader will need to re-request. This action is logged.
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => {
                      applyPayoutDecision(p.reference, "rejected");
                      toast({
                        title: "Payout rejected",
                        description: `${p.traderName}'s payout was rejected.`,
                        variant: "destructive",
                      });
                    }}
                  >
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={pays}
      rowKey={(p) => p.id}
      searchableText={(p) => `${p.reference} ${p.traderName} ${p.method} ${p.status}`}
      searchPlaceholder={resolveTermsInString("Search payouts…", tenant)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export function PayoutsOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  usePayoutVersion(); // KPIs recompute when decisions change
  const currency = runtime.tenant?.currency ?? "USD";
  const pays = getTenantPayouts(tid).map((p) => ({ ...p, status: effectivePayoutStatus(p) }));
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
      payoutExportColumns(term("trader")),
      `payouts-overview-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title={plural(term("payout"))}
        description={`${term("trader")} withdrawal requests and approvals.`}
        icon={Wallet}
        actions={<Button size="sm" variant="outline" onClick={handleExport}>Export</Button>}
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
            {pendingPayouts.map((p) => (
              <PayoutReviewActions
                key={p.id}
                payoutId={p.reference}
                traderName={p.traderName}
                amount={p.amount}
                currency={p.currency}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={`No pending ${plural(term("payout")).toLowerCase()}`}
            description={`When ${plural(term("trader")).toLowerCase()} request ${plural(term("payout")).toLowerCase()}, they will appear here for review.`}
            icon={Clock}
            hint={`Enable ${plural(term("payout")).toLowerCase()} requests from your ${term("challenge").toLowerCase()} settings`}
          />
        )}
      </PageContent>
    </Page>
  );
}

export function PayoutHistoryPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  usePayoutVersion();
  const historyPayouts = getTenantPayouts(tid)
    .map((p) => ({ ...p, status: effectivePayoutStatus(p) }))
    .filter((p) => p.status === "paid" || p.status === "rejected");

  const handleExport = () => {
    exportToCsv(
      historyPayouts,
      payoutExportColumns(term("trader")),
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
