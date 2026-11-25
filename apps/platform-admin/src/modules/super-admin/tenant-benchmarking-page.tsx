"use client";

/**
 * Tenant Performance Benchmarking — audit finding #2 (LOW).
 *
 * Platform Analytics compares tenants to *each other*; this sub-screen
 * compares them to the outside world and to the bar their plan tier is
 * sold on:
 *
 *   • Trader pass rate — funded traders ÷ traders
 *   • Avg evaluation duration — mean days elapsed across in-progress
 *     evaluations (30-day window)
 *   • Payout frequency — paid payouts per funded trader (seeded window)
 *   • Revenue per trader — challenge-fee + subscription income ÷ traders,
 *     FX-normalised to USD so tenants billing in GBP compare fairly
 *
 * Every tenant row carries two reference points: the **industry
 * benchmark** (one constant per metric) and the **plan-tier target**
 * (higher tiers are held to a higher bar). Both are deterministic
 * fixtures — a fixed table, no `Math.random()` — so screenshots and
 * tests stay stable; swap them for the benchmark feed at integration.
 *
 * Drill-down filters: plan tier (segment) and region (the tenant's
 * data-residency pin — canonical ids from `lib/platform/regions.ts`,
 * matched by equality). Both default to an explicit `"all"` sentinel
 * and intersect (AND) — a region filter never masks the plan filter.
 *
 * All derivations live in `lib/platform/benchmarking.ts`: null-safe
 * (a metric with no cohort data renders "—", never a fake 0) and
 * seed-derived — no per-screen metric maps.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/platform/data-table";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { useTenants } from "@/lib/platform/tenant-store";
import { TENANT_REGIONS, regionLabel } from "@/lib/platform/regions";
import { cn } from "@/lib/utils";
import {
  BENCHMARK_METRICS,
  BENCHMARK_METRIC_KEYS,
  cohortMean,
  meetsPlanTarget,
  planTargetGap,
  tenantBenchmarkRow,
  type BenchmarkMetricDef,
  type BenchmarkMetricKey,
  type PlanTier,
  type TenantBenchmarkRow,
} from "@/lib/platform/benchmarking";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Timer, Users, Wallet } from "lucide-react";

const PLAN_TIERS: PlanTier[] = ["starter", "growth", "scale", "enterprise"];

const METRIC_ICONS: Record<
  BenchmarkMetricKey,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  passRate: Users,
  evalDays: Timer,
  payoutFreq: Wallet,
  revenuePerTrader: DollarSign,
};

/** Value + signed gap vs the row's plan target (null-safe, P0). */
function MetricCell({ row, def }: { row: TenantBenchmarkRow; def: BenchmarkMetricDef }) {
  const value = row[def.key];
  if (value === null) {
    return (
      <span
        className="text-sm text-muted-foreground"
        title="No data for this cohort"
      >
        —
      </span>
    );
  }
  const gap = planTargetGap(def, value, row.plan);
  const good = meetsPlanTarget(def, value, row.plan);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-mono tabular-nums text-sm">{def.format(value)}</span>
      <span
        title={`Plan target: ${def.format(def.planTargets[row.plan])}`}
        className={cn(
          "text-[10px] font-medium",
          good
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400",
        )}
      >
        {def.gap(gap)}
      </span>
    </div>
  );
}

export function TenantBenchmarkingPage() {
  const { loading } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const tenants = useTenants();

  // Explicit "all" sentinels — "starter" is a real tier, never a default
  // mask (the old page used it as one, which hid the plan filter).
  const [filterPlan, setFilterPlan] = useState<PlanTier | "all">("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");

  const rows = useMemo(() => tenants.map(tenantBenchmarkRow), [tenants]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (filterPlan === "all" || r.plan === filterPlan) &&
          (filterRegion === "all" || r.region === filterRegion),
      ),
    [rows, filterPlan, filterRegion],
  );

  const columns: Column<TenantBenchmarkRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{r.name}</span>
          <span className="text-xs text-muted-foreground">{r.tenantId}</span>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) => (
        <Badge variant="outline" className="text-[10px] capitalize">
          {r.plan}
        </Badge>
      ),
      sortValue: (r) => PLAN_TIERS.indexOf(r.plan),
    },
    {
      key: "region",
      header: "Region",
      cell: (r) => (
        <span className="text-sm text-muted-foreground">{regionLabel(r.region)}</span>
      ),
      sortValue: (r) => regionLabel(r.region),
    },
    ...BENCHMARK_METRIC_KEYS.map((key) => {
      const def = BENCHMARK_METRICS[key];
      return {
        key,
        header: def.label,
        numeric: true,
        cell: (r: TenantBenchmarkRow) => <MetricCell row={r} def={def} />,
        sortValue: (r: TenantBenchmarkRow) => r[key] ?? -Infinity,
      } satisfies Column<TenantBenchmarkRow>;
    }),
  ];

  const hasFilter = filterPlan !== "all" || filterRegion !== "all";

  return (
    <Page>
      <PageHeader title="Tenant Performance Benchmarking" />
      <PageContent>
        {/* Drill-down filters — plan and region intersect (AND), both
            defaulting to an explicit "all" sentinel. */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterPlan}
            onValueChange={(v) => setFilterPlan(v as PlanTier | "all")}
          >
            <SelectTrigger className="h-9 w-44 text-xs" aria-label="Filter by plan tier">
              <SelectValue placeholder="Plan tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {PLAN_TIERS.map((p) => (
                <SelectItem key={p} value={p}>
                  <span className="capitalize">{p}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filterRegion}
            onValueChange={(v) => setFilterRegion(v)}
          >
            <SelectTrigger className="h-9 w-56 text-xs" aria-label="Filter by region">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {TENANT_REGIONS.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground">
            {filtered.length} of {rows.length} tenant{rows.length === 1 ? "" : "s"} in view
          </span>
        </div>

        {/* Cohort-mean overview — one card per metric, each carrying its
            delta vs the industry benchmark and a sentiment tone. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {BENCHMARK_METRIC_KEYS.map((key) => {
            const def = BENCHMARK_METRICS[key];
            const mean = cohortMean(filtered, key);
            const beats =
              mean !== null &&
              (def.higherIsBetter ? mean >= def.industry : mean <= def.industry);
            const delta =
              mean === null || def.industry === 0
                ? undefined
                : Math.round(
                    ((def.higherIsBetter
                      ? mean - def.industry
                      : def.industry - mean) /
                      def.industry) *
                      100,
                  );
            return (
              <MetricCard
                key={key}
                label={`Cohort · ${def.label}`}
                icon={METRIC_ICONS[key]}
                value={mean !== null ? def.format(mean) : "—"}
                delta={delta}
                deltaLabel={
                  mean !== null
                    ? `industry ${def.format(def.industry)}`
                    : key === "evalDays"
                      ? "no in-progress evaluations"
                      : "no data for this cohort"
                }
                tone={mean === null ? "default" : beats ? "positive" : "negative"}
              />
            );
          })}
        </div>

        {/* Comparison table — four metrics, each with its signed gap vs
            the row's plan target (hover the gap for the target value). */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">Tenant comparison</span>
            <p className="text-xs text-muted-foreground">
              Each tenant against its plan-tier target — the signed gap sits under every
              value: green meets or beats the bar, red misses it. Sort by any column.
            </p>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(r) => r.tenantId}
              loading={loading}
              emptyTitle={
                hasFilter ? "No tenants match these filters" : "No tenants yet"
              }
              emptyDescription={
                hasFilter
                  ? "Clear the plan or region filter to widen the cohort."
                  : "The tenant roster will appear here once tenants are provisioned."
              }
            />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
