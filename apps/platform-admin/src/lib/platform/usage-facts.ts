/**
 * Tenant usage facts (CON-10 metering) — ONE deterministic source for
 * per-tenant consumption vs plan ceilings.
 *
 * Previously the fixture lived unexported inside the Usage Metering
 * page, so any other screen that wanted to reason about consumption
 * (tenant health predictions, growth suggestions) had to duplicate the
 * numbers. This module owns them; the metering page and the tenant
 * health forecast both read from here, so the two surfaces can never
 * disagree. No Math.random — stable across renders.
 */

import type { TenantContext } from "./types";

/** Plan ceilings per CON-05 entitlements — the numbers CON-10 metering checks against. */
export const PLAN_LIMITS: Record<
  TenantContext["plan"],
  { accounts: number; apiCallsPerDay: number; storageGb: number; eventsPerDay: number }
> = {
  starter: { accounts: 1_000, apiCallsPerDay: 100_000, storageGb: 50, eventsPerDay: 10_000 },
  growth: { accounts: 5_000, apiCallsPerDay: 1_000_000, storageGb: 250, eventsPerDay: 100_000 },
  scale: { accounts: 20_000, apiCallsPerDay: 5_000_000, storageGb: 1_000, eventsPerDay: 500_000 },
  enterprise: { accounts: 50_000, apiCallsPerDay: 10_000_000, storageGb: 2_000, eventsPerDay: 1_000_000 },
};

export interface TenantUsage {
  tenantId: string;
  accounts: number;
  apiCallsPerDay: number;
  storageGb: number;
  eventsPerDay: number;
}

/** Deterministic pseudo-usage per tenant — stable across renders. */
export const USAGE: TenantUsage[] = [
  { tenantId: "tenant-alpha", accounts: 1_842, apiCallsPerDay: 742_310, storageGb: 188, eventsPerDay: 61_240 },
  { tenantId: "tenant-beta", accounts: 918, apiCallsPerDay: 88_400, storageGb: 31, eventsPerDay: 8_120 },
  { tenantId: "tenant-gamma", accounts: 3_104, apiCallsPerDay: 1_284_900, storageGb: 302, eventsPerDay: 148_500 },
];

/** Usage row for a tenant, or null when the tenant has no consumption yet. */
export function usageFor(tenantId: string): TenantUsage | null {
  return USAGE.find((u) => u.tenantId === tenantId) ?? null;
}

/** Utilisation % of a ceiling, capped at 100 for bars. */
export function pctUsed(used: number, limit: number): number {
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * Per-metric utilisation of a tenant's plan — the shared shape the
 * metering page bars and the health forecast's growth/underuse signals
 * both consume.
 */
export interface Utilization {
  accounts: number;
  apiCallsPerDay: number;
  storageGb: number;
  eventsPerDay: number;
  /** Highest single-metric utilisation — "how close is this tenant to a ceiling". */
  peak: number;
}

export function utilizationOf(t: TenantContext): Utilization | null {
  const u = usageFor(t.id);
  if (!u) return null;
  const limits = PLAN_LIMITS[t.plan];
  const accounts = pctUsed(u.accounts, limits.accounts);
  const apiCallsPerDay = pctUsed(u.apiCallsPerDay, limits.apiCallsPerDay);
  const storageGb = pctUsed(u.storageGb, limits.storageGb);
  const eventsPerDay = pctUsed(u.eventsPerDay, limits.eventsPerDay);
  return {
    accounts,
    apiCallsPerDay,
    storageGb,
    eventsPerDay,
    peak: Math.max(accounts, apiCallsPerDay, storageGb, eventsPerDay),
  };
}
