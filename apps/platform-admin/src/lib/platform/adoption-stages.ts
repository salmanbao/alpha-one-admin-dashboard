"use client";

/**
 * Adoption Funnel Stage Derivation — single source of truth for
 * mapping a tenant's status + module count into a funnel stage.
 *
 * Shared by Adoption Funnel page and Tenant Lifecycle page so the
 * two surfaces can never disagree on stage classification.
 */

import type { TenantContext } from "./types";

/** Number of enabled modules required to be considered "engaged". */
export const ENGAGED_MODULE_THRESHOLD = 5;

export type FunnelStage = "invited" | "trial" | "onboarding" | "active" | "engaged";

export type OutsideFunnelStage =
  | "provisioning"
  | "provisioning_failed"
  | "rolled_back"
  | "suspended"
  | "terminated";

/** All lifecycle statuses that exist on TenantContext, plus derived "engaged". */
export type AllLifecycleStatus = TenantContext["status"] | "engaged";

/**
 * Derive the funnel stage for a tenant.
 *
 * Rules:
 * - "engaged" only promoted from "active" with ≥5 modules
 * - "active" stays "active" regardless of module count
 * - "onboarding"/"trial"/"invited" pass through
 * - The five outside statuses keep their identity (not collapsed to "invited")
 */
export function funnelStageOf(t: TenantContext): FunnelStage | OutsideFunnelStage {
  if (t.status === "active") {
    return t.enabledModules.length >= ENGAGED_MODULE_THRESHOLD ? "engaged" : "active";
  }
  if (t.status === "onboarding") return "onboarding";
  if (t.status === "trial") return "trial";
  if (t.status === "invited") return "invited";
  // Outside funnel statuses — keep their true identity
  const outsideStatuses: OutsideFunnelStage[] = ["provisioning", "provisioning_failed", "rolled_back", "suspended", "terminated"];
  if (outsideStatuses.includes(t.status as OutsideFunnelStage)) {
    return t.status as OutsideFunnelStage;
  }
  // Exhaustive check - should never reach here
  return "invited";
}

/** Check if a stage is one of the five funnel stages. */
export function isFunnelStage(stage: string): stage is FunnelStage {
  return ["invited", "trial", "onboarding", "active", "engaged"].includes(stage);
}

/** Check if a stage is an outside-funnel status. */
export function isOutsideFunnelStage(stage: string): stage is OutsideFunnelStage {
  return ["provisioning", "provisioning_failed", "rolled_back", "suspended", "terminated"].includes(stage);
}

/** Human-readable label for any lifecycle stage. */
export function stageLabel(stage: AllLifecycleStatus): string {
  const labels: Record<AllLifecycleStatus, string> = {
    invited: "Invited",
    trial: "Trial",
    onboarding: "Onboarding",
    active: "Active",
    engaged: "Engaged",
    provisioning: "Provisioning",
    provisioning_failed: "Provisioning Failed",
    rolled_back: "Rolled Back",
    suspended: "Suspended",
    terminated: "Terminated",
  };
  return labels[stage] ?? stage;
}

/** Short description for any lifecycle stage. */
export function stageDescription(stage: AllLifecycleStatus): string {
  const descriptions: Record<AllLifecycleStatus, string> = {
    invited: "Invitation sent, pending first login",
    trial: "Active trial with limited features",
    onboarding: "Going through guided setup",
    active: "Full access, normal billing",
    engaged: "5+ modules enabled, daily activity",
    provisioning: "Tenant being provisioned",
    provisioning_failed: "Provisioning failed — needs attention",
    rolled_back: "Creation rolled back",
    suspended: "Access suspended",
    terminated: "Contract terminated",
  };
  return descriptions[stage] ?? "";
}

/**
 * Compute funnel stage summaries from a tenant roster.
 * Returns the five funnel stages + an "outside" bucket split by status.
 */
export interface StageSummary {
  id: string;
  label: string;
  description: string;
  count: number;
  pctOfFleet: number;
  conversionPct: number | null; // % vs previous funnel stage
  dropOff: number; // count lost vs previous funnel stage
  dropOffReason?: string;
  isOutside: boolean;
  outsideBreakdown?: Record<string, number>; // for "Outside funnel" row
}

export function funnelSummaries(
  roster: TenantContext[],
  runs?: Array<{ stamps: Record<string, string>; tenantId?: string | null }>
): StageSummary[] {
  const total = roster.length;

  // Count tenants per derived stage
  const stageCounts: Record<string, number> = {};
  const outsideBreakdown: Record<string, number> = {};

  for (const t of roster) {
    const stage = funnelStageOf(t);
    if (isFunnelStage(stage)) {
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    } else {
      outsideBreakdown[stage] = (outsideBreakdown[stage] || 0) + 1;
    }
  }

  const funnelStageIds: FunnelStage[] = ["invited", "trial", "onboarding", "active", "engaged"];
  const summaries: StageSummary[] = [];

  for (let i = 0; i < funnelStageIds.length; i++) {
    const id = funnelStageIds[i];
    const count = stageCounts[id] || 0;
    const pctOfFleet = total > 0 ? Math.round((count / total) * 100) : 0;

    // Conversion % vs previous funnel stage
    let conversionPct: number | null = null;
    let dropOff = 0;
    let dropOffReason: string | undefined;

    if (i > 0) {
      const prevId = funnelStageIds[i - 1];
      const prevCount = stageCounts[prevId] || 0;
      if (prevCount > 0) {
        conversionPct = Math.round((count / prevCount) * 100);
        dropOff = Math.max(0, prevCount - count);
      }
    }

    // Derive drop-off reason from onboarding runs if available
    if (runs && dropOff > 0) {
      // TODO: derive from actual run stamps
      if (id === "active") dropOffReason = "Onboarding friction";
      else if (id === "engaged") dropOffReason = "Module adoption ceiling";
      else dropOffReason = "Conversion failure";
    }

    summaries.push({
      id,
      label: stageLabel(id),
      description: stageDescription(id),
      count,
      pctOfFleet,
      conversionPct,
      dropOff,
      dropOffReason,
      isOutside: false,
    });
  }

  // Add "Outside funnel" row if any tenants are in outside statuses
  const outsideTotal = Object.values(outsideBreakdown).reduce((a, b) => a + b, 0);
  if (outsideTotal > 0) {
    summaries.push({
      id: "outside",
      label: "Outside Funnel",
      description: "Statuses not in the adoption funnel",
      count: outsideTotal,
      pctOfFleet: total > 0 ? Math.round((outsideTotal / total) * 100) : 0,
      conversionPct: null,
      dropOff: 0,
      isOutside: true,
      outsideBreakdown,
    });
  }

  return summaries;
}