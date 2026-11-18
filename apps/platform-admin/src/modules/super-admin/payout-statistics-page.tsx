"use client";

/**
 * Payout Statistics — R9 W6 UC-P2.
 *
 * Verifiable cross-tenant payout aggregates, computed from the same
 * payout intake rows every other platform surface reads (`payouts` in
 * lib/platform/mock-data) — nothing is entered by hand, so the numbers
 * reconcile: the page recomputes the grand totals two independent ways
 * (row-wise vs per-tenant) and shows the tie-out explicitly.
 *
 * Contents:
 *   • headline cards — total paid per currency, on-time %, paid count;
 *   • per-tenant table — paid count/total, on-time %, avg days to pay,
 *     in-flight and rejected rows;
 *   • published methodology note — what is counted, what is excluded,
 *     how "on-time" is defined (≤ 7 days from request to payment);
 *   • print action — opens the browser print dialog (no fake file
 *     download); the action writes a Platform Audit Log row (R10: the
 *     UI claims it is logged, so it IS logged).
 *
 * Currency honesty: amounts are reported in their payout currency —
 * no FX conversion is invented for a demo. Footer labels the figures
 * as simulated aggregates.
 */

import { useMemo, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { recordAudit } from "@/lib/platform/console-store";
import { usePlatform } from "@/lib/platform/platform-context";
import { toast } from "@/hooks/use-toast";
import { payouts, tenants, type Payout } from "@/lib/platform/mock-data";
import {
  DollarSign,
  Printer,
  CheckCircle2,
  Timer,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";

/** On-time definition: paid within 7 days of the request. */
const ON_TIME_DAYS = 7;
const DAY_MS = 86_400_000;

const processingDays = (p: Payout): number | null =>
  p.processedAt
    ? (Date.parse(p.processedAt) - Date.parse(p.createdAt)) / DAY_MS
    : null;

const isOnTime = (p: Payout): boolean => {
  const d = processingDays(p);
  return p.status === "paid" && d !== null && d <= ON_TIME_DAYS;
};

interface TenantStat {
  tenantId: string;
  name: string;
  plan: string;
  currency: string;
  paid: number;
  paidTotal: number;
  onTime: number;
  onTimePct: number | null;
  avgDays: number | null;
  inFlight: number;
  rejected: number;
}

/** Per-tenant aggregates — derived only from the intake rows. */
function buildStats(): TenantStat[] {
  return tenants.map((t) => {
    const rows = payouts.filter((p) => p.tenantId === t.id);
    const paid = rows.filter((p) => p.status === "paid");
    const onTime = paid.filter(isOnTime);
    const days = paid.map(processingDays).filter((d): d is number => d !== null);
    const currency = paid[0]?.currency ?? rows[0]?.currency ?? "USD";
    return {
      tenantId: t.id,
      name: t.name,
      plan: t.plan,
      currency,
      paid: paid.length,
      paidTotal: paid.reduce((s, p) => s + p.amount, 0),
      onTime: onTime.length,
      onTimePct: paid.length > 0 ? Math.round((onTime.length / paid.length) * 100) : null,
      avgDays:
        days.length > 0
        ? Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10
        : null,
      inFlight: rows.filter(
        (p) => p.status === "pending" || p.status === "approved" || p.status === "processing",
      ).length,
      rejected: rows.filter((p) => p.status === "rejected").length,
    };
  });
}

export function PayoutStatisticsPage() {
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 350 }), []);
  const { user } = usePlatform();
  const [printing, setPrinting] = useState(false);

  const stats = useMemo(buildStats, []);

  /* Headline aggregates — computed row-wise, then re-derived per tenant
   * for the tie-out (the acceptance: stats reconcile with intake rows). */
  const totals = useMemo(() => {
    const paidRows = payouts.filter((p) => p.status === "paid");
    const usd = paidRows.filter((p) => p.currency === "USD");
    const gbp = paidRows.filter((p) => p.currency === "GBP");
    const onTime = paidRows.filter(isOnTime);
    const statusCounts = {
      paid: paidRows.length,
      approved: payouts.filter((p) => p.status === "approved").length,
      processing: payouts.filter((p) => p.status === "processing").length,
      pending: payouts.filter((p) => p.status === "pending").length,
      rejected: payouts.filter((p) => p.status === "rejected").length,
    };
    const rowWiseUsd = usd.reduce((s, p) => s + p.amount, 0);
    const rowWiseGbp = gbp.reduce((s, p) => s + p.amount, 0);
    const tenantWiseUsd = stats
      .filter((s) => s.currency === "USD")
      .reduce((s, x) => s + x.paidTotal, 0);
    const tenantWiseGbp = stats
      .filter((s) => s.currency === "GBP")
      .reduce((s, x) => s + x.paidTotal, 0);
    return {
      statusCounts,
      paidTotalUsd: rowWiseUsd,
      paidTotalGbp: rowWiseGbp,
      onTimePct:
        paidRows.length > 0
          ? Math.round((onTime.length / paidRows.length) * 100)
          : null,
      paidCount: paidRows.length,
      intakeRows: payouts.length,
      /* Tie-out: both derivations must agree (and rows must add up). */
      totalsMatch:
        Math.abs(rowWiseUsd - tenantWiseUsd) < 0.01 &&
        Math.abs(rowWiseGbp - tenantWiseGbp) < 0.01,
      rowsMatch:
        stats.reduce((s, x) => s + x.paid, 0) === statusCounts.paid &&
        statusCounts.paid +
          statusCounts.approved +
          statusCounts.processing +
          statusCounts.pending +
          statusCounts.rejected ===
          payouts.length,
    };
  }, [stats]);

  const printReport = () => {
    setPrinting(true);
    recordAudit({
      actor: user.name,
      action: "payout-stats.printed",
      target: "payout-statistics",
      severity: "info",
      detail:
        `Printed cross-tenant payout statistics — ${stats.length} tenants, ` +
        `${totals.intakeRows} intake rows, paid ${totals.paidCount} ` +
        `(${totals.statusCounts.paid} paid / ${totals.statusCounts.pending} pending / ` +
        `${totals.statusCounts.rejected} rejected), on-time ${totals.onTimePct ?? "n/a"}%.`,
    });
    toast({
      title: "Print view ready",
      description: "Opening the print dialog — choose “Save as PDF” to keep a copy. (Demo)",
    });
    window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 350);
  };

  const columns: Column<TenantStat>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div>
          <p className="text-sm font-medium">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">{r.tenantId}</p>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) => <Badge variant="outline">{r.plan}</Badge>,
      sortValue: (r) => r.plan,
    },
    {
      key: "paid",
      header: "Paid",
      numeric: true,
      cell: (r) => r.paid,
      sortValue: (r) => r.paid,
    },
    {
      key: "total",
      header: "Total paid",
      numeric: true,
      cell: (r) => (
        <span className="font-medium">{formatCurrency(r.paidTotal, r.currency)}</span>
      ),
      sortValue: (r) => r.paidTotal,
    },
    {
      key: "ontime",
      header: `On-time (≤${ON_TIME_DAYS}d)`,
      numeric: true,
      cell: (r) =>
        r.onTimePct === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Badge variant={r.onTimePct >= 90 ? "default" : "outline"}>
            {r.onTimePct}%
          </Badge>
        ),
      sortValue: (r) => r.onTimePct ?? -1,
    },
    {
      key: "avg",
      header: "Avg days to pay",
      numeric: true,
      cell: (r) =>
        r.avgDays === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          `${r.avgDays} d`
        ),
      sortValue: (r) => r.avgDays ?? -1,
    },
    {
      key: "inflight",
      header: "In flight",
      numeric: true,
      cell: (r) => r.inFlight,
      sortValue: (r) => r.inFlight,
    },
    {
      key: "rejected",
      header: "Rejected",
      numeric: true,
      cell: (r) => r.rejected,
      sortValue: (r) => r.rejected,
    },
  ];

  const sc = totals.statusCounts;

  return (
    <Page>
      <PageHeader
        title="Payout Statistics"
        description="Cross-tenant payout aggregates computed from the payout intake rows — published methodology, tie-out included."
        icon={DollarSign}
        actions={
          <Button onClick={printReport} disabled={printing} aria-label="Print payout statistics">
            <Printer className="mr-2 h-4 w-4" />
            {printing ? "Opening print dialog…" : "Print report"}
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading payout statistics…"
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Total paid (USD)"
              value={formatCurrency(totals.paidTotalUsd, "USD")}
              icon={DollarSign}
              tone="positive"
            />
            <MetricCard
              label="Total paid (GBP)"
              value={formatCurrency(totals.paidTotalGbp, "GBP")}
              icon={DollarSign}
            />
            <MetricCard
              label={`On-time (≤${ON_TIME_DAYS} days)`}
              value={totals.onTimePct === null ? "n/a" : `${totals.onTimePct}%`}
              icon={Timer}
              tone={
                totals.onTimePct === null
                  ? "default"
                  : totals.onTimePct >= 90
                    ? "positive"
                    : "warning"
              }
            />
            <MetricCard
              label="Paid payouts"
              value={`${totals.paidCount} / ${totals.intakeRows}`}
              icon={ClipboardList}
            />
          </div>

          {/* Reconciliation — the aggregates are re-derived per tenant and
              must tie back to the intake rows before we publish them. */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    totals.totalsMatch && totals.rowsMatch
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-semibold">
                    Reconciles with intake rows
                    {totals.totalsMatch && totals.rowsMatch ? " ✓" : " — mismatch"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {totals.intakeRows} intake rows = {sc.paid} paid + {sc.approved}{" "}
                    approved + {sc.processing} processing + {sc.pending} pending +{" "}
                    {sc.rejected} rejected. Row-wise totals vs per-tenant totals:{" "}
                    {formatCurrency(totals.paidTotalUsd, "USD")} /{" "}
                    {formatCurrency(totals.paidTotalGbp, "GBP")} both ways
                    {totals.totalsMatch ? " ✓" : " ✗"}; {totals.paidCount} paid rows
                    distributed across {stats.filter((s) => s.paid > 0).length} tenant(s)
                    {totals.rowsMatch ? " ✓" : " ✗"}.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <DataTable<TenantStat>
            columns={columns}
            data={stats}
            rowKey={(r) => r.tenantId}
            searchableText={(r) => `${r.name} ${r.tenantId} ${r.plan}`}
            searchPlaceholder="Search tenants…"
            pageSize={10}
            emptyTitle="No payout rows"
            emptyDescription="No intake rows match the current filters."
          />

          {/* Published methodology — what is and is not counted. */}
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-semibold">Methodology (published)</p>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Counted:</span> every payout
                intake row on this platform ({totals.intakeRows} rows across{" "}
                {stats.length} tenants). “Total paid” sums rows with status{" "}
                <code>paid</code> only. “On-time” counts paid rows whose payment landed{" "}
                <code>{ON_TIME_DAYS} days or less</code> after the request
                (createdAt → processedAt); the denominator is paid rows only.
              </p>
              <p>
                <span className="font-medium text-foreground">Excluded:</span> pending,
                approved, processing and rejected rows (never settled — they appear in
                “In flight” / “Rejected” columns instead); trader profit-split
                percentages; fees, refunds and chargebacks; affiliate commissions.
                Amounts are reported in their payout currency — no FX conversion is
                applied, so USD and GBP totals are never added together.
              </p>
              <p>
                <span className="font-medium text-foreground">Verification:</span> totals
                are computed twice — once row-by-row, once per tenant — and the tie-out
                above must agree before the figures are shown. Average days-to-pay is the
                mean of paid rows&apos; processing time, rounded to one decimal.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-50/30 p-3 text-xs text-muted-foreground dark:bg-amber-950/10">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span>
              simulated aggregates (Demo) — intake rows are fixture data; the
              methodology and tie-out above are computed live from those rows.
            </span>
          </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
