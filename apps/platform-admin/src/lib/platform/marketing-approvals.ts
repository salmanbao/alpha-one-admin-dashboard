"use client";

import { readTenants, updateTenant } from "@/lib/platform/tenant-store";
import type { AppliedOutcome } from "@/lib/platform/approval-apply";

/**
 * applyMarketingApproval handles the staged mutation payloads that the
 * approval bridge applies when a second operator approves a `marketing.*`
 * request. The quota adjustment payload includes effectiveDate and new
 * channel limits.
 */
export function applyMarketingApproval(request: any): AppliedOutcome | void {
  const payload = request.payload;
  if (!payload) return;
  const { actionKey, tenantId, actionLabel, detail } = request;

  // Find the tenant
  const tenants = readTenants();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return;

  // marketing.quota.adjust → { effectiveDate, limits, justification }
  if (actionKey === "marketing.quota.adjust") {
    const { effectiveDate, limits, justification } = payload as {
      effectiveDate: string;
      limits: Record<string, number>;
      justification: string;
    };
    if (!effectiveDate || !limits) return;

    const effDate = new Date(effectiveDate).getTime();
    const now = Date.now();

    // Update quotaHistory with the approved change
    updateTenant(tenantId, {
      quotaHistory: [
        ...(tenant.quotaHistory ?? []),
        {
          at: effectiveDate,
          change: `Quota adjusted ${JSON.stringify(limits)} — approved ${request.id}`,
          by: "approval",
          state: effDate <= now ? "applied" as const : "scheduled" as const,
          justification,
        },
      ],
    });

    return {
      title: effDate <= now ? "Quota applied" : "Quota scheduled",
      description: `${actionLabel} — ${effDate <= now ? "applied immediately" : "scheduled for " + effectiveDate}`,
    };
  }

  return;
}