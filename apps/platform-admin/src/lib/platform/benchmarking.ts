/**
 * Tenant benchmarking derivations — single source of truth for the
 * Tenant Performance Benchmarking screen (super-admin).
 *
 * Why this file: the screen's docstring promised four metrics but the
 * page never computed any of them (the overview card always rendered
 * "—"). Every number now derives here from the platform seed, so the
 * comparison table, the cohort-mean cards, and future consumers (CSV
 * export, the trend tab) agree.
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
