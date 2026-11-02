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
