"use client";

/**
 * Impersonation policy (CON-07) — the single deny-list + status gate
 * shared by every impersonation entry point (Tenant View-As and the
 * tenant-detail "Login as" action).
 *
 * Gap P0-1/T-20: the deny-list used to live only on the View-As page
 * and was keyed `"gamma-futures"` while matching against raw tenant ids
 * (`tenant-gamma`) and slugs (`gamma`) — so the advertised abuse block
 * never matched anything. Matching now normalizes id, slug AND name, so
 * a blocked tenant is blocked from every entry point.
 */

import type { TenantContext } from "@/lib/platform/types";

/** Tenants that must never be impersonated, with the surfaced reason. */
export const IMPERSONATION_DENY_LIST: Record<string, string> = {
  "gamma-futures": "Under abuse investigation AB-131 — impersonation blocked",
};

const TENANT_BLOCKED_STATUS = {
  suspended: "Tenant is suspended — reactivate before impersonating",
  terminated: "Tenant is terminated — impersonation impossible",
} as const;

/** `Gamma Futures` / `tenant_gamma` → `gamma-futures` style keys. */
const normalize = (s: string): string =>
  s.toLowerCase().trim().replace(/[\s_]+/g, "-");

/**
 * Why this tenant cannot be impersonated — `null` when allowed.
 * Checked against the deny-list (id/slug/name) and terminal tenant
 * status, in that order.
 */
export function impersonationDenyReason(
  tenant: Pick<TenantContext, "id" | "slug" | "name" | "status">,
): string | null {
  for (const key of [tenant.id, tenant.slug, tenant.name]) {
    const hit = IMPERSONATION_DENY_LIST[normalize(key)];
    if (hit) return hit;
  }
  const statusBlock =
    TENANT_BLOCKED_STATUS[tenant.status as keyof typeof TENANT_BLOCKED_STATUS];
  return statusBlock ?? null;
}
