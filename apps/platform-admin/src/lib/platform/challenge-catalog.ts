"use client";

/**
 * Challenge Catalog — single source of truth for challenge program
 * configuration review. Shared by platform-admin (review) and future
 * prop-admin (editor) so the two surfaces can never disagree.
 *
 * This module encodes the coverage invariant: each evaluation phase
 * needs a config row; funded/paying types need one additional funded row.
 */

import { challengeTypes, challengePhaseConfigs, ChallengeType, ChallengePhaseConfig, getChallengeTypes, getChallengePhaseConfigs } from "./mock-data";

/** Dev-time assertion: every challengeTypeId in configs must exist in challengeTypes. */
function assertConfigTypeCoverage(): void {
  if (process.env.NODE_ENV !== "development") return;
  const typeIds = new Set(challengeTypes.map((t) => t.id));
  const orphanConfigs = challengePhaseConfigs.filter((p) => !typeIds.has(p.challengeTypeId));
  if (orphanConfigs.length > 0) {
    console.error(
      "[challenge-catalog] Orphan configs reference unknown challengeTypeId:",
      orphanConfigs.map((p) => p.challengeTypeId)
    );
  }
}
assertConfigTypeCoverage();

/**
 * Get the human-readable label for a challenge type id.
 * Throws in development if the id doesn't exist (fails loudly instead of silent fallback).
 */
export function challengeTypeLabel(id: string): string {
  const type = challengeTypes.find((t) => t.id === id);
  if (!type) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`[challenge-catalog] Unknown challengeTypeId: ${id}. Add to challengeTypes in mock-data.ts`);
    }
    return id; // fallback only in production
  }
  return type.name;
}

/**
 * Get the icon name for a challenge type id.
 */
export function challengeTypeIcon(id: string): string {
  const type = challengeTypes.find((t) => t.id === id);
  return type?.icon ?? "HelpCircle";
}

/**
 * Coverage report per challenge type.
 *
 * Invariant (report §3 P0-2): each evaluation phase needs a config row,
 * and funded/paying types need one additional funded row — except
 * funded-only types (ct-1 "Instant Funded"), whose declared phase count
 * IS the funded row (no evaluation phases).
 */
const FUNDED_ONLY_TYPES = new Set(["ct-1"]);

export function typeCoverage(): Array<{
  type: ChallengeType;
  configured: number;
  expected: number;
  missing: number;
  complete: boolean;
}> {
  return challengeTypes.map((type) => {
    const configured = challengePhaseConfigs.filter((p) => p.challengeTypeId === type.id).length;
    // Free Trial and Competition don't have funded rows.
    const hasFundedRow = !type.hasFreeTrial && !type.isCompetition;
    const evalPhases = FUNDED_ONLY_TYPES.has(type.id) ? 0 : type.phases;
    const expected = evalPhases + (hasFundedRow ? 1 : 0);
    return {
      type,
      configured,
      expected,
      missing: Math.max(0, expected - configured),
      complete: configured >= expected,
    };
  });
}

/**
 * Status of a phase row for display and filtering.
 */
export function phaseRowStatus(p: ChallengePhaseConfig): "funded" | "no-min-days" | "min-days" {
  if (p.isFunded) return "funded";
  if (p.minTradingDays === 0) return "no-min-days";
  return "min-days";
}

/**
 * Check if a phase config's drawdown limits match platform risk defaults.
 * Defaults from global-defaults: daily 5% (d6), max 10% (d7).
 */
export function matchesRiskDefaults(p: ChallengePhaseConfig): { daily: boolean; max: boolean } {
  return {
    daily: p.dailyDrawdownPct === 5,
    max: p.maxDrawdownPct === 10,
  };
}

/**
 * Get all challenge types (active only by default).
 */
export function getActiveChallengeTypes(): ChallengeType[] {
  return getChallengeTypes().filter((t) => t.active);
}

/**
 * Get phase configs for a specific type, or all if no type specified.
 */
export function getPhaseConfigs(challengeTypeId?: string): ChallengePhaseConfig[] {
  return getChallengePhaseConfigs(challengeTypeId);
}

/**
 * Sort phase configs: by challengeTypeId (numerical) then phaseOrder.
 */
export function sortPhaseConfigs(configs: ChallengePhaseConfig[]): ChallengePhaseConfig[] {
  return [...configs].sort((a, b) => {
    const aNum = parseInt(a.challengeTypeId.replace("ct-", ""), 10);
    const bNum = parseInt(b.challengeTypeId.replace("ct-", ""), 10);
    if (aNum !== bNum) return aNum - bNum;
    return a.phaseOrder - b.phaseOrder;
  });
}

/**
 * Get change history entries for a specific config id (alignment to pc-* ids).
 */
export function getConfigChangeHistory(configId: string, changeHistory: Array<{
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  actor: string;
  timestamp: string;
  tenantId?: string;
}>): Array<{
  entityType: string;
  entityId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  actor: string;
  timestamp: string;
  tenantId?: string;
}> {
  return changeHistory.filter(
    (c) => c.entityType === "Phase" && c.entityId === configId
  );
}