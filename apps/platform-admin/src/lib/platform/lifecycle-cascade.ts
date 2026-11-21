"use client";

/**
 * Lifecycle Cascade — downstream effects of tenant status changes.
 *
 * Gap TM-05: Suspend and terminate have no downstream cascade —
 * user sessions, impersonation and the data panel are all disconnected.
 *
 * This module provides a single cascade routine invoked by applyStatus
 * on both action surfaces (tenant-lifecycle and tenant-detail). It:
 *   1. Ends any active impersonation for the tenant.
 *   2. Revokes all tenant user sessions.
 *   3. Returns a summary of what was shut down for the operator.
 *
 * The cascade result is surfaced in the confirmation dialog so the
 * operator sees exactly what was affected.
 */

import { endImpersonation } from "./console-store";
import { revokeTenantSessions } from "./tenant-sessions-store";

export interface CascadeResult {
  sessionsRevoked: number;
  impersonationsEnded: number;
}

/**
 * Execute the lifecycle cascade for a tenant transitioning to a
 * restricted status (suspended or terminated). Returns a summary
 * of the downstream effects.
 *
 * Called by applyStatus after the status write but before the
 * notification, so the operator sees the full impact immediately.
 */
export function runLifecycleCascade(
  tenantId: string,
  tenantName: string,
  newStatus: "suspended" | "terminated",
  consoleState: { impersonations: Array<{ id: string; tenantId: string; endedAt?: number }> },
): CascadeResult {
  const result: CascadeResult = {
    sessionsRevoked: 0,
    impersonationsEnded: 0,
  };

  // 1. End any active impersonation for this tenant.
  const activeImpersonations = consoleState.impersonations.filter(
    (imp) => imp.tenantId === tenantId && !imp.endedAt,
  );
  for (const imp of activeImpersonations) {
    endImpersonation(imp.id, "manual");
    result.impersonationsEnded++;
  }

  // 2. Revoke all tenant user sessions.
  result.sessionsRevoked = revokeTenantSessions(tenantId);

  return result;
}

/**
 * Format the cascade result for display in a confirmation dialog
 * or notification message.
 */
export function formatCascadeSummary(result: CascadeResult): string {
  const parts: string[] = [];
  if (result.sessionsRevoked > 0) {
    parts.push(`${result.sessionsRevoked} session${result.sessionsRevoked === 1 ? "" : "s"} revoked`);
  }
  if (result.impersonationsEnded > 0) {
    parts.push(`${result.impersonationsEnded} impersonation${result.impersonationsEnded === 1 ? "" : "s"} ended`);
  }
  if (parts.length === 0) return "No active sessions or impersonations found.";
  return `Cascade: ${parts.join(", ")}.`;
}
