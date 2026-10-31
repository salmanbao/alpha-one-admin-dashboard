/**
 * Usage-vs-limit forecast model (audit finding #4 — tenant billing
 * overage monitoring).
 *
 * Shared by the dedicated "Tenant Usage & Overage" dashboard
 * (usage-metering-page) and the plans page's OverageMonitoringPanel so
 * both surfaces project the SAME trend from the SAME formulas — they
 * previously kept private copies that could drift apart.
 *
 * Frontend-only: growth is a deterministic hash of (tenant, metric) —
 * stable across renders and reloads, no Math.random().
 */

/**
 * Deterministic 30-day growth rate (%) for one tenant's usage of one
 * metric — identical formula to the original plans-page implementation
 * (behavior-preserving extraction).
 *
 * @param metricKey any metric identifier ("apiCallsPerDay", "accounts", …)
 */
export function usageGrowth30d(tenantId: string, metricKey: string): number {
  const seed = (tenantId + metricKey)
    .split("")
    .reduce((s, c) => s + c.charCodeAt(0), 0);
  return 5 + (seed % 34); // 5–38% growth per 30 days
}

/**
 * Days until `used` reaches `limit` at the current 30-day trend
 * (linear projection). 0 when already at/over the ceiling,
 * Infinity when usage never grows.
 */
export function daysToLimit(
  used: number,
  limit: number,
  growthPct: number,
): number {
  if (used >= limit) return 0;
  const monthlyDelta = (used * growthPct) / 100;
  if (monthlyDelta <= 0) return Number.POSITIVE_INFINITY;
  return Math.round(((limit - used) / monthlyDelta) * 30);
}

export interface UsageForecast {
  /** Metric key projected. */
  key: string;
  /** Days until that metric's limit (0 = over now, Infinity = none ahead). */
  days: number;
  /** 30-day growth rate used for the projection. */
  growth: number;
}

/**
 * The binding forecast across a tenant's metrics — the metric that
 * will hit its ceiling soonest (over-limit metrics come back as 0 and
 * tie-break by highest utilization first).
 */
export function soonestLimit(
  metrics: Array<{ key: string; used: number; limit: number; pctUsed: number }>,
  tenantId: string,
): UsageForecast {
  let best: UsageForecast | null = null;
  let bestPct = -1;
  for (const m of metrics) {
    const growth = usageGrowth30d(tenantId, m.key);
    const days = daysToLimit(m.used, m.limit, growth);
    if (best === null || days < best.days || (days === best.days && m.pctUsed > bestPct)) {
      best = { key: m.key, days, growth };
      bestPct = m.pctUsed;
    }
  }
  return best ?? { key: "", days: Number.POSITIVE_INFINITY, growth: 0 };
}
