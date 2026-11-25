/**
 * Tenant benchmarking derivations — single source of truth for the
 * Tenant Performance Benchmarking screen (super-admin).
 *
 * Why this file: the screen's docstring promised four metrics but the
 * page never computed any of them (the overview card always rendered
 * "—"). Every number now derives here from the platform seed, so the
 * comparison table, the cohort-mean cards, the CSV export, and the
 * trend tab all agree — the last point of a trend series equals the
 * table value for the same cohort.
 *
 * Metric definitions — labels, industry benchmarks, plan-tier targets —
 * are deterministic fixtures: a fixed table, no `Math.random()`, so
 * screenshots and tests stay stable. Swap them for the benchmark feed
 * at integration.
 *
 * Revenue per trader — deliberate data choice: derived as the Σ of the
 * tenant's own income transactions (challenge-fee + subscription, net
 * of refunds) FX-normalised to USD via `convertCurrency`, NOT from
 * `getFirmStatistics().totalRevenue`, which is a single hardcoded
 * constant in mock-data.ts shared by every tenant and therefore carries
 * no per-tenant signal. Payouts and affiliate commissions are outflows
 * and are excluded.
 *
 * Evaluation duration — days elapsed is derived against the seeded
 * 30-day evaluation window (`30 − daysLeft`), not the trader's join
 * date: challenges are seeded with `daysLeft` against that window, and
 * a cohort mean of join-age would just measure tenant tenure. Returns
 * `null` (never 0) when a tenant has no in-progress evaluations, so an
 * empty cohort reads as "no data" rather than "instant pass".
 */

import { formatCurrencyValue } from "@pfaas/platform-core";
import {
  getTenantChallenges,
  getTenantPayouts,
  getTenantTraders,
  getTenantTransactions,
} from "./mock-data";
import { convertCurrency } from "./currency";
import type { TenantContext } from "./types";

export type PlanTier = TenantContext["plan"];

export type BenchmarkMetricKey =
  | "passRate"
  | "evalDays"
  | "payoutFreq"
  | "revenuePerTrader";

export interface BenchmarkMetricDef {
  key: BenchmarkMetricKey;
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
  /** Operator-facing "why this matters" hint shown in the row drawer. */
  why: string;
  /** How the trend series is bucketed (shown as the chart caption). */
  trendNote: string;
}

/** Render / iteration order for the four metrics. */
export const BENCHMARK_METRIC_KEYS: BenchmarkMetricKey[] = [
  "passRate",
  "evalDays",
  "payoutFreq",
  "revenuePerTrader",
];

const signed = (v: number, decimals: number, suffix = "") =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;

export const BENCHMARK_METRICS: Record<BenchmarkMetricKey, BenchmarkMetricDef> = {
  passRate: {
    key: "passRate",
    label: "Trader pass rate",
    unit: "funded ÷ traders",
    higherIsBetter: true,
    industry: 22,
    planTargets: { starter: 16, growth: 20, scale: 24, enterprise: 28 },
    format: (v) => `${v.toFixed(1)}%`,
    gap: (v) => signed(v, 1, " pts"),
    why: "Share of traders who reach funded. Below the industry line usually means evaluation gates filter out more participants than peers do.",
    trendNote: "Cumulative funded ÷ traders, bucketed by the month traders joined.",
  },
  evalDays: {
    key: "evalDays",
    label: "Avg evaluation duration",
    unit: "days elapsed, in-progress",
    higherIsBetter: false,
    industry: 45,
    planTargets: { starter: 60, growth: 45, scale: 30, enterprise: 20 },
    format: (v) => v.toFixed(1),
    gap: (v) => signed(v, 1),
    why: "Mean days elapsed on in-progress evaluations. Faster is not automatically better — very short runs can mean thin evaluation, very long runs mean capital sits locked up.",
    trendNote: "Cumulative mean elapsed days of in-progress evaluations, bucketed by the month they started.",
  },
  payoutFreq: {
    key: "payoutFreq",
    label: "Payout frequency",
    unit: "paid payouts per funded trader",
    higherIsBetter: true,
    industry: 2,
    planTargets: { starter: 1, growth: 2, scale: 3, enterprise: 4 },
    format: (v) => v.toFixed(2),
    gap: (v) => signed(v, 2),
    why: "Paid payouts per funded trader. Below the plan target points at a payout-review backlog or funded traders who rarely request withdrawals.",
    trendNote: "Cumulative paid payouts per funded trader, bucketed by week of payout.",
  },
  revenuePerTrader: {
    key: "revenuePerTrader",
    label: "Revenue per trader",
    unit: "USD, FX-normalised",
    higherIsBetter: true,
    industry: 5000,
    planTargets: { starter: 3000, growth: 5000, scale: 8000, enterprise: 12000 },
    format: (v) => formatCurrencyValue(v, "USD", { decimals: 0 }),
    gap: (v) => signed(v, 0, " USD"),
    why: "Income per trader, FX-normalised. Under the plan target means the roster is thinly monetised — check challenge pricing, subscription mix, and refund rate.",
    trendNote: "Cumulative FX-normalised income per trader, bucketed by week (30-day transaction window).",
  },
};

/** One comparison-table row: tenant identity + the four derived metrics. */
export interface TenantBenchmarkRow {
  tenantId: string;
  name: string;
  plan: PlanTier;
  region?: string;
  /** null = no data for this cohort (never fake a 0). */
  passRate: number | null;
  evalDays: number | null;
  payoutFreq: number | null;
  revenuePerTrader: number | null;
}

/** Seeded evaluation window the challenges' `daysLeft` counts against. */
const EVAL_WINDOW_DAYS = 30;

/** Derive every benchmark metric for one tenant from the platform seed. */
export function tenantBenchmarkRow(tenant: TenantContext): TenantBenchmarkRow {
  const traders = getTenantTraders(tenant.id);

  const funded = traders.filter((t) => t.challengePhase === "funded").length;
  const passRate = traders.length > 0 ? (funded / traders.length) * 100 : null;

  const inProgress = getTenantChallenges(tenant.id).filter(
    (c) => c.status === "in-progress",
  );
  const evalDays =
    inProgress.length > 0
      ? inProgress.reduce(
          (sum, c) => sum + Math.max(0, EVAL_WINDOW_DAYS - c.daysLeft),
          0,
        ) / inProgress.length
      : null;

  const paid = getTenantPayouts(tenant.id).filter((p) => p.status === "paid");
  const payoutFreq = funded > 0 ? paid.length / funded : null;

  // Income transactions only, FX-normalised per row (tenant-beta bills
  // in GBP — see module docstring for why this beats getFirmStatistics).
  const revenueUsd = getTenantTransactions(tenant.id)
    .filter(
      (t) =>
        t.type === "challenge-fee" || t.type === "subscription" || t.type === "refund",
    )
    .reduce((sum, t) => {
      const usd = convertCurrency(t.amount, t.currency, "USD");
      return sum + (t.type === "refund" ? -usd : usd);
    }, 0);
  const revenuePerTrader = traders.length > 0 ? revenueUsd / traders.length : null;

  return {
    tenantId: tenant.id,
    name: tenant.name,
    plan: tenant.plan,
    region: tenant.region,
    passRate,
    evalDays,
    payoutFreq,
    revenuePerTrader,
  };
}

/** Cohort mean across rows; null when no row has data for the metric. */
export function cohortMean(
  rows: TenantBenchmarkRow[],
  key: BenchmarkMetricKey,
): number | null {
  const values = rows
    .map((r) => r[key])
    .filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Signed gap of `value` against the row's plan-tier target. */
export function planTargetGap(
  def: BenchmarkMetricDef,
  value: number,
  plan: PlanTier,
): number {
  return value - def.planTargets[plan];
}

/** True when `value` meets or beats the row's plan-tier target. */
export function meetsPlanTarget(
  def: BenchmarkMetricDef,
  value: number,
  plan: PlanTier,
): boolean {
  const diff = planTargetGap(def, value, plan);
  return def.higherIsBetter ? diff >= 0 : diff <= 0;
}

/* ------------------------------------------------------------------ *
 * Trend series — one deterministic series per metric for the trend
 * tab. Buckets come from the same seed dates the table derives from
 * (trader joins, challenge starts, payout processing, transaction
 * dates) — no `Math.random()`. Each series is cumulative, so the last
 * point equals the tenant row / cohort value for the same cohort.
 * Buckets with no events carry the previous value forward (the chart
 * stays continuous), and a cohort with no data returns `[]` so the
 * chart renders its empty state instead of a fake 0.
 * ------------------------------------------------------------------ */

/** Type alias (not an interface) so it stays assignable to the charts'
 *  `SeriesPoint` index signature. */
export type BenchmarkTrendPoint = {
  /** Bucket label shown on the chart's x-axis ("Jun", "Nov 24"). */
  period: string;
  value: number;
};

const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

/** UTC month index (year × 12 + month) so months expand by a step of 1. */
function monthKey(iso: string): number {
  const d = new Date(iso);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function monthLabel(key: number): string {
  return new Date(Math.floor(key / 12), key % 12, 1).toLocaleDateString(
    "en-US",
    { month: "short", timeZone: "UTC" },
  );
}

/** UTC Monday 00:00 of the week containing `iso`, as a timestamp. */
function weekKey(iso: string): number {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function weekLabel(key: number): string {
  return new Date(key).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Sorted keys with gaps expanded (months step 1, weeks step MS_WEEK). */
function expandKeys(keys: number[], step: number): number[] {
  const sorted = [...new Set(keys)].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      for (let k = sorted[i - 1] + step; k < sorted[i]; k += step) out.push(k);
    }
    out.push(sorted[i]);
  }
  return out;
}

/**
 * Fold per-bucket locals into a cumulative series. `merge` receives
 * `undefined` for gap buckets (carry the state forward); `read` maps
 * the running state to the charted value.
 */
function cumulativeFromMap<T, S>(
  locals: Map<number, T>,
  step: number,
  init: S,
  merge: (state: S, local: T | undefined) => S,
  read: (state: S) => number,
  label: (key: number) => string,
): BenchmarkTrendPoint[] {
  if (locals.size === 0) return [];
  let state = init;
  return expandKeys([...locals.keys()], step).map((key) => {
    state = merge(state, locals.get(key));
    return { period: label(key), value: read(state) };
  });
}

/**
 * Cumulative trend for one metric across a cohort of tenants.
 * Returns `[]` when the cohort has no data for the metric — the
 * caller renders the chart's empty state, never a fake 0.
 */
export function benchmarkTrend(
  tenantIds: string[],
  key: BenchmarkMetricKey,
): BenchmarkTrendPoint[] {
  switch (key) {
    case "passRate": {
      const traders = tenantIds.flatMap((id) => getTenantTraders(id));
      if (traders.length === 0) return [];
      const locals = new Map<number, { funded: number; total: number }>();
      for (const t of traders) {
        const k = monthKey(t.joinedAt);
        const cur = locals.get(k) ?? { funded: 0, total: 0 };
        cur.total += 1;
        if (t.challengePhase === "funded") cur.funded += 1;
        locals.set(k, cur);
      }
      return cumulativeFromMap(
        locals,
        1,
        { funded: 0, total: 0 },
        (s, l) =>
          l ? { funded: s.funded + l.funded, total: s.total + l.total } : s,
        (s) => (s.total > 0 ? (s.funded / s.total) * 100 : 0),
        monthLabel,
      );
    }

    case "evalDays": {
      const inProgress = tenantIds
        .flatMap((id) => getTenantChallenges(id))
        .filter((c) => c.status === "in-progress");
      if (inProgress.length === 0) return [];
      const locals = new Map<number, { sum: number; count: number }>();
      for (const c of inProgress) {
        const k = monthKey(c.createdAt);
        const cur = locals.get(k) ?? { sum: 0, count: 0 };
        cur.sum += Math.max(0, EVAL_WINDOW_DAYS - c.daysLeft);
        cur.count += 1;
        locals.set(k, cur);
      }
      return cumulativeFromMap(
        locals,
        1,
        { sum: 0, count: 0 },
        (s, l) => (l ? { sum: s.sum + l.sum, count: s.count + l.count } : s),
        (s) => (s.count > 0 ? s.sum / s.count : 0),
        monthLabel,
      );
    }

    case "payoutFreq": {
      const funded = tenantIds
        .flatMap((id) => getTenantTraders(id))
        .filter((t) => t.challengePhase === "funded").length;
      if (funded === 0) return [];
      const locals = new Map<number, number>();
      for (const id of tenantIds) {
        for (const p of getTenantPayouts(id)) {
          if (p.status !== "paid" || !p.processedAt) continue;
          const k = weekKey(p.processedAt);
          locals.set(k, (locals.get(k) ?? 0) + 1);
        }
      }
      return cumulativeFromMap(
        locals,
        MS_WEEK,
        0,
        (s, l) => s + (l ?? 0),
        (s) => s / funded,
        weekLabel,
      );
    }

    case "revenuePerTrader": {
      const traderCount = tenantIds.flatMap((id) => getTenantTraders(id))
        .length;
      if (traderCount === 0) return [];
      const locals = new Map<number, number>();
      for (const id of tenantIds) {
        for (const t of getTenantTransactions(id)) {
          if (
            t.type !== "challenge-fee" &&
            t.type !== "subscription" &&
            t.type !== "refund"
          ) {
            continue;
          }
          const usd = convertCurrency(t.amount, t.currency, "USD");
          const signed = t.type === "refund" ? -usd : usd;
          const k = weekKey(t.date);
          locals.set(k, (locals.get(k) ?? 0) + signed);
        }
      }
      return cumulativeFromMap(
        locals,
        MS_WEEK,
        0,
        (s, l) => s + (l ?? 0),
        (s) => s / traderCount,
        weekLabel,
      );
    }
  }
}
