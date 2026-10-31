/**
 * Payout math — single source of truth for eligibility and split computation.
 *
 * Why this exists: the payout request screens used to hard-code a 0.8 trader
 * share and treated floating P&L (equity − balance) as withdrawable profit.
 * Both were wrong for any plan that isn't 80% and for any account with open
 * positions. This module makes the math plan-driven and HWM-consistent:
 *
 *   eligibleProfit = max(0, balance − startingBalance)
 *
 * where startingBalance is the plan's account size (the high-water-mark
 * baseline — after a payout the balance drops back and new profit accrues
 * above the same starting size again). Floating P&L (equity − balance) is
 * explicitly EXCLUDED and shown as excluded, because unrealised profit can
 * vanish before settlement.
 *
 * Frontend-honest scope: this is pure deterministic math over seed/demo
 * state. A production system would snapshot the inputs (balance, FX rate,
 * plan version) at request time — the quote shape here is what such a
 * snapshot would carry.
 */

import { formatCurrencyValue } from "@pfaas/platform-core";
import { challengePhaseConfigs } from "@/lib/platform/mock-data";
import type { ChallengePhaseConfig, Payout, TradingAccount } from "@/lib/platform/mock-data";

/** Payout policy constants (firm-level configuration in production). */
export const PAYOUT_POLICY = {
  /** Minimum single payout request, in account currency. */
  minimumRequest: 100,
  /** Maximum single payout request, in account currency. */
  maximumRequest: 25_000,
  /** Minimum days between payouts (cadence). */
  cadenceDays: 14,
  /** Flat processing fee deducted from the trader share. */
  processingFee: 20,
} as const;

export type PayoutCheckStatus = "passed" | "failed" | "warning";

export interface PayoutCheck {
  label: string;
  status: PayoutCheckStatus;
  detail: string;
}

export interface PayoutQuote {
  /** The funded account the quote was computed for. */
  account: TradingAccount;
  /** Plan the account is enrolled under (from phaseConfigId). */
  plan: ChallengePhaseConfig | null;
  /** Plan starting size — the HWM baseline. */
  startingBalance: number;
  /** Current realised balance. */
  balance: number;
  /** Floating P&L (equity − balance) — excluded from the payout. */
  floatingPnl: number;
  /** Profit above starting balance available for withdrawal. */
  eligibleProfit: number;
  /** Trader's split percentage from the plan (e.g. 90 = 90%). */
  traderSplitPct: number;
  /** Firm retention = eligibleProfit − traderShare. */
  firmShare: number;
  /** Trader share before fee = eligibleProfit × traderSplitPct. */
  traderShare: number;
  /** Flat processing fee. */
  processingFee: number;
  /** Net payout = traderShare − fee (floored at 0). */
  netPayout: number;
  /** Whether the max cap reduced the request. */
  cappedByMaximum: boolean;
  /** Full eligibility checklist. */
  checks: PayoutCheck[];
  /** True when every blocking check passes and the amount is within limits. */
  canRequestPayout: boolean;
}

/** Resolve the plan config for an account via its phaseConfigId. */
export function resolvePlanForAccount(account: TradingAccount): ChallengePhaseConfig | null {
  if (!account.phaseConfigId) return null;
  return challengePhaseConfigs.find((p) => p.id === account.phaseConfigId) ?? null;
}

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

/**
 * Compute the full payout quote for an account.
 *
 * @param account  The trading account (funded only — challenges yield 0).
 * @param payouts  The trader's payout history (for cadence checks).
 * @param openBreaches  Count of open risk cases on the trader.
 * @param kycApproved  Whether the trader's KYC is approved.
 */
export function computePayoutQuote(
  account: TradingAccount,
  payouts: Payout[],
  openBreaches: number,
  kycApproved: boolean,
): PayoutQuote {
  const plan = resolvePlanForAccount(account);
  const startingBalance = plan?.accountSize ?? account.balance;
  const isFunded = account.phase === "funded" && account.status !== "breached";

  const balance = account.balance;
  const floatingPnl = account.equity - account.balance;
  // HWM-consistent: profit above the plan's starting size. The balance is
  // assumed post-withdrawal (a paid-out amount drops the balance back toward
  // startingBalance), so this is realised profit only.
  const rawEligible = Math.max(0, balance - startingBalance);

  // Trader split comes from the plan (funded plans only; challenge plans are 0).
  const traderSplitPct = plan && plan.isFunded ? plan.profitSplit : 0;

  // Apply min/max policy to the eligible profit before splitting.
  const cappedByMaximum = rawEligible > PAYOUT_POLICY.maximumRequest;
  const eligibleProfit = Math.min(rawEligible, PAYOUT_POLICY.maximumRequest);
  const traderShare = Math.round((eligibleProfit * traderSplitPct) / 100);
  const firmShare = eligibleProfit - traderShare;
  const processingFee = traderShare > 0 ? PAYOUT_POLICY.processingFee : 0;
  const netPayout = Math.max(0, traderShare - processingFee);

  // Cadence: measured against the last SETTLED payout (money actually moved).
  // Approved/processing payouts don't consume the cadence window — a trader
  // shouldn't be blocked for having a payout in review, but a paid payout
  // within the window does block a new request.
  const lastPaidPayout = payouts
    .filter((p) => p.status === "paid")
    .sort((a, b) => ((a.processedAt ?? a.createdAt) < (b.processedAt ?? b.createdAt) ? 1 : -1))[0];
  const daysSinceLastPayout = daysSince(lastPaidPayout?.processedAt ?? lastPaidPayout?.createdAt);
  const cadenceOk =
    daysSinceLastPayout === null || daysSinceLastPayout >= PAYOUT_POLICY.cadenceDays;

  const checks: PayoutCheck[] = [
    {
      label: "Funded account",
      status: account.phase === "funded" ? "passed" : "failed",
      detail:
        account.phase === "funded"
          ? "Account is funded — payouts available"
          : "Evaluation-phase accounts cannot request payouts until funded",
    },
    {
      label: "Account in good standing",
      status: account.status === "active" ? "passed" : "failed",
      detail:
        account.status === "active"
          ? "Account status is active"
          : `Account status is “${account.status}” — payouts blocked`,
    },
    {
      label: "KYC verified",
      status: kycApproved ? "passed" : "failed",
      detail: kycApproved ? "Identity verification complete" : "Complete identity verification to unlock payouts",
    },
    {
      label: "No active risk hold",
      status: openBreaches === 0 ? "passed" : "failed",
      detail: openBreaches === 0 ? "No open risk cases on your account" : `${openBreaches} open risk case(s) blocking payouts`,
    },
    {
      label: "Realised profit above starting balance",
      status: rawEligible > 0 ? "passed" : "failed",
      detail:
        rawEligible > 0
          ? `${formatMoney(rawEligible)} realised profit above the ${formatMoney(startingBalance)} starting balance`
          : `No realised profit above the ${formatMoney(startingBalance)} starting balance yet`,
    },
    {
      label: "Payout cadence",
      status: cadenceOk ? "passed" : "failed",
      detail: cadenceOk
        ? lastPaidPayout
          ? `Last paid payout ${daysSinceLastPayout} day(s) ago — ${PAYOUT_POLICY.cadenceDays}-day cadence met`
          : `No previous paid payout — ${PAYOUT_POLICY.cadenceDays}-day cadence met`
        : `Last paid payout was ${daysSinceLastPayout} day(s) ago — ${PAYOUT_POLICY.cadenceDays}-day cadence required`,
    },
    {
      label: "Minimum payout amount",
      // Only meaningful once there is profit to split; otherwise the
      // "realised profit" check above already blocks the request.
      status: rawEligible === 0 || traderShare >= PAYOUT_POLICY.minimumRequest ? "passed" : "warning",
      detail:
        rawEligible === 0 || traderShare >= PAYOUT_POLICY.minimumRequest
          ? `Minimum ${formatMoney(PAYOUT_POLICY.minimumRequest)} per request`
          : `Your share (${formatMoney(traderShare)}) is below the ${formatMoney(PAYOUT_POLICY.minimumRequest)} minimum — accrue more profit first`,
    },
    {
      label: "Maximum payout per request",
      status: cappedByMaximum ? "warning" : "passed",
      detail: cappedByMaximum
        ? `Capped at ${formatMoney(PAYOUT_POLICY.maximumRequest)} per request — the remainder stays available`
        : `Up to ${formatMoney(PAYOUT_POLICY.maximumRequest)} per request`,
    },
  ];

  // Blocking failures: any "failed" check blocks the request. Warnings (cap,
  // minimum) do not block but are surfaced.
  const canRequestPayout = isFunded && checks.every((c) => c.status !== "failed");

  return {
    account,
    plan,
    startingBalance,
    balance,
    floatingPnl,
    eligibleProfit,
    traderSplitPct,
    firmShare,
    traderShare,
    processingFee,
    netPayout,
    cappedByMaximum,
    checks,
    canRequestPayout,
  };
}

/**
 * Money formatting — delegates to the canonical utility in
 * `@pfaas/platform-core` (finding #2: was 0-decimal here, which
 * diverged from every other dashboard). Kept as a local alias so this
 * module stays free of component imports (no import cycle).
 */
function formatMoney(n: number): string {
  return formatCurrencyValue(n, "USD");
}
