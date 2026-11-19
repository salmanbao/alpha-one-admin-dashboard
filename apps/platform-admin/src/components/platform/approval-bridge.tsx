"use client";

/**
 * Approval bridge (gap S-09 / P0-2).
 *
 * The one place that names every maker-checker-covered domain: role,
 * API-key and staff mutations register here, and the applier hook
 * (mounted once in AppShell) applies each approved request exactly
 * once — from any page, surviving reloads, because the mutation payload
 * travels on the approval request itself.
 */

import { registerApprovalHandler, useApprovalApplier } from "@/lib/platform/approval-apply";
import { applyRoleApproval } from "@/lib/platform/role-store";
import { applyApiKeyApproval } from "@/lib/platform/api-key-store";
import { applyStaffApproval } from "@/lib/platform/staff-store";
import { applyOperatorApproval } from "@/lib/platform/platform-context";
import { applyPlatformApproval } from "@/lib/platform/deployments-store";

registerApprovalHandler("role.", applyRoleApproval);
registerApprovalHandler("apikey.", applyApiKeyApproval);
registerApprovalHandler("staff.", applyStaffApproval);
// Directory lifecycle + profile edits (gap S-01/S-02 — P0-3).
registerApprovalHandler("operator.", applyOperatorApproval);
// P0-4: deployment rollback via two-operator approval.
registerApprovalHandler("platform.", applyPlatformApproval);

export function ApprovalBridge() {
  useApprovalApplier();
  return null;
}
