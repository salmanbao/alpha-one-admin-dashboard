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
 * Drill-down filters: plan tier (segment), region (derived from the
 * tenant's IANA timezone) and the metric the charts/insights follow.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { AreaSeries, BarSeries } from "@/components/platform/charts";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  tenants as allTenants,
  getTenantTraders,
  getTenantChallenges,
  getTenantPayouts,
  getTenantTransactions,
} from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Gauge,
  Lightbulb,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Metric dictionary                                                    */
/* ------------------------------------------------------------------ */

type PlanTier = TenantContext["plan"];
type MetricKey = "passRate" | "evalDays" | "payoutFreq" | "revenuePerTrader";

interface MetricDef {
  key: MetricKey;
  label: string;
  /** Short unit note shown under charts / table headers. */
  unit: string;
  /** True when a higher number is the good outcome. */
  higherIsBetter: boolean;
  /** Illustrative industry benchmark (fixed fixture). */
  industry: number;
  /** Plan-tier targets — enterprise is held to a stricter bar. */
  planTargets: Record<PlanTier, number>;
  format: (v: number) => string;
  /** Signed formatter for a difference against a reference. */
  gap: (v: number) => string;
}

const METRICS: Record<MetricKey, MetricDef> = {
  passRate: {
    key: "passRate",
    label: "Trader pass rate",
    unit: "funded ÷ traders",
    higherIsBetter: true,
    industry: 22,
    planTargets: { starter: 16, growth: 20, scale: 24, enterprise: 28 },
    format: (v) => `${v.toFixed(0)}%`,
    gap: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} pts`,
  },
  evalDays: {
    key: "evalDays",
    label: "Avg evaluation duration",
    unit: "days in evaluation",
    higherIsBetter: false,
    // Calibrated to the seeded 30-day evaluation window (observed tenant
    // means sit at 9–13 d): industry clears at 18 d and each tier is held
    // to a stricter bar, so targets can never exceed the window itself.
    industry: 18,
    planTargets: { starter: 24, growth: 20, scale: 17, enterprise: 15 },
    format: (v) => `${v.toFixed(0)} d`,
    gap: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} d`,
  },
  payoutFreq: {
    key: "payoutFreq",
    label: "Payout frequency",
    unit: "paid payouts / funded trader",
    higherIsBetter: true,
    industry: 1.4,
    planTargets: { starter: 1.0, growth: 1.3, scale: 1.6, enterprise: 1.9 },
    format: (v) => `${v.toFixed(1)}×`,
    gap: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}×`,
  },
  revenuePerTrader: {
    key: "revenuePerTrader",
    label: "Revenue per trader",
    unit: "USD-normalised",
    higherIsBetter: true,
    // Calibrated to the seeded fee/subscription mix (observed tenant means
    // $1.7k–$2.8k per trader) so the reference sits mid-pack rather than
    // an order of magnitude below every tenant.
    industry: 2000,
    planTargets: { starter: 1600, growth: 2000, scale: 2300, enterprise: 2600 },
    format: (v) => formatCurrency(v, "USD"),
    gap: (v) => `${v >= 0 ? "+" : "−"}${formatCurrency(Math.abs(v), "USD")}`,
  },
};

const METRIC_ORDER: MetricKey[] = ["passRate", "evalDays", "payoutFreq", "revenuePerTrader"];
const PLAN_TIERS: PlanTier[] = ["starter", "growth", "scale", "enterprise"];
const PLAN_LABEL: Record<PlanTier, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  enterprise: "Enterprise",
};

/** Fixed FX table — GBP/EUR tenants normalised to USD for comparison. */
const FX_TO_USD: Record<string, number> = { USD: 1, GBP: 1.27, EUR: 1.08 };

/** Region derived from the tenant's IANA timezone (no extra field needed). */
function regionOf(tenant: TenantContext): string {
  const tz = tenant.timezone;
  if (tz.startsWith("America/")) return "North America";
  if (tz.startsWith("Europe/")) return "Europe";
  if (tz.startsWith("Asia/") || tz.startsWith("Australia/")) return "Asia-Pacific";
  if (tz.startsWith("Africa/")) return "Africa";
  return "Other";
}

/* ------------------------------------------------------------------ */
/* Row model + deterministic metric computation                         */
/* ------------------------------------------------------------------ */

interface TenantBenchmark {
  id: string;
  name: string;
  shortName: string;
  plan: PlanTier;
  region: string;
  currency: string;
  /** Raw numerators kept so portfolio aggregates stay exact. */
  traders: number;
  funded: number;
  paidPayouts: number;
  revenueUsd: number;
  values: Record<MetricKey, number>;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function buildRows(): TenantBenchmark[] {
  return allTenants
    .filter((t) => t.id !== "platform")
    .map((t) => {
      const traders = getTenantTraders(t.id);
      const funded = traders.filter((tr) => tr.challengePhase === "funded").length;
      const paidPayouts = getTenantPayouts(t.id).filter((p) => p.status === "paid").length;
      const fx = FX_TO_USD[t.currency] ?? 1;
      const revenueUsd = getTenantTransactions(t.id)
        .filter((x) => x.type === "challenge-fee" || x.type === "subscription")
        .reduce((s, x) => s + x.amount * fx, 0);
      // Days elapsed inside the 30-day evaluation window, averaged over
      // the tenant's in-progress evaluations.
      const challenges = getTenantChallenges(t.id);
      const evalDays = challenges.length
        ? mean(challenges.map((c) => 30 - c.daysLeft))
        : 0;

      return {
        id: t.id,
        name: t.name,
        shortName: t.name.split(" ")[0],
        plan: t.plan,
        region: regionOf(t),
        currency: t.currency,
        traders: traders.length,
        funded,
        paidPayouts,
        revenueUsd,
        values: {
          passRate: traders.length > 0 ? (funded / traders.length) * 100 : 0,
          evalDays,
          payoutFreq: funded > 0 ? paidPayouts / funded : 0,
          revenuePerTrader: traders.length > 0 ? revenueUsd / traders.length : 0,
        },
      };
    });
}

/** Exact portfolio aggregate for a metric (weighted where it matters). */
function aggregate(rows: TenantBenchmark[], key: MetricKey): number {
  if (!rows.length) return 0;
  const traders = rows.reduce((s, r) => s + r.traders, 0);
  const funded = rows.reduce((s, r) => s + r.funded, 0);
  switch (key) {
    case "passRate":
      return traders > 0 ? (rows.reduce((s, r) => s + r.funded, 0) / traders) * 100 : 0;
    case "payoutFreq":
      return funded > 0 ? rows.reduce((s, r) => s + r.paidPayouts, 0) / funded : 0;
    case "revenuePerTrader":
      return traders > 0 ? rows.reduce((s, r) => s + r.revenueUsd, 0) / traders : 0;
    case "evalDays":
      return mean(rows.map((r) => r.values.evalDays));
  }
}

const meets = (value: number, target: number, def: MetricDef) =>
  def.higherIsBetter ? value >= target : value <= target;

/** Signed gap where positive always means "better than the reference". */
function signedGap(value: number, target: number, def: MetricDef): number {
  const raw = value - target;
  return def.higherIsBetter ? raw : -raw;
}

/* ------------------------------------------------------------------ */
/* Deterministic 12-month trend (no Math.random)                        */
/* ------------------------------------------------------------------ */

function trendSeries(def: MetricDef, center: number) {
  const amplitude =
    def.key === "revenuePerTrader"
      ? Math.max(center * 0.16, 12)
      : def.key === "payoutFreq"
        ? 0.16
        : def.key === "evalDays"
          ? 3.5
          : 3;
  const step = amplitude * 0.07;
  const dp = def.key === "revenuePerTrader" ? 0 : 1;
  return Array.from({ length: 12 }, (_, i) => {
    const monthsAgo = 11 - i;
    const seasonal = Math.sin((monthsAgo + 1) / 1.9) * amplitude;
    // Past is worse than today: drift away from the current value in the
    // direction that represents "worse" for this metric.
    const drift = (def.higherIsBetter ? -1 : 1) * monthsAgo * step;
    return {
      date: `M-${monthsAgo}`,
      value: Number((center + seasonal + drift).toFixed(dp)),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Visual: value vs reference bars                                      */
/* ------------------------------------------------------------------ */

function BenchmarkBars({
  rows,
  format,
  referenceLabel,
}: {
  rows: { id: string; label: string; value: number; target: number }[];
  format: (v: number) => string;
  referenceLabel: string;
}) {
  const max = Math.max(...rows.flatMap((r) => [r.value, r.target]), 0.0001) * 1.15;
  return (
    <div className="space-y-3.5">
      {rows.map((r) => {
        const pct = Math.min(100, (r.value / max) * 100);
        const targetPct = Math.min(100, (r.target / max) * 100);
        const better = r.value >= r.target;
        return (
          <div key={r.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">{r.label}</span>
              <span className="tabular-nums">
                <span className={cn("font-semibold", better ? "text-emerald-600" : "text-rose-600")}>
                  {format(r.value)}
                </span>
                <span className="text-muted-foreground"> / {format(r.target)}</span>
              </span>
            </div>
            <div className="relative h-2.5 rounded-full bg-muted" aria-hidden="true">
              <div
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  better ? "bg-emerald-500" : "bg-rose-500",
                )}
                style={{ width: `${pct}%` }}
              />
              <span
                className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/60"
                style={{ left: `calc(${targetPct}% - 1px)` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-muted-foreground">
        Bar = tenant result · marker = {referenceLabel} · green meets it, red misses it.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const ADVICE: Record<MetricKey, (name: string, value: string, target: string) => string> = {
  passRate: (n, v, t) =>
    `${n} funds ${v} of traders against a ${t} industry benchmark — review challenge difficulty, coaching touchpoints and onboarding friction before the next cohort.`,
  evalDays: (n, v, t) =>
    `${n} takes ${v} to move a trader through evaluation against ${t} industry — check for stalled evaluations and add progress nudges at day 7 and day 14.`,
  payoutFreq: (n, v, t) =>
    `${n} pays ${v} per funded trader against ${t} industry — audit payout request friction and approval queue latency; slower payouts read as a weaker program.`,
  revenuePerTrader: (n, v, t) =>
    `${n} earns ${v} per trader against ${t} industry — inspect pricing tier, add-on attach rate and challenge mix for room to grow yield.`,
};

export function TenantBenchmarkingPage() {
  const { navigate } = usePlatform();

  const {
    data: rows = [],
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => buildRows(), { delayMs: 450 }), []);

  const [planFilter, setPlanFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [metricKey, setMetricKey] = useState<MetricKey>("passRate");

  const def = METRICS[metricKey];
  const regions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.region))).sort(),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (planFilter === "all" || r.plan === planFilter) &&
          (regionFilter === "all" || r.region === regionFilter),
      ),
    [rows, planFilter, regionFilter],
  );

  const portfolio = aggregate(filtered, metricKey);
  const gap = signedGap(portfolio, def.industry, def);
  const meetsCount = filtered.filter((r) => meets(r.values[metricKey], def.industry, def)).length;

  const tiersInView = PLAN_TIERS.filter((p) => filtered.some((r) => r.plan === p));

  const trend = useMemo(() => trendSeries(def, portfolio || def.industry), [def, portfolio]);

  const tenantBars = filtered.map((r) => ({
    name: r.shortName,
    value: Number(r.values[metricKey].toFixed(2)),
  }));

  const industryBars = filtered.map((r) => ({
    id: r.id,
    label: r.name,
    value: r.values[metricKey],
    target: def.industry,
  }));

  const tierBars = filtered.map((r) => ({
    id: r.id,
    label: `${r.name} (${PLAN_LABEL[r.plan]})`,
    value: r.values[metricKey],
    target: def.planTargets[r.plan],
  }));

  const laggards = filtered.filter((r) => !meets(r.values[metricKey], def.industry, def));

  const columns: Column<TenantBenchmark>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {PLAN_LABEL[r.plan]} · {r.region}
          </p>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "passRate",
      header: "Pass rate",
      cell: (r) => <span className="tabular-nums">{METRICS.passRate.format(r.values.passRate)}</span>,
      sortValue: (r) => r.values.passRate,
      numeric: true,
    },
    {
      key: "evalDays",
      header: "Eval days",
      cell: (r) => <span className="tabular-nums">{METRICS.evalDays.format(r.values.evalDays)}</span>,
      sortValue: (r) => r.values.evalDays,
      numeric: true,
    },
    {
      key: "payoutFreq",
      header: "Payouts",
      cell: (r) => (
        <span className="tabular-nums">{METRICS.payoutFreq.format(r.values.payoutFreq)}</span>
      ),
      sortValue: (r) => r.values.payoutFreq,
      numeric: true,
    },
    {
      key: "revenue",
      header: "Rev / trader",
      cell: (r) => (
        <span className="tabular-nums">
          {METRICS.revenuePerTrader.format(r.values.revenuePerTrader)}
        </span>
      ),
      sortValue: (r) => r.values.revenuePerTrader,
      numeric: true,
    },
    {
      key: "vsIndustry",
      header: `Vs ${def.format(def.industry)} benchmark`,
      cell: (r) => {
        const value = r.values[metricKey];
        const ok = meets(value, def.industry, def);
        const gapValue = signedGap(value, def.industry, def);
        const near = !ok && Math.abs(gapValue) <= Math.abs(def.industry) * 0.1;
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge tone={ok ? "success" : near ? "warning" : "danger"}>
              {ok ? "Meets benchmark" : near ? "Near benchmark" : "Below benchmark"}
            </StatusBadge>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {/* signedGap is positive when better, so the word follows the sign */}
              {def.gap(gapValue)} {gapValue >= 0 ? "ahead" : "behind"}
            </span>
          </div>
        );
      },
      sortValue: (r) => signedGap(r.values[metricKey], def.industry, def),
    },
  ];

  const filters = (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Plan tier (segment)
          </p>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-44" aria-label="Filter by plan tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plan tiers</SelectItem>
              {PLAN_TIERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PLAN_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Region
          </p>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-44" aria-label="Filter by region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regions.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Benchmark metric
          </p>
          <Select value={metricKey} onValueChange={(v) => setMetricKey(v as MetricKey)}>
            <SelectTrigger className="w-56" aria-label="Select benchmark metric">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRIC_ORDER.map((key) => (
                <SelectItem key={key} value={key}>
                  {METRICS[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mb-0.5"
          onClick={() => {
            setPlanFilter("all");
            setRegionFilter("all");
            setMetricKey("passRate");
          }}
        >
          Reset filters
        </Button>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {filtered.length} of {rows.length} tenants in view
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Page>
      <PageHeader
        title="Tenant Benchmarking"
        description="Peer and industry comparison of pass rates, evaluation duration, payout frequency and revenue per trader — by plan tier and region."
        icon={Gauge}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("platform-analytics")}>
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Platform analytics
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={rows.length > 0}
          loadingLabel="Loading benchmark data…"
        >
          <div className="space-y-4">
            {filters}

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <Target className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">No tenants match these filters</p>
                    <p className="text-xs text-muted-foreground">
                      Widen the plan tier or region to bring tenants back into the comparison.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPlanFilter("all");
                      setRegionFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <MetricCard
                    label={`Portfolio — ${def.label}`}
                    value={def.format(portfolio)}
                    icon={Gauge}
                    tone={meets(portfolio, def.industry, def) ? "positive" : "negative"}
                    deltaLabel={def.unit}
                  />
                  <MetricCard
                    label="Industry benchmark"
                    value={def.format(def.industry)}
                    icon={Target}
                    deltaLabel="illustrative feed"
                  />
                  <MetricCard
                    label="Gap vs benchmark"
                    value={def.gap(signedGap(portfolio, def.industry, def))}
                    icon={gap >= 0 ? TrendingUp : TrendingDown}
                    tone={gap >= 0 ? "positive" : "negative"}
                    deltaLabel={gap >= 0 ? "ahead of industry" : "behind industry"}
                  />
                  <MetricCard
                    label="Tenants meeting benchmark"
                    value={`${meetsCount} of ${filtered.length}`}
                    icon={Users}
                    tone={meetsCount === filtered.length ? "positive" : "warning"}
                    deltaLabel={def.label.toLowerCase()}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <span className="text-sm font-medium">
                        {def.label} by tenant
                      </span>
                    </CardHeader>
                    <CardContent>
                      <BarSeries
                        data={tenantBars}
                        xKey="name"
                        yKey="value"
                        color="#0f766e"
                        height={220}
                        formatValue={(v) => def.format(v)}
                        label={`${def.label} per tenant — ${tenantBars
                          .map((d) => `${d.name}: ${def.format(d.value)}`)
                          .join(", ")}. Industry benchmark ${def.format(def.industry)}.`}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <span className="text-sm font-medium">Against industry benchmark</span>
                    </CardHeader>
                    <CardContent>
                      <BenchmarkBars
                        rows={industryBars}
                        format={def.format}
                        referenceLabel={`${def.label.toLowerCase()} industry benchmark (${def.format(def.industry)})`}
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <span className="text-sm font-medium">Against plan-tier targets</span>
                    </CardHeader>
                    <CardContent>
                      <BenchmarkBars
                        rows={tierBars}
                        format={def.format}
                        referenceLabel="the target for each tenant's plan tier"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {def.label} — 12-month trend
                      </span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        benchmark {def.format(def.industry)}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <AreaSeries
                        data={trend}
                        xKey="date"
                        yKey="value"
                        color="#0f766e"
                        height={220}
                        formatValue={(v) => def.format(v)}
                        label={`Portfolio ${def.label.toLowerCase()} over 12 months, ending at ${def.format(portfolio)} against a ${def.format(def.industry)} industry benchmark.`}
                      />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Portfolio {def.format(portfolio)} today · industry {def.format(def.industry)} ·
                        plan-tier targets{" "}
                        {tiersInView.map((t) => `${PLAN_LABEL[t]} ${def.format(def.planTargets[t])}`).join(" · ")}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <span className="text-sm font-medium">Tenant comparison</span>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      columns={columns}
                      data={filtered}
                      rowKey={(r) => r.id}
                      searchableText={(r) => `${r.name} ${r.plan} ${r.region}`}
                      searchPlaceholder="Search tenants…"
                      pageSize={10}
                      emptyTitle="No tenants found"
                      emptyDescription="Adjust the plan tier or region filter."
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    <span className="text-sm font-medium">
                      Recommendations — {def.label.toLowerCase()}
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {laggards.length === 0 ? (
                      <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                        <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>
                          All {filtered.length} tenants in view meet or beat the{" "}
                          {def.format(def.industry)} industry benchmark for {def.label.toLowerCase()}.
                          Keep the current playbook and re-check after the next cohort.
                        </span>
                      </div>
                    ) : (
                      laggards.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
                        >
                          <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                          <span>
                            {ADVICE[metricKey](
                              r.name,
                              def.format(r.values[metricKey]),
                              def.format(def.industry),
                            )}
                          </span>
                        </div>
                      ))
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Benchmarks and plan-tier targets are deterministic fixtures — replace the
                      tables in this file with the benchmark feed when the backend exposes it.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
