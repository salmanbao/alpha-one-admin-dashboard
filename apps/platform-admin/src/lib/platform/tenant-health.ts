/**
 * Tenant health scoring (audit V #7) — ONE deterministic derivation
 * shared by the Tenant Health dashboard, the lifecycle list and tenant
 * detail, so the three surfaces can never disagree.
 *
 * Band (healthy / watch / critical) keeps the original rules — status
 * first, then adoption depth — while the numeric score refines severity
 * inside the band from support load and open breaches. Scores are
 * clamped into the band's range so a number never contradicts the
 * category next to it (no Math.random, stable across renders).
 */

import { supportTickets, breaches } from "./mock-data";
import { utilizationOf } from "./usage-facts";
import type { TenantContext } from "./types";

export type Health = "healthy" | "watch" | "critical";

/**
 * Health derivation — status first, then adoption depth:
 *  - critical: suspended / terminated / failed provisioning
 *  - watch:    trial / onboarding / invited / provisioning, or a live
 *              tenant running very few modules (low adoption)
 *  - healthy:  active tenants with a real module footprint
 */
export function healthOf(t: TenantContext): Health {
  if (t.status === "suspended" || t.status === "terminated" || t.status === "provisioning_failed") {
    return "critical";
  }
  if (t.status === "trial" || t.status === "onboarding" || t.status === "invited" || t.status === "provisioning") {
    return "watch";
  }
  return t.enabledModules.length >= 5 ? "healthy" : "watch";
}

/** Score ranges per band — the number stays inside the category. */
const BAND_RANGE: Record<Health, [number, number]> = {
  critical: [0, 40],
  watch: [45, 70],
  healthy: [75, 100],
};

export interface TenantHealthScore {
  /**0–100, higher = healthier, always within `band`'s range. */
  score: number;
  band: Health;
  /** Concrete next steps — empty only when nothing is outstanding. */
  recommendations: string[];
}

/**
 * Numeric health score — deterministic from lifecycle status, module
 * adoption depth, support-ticket load and open platform breaches.
 */
export function tenantHealthScore(t: TenantContext): TenantHealthScore {
  const band = healthOf(t);

  const openTickets = supportTickets.filter(
    (s) => s.tenantId === t.id && (s.status === "open" || s.status === "in-progress"),
  );
  const highTickets = openTickets.filter(
    (s) => s.priority === "high" || s.priority === "urgent",
  );
  const openBreaches = breaches.filter(
    (b) => b.tenantId === t.id && b.status === "open",
  );

  let raw = 100;
  if (t.status === "suspended" || t.status === "terminated" || t.status === "provisioning_failed") {
    raw -= 70;
  } else if (t.status !== "active") {
    raw -= 25; // trial / onboarding / invited / provisioning
  }
  // Adoption depth — the strongest positive signal (≤ −30).
  raw -= Math.max(0, 5 - t.enabledModules.length) * 6;
  // Support load — open and high-priority tickets (≤ −20).
  raw -= Math.min(20, openTickets.length * 3 + highTickets.length * 4);
  // Platform breaches — rule violations still open (≤ −20).
  raw -= Math.min(20, openBreaches.length * 5);

  const [lo, hi] = BAND_RANGE[band];
  const score = Math.max(lo, Math.min(hi, Math.round(raw)));

  const recommendations: string[] = [];
  if (band === "critical") {
    recommendations.push(
      t.status === "provisioning_failed"
        ? "Resume the failed provisioning saga from the console."
        : `Resolve the ${t.status} status first — tenant access is blocked.`,
    );
  }
  if (t.enabledModules.length < 5) {
    const missing = 5 - t.enabledModules.length;
    recommendations.push(
      `Enable ${missing} more module${missing === 1 ? "" : "s"} — adoption is the strongest health signal.`,
    );
  }
  if (highTickets.length > 0) {
    recommendations.push(
      `Close ${highTickets.length} high-priority support ticket${highTickets.length === 1 ? "" : "s"}.`,
    );
  } else if (openTickets.length > 0) {
    recommendations.push(
      `${openTickets.length} open support ticket${openTickets.length === 1 ? "" : "s"} — keep first-response times short.`,
    );
  }
  if (openBreaches.length > 0) {
    recommendations.push(
      `${openBreaches.length} open platform breach${openBreaches.length === 1 ? "" : "es"} — review limits and rules with the trader.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push("Nothing outstanding — keep the current cadence.");
  }

  return { score, band, recommendations };
}

/* ------------------------------------------------------------------ */
/* Predictive layer (audit finding #8) — churn risk + growth signals   */
/* ------------------------------------------------------------------ */

export type ChurnRisk = "high" | "medium" | "low";

export interface TenantForecast {
  /** 0–100, higher = more likely to churn in the next 90 days. */
  churnScore: number;
  churnRisk: ChurnRisk;
  /** Why the score is what it is — one line per contributing factor. */
  churnDrivers: string[];
  /** Highest plan-metric utilisation, or null when the tenant has no usage row. */
  peakUtilization: number | null;
  /** Tenant is at/over 80% of a plan ceiling → upgrade conversation. */
  nearLimit: boolean;
  /** Tenant sits under 20% everywhere → adoption/growth conversation. */
  underutilized: boolean;
  /** Personalised next step for this tenant — empty when nothing applies. */
  suggestions: string[];
}

/** Plan tier order — used to name the next tier in upgrade suggestions. */
const PLAN_TIERS: TenantContext["plan"][] = ["starter", "growth", "scale", "enterprise"];

/**
 * Deterministic forecast per tenant: churn risk from the same signals
 * health scoring uses (status, adoption, support load, breaches) plus
 * consumption vs plan ceiling from usage-facts, so the prediction never
 * contradicts the health number shown next to it.
 */
export function tenantForecast(t: TenantContext): TenantForecast {
  const openTickets = supportTickets.filter(
    (s) => s.tenantId === t.id && (s.status === "open" || s.status === "in-progress"),
  );
  const highTickets = openTickets.filter(
    (s) => s.priority === "high" || s.priority === "urgent",
  );
  const openBreaches = breaches.filter((b) => b.tenantId === t.id && b.status === "open");
  const util = utilizationOf(t);

  const drivers: string[] = [];
  let churn = 0;

  if (t.status === "suspended" || t.status === "terminated" || t.status === "provisioning_failed") {
    churn += 45;
    drivers.push(`Status is ${t.status.replace(/_/g, " ")} — access is already blocked.`);
  } else if (t.status !== "active") {
    churn += 30;
    drivers.push(`Still in ${t.status} — never converted to an active tenant.`);
  }
  if (t.enabledModules.length < 5) {
    const missing = 5 - t.enabledModules.length;
    churn += Math.min(24, missing * 8);
    drivers.push(`Only ${t.enabledModules.length} module${t.enabledModules.length === 1 ? "" : "s"} enabled — shallow adoption.`);
  }
  if (highTickets.length > 0) {
    churn += Math.min(18, highTickets.length * 9);
    drivers.push(`${highTickets.length} high-priority ticket${highTickets.length === 1 ? "" : "s"} open.`);
  }
  if (openBreaches.length > 0) {
    churn += Math.min(12, openBreaches.length * 6);
    drivers.push(`${openBreaches.length} open breach${openBreaches.length === 1 ? "" : "es"} unresolved.`);
  }
  if (util && util.peak < 20) {
    churn += 12;
    drivers.push(`Consumption under 20% of the ${t.plan} plan — low realised value.`);
  }

  const churnScore = Math.min(100, churn);
  const churnRisk: ChurnRisk = churnScore >= 60 ? "high" : churnScore >= 30 ? "medium" : "low";
  const nearLimit = util ? util.peak >= 80 : false;
  const underutilized = util ? util.peak < 20 : false;

  const suggestions: string[] = [];
  if (nearLimit && util) {
    const tierIdx = PLAN_TIERS.indexOf(t.plan);
    const nextTier = PLAN_TIERS[tierIdx + 1];
    const metricLabel =
      util.peak === util.accounts
        ? "accounts"
        : util.peak === util.apiCallsPerDay
          ? "API calls"
          : util.peak === util.storageGb
            ? "storage"
            : "events";
    suggestions.push(
      nextTier
        ? `At ${util.peak}% of the ${t.plan} ${metricLabel} ceiling — open an upgrade conversation to ${nextTier}.`
        : `At ${util.peak}% of the enterprise ${metricLabel} ceiling — discuss overage pricing before the next cycle.`,
    );
  }
  if (underutilized) {
    const disabled = 5 - t.enabledModules.length;
    suggestions.push(
      disabled > 0
        ? `Usage is flat across every metric — run an adoption review and enable ${disabled} more module${disabled === 1 ? "" : "s"}.`
        : "Usage is flat across every metric despite full module coverage — schedule a value-review call.",
    );
  }
  if (churnRisk === "high") {
    suggestions.unshift(
      churn >= 60
        ? "High churn risk — assign an owner and open a save play this week."
        : "Elevated churn risk — proactive check-in recommended.",
    );
  } else if (churnRisk === "medium" && !underutilized && !nearLimit) {
    suggestions.push("Moderate churn risk — keep the quarterly success cadence.");
  }

  return { churnScore, churnRisk, churnDrivers: drivers, peakUtilization: util?.peak ?? null, nearLimit, underutilized, suggestions };
}

/** Aggregate forecast across tenants — the counts the health dashboard cards show. */
export function forecastSummary(forecasts: TenantForecast[]): {
  high: number;
  medium: number;
  low: number;
  nearLimit: number;
  underutilized: number;
} {
  return {
    high: forecasts.filter((f) => f.churnRisk === "high").length,
    medium: forecasts.filter((f) => f.churnRisk === "medium").length,
    low: forecasts.filter((f) => f.churnRisk === "low").length,
    nearLimit: forecasts.filter((f) => f.nearLimit).length,
    underutilized: forecasts.filter((f) => f.underutilized).length,
  };
}
