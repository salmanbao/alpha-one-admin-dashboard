"use client";

import type { TerraAccount } from "@/lib/fixtures/terra-fixtures";

/**
 * Breach/drawdown warning thresholds (R3-05 / AUDIT-R3 §6 item 5).
 *
 * A warning fires when either allowance has 30% or less remaining — the
 * point at which the trader should cut size *before* the first breach,
 * rather than learning about it from "Evaluation Failed" afterwards.
 */
export const RISK_WARNING_THRESHOLD_PCT = 30;

/** Share of the allowance still left, 0–100. */
export function remainingPct(remaining: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 100;
  if (!Number.isFinite(remaining) || remaining <= 0) return 0;
  return Math.round((Math.min(remaining, limit) / limit) * 100);
}

interface RiskLimits {
  daily: number;
  maxDd: number;
}

export interface RiskWarningState {
  /** % of the daily-loss allowance still remaining. */
  dailyPct: number;
  /** % of the max-drawdown allowance still remaining. */
  maxDdPct: number;
  /** True when either allowance is at or below the warning threshold. */
  warned: boolean;
  /** Which allowance triggered the warning ("daily" | "maxDd" | null). */
  breach: "daily" | "maxDd" | null;
}

/**
 * Evaluate the active account against its program limits. Neither number
 * can be influenced by the UI — they come from the fixtures' per-account
 * remaining allowances and the shared per-account limit table.
 */
export function computeRiskWarning(
  account: TerraAccount | null | undefined,
  limits: RiskLimits | null | undefined,
): RiskWarningState {
  const dailyPct = account
    ? remainingPct(account.dailyLossRemaining, limits?.daily ?? 0)
    : 100;
  const maxDdPct = account
    ? remainingPct(account.maxDdRemaining, limits?.maxDd ?? 0)
    : 100;
  const breach =
    dailyPct <= RISK_WARNING_THRESHOLD_PCT && maxDdPct <= RISK_WARNING_THRESHOLD_PCT
      ? "daily" // both breached — name the tighter one (daily loss hits first)
      : dailyPct <= RISK_WARNING_THRESHOLD_PCT
        ? "daily"
        : maxDdPct <= RISK_WARNING_THRESHOLD_PCT
          ? "maxDd"
          : null;
  return { dailyPct, maxDdPct, warned: breach !== null, breach };
}
