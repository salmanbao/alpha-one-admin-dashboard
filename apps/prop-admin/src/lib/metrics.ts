/**
 * PFaaS Platform — Metric Catalogue
 *
 * Single source of truth for business KPI definitions. Every metric has
 * a stable id, an operator-facing label, a one-line definition (what the
 * number actually means) and a display format — so analytics, payout and
 * risk pages stop inventing parallel names/formulas for the same KPI,
 * and docs can render from the same catalogue the UI uses.
 *
 * The pure calculation helpers below centralise the ratios that were
 * previously inlined across pages (with inconsistent divide-by-zero
 * handling — one call site produced NaN when a tenant had no trades).
 * Pages import these instead of re-deriving the math.
 */

export type MetricFormat = "currency" | "percent" | "count" | "ratio";

export interface MetricDefinition {
  /** Stable id — matches docs / exports / saved views. */
  id: string;
  /** Operator-facing label (MetricCard `label`). */
  label: string;
  /** One-line definition surfaced in contextual help (§14). */
  description: string;
  format: MetricFormat;
}

/** Round to `digits` decimals (avoids float artefacts like 83.99999). */
export function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * Percentage with explicit zero-denominator handling — returns 0 instead
 * of NaN/Infinity when `whole` is 0 (empty tenant, no trades yet).
 */
export function ratePct(part: number, whole: number, digits = 1): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return round((part / whole) * 100, digits);
}

/** Win rate from raw win/loss counts, 0–100, no decimals. */
export function winRatePct(wins: number, losses: number): number {
  return ratePct(wins, wins + losses, 0);
}

/** Profit margin = net profit / revenue, percent. */
export function profitMarginPct(netProfit: number, revenue: number): number {
  return ratePct(netProfit, revenue);
}

/** Payout ratio = paid-out amount / revenue, percent. */
export function payoutRatioPct(paidOut: number, revenue: number): number {
  return ratePct(paidOut, revenue);
}

/** Average order/challenge value = revenue / units sold. */
export function avgOrderValue(revenue: number, units: number): number {
  if (!Number.isFinite(units) || units <= 0) return 0;
  return revenue / units;
}

/**
 * Funded-trader conversion = funded accounts / total traders, percent,
 * clamped to 0.1–10% (matches the dashboard's smoothing of tiny demo
 * populations so the KPI doesn't swing to 0% or 100%).
 */
export function fundedConversionPct(funded: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(10, Math.max(0.1, ratePct(funded, total)));
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

export const METRICS = {
  totalRevenue: {
    id: "total-revenue",
    label: "Total Revenue",
    description: "Gross revenue from challenge sales and fees in the selected period.",
    format: "currency",
  },
  netProfit: {
    id: "net-profit",
    label: "Net Profit",
    description: "Total revenue minus payouts paid to traders.",
    format: "currency",
  },
  profitMargin: {
    id: "profit-margin",
    label: "Profit Margin",
    description: "Net profit as a percentage of total revenue.",
    format: "percent",
  },
  payoutRatio: {
    id: "payout-ratio",
    label: "Payout Ratio",
    description: "Payouts paid as a percentage of total revenue.",
    format: "percent",
  },
  avgChallengeValue: {
    id: "avg-challenge-value",
    label: "Avg Challenge Value",
    description: "Total revenue divided by challenges sold.",
    format: "currency",
  },
  challengesSold: {
    id: "challenges-sold",
    label: "Challenges Sold",
    description: "Number of challenge purchases in the selected period.",
    format: "count",
  },
  winRate: {
    id: "win-rate",
    label: "Win Rate",
    description: "Winning trades as a percentage of all closed trades.",
    format: "percent",
  },
  fundedConversion: {
    id: "funded-conversion",
    label: "Conversion Rate",
    description: "Traders who reached funded status as a percentage of all traders.",
    format: "percent",
  },
  avgOrderValue: {
    id: "avg-order-value",
    label: "Avg Order Value",
    description: "Total revenue divided by the number of orders.",
    format: "currency",
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRICS;

/** Look up a metric definition by catalogue key. */
export function metric(id: MetricId): MetricDefinition {
  return METRICS[id];
}
