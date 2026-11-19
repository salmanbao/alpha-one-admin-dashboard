"use client";

/**
 * R10-A3 — Challenge commercial policy engine (P1).
 *
 * Free retry, size-change, fee-credit and refund policies were copy-only
 * (stitch text + hardcoded marketplace cards). This store makes them
 * configurable, auditable, and evaluated:
 *
 *   • free-retry rules (qualifying conditions, cap, cooldown),
 *   • size upgrade/downgrade policy with fee/refund math,
 *   • fee credit toward the funded account (applied on `challenge.funded`),
 *   • refund-on-first-payout policy (applied on `payout.paid`),
 *   • coupon engine (validate + redeem, per-program applicability).
 *
 * Join-key note: `challenge.funded` payloads carry `challengeId` +
 * `traderName` (no traderId), so applied policies are keyed by
 * `${subject}:${challengeId}` where subject is traderId when known and
 * falls back to the display name — documented here because the demo
 * transport doesn't carry the id.
 *
 * Exactly-once event application via the `lastProcessedSeq` watermark.
 *
 * Reuses existing patterns:
 * - demo-persistence for zod-validated persistence
 * - lifecycle events for policy applications
 * - recordAudit for audit trails
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { useLifecycleLog, emitLifecycle, type LifecycleEvent } from "@pfaas/lifecycle";

/* ------------------------------------------------------------------ */
/* Policy types                                                        */
/* ------------------------------------------------------------------ */

export interface FreeRetryPolicy {
  enabled: boolean;
  maxFreeRetries: number;
  conditions: {
    minProfitPct: number;
    maxDrawdownPct: number;
    minTradingDays: number;
    requireNoBreaches: boolean;
  };
  cooldownDays: number;
}

export interface SizeChangePolicy {
  enabled: boolean;
  allowUpgrade: boolean;
  allowDowngrade: boolean;
  maxChangePct: number;
  feeStructure: {
    upgradeFeePct: number; // % of the size difference charged
    downgradeRefundPct: number; // % of the size difference refunded
  };
  requireApproval: boolean;
  approvalRoles: string[];
}

export interface FeeCreditPolicy {
  enabled: boolean;
  creditPct: number; // % of the challenge fee credited
  maxCreditAmount?: number;
  conditions: {
    minTradingDays: number;
    requireProfit: boolean;
    requireNoBreaches: boolean;
  };
  applicationTiming: "funded" | "first-payout" | "manual";
}

export interface RefundPolicy {
  enabled: boolean;
  refundPct: number;
  maxRefundAmount?: number;
  conditions: {
    minProfitPct: number;
    maxDrawdownPct: number;
    minTradingDays: number;
    requireNoBreaches: boolean;
  };
  timing: "first-payout" | "second-payout" | "manual";
}

export interface CouponConfig {
  id: string;
  code: string;
  description: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxUses: number;
  currentUses: number;
  expiresAt?: string;
  /** Empty = applicable to every program. */
  applicablePrograms: string[];
  enabled: boolean;
}

export interface AppliedPolicy {
  subject: string; // traderId or traderName fallback
  challengeId: string;
  freeRetriesUsed: number;
  freeRetriesRemaining: number;
  lastFreeRetryAt?: string;
  feeCreditAmount: number;
  refundAmount: number;
  couponApplied?: string;
}

export interface ChallengeCommercialState {
  freeRetryPolicy: FreeRetryPolicy;
  sizeChangePolicy: SizeChangePolicy;
  feeCreditPolicy: FeeCreditPolicy;
  refundPolicy: RefundPolicy;
  coupons: CouponConfig[];
  /** Applied policies keyed by `${subject}:${challengeId}`. */
  appliedPolicies: Record<string, AppliedPolicy>;
  /** Watermark into the shared lifecycle log (exactly-once processing). */
  lastProcessedSeq: number;
}

/* ------------------------------------------------------------------ */
/* Zod schema for persistence                                          */
/* ------------------------------------------------------------------ */

const challengeCommercialStateSchema = z.object({
  freeRetryPolicy: z.object({
    enabled: z.boolean(),
    maxFreeRetries: z.number().min(0),
    conditions: z.object({
      minProfitPct: z.number().min(0),
      maxDrawdownPct: z.number().min(0),
      minTradingDays: z.number().min(0),
      requireNoBreaches: z.boolean(),
    }),
    cooldownDays: z.number().min(0),
  }),
  sizeChangePolicy: z.object({
    enabled: z.boolean(),
    allowUpgrade: z.boolean(),
    allowDowngrade: z.boolean(),
    maxChangePct: z.number().min(0).max(100),
    feeStructure: z.object({
      upgradeFeePct: z.number().min(0).max(100),
      downgradeRefundPct: z.number().min(0).max(100),
    }),
    requireApproval: z.boolean(),
    approvalRoles: z.array(z.string()),
  }),
  feeCreditPolicy: z.object({
    enabled: z.boolean(),
    creditPct: z.number().min(0).max(100),
    maxCreditAmount: z.number().optional(),
    conditions: z.object({
      minTradingDays: z.number().min(0),
      requireProfit: z.boolean(),
      requireNoBreaches: z.boolean(),
    }),
    applicationTiming: z.enum(["funded", "first-payout", "manual"]),
  }),
  refundPolicy: z.object({
    enabled: z.boolean(),
    refundPct: z.number().min(0).max(100),
    maxRefundAmount: z.number().optional(),
    conditions: z.object({
      minProfitPct: z.number().min(0),
      maxDrawdownPct: z.number().min(0),
      minTradingDays: z.number().min(0),
      requireNoBreaches: z.boolean(),
    }),
    timing: z.enum(["first-payout", "second-payout", "manual"]),
  }),
  coupons: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      description: z.string(),
      discountType: z.enum(["percentage", "fixed"]),
      discountValue: z.number().min(0),
      maxUses: z.number().min(1),
      currentUses: z.number().min(0),
      expiresAt: z.string().optional(),
      applicablePrograms: z.array(z.string()),
      enabled: z.boolean(),
    }),
  ),
  appliedPolicies: z.record(
    z.string(),
    z.object({
      subject: z.string(),
      challengeId: z.string(),
      freeRetriesUsed: z.number().min(0),
      freeRetriesRemaining: z.number().min(0),
      lastFreeRetryAt: z.string().optional(),
      feeCreditAmount: z.number().min(0),
      refundAmount: z.number().min(0),
      couponApplied: z.string().optional(),
    }),
  ),
  lastProcessedSeq: z.number(),
});

type ChallengeCommercialStateType = z.infer<typeof challengeCommercialStateSchema>;

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const SLOT = "challenge-commercial-policy";
let state: ChallengeCommercialStateType = loadDemoState(
  SLOT,
  challengeCommercialStateSchema,
  {
    freeRetryPolicy: {
      enabled: true,
      maxFreeRetries: 1,
      conditions: {
        minProfitPct: 3,
        maxDrawdownPct: 7,
        minTradingDays: 5,
        requireNoBreaches: true,
      },
      cooldownDays: 7,
    },
    sizeChangePolicy: {
      enabled: true,
      allowUpgrade: true,
      allowDowngrade: false,
      maxChangePct: 50,
      feeStructure: { upgradeFeePct: 50, downgradeRefundPct: 0 },
      requireApproval: true,
      approvalRoles: ["admin", "super-admin"],
    },
    feeCreditPolicy: {
      enabled: true,
      creditPct: 50,
      maxCreditAmount: 500,
      conditions: { minTradingDays: 14, requireProfit: true, requireNoBreaches: true },
      applicationTiming: "funded",
    },
    refundPolicy: {
      enabled: true,
      refundPct: 100,
      maxRefundAmount: 1000,
      conditions: {
        minProfitPct: 5,
        maxDrawdownPct: 7,
        minTradingDays: 10,
        requireNoBreaches: true,
      },
      timing: "first-payout",
    },
    coupons: [],
    appliedPolicies: {},
    lastProcessedSeq: 0,
  },
);
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function useChallengeCommercialVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}

/* ------------------------------------------------------------------ */
/* Policy management                                                   */
/* ------------------------------------------------------------------ */

type PolicyKey = "freeRetryPolicy" | "sizeChangePolicy" | "feeCreditPolicy" | "refundPolicy";
const POLICY_LABELS: Record<PolicyKey, string> = {
  freeRetryPolicy: "Free retry",
  sizeChangePolicy: "Size change",
  feeCreditPolicy: "Fee credit",
  refundPolicy: "Refund",
};

export function getCommercialPolicies(): ChallengeCommercialState {
  return state;
}

export function updateCommercialPolicy<K extends PolicyKey>(
  key: K,
  updates: Partial<ChallengeCommercialState[K]>,
  actor: string,
): void {
  const current = state[key] as Record<string, unknown>;
  state = {
    ...state,
    [key]: { ...current, ...(updates as Record<string, unknown>) },
  } as ChallengeCommercialStateType;
  notify();

  recordAudit({
    action: `Updated ${POLICY_LABELS[key].toLowerCase()} policy`,
    entity: "challenge-commercial-policy",
    entityId: key,
    summary: `${POLICY_LABELS[key]} policy updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

/* ------------------------------------------------------------------ */
/* Coupon engine                                                       */
/* ------------------------------------------------------------------ */

export function getCoupons(): CouponConfig[] {
  return state.coupons;
}

export function addCoupon(
  coupon: Omit<CouponConfig, "id" | "currentUses">,
  actor: string,
): CouponConfig {
  const id = `coupon-${Date.now()}`;
  const newCoupon: CouponConfig = { id, currentUses: 0, ...coupon };
  state.coupons = [...state.coupons, newCoupon];
  notify();
  recordAudit({
    action: "Added coupon",
    entity: "challenge-commercial-policy",
    entityId: id,
    summary: `Coupon "${newCoupon.code}" (${newCoupon.discountType === "percentage" ? `${newCoupon.discountValue}%` : `$${newCoupon.discountValue}`}) added by ${actor}`,
    severity: "info",
  });
  return newCoupon;
}

export function updateCoupon(
  couponId: string,
  updates: Partial<CouponConfig>,
  actor: string,
): void {
  const existing = state.coupons.find((c) => c.id === couponId);
  if (!existing) return;
  state.coupons = state.coupons.map((c) => (c.id === couponId ? { ...c, ...updates } : c));
  notify();
  recordAudit({
    action: "Updated coupon",
    entity: "challenge-commercial-policy",
    entityId: couponId,
    summary: `Coupon "${existing.code}" updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

export function removeCoupon(couponId: string, actor: string): void {
  const existing = state.coupons.find((c) => c.id === couponId);
  if (!existing) return;
  state.coupons = state.coupons.filter((c) => c.id !== couponId);
  notify();
  recordAudit({
    action: "Removed coupon",
    entity: "challenge-commercial-policy",
    entityId: couponId,
    summary: `Coupon "${existing.code}" removed by ${actor}`,
    severity: "warning",
  });
}

export function validateCoupon(
  code: string,
  programId?: string,
): { valid: boolean; coupon?: CouponConfig; error?: string } {
  const coupon = state.coupons.find(
    (c) => c.code.toLowerCase() === code.trim().toLowerCase(),
  );
  if (!coupon) return { valid: false, error: "Coupon not found" };
  if (!coupon.enabled) return { valid: false, error: "Coupon is disabled" };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date())
    return { valid: false, error: "Coupon has expired" };
  if (coupon.currentUses >= coupon.maxUses)
    return { valid: false, error: "Coupon has reached its usage limit" };
  if (
    coupon.applicablePrograms.length > 0 &&
    programId &&
    !coupon.applicablePrograms.includes(programId)
  )
    return { valid: false, error: "Coupon does not apply to this program" };
  return { valid: true, coupon };
}

/** Redeem: bumps the use count and stamps the applied policy. */
export function redeemCoupon(
  code: string,
  subject: string,
  challengeId: string,
  programId?: string,
): { ok: boolean; error?: string; discount?: number } {
  const check = validateCoupon(code, programId);
  if (!check.valid || !check.coupon) return { ok: false, error: check.error };

  const coupon = check.coupon;
  state.coupons = state.coupons.map((c) =>
    c.id === coupon.id ? { ...c, currentUses: c.currentUses + 1 } : c,
  );

  const key = `${subject}:${challengeId}`;
  const existing = state.appliedPolicies[key];
  state.appliedPolicies = {
    ...state.appliedPolicies,
    [key]: {
      subject,
      challengeId,
      freeRetriesUsed: existing?.freeRetriesUsed ?? 0,
      freeRetriesRemaining:
        existing?.freeRetriesRemaining ?? state.freeRetryPolicy.maxFreeRetries,
      lastFreeRetryAt: existing?.lastFreeRetryAt,
      feeCreditAmount: existing?.feeCreditAmount ?? 0,
      refundAmount: existing?.refundAmount ?? 0,
      couponApplied: coupon.code,
    },
  };
  notify();

  const discount =
    coupon.discountType === "percentage"
      ? coupon.discountValue // % — applied by the checkout against the price
      : coupon.discountValue; // fixed amount

  recordAudit({
    action: "Redeemed coupon",
    entity: "challenge-commercial-policy",
    entityId: coupon.id,
    summary: `Coupon "${coupon.code}" redeemed by ${subject} for challenge ${challengeId}`,
    severity: "info",
  });

  return { ok: true, discount };
}

/* ------------------------------------------------------------------ */
/* Applied policies                                                     */
/* ------------------------------------------------------------------ */

export function getAppliedPolicy(subject: string, challengeId: string): AppliedPolicy | null {
  return state.appliedPolicies[`${subject}:${challengeId}`] ?? null;
}

export function getAppliedPoliciesForSubject(subject: string): AppliedPolicy[] {
  return Object.values(state.appliedPolicies).filter((p) => p.subject === subject);
}

function ensurePolicy(subject: string, challengeId: string): AppliedPolicy {
  const key = `${subject}:${challengeId}`;
  const existing = state.appliedPolicies[key];
  if (existing) return existing;
  const fresh: AppliedPolicy = {
    subject,
    challengeId,
    freeRetriesUsed: 0,
    freeRetriesRemaining: state.freeRetryPolicy.maxFreeRetries,
    feeCreditAmount: 0,
    refundAmount: 0,
  };
  state.appliedPolicies[key] = fresh;
  saveDemoState(SLOT, state); // silent create — caller's mutation notifies
  return fresh;
}

/* ------------------------------------------------------------------ */
/* Free retry                                                          */
/* ------------------------------------------------------------------ */

export function checkFreeRetryEligibility(
  subject: string,
  challengeId: string,
  attempt: {
    profitPct: number;
    drawdownPct: number;
    tradingDays: number;
    breaches: number;
  },
): { eligible: boolean; reason?: string } {
  const policy = state.freeRetryPolicy;
  if (!policy.enabled) return { eligible: false, reason: "Free retries are disabled" };

  const applied = getAppliedPolicy(subject, challengeId);
  if (applied && applied.freeRetriesRemaining <= 0)
    return { eligible: false, reason: "No free retries remaining" };

  if (applied?.lastFreeRetryAt) {
    const days =
      (Date.now() - new Date(applied.lastFreeRetryAt).getTime()) / 86_400_000;
    if (days < policy.cooldownDays)
      return {
        eligible: false,
        reason: `Cooldown active — ${Math.ceil(policy.cooldownDays - days)} day(s) remaining`,
      };
  }

  const c = policy.conditions;
  if (attempt.profitPct < c.minProfitPct)
    return {
      eligible: false,
      reason: `Needs ≥${c.minProfitPct}% profit at failure (had ${attempt.profitPct}%)`,
    };
  if (attempt.drawdownPct > c.maxDrawdownPct)
    return {
      eligible: false,
      reason: `Drawdown must stay ≤${c.maxDrawdownPct}% (had ${attempt.drawdownPct}%)`,
    };
  if (attempt.tradingDays < c.minTradingDays)
    return {
      eligible: false,
      reason: `Needs ≥${c.minTradingDays} trading days (had ${attempt.tradingDays})`,
    };
  if (c.requireNoBreaches && attempt.breaches > 0)
    return { eligible: false, reason: `Needs zero breaches (had ${attempt.breaches})` };

  return { eligible: true };
}

export function consumeFreeRetry(
  subject: string,
  challengeId: string,
  actor: string,
): boolean {
  const applied = ensurePolicy(subject, challengeId);
  if (applied.freeRetriesRemaining <= 0) return false;

  state.appliedPolicies[`${subject}:${challengeId}`] = {
    ...applied,
    freeRetriesUsed: applied.freeRetriesUsed + 1,
    freeRetriesRemaining: applied.freeRetriesRemaining - 1,
    lastFreeRetryAt: new Date().toISOString(),
  };
  notify();

  recordAudit({
    action: "Issued free retry",
    entity: "challenge-commercial-policy",
    entityId: challengeId,
    summary: `Free retry issued to ${subject} for challenge ${challengeId} by ${actor} (${applied.freeRetriesRemaining - 1} remaining)`,
    severity: "info",
  });

  emitLifecycle({
    entity: { kind: "challenge", id: challengeId },
    name: "challenge.free-retry-used",
    actor: "prop-admin",
    key: `free-retry:${subject}:${challengeId}:${applied.freeRetriesUsed + 1}`,
    payload: {
      subject,
      challengeId,
      retriesRemaining: applied.freeRetriesRemaining - 1,
      issuedBy: actor,
    },
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Size change                                                          */
/* ------------------------------------------------------------------ */

export function checkSizeChangeEligibility(
  currentSize: number,
  requestedSize: number,
): { eligible: boolean; reason?: string; feeAmount?: number; refundAmount?: number } {
  const policy = state.sizeChangePolicy;
  if (!policy.enabled) return { eligible: false, reason: "Size changes are disabled" };

  const upgrade = requestedSize > currentSize;
  const downgrade = requestedSize < currentSize;
  if (upgrade && !policy.allowUpgrade)
    return { eligible: false, reason: "Upgrades are not allowed" };
  if (downgrade && !policy.allowDowngrade)
    return { eligible: false, reason: "Downgrades are not allowed" };

  const changePct = Math.abs((requestedSize - currentSize) / currentSize) * 100;
  if (changePct > policy.maxChangePct)
    return {
      eligible: false,
      reason: `Change exceeds the ${policy.maxChangePct}% cap (requested ${changePct.toFixed(1)}%)`,
    };

  const diff = Math.abs(requestedSize - currentSize);
  return {
    eligible: true,
    feeAmount: upgrade ? diff * (policy.feeStructure.upgradeFeePct / 100) : 0,
    refundAmount: downgrade ? diff * (policy.feeStructure.downgradeRefundPct / 100) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Fee credit + refund                                                 */
/* ------------------------------------------------------------------ */

export function checkFeeCreditEligibility(
  subject: string,
  challengeId: string,
  attempt: { tradingDays: number; hasProfit: boolean; breaches: number },
): { eligible: boolean; reason?: string; creditAmount?: number } {
  const policy = state.feeCreditPolicy;
  if (!policy.enabled) return { eligible: false, reason: "Fee credits are disabled" };

  const applied = getAppliedPolicy(subject, challengeId);
  if (applied && applied.feeCreditAmount > 0)
    return { eligible: false, reason: "Fee credit already applied" };
  if (attempt.tradingDays < policy.conditions.minTradingDays)
    return {
      eligible: false,
      reason: `Needs ≥${policy.conditions.minTradingDays} trading days (had ${attempt.tradingDays})`,
    };
  if (policy.conditions.requireProfit && !attempt.hasProfit)
    return { eligible: false, reason: "Profit required" };
  if (policy.conditions.requireNoBreaches && attempt.breaches > 0)
    return { eligible: false, reason: `Breaches present (had ${attempt.breaches})` };

  return { eligible: true }; // amount resolved against the real fee at apply time
}

export function checkRefundEligibility(
  subject: string,
  challengeId: string,
  attempt: {
    profitPct: number;
    drawdownPct: number;
    tradingDays: number;
    breaches: number;
    payoutCount: number;
  },
): { eligible: boolean; reason?: string } {
  const policy = state.refundPolicy;
  if (!policy.enabled) return { eligible: false, reason: "Refunds are disabled" };

  const applied = getAppliedPolicy(subject, challengeId);
  if (applied && applied.refundAmount > 0)
    return { eligible: false, reason: "Refund already applied" };
  if (policy.timing === "first-payout" && attempt.payoutCount < 1)
    return { eligible: false, reason: "First payout not completed" };
  if (policy.timing === "second-payout" && attempt.payoutCount < 2)
    return { eligible: false, reason: "Second payout not completed" };

  const c = policy.conditions;
  if (attempt.profitPct < c.minProfitPct)
    return { eligible: false, reason: `Needs ≥${c.minProfitPct}% profit` };
  if (attempt.drawdownPct > c.maxDrawdownPct)
    return { eligible: false, reason: `Drawdown must stay ≤${c.maxDrawdownPct}%` };
  if (attempt.tradingDays < c.minTradingDays)
    return { eligible: false, reason: `Needs ≥${c.minTradingDays} trading days` };
  if (c.requireNoBreaches && attempt.breaches > 0)
    return { eligible: false, reason: `Breaches present (had ${attempt.breaches})` };

  return { eligible: true };
}

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

function freshEvents(log: LifecycleEvent[]): LifecycleEvent[] {
  const fresh: LifecycleEvent[] = [];
  let max = state.lastProcessedSeq;
  for (const e of log) {
    const seq = Number(String(e.id).split(":")[0]);
    if (!Number.isFinite(seq)) continue;
    if (seq <= state.lastProcessedSeq) continue;
    fresh.push(e);
    if (seq > max) max = seq;
  }
  if (fresh.length) {
    state.lastProcessedSeq = max;
    saveDemoState(SLOT, state);
  }
  return fresh;
}

export function useChallengeCommercialEvaluator(_tenantId: string): void {
  const log = useLifecycleLog();

  useEffect(() => {
    for (const e of freshEvents(log)) {
      // Funding moment → fee credit policy applies (timing: "funded").
      if (e.name === "challenge.funded" && state.feeCreditPolicy.applicationTiming === "funded") {
        const challengeId =
          typeof e.payload?.challengeId === "string" ? e.payload.challengeId : "";
        const subject =
          typeof e.payload?.traderName === "string" ? e.payload.traderName : null;
        if (!challengeId || !subject) continue;
        if (!state.feeCreditPolicy.enabled) continue;

        const applied = getAppliedPolicy(subject, challengeId);
        if (applied && applied.feeCreditAmount > 0) continue; // idempotent

        const policy = ensurePolicy(subject, challengeId);
        state.appliedPolicies[`${subject}:${challengeId}`] = {
          ...policy,
          feeCreditAmount: state.feeCreditPolicy.maxCreditAmount ?? 0,
        };
        notify();

        recordAudit({
          action: "Applied challenge fee credit",
          entity: "challenge-commercial-policy",
          entityId: challengeId,
          summary: `Fee credit (${state.feeCreditPolicy.creditPct}% up to ${state.feeCreditPolicy.maxCreditAmount ?? "∞"}) applied for ${subject} on challenge ${challengeId}`,
          severity: "info",
        });

        emitLifecycle({
          entity: { kind: "challenge", id: challengeId },
          name: "challenge.fee-credit-applied",
          actor: "system",
          key: `fee-credit:${subject}:${challengeId}`,
          payload: {
            subject,
            challengeId,
            creditAmount: state.feeCreditPolicy.maxCreditAmount ?? null,
            creditPct: state.feeCreditPolicy.creditPct,
          },
        });
      }

      // Note: the refund path is NOT event-driven here — `payout.paid`
      // carries no payout count, so the evaluator deliberately leaves
      // refunds to the operator surface (checkRefundEligibility +
      // applyRefund below) rather than guessing the timing.
    }
  }, [log]);
}

/* Refunds are applied from the challenge detail surface (the demo
 * transport doesn't carry a payout count, so the evaluator would have to
 * guess the timing — an operator decision instead). */

export function applyRefund(
  subject: string,
  challengeId: string,
  amount: number,
  actor: string,
): boolean {
  const check = checkRefundEligibility(subject, challengeId, {
    profitPct: 100,
    drawdownPct: 0,
    tradingDays: 9999,
    breaches: 0,
    payoutCount: 1,
  });
  if (!check.eligible) return false;

  const policy = ensurePolicy(subject, challengeId);
  const capped = state.refundPolicy.maxRefundAmount
    ? Math.min(amount, state.refundPolicy.maxRefundAmount)
    : amount;
  state.appliedPolicies[`${subject}:${challengeId}`] = {
    ...policy,
    refundAmount: capped,
  };
  notify();

  recordAudit({
    action: "Applied challenge refund",
    entity: "challenge-commercial-policy",
    entityId: challengeId,
    summary: `Refund of $${capped.toFixed(2)} applied for ${subject} on challenge ${challengeId} by ${actor}`,
    severity: "info",
  });

  emitLifecycle({
    entity: { kind: "challenge", id: challengeId },
    name: "challenge.refund-applied",
    actor: "prop-admin",
    key: `refund:${subject}:${challengeId}`,
    payload: { subject, challengeId, refundAmount: capped },
  });
  return true;
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

export function getCommercialStats(): {
  totalCoupons: number;
  activeCoupons: number;
  totalCouponUses: number;
  freeRetriesIssued: number;
  feeCreditsApplied: number;
  refundsApplied: number;
} {
  const policies = Object.values(state.appliedPolicies);
  return {
    totalCoupons: state.coupons.length,
    activeCoupons: state.coupons.filter((c) => c.enabled).length,
    totalCouponUses: state.coupons.reduce((s, c) => s + c.currentUses, 0),
    freeRetriesIssued: policies.reduce((s, p) => s + p.freeRetriesUsed, 0),
    feeCreditsApplied: policies.filter((p) => p.feeCreditAmount > 0).length,
    refundsApplied: policies.filter((p) => p.refundAmount > 0).length,
  };
}
