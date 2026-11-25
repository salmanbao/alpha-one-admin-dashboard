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
 * Drill-down filters live in the URL (`?plan=&region=`): plan tier
 * (segment) and region (the tenant's data-residency pin — canonical
 * ids from `lib/platform/regions.ts`, matched by equality). Both
 * default to an explicit `"all"` sentinel and intersect (AND) — a
 * region filter never masks the plan filter. Shareable links, back
 * button, and refresh all restore the exact cohort.
 *
 * Row click opens the benchmark drawer: the tenant's four values vs
 * both reference points, each with a "why this matters" hint, plus
 * jumps to the tenant detail and the fleet view.
 *
 * All derivations live in `lib/platform/benchmarking.ts`: null-safe
 * (a metric with no cohort data renders "—", never a fake 0) and
 * seed-derived — no per-screen metric maps.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/platform/data-table";
import { PageAsyncBoundary, EmptyState } from "@/components/platform/guards";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { useTenants } from "@/lib/platform/tenant-store";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  TENANT_REGIONS,
  TENANT_REGION_IDS,
  regionLabel,
} from "@/lib/platform/regions";
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
import { DollarSign, Timer, Users, Wallet, Building2 } from "lucide-react";

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

/** URL params → filter values; unknown/stale values fall back to "all". */
function parseParams(params: Record<string, string>): {
  plan: PlanTier | "all";
  region: string;
} {
  const plan = params.plan;
  const region = params.region;
  return {
    plan: plan && (PLAN_TIERS as string[]).includes(plan) ? (plan as PlanTier) : "all",
    region: region && TENANT_REGION_IDS.includes(region) ? region : "all",
  };
}

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
  const { router, navigate } = usePlatform();
  const { data: hydrated, loading, error, retry } = useAsyncMock(
    () => mockAsync(() => true, { delayMs: 400 }),
    [],
  );
  const tenants = useTenants();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { plan: filterPlan, region: filterRegion } = useMemo(
    () => parseParams(router.params),
    [router.params],
  );

  const setFilter = (key: "plan" | "region", value: string) => {
    const next: Record<string, string> = { ...router.params };
    if (value === "all") delete next[key];
    else next[key] = value;
    navigate("tenant-benchmarking", next, { replace: true });
  };

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

  const selected = useMemo(
    () => rows.find((r) => r.tenantId === selectedId) ?? null,
    [rows, selectedId],
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
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading benchmark data…"
        >
          {/* Drill-down filters — plan and region intersect (AND), both
              defaulting to an explicit "all" sentinel, both persisted
              in the URL so the cohort is shareable. */}
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filterPlan}
              onValueChange={(v) => setFilter("plan", v)}
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
              onValueChange={(v) => setFilter("region", v)}
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
              the row's plan target (hover the gap for the target value).
              Click a row for the benchmark drawer. */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={hasFilter ? Building2 : Users}
              title={
                hasFilter ? "No tenants match these filters" : "No tenants yet"
              }
              description={
                hasFilter
                  ? "The current plan/region combination excludes every tenant in the roster."
                  : "The tenant roster will appear here once tenants are provisioned."
              }
              hint={hasFilter ? undefined : "Provision a tenant to benchmark it."}
              action={
                hasFilter ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const next = { ...router.params };
                      delete next.plan;
                      delete next.region;
                      navigate("tenant-benchmarking", next, { replace: true });
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <span className="text-sm font-medium">Tenant comparison</span>
                <p className="text-xs text-muted-foreground">
                  Each tenant against its plan-tier target — the signed gap sits under every
                  value: green meets or beats the bar, red misses it. Sort by any column,
                  or click a row for the full benchmark breakdown.
                </p>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={columns}
                  data={filtered}
                  rowKey={(r) => r.tenantId}
                  loading={loading}
                  onRowClick={(r) => setSelectedId(r.tenantId)}
                />
              </CardContent>
            </Card>
          )}
        </PageAsyncBoundary>

        {/* Benchmark drawer — values vs both reference points, with
            why-hints and cross-links (P1). */}
        <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            {selected ? (
              <>
                <SheetHeader>
                  <SheetTitle>{selected.name}</SheetTitle>
                  <SheetDescription>
                    {selected.tenantId} · {selected.plan} plan ·{" "}
                    {regionLabel(selected.region)}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Each value against the industry benchmark and this tenant's
                    plan-tier target:
                  </p>
                  {BENCHMARK_METRIC_KEYS.map((key) => {
                    const def = BENCHMARK_METRICS[key];
                    const value = selected[key];
                    const good =
                      value !== null && meetsPlanTarget(def, value, selected.plan);
                    return (
                      <div key={key} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{def.label}</span>
                          {value === null ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <span className="font-mono tabular-nums text-sm">
                              {def.format(value)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <span>Industry {def.format(def.industry)}</span>
                          <span>
                            Plan target {def.format(def.planTargets[selected.plan])}
                          </span>
                          {value !== null ? (
                            <span
                              className={cn(
                                "font-medium",
                                good
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400",
                              )}
                            >
                              {def.gap(planTargetGap(def, value, selected.plan))} vs
                              target
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {def.why}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const id = selected.tenantId;
                      setSelectedId(null);
                      navigate("tenant-detail", { id });
                    }}
                  >
                    Open tenant detail
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedId(null);
                      navigate("platform-analytics");
                    }}
                  >
                    Compare in fleet view
                  </Button>
                </div>
              </>
            ) : null}
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}
