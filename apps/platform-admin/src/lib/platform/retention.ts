/**
 * Tenant retention — one truth shared by the lifecycle panel and
 * the offboarding page so the two surfaces can never disagree.
 *
 * PURGE eligibility = terminatedAt (or suspendedAt) + RETENTION_DAYS.
 * This file is the single source of truth; both pages import from here.
 */

import type { TenantContext } from "./types";

export const RETENTION_DAYS = 90;

/**
 * Returns the absolute date when a tenant becomes purge-eligible,
 * or `null` when the required anchor is absent.
 */
export function purgeEligibleAt(t: TenantContext): Date | null {
  const anchor = t.terminatedAt ?? t.suspendedAt;
  if (!anchor) return null;
  const d = new Date(anchor);
  return new Date(d.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Returns the whole number of days remaining until purge eligibility,
 * or `null` when the tenant is not on a purge path.
 */
export function daysUntilPurge(t: TenantContext): number | null {
  const eligible = purgeEligibleAt(t);
  if (!eligible) return null;
  const now = new Date();
  const diff = eligible.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}