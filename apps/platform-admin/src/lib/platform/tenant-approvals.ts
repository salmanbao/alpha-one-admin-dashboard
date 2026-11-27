"use client";

import { updateTenant, readTenants } from "@/lib/platform/tenant-store";
import type { TenantContext } from "@/lib/platform/types";
import type { AppliedOutcome } from "@/lib/platform/approval-apply";

/**
 * applyTenantApproval handles the staged mutation payloads that the
 * approval bridge applies when a second operator approves a `tenant.*`
 * request.  Each case receives the `request` (which carries the payload)
 * and applies the exact mutation, recording a matching audit entry so
 * state, audit trail and toast all tell the same story.
 */
export function applyTenantApproval(request: any): AppliedOutcome | void {
  const payload = request.payload;
  if (!payload) return;
  const { actionKey, tenantId, actionLabel, detail } = request;

  // Find the tenant to get current state
  const tenants = readTenants();
  const tenant = tenants.find((t) => t.id === tenantId);
  if (!tenant) return;

  // The payload structure for each tenant action:
  // tenant.purge    → { tenantId, retentionDays, reason }
  // tenant.restore  → { tenantId, fromStatus }
  // tenant.suspend  → { tenantId, targetStatus }
  // tenant.terminate → { tenantId, targetStatus }

  switch (actionKey) {
    case "tenant.purge": {
      const { retentionDays, reason } = payload as {
        tenantId: string;
        retentionDays: number;
        reason: string;
      };
      if (!retentionDays) return;

      updateTenant(tenantId, {
        purgeScheduledFor: new Date(
          Date.now() + retentionDays * 24 * 60 * 60 * 1000,
        ).toISOString(),
        statusHistory: [
          ...(tenant.statusHistory ?? []),
          { status: "terminated", at: new Date().toISOString(), by: "approval", reason: reason ?? "Purge scheduled" },
        ],
      });
      return {
        title: "Purge scheduled",
        description: `${actionLabel} — purge scheduled in ${retentionDays} days`,
      };
    }

    case "tenant.restore": {
      const { fromStatus } = payload as {
        tenantId: string;
        fromStatus: TenantContext["status"];
      };
      if (!fromStatus) return;

      updateTenant(tenantId, {
        status: fromStatus,
        purgeScheduledFor: undefined,
        statusHistory: [
          ...(tenant.statusHistory ?? []),
          { status: "active", at: new Date().toISOString(), by: "approval", reason: "Restore from purge window" },
        ],
      });
      return {
        title: "Tenant restored",
        description: `${actionLabel} — restored from purge window`,
      };
    }

    case "tenant.suspend": {
      const { targetStatus } = payload as {
        tenantId: string;
        targetStatus: TenantContext["status"];
      };
      if (!targetStatus) return;

      updateTenant(tenantId, {
        status: targetStatus,
        statusHistory: [
          ...(tenant.statusHistory ?? []),
          { status: targetStatus, at: new Date().toISOString(), by: "approval", reason: detail ?? "Suspended via two-operator approval" },
        ],
      });
      return {
        title: "Tenant suspended",
        description: `${actionLabel}`,
      };
    }

    case "tenant.terminate": {
      const { targetStatus } = payload as {
        tenantId: string;
        targetStatus: TenantContext["status"];
      };
      if (!targetStatus) return;

      updateTenant(tenantId, {
        status: targetStatus,
        statusHistory: [
          ...(tenant.statusHistory ?? []),
          { status: targetStatus, at: new Date().toISOString(), by: "approval", reason: detail ?? "Terminated via two-operator approval" },
        ],
      });
      return {
        title: "Tenant terminated",
        description: `${actionLabel}`,
      };
    }

    case "tenant.offboard": {
      const { retention, gracePeriodDays, scheduledFor, reason } = payload as {
        tenantId: string;
        retention: string;
        gracePeriodDays: number;
        scheduledFor: string;
        reason: string;
      };
      if (!retention || !scheduledFor) return;

      const offboardStatus = retention === "preserve" ? "offboarding" as const : "terminated" as const;

      updateTenant(tenantId, {
        status: offboardStatus,
        statusHistory: [
          ...(tenant.statusHistory ?? []),
          {
            status: offboardStatus,
            at: new Date().toISOString(),
            by: "approval",
            reason: detail ?? `Offboarded (retention=${retention}, gracePeriod=${gracePeriodDays}d, reason="${reason}")`,
          },
        ],
      });
      return {
        title: offboardStatus === "offboarding" ? "Tenant offboarded" : "Tenant terminated",
        description: `${actionLabel} — scheduled ${scheduledFor}, retention=${retention}, grace=${gracePeriodDays}d`,
      };
    }

    default:
      return;
  }
}