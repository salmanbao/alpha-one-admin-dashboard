"use client";

/**
 * R10-A2 — Profit-split tiers and first-payout hold enforcement (P0).
 *
 * - Tiered profit split (the seed previously carried one flat split per
 *   phase — payout-math reads the tier the account is on).
 * - First-payout hold: a trader-level gate that blocks the FIRST
 *   withdrawal until trading-days / profit / cycle / breach conditions
 *   are met (`checkFirstPayoutEligibility` is the payout-gate API).
 * - Automated tier upgrades evaluated on trade.closed / payout.paid.
 *
 * Exactly-once processing via the `lastProcessedSeq` watermark over the
 * append-only lifecycle log (same pattern as scaling-plan-store).
 *
 * Reuses existing patterns:
 * - demo-persistence for zod-validated persistence
 * - lifecycle events for tier changes
 * - recordAudit for audit trails
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { useLifecycleLog, emitLifecycle, type LifecycleEvent } from "@pfaas/lifecycle";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface FirstPayoutHoldConditions {
  minTradingDays: number;
  minProfitPct: number;
  minProfitableCycles: number;
  requireZeroBreaches: boolean;
}

export interface ProfitSplitTier {
  id: string;
  name: string;
  description: string;
  /** Minimum cumulative profit % to qualify for this tier. */
  minProfitPct: number;
  /** Trader's share of profit at this tier. */
  traderSplitPct: number;
  minProfitableCycles?: number;
  minTradingDays?: number;
  requireZeroBreaches?: boolean;
  /** First-payout hold requirements that apply while on this tier. */
  firstPayoutHold?: FirstPayoutHoldConditions;
  benefits: {
    expressPayout: boolean;
    weekendPass: boolean;
    prioritySupport: boolean;
    customLeverage: boolean;
    dedicatedAccountManager: boolean;
  };
  /** Display order (ascending). */
  order: number;
}

export interface FirstPayoutHoldState {
  isOnHold: boolean;
  requirementsMet: boolean;
  holdReason?: string;
  conditions: FirstPayoutHoldConditions;
  progress: {
    tradingDays: number;
    profitPct: number;
    profitableCycles: number;
    breaches: number;
  };
}

export interface TraderTierProgress {
  accountId: string;
  traderId?: string;
  traderName?: string;
  currentTierId: string;
  currentTierOrder: number;
  cumulativeProfitPct: number;
  profitableCycles: number;
  tradingDays: number;
  totalBreaches: number;
  firstPayoutHold: FirstPayoutHoldState;
  lastTierChangeAt?: string;
  tierHistory: { tierId: string; changedAt: string; previousTierId?: string }[];
  /** Day key of the last processed trade (one trading day counted once). */
  lastTradeDayKey?: string;
}

export interface ProfitSplitState {
  tiers: ProfitSplitTier[];
  /** Progress rows keyed by accountId. */
  traderProgress: Record<string, TraderTierProgress>;
  defaultTierId: string;
  /** Watermark into the shared lifecycle log (exactly-once processing). */
  lastProcessedSeq: number;
}

/* ------------------------------------------------------------------ */
/* Zod schema for persistence                                          */
/* ------------------------------------------------------------------ */

const holdConditionsSchema = z.object({
  minTradingDays: z.number(),
  minProfitPct: z.number(),
  minProfitableCycles: z.number(),
  requireZeroBreaches: z.boolean(),
});

const profitSplitTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  minProfitPct: z.number().min(0),
  traderSplitPct: z.number().min(0).max(100),
  minProfitableCycles: z.number().optional(),
  minTradingDays: z.number().optional(),
  requireZeroBreaches: z.boolean().optional(),
  firstPayoutHold: holdConditionsSchema.optional(),
  benefits: z.object({
    expressPayout: z.boolean(),
    weekendPass: z.boolean(),
    prioritySupport: z.boolean(),
    customLeverage: z.boolean(),
    dedicatedAccountManager: z.boolean(),
  }),
  order: z.number(),
});

const firstPayoutHoldStateSchema = z.object({
  isOnHold: z.boolean(),
  requirementsMet: z.boolean(),
  holdReason: z.string().optional(),
  conditions: holdConditionsSchema,
  progress: z.object({
    tradingDays: z.number(),
    profitPct: z.number(),
    profitableCycles: z.number(),
    breaches: z.number(),
  }),
});

const traderTierProgressSchema = z.object({
  accountId: z.string(),
  traderId: z.string().optional(),
  traderName: z.string().optional(),
  currentTierId: z.string(),
  currentTierOrder: z.number(),
  cumulativeProfitPct: z.number(),
  profitableCycles: z.number(),
  tradingDays: z.number(),
  totalBreaches: z.number(),
  firstPayoutHold: firstPayoutHoldStateSchema,
  lastTierChangeAt: z.string().optional(),
  tierHistory: z.array(
    z.object({
      tierId: z.string(),
      changedAt: z.string(),
      previousTierId: z.string().optional(),
    }),
  ),
  lastTradeDayKey: z.string().optional(),
});

const profitSplitStateSchema = z.object({
  tiers: z.array(profitSplitTierSchema),
  traderProgress: z.record(z.string(), traderTierProgressSchema),
  defaultTierId: z.string(),
  lastProcessedSeq: z.number(),
});

type ProfitSplitStateType = z.infer<typeof profitSplitStateSchema>;

/* ------------------------------------------------------------------ */
/* Default tiers                                                       */
/* ------------------------------------------------------------------ */

const DEFAULT_TIERS: ProfitSplitTier[] = [
  {
    id: "tier-beginner",
    name: "Beginner",
    description: "Starting tier for new funded traders — 80% profit split",
    minProfitPct: 0,
    traderSplitPct: 80,
    firstPayoutHold: {
      minTradingDays: 14,
      minProfitPct: 5,
      minProfitableCycles: 1,
      requireZeroBreaches: true,
    },
    benefits: {
      expressPayout: false,
      weekendPass: false,
      prioritySupport: false,
      customLeverage: false,
      dedicatedAccountManager: false,
    },
    order: 1,
  },
  {
    id: "tier-intermediate",
    name: "Intermediate",
    description: "Consistent profits — 85% profit split",
    minProfitPct: 10,
    traderSplitPct: 85,
    minProfitableCycles: 2,
    minTradingDays: 30,
    requireZeroBreaches: true,
    firstPayoutHold: {
      minTradingDays: 7,
      minProfitPct: 3,
      minProfitableCycles: 1,
      requireZeroBreaches: true,
    },
    benefits: {
      expressPayout: false,
      weekendPass: false,
      prioritySupport: true,
      customLeverage: false,
      dedicatedAccountManager: false,
    },
    order: 2,
  },
  {
    id: "tier-advanced",
    name: "Advanced",
    description: "Proven track record — 90% profit split",
    minProfitPct: 20,
    traderSplitPct: 90,
    minProfitableCycles: 4,
    minTradingDays: 60,
    requireZeroBreaches: true,
    firstPayoutHold: {
      minTradingDays: 5,
      minProfitPct: 2,
      minProfitableCycles: 1,
      requireZeroBreaches: true,
    },
    benefits: {
      expressPayout: true,
      weekendPass: false,
      prioritySupport: true,
      customLeverage: false,
      dedicatedAccountManager: false,
    },
    order: 3,
  },
  {
    id: "tier-elite",
    name: "Elite",
    description: "Top performers — 90% split with premium benefits",
    minProfitPct: 35,
    traderSplitPct: 90,
    minProfitableCycles: 6,
    minTradingDays: 90,
    requireZeroBreaches: true,
    firstPayoutHold: {
      minTradingDays: 3,
      minProfitPct: 1,
      minProfitableCycles: 1,
      requireZeroBreaches: true,
    },
    benefits: {
      expressPayout: true,
      weekendPass: true,
      prioritySupport: true,
      customLeverage: true,
      dedicatedAccountManager: false,
    },
    order: 4,
  },
  {
    id: "tier-vip",
    name: "VIP",
    description: "Elite traders with dedicated support — 90% split + full benefits",
    minProfitPct: 50,
    traderSplitPct: 90,
    minProfitableCycles: 8,
    minTradingDays: 120,
    requireZeroBreaches: true,
    firstPayoutHold: {
      minTradingDays: 2,
      minProfitPct: 0.5,
      minProfitableCycles: 1,
      requireZeroBreaches: true,
    },
    benefits: {
      expressPayout: true,
      weekendPass: true,
      prioritySupport: true,
      customLeverage: true,
      dedicatedAccountManager: true,
    },
    order: 5,
  },
];

/* ------------------------------------------------------------------ */
/* Store implementation                                                */
/* ------------------------------------------------------------------ */

const SLOT = "profit-split-tiers";
let state: ProfitSplitStateType = loadDemoState(SLOT, profitSplitStateSchema, {
  tiers: DEFAULT_TIERS,
  traderProgress: {},
  defaultTierId: "tier-beginner",
  lastProcessedSeq: 0,
});
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function useProfitSplitVersion(): number {
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
/* Tier management                                                     */
/* ------------------------------------------------------------------ */

export function getProfitSplitTiers(): ProfitSplitTier[] {
  return [...state.tiers].sort((a, b) => a.order - b.order);
}

export function getProfitSplitTier(tierId: string): ProfitSplitTier | null {
  return state.tiers.find((t) => t.id === tierId) ?? null;
}

export function updateProfitSplitTier(
  tierId: string,
  updates: Partial<ProfitSplitTier>,
  actor: string,
): void {
  const existing = state.tiers.find((t) => t.id === tierId);
  if (!existing) return;

  state.tiers = state.tiers.map((t) => (t.id === tierId ? { ...t, ...updates } : t));
  notify();

  recordAudit({
    action: "Updated profit split tier",
    entity: "profit-split-tier",
    entityId: tierId,
    summary: `Tier "${existing.name}" updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

export function addProfitSplitTier(
  tier: Omit<ProfitSplitTier, "id">,
  actor: string,
): ProfitSplitTier {
  const id = `tier-${Date.now()}`;
  const newTier: ProfitSplitTier = { id, ...tier };
  state.tiers = [...state.tiers, newTier];
  notify();

  recordAudit({
    action: "Added profit split tier",
    entity: "profit-split-tier",
    entityId: id,
    summary: `Tier "${newTier.name}" (${newTier.traderSplitPct}%) added by ${actor}`,
    severity: "info",
  });

  return newTier;
}

export function removeProfitSplitTier(tierId: string, actor: string): void {
  const existing = state.tiers.find((t) => t.id === tierId);
  if (!existing) return;
  if (tierId === state.defaultTierId) {
    throw new Error("Cannot remove the default tier");
  }
  const onTier = Object.values(state.traderProgress).filter(
    (p) => p.currentTierId === tierId,
  );
  if (onTier.length > 0) {
    throw new Error(
      `Cannot remove tier: ${onTier.length} account(s) are currently on this tier`,
    );
  }

  state.tiers = state.tiers.filter((t) => t.id !== tierId);
  notify();

  recordAudit({
    action: "Removed profit split tier",
    entity: "profit-split-tier",
    entityId: tierId,
    summary: `Tier "${existing.name}" removed by ${actor}`,
    severity: "warning",
  });
}

export function setDefaultTier(tierId: string, actor: string): void {
  const existing = state.tiers.find((t) => t.id === tierId);
  if (!existing) return;

  state.defaultTierId = tierId;
  notify();

  recordAudit({
    action: "Set default profit split tier",
    entity: "profit-split-tier",
    entityId: tierId,
    summary: `Default tier set to "${existing.name}" by ${actor}`,
    severity: "info",
  });
}

/* ------------------------------------------------------------------ */
/* Trader progress management                                          */
/* ------------------------------------------------------------------ */

export function getTraderTierProgress(accountId: string): TraderTierProgress | null {
  return state.traderProgress[accountId] ?? null;
}

export function getAllTierProgress(): TraderTierProgress[] {
  return Object.values(state.traderProgress);
}

function ensureTierProgress(
  accountId: string,
  opts: { traderId?: string; traderName?: string } = {},
): TraderTierProgress {
  const existing = state.traderProgress[accountId];
  if (existing) {
    if (opts.traderId && !existing.traderId) existing.traderId = opts.traderId;
    if (opts.traderName && !existing.traderName) existing.traderName = opts.traderName;
    return existing;
  }
  const defaultTier = getProfitSplitTier(state.defaultTierId);
  const fresh: TraderTierProgress = {
    accountId,
    traderId: opts.traderId,
    traderName: opts.traderName,
    currentTierId: state.defaultTierId,
    currentTierOrder: defaultTier?.order ?? 1,
    cumulativeProfitPct: 0,
    profitableCycles: 0,
    tradingDays: 0,
    totalBreaches: 0,
    firstPayoutHold: {
      isOnHold: true,
      requirementsMet: false,
      holdReason: "First payout hold — requirements not yet met",
      conditions: {
        minTradingDays: defaultTier?.firstPayoutHold?.minTradingDays ?? 14,
        minProfitPct: defaultTier?.firstPayoutHold?.minProfitPct ?? 5,
        minProfitableCycles: defaultTier?.firstPayoutHold?.minProfitableCycles ?? 1,
        requireZeroBreaches: defaultTier?.firstPayoutHold?.requireZeroBreaches ?? true,
      },
      progress: { tradingDays: 0, profitPct: 0, profitableCycles: 0, breaches: 0 },
    },
    tierHistory: [],
  };
  state.traderProgress[accountId] = fresh;
  saveDemoState(SLOT, state); // silent create — caller's mutation notifies
  return fresh;
}

/* ------------------------------------------------------------------ */
/* Tier evaluation engine                                              */
/* ------------------------------------------------------------------ */

function evaluateTierUp(progress: TraderTierProgress): ProfitSplitTier | null {
  const sortedTiers = getProfitSplitTiers();
  for (let i = sortedTiers.length - 1; i >= 0; i--) {
    const tier = sortedTiers[i];
    if (tier.order <= progress.currentTierOrder) continue;
    if (progress.cumulativeProfitPct < tier.minProfitPct) continue;
    if (tier.minProfitableCycles && progress.profitableCycles < tier.minProfitableCycles)
      continue;
    if (tier.minTradingDays && progress.tradingDays < tier.minTradingDays) continue;
    if (tier.requireZeroBreaches && progress.totalBreaches > 0) continue;
    return tier;
  }
  return null;
}

function applyTierChange(progress: TraderTierProgress, newTier: ProfitSplitTier): void {
  const previousTierId = progress.currentTierId;
  const updated: TraderTierProgress = {
    ...progress,
    currentTierId: newTier.id,
    currentTierOrder: newTier.order,
    lastTierChangeAt: new Date().toISOString(),
    tierHistory: [
      ...progress.tierHistory,
      { tierId: newTier.id, changedAt: new Date().toISOString(), previousTierId },
    ],
  };

  if (newTier.firstPayoutHold) {
    updated.firstPayoutHold = {
      ...progress.firstPayoutHold,
      conditions: { ...newTier.firstPayoutHold },
      progress: {
        tradingDays: updated.tradingDays,
        profitPct: updated.cumulativeProfitPct,
        profitableCycles: updated.profitableCycles,
        breaches: updated.totalBreaches,
      },
    };
    const met = holdMet(updated);
    updated.firstPayoutHold.isOnHold = !met;
    updated.firstPayoutHold.requirementsMet = met;
    if (met) updated.firstPayoutHold.holdReason = undefined;
  }

  state.traderProgress[progress.accountId] = updated;
  notify();

  recordAudit({
    action: "Profit split tier upgraded",
    entity: "profit-split-tier",
    entityId: newTier.id,
    summary: `Account ${progress.accountId} upgraded from tier "${previousTierId}" to "${newTier.name}" (${newTier.traderSplitPct}%)`,
    severity: "info",
  });

  emitLifecycle({
    entity: { kind: "account", id: progress.accountId },
    name: "profit-split.tier-upgraded",
    actor: "system",
    key: `tier:${progress.accountId}:${newTier.id}`,
    payload: {
      accountId: progress.accountId,
      traderId: progress.traderId ?? null,
      previousTierId,
      newTierId: newTier.id,
      newTierName: newTier.name,
      newTraderSplitPct: newTier.traderSplitPct,
    },
  });
}

/* ------------------------------------------------------------------ */
/* First payout hold                                                   */
/* ------------------------------------------------------------------ */

function holdMet(progress: TraderTierProgress): boolean {
  const c = progress.firstPayoutHold.conditions;
  if (progress.tradingDays < c.minTradingDays) return false;
  if (progress.cumulativeProfitPct < c.minProfitPct) return false;
  if (progress.profitableCycles < c.minProfitableCycles) return false;
  if (c.requireZeroBreaches && progress.totalBreaches > 0) return false;
  return true;
}

/**
 * Payout-gate API (R10-A2): the FIRST withdrawal for an account stays on
 * hold until the tier's conditions are met. Subsequent payouts are not
 * gated by this check — the hold is released exactly once.
 */
export function checkFirstPayoutEligibility(
  accountId: string,
): { eligible: boolean; reason?: string; progress?: TraderTierProgress } {
  const progress = getTraderTierProgress(accountId);
  if (!progress) {
    return { eligible: false, reason: "No tier progress found for this account" };
  }
  const hold = progress.firstPayoutHold;
  if (!hold.isOnHold || hold.requirementsMet) return { eligible: true, progress };

  const missing: string[] = [];
  if (progress.tradingDays < hold.conditions.minTradingDays)
    missing.push(
      `${hold.conditions.minTradingDays} trading days (currently ${progress.tradingDays})`,
    );
  if (progress.cumulativeProfitPct < hold.conditions.minProfitPct)
    missing.push(
      `${hold.conditions.minProfitPct}% profit (currently ${progress.cumulativeProfitPct.toFixed(1)}%)`,
    );
  if (progress.profitableCycles < hold.conditions.minProfitableCycles)
    missing.push(
      `${hold.conditions.minProfitableCycles} profitable payout cycle(s) (currently ${progress.profitableCycles})`,
    );
  if (hold.conditions.requireZeroBreaches && progress.totalBreaches > 0)
    missing.push(`zero breaches (currently ${progress.totalBreaches})`);

  return {
    eligible: false,
    reason: `First payout hold active — missing: ${missing.join(", ")}`,
    progress,
  };
}

/** Operator override: release a hold once conditions are verified. */
export function releaseFirstPayoutHold(accountId: string, actor: string): boolean {
  const progress = getTraderTierProgress(accountId);
  if (!progress || !progress.firstPayoutHold.isOnHold) return false;

  const updated: TraderTierProgress = {
    ...progress,
    firstPayoutHold: {
      ...progress.firstPayoutHold,
      isOnHold: false,
      requirementsMet: true,
      holdReason: undefined,
    },
  };
  state.traderProgress[accountId] = updated;
  notify();

  recordAudit({
    action: "Released first payout hold",
    entity: "profit-split-tier",
    entityId: accountId,
    summary: `First payout hold released for account ${accountId} by ${actor}`,
    severity: "info",
  });

  emitLifecycle({
    entity: { kind: "account", id: accountId },
    name: "profit-split.first-payout-hold-released",
    actor: "prop-admin",
    key: `hold-release:${accountId}`,
    payload: { accountId, releasedBy: actor },
  });

  return true;
}

/* ------------------------------------------------------------------ */
/* Event handlers (exported for the UI + evaluator)                    */
/* ------------------------------------------------------------------ */

export function handleTradingDay(
  accountId: string,
  opts: {
    isProfitableDay?: boolean;
    profitPctDelta?: number;
    closedAt?: string;
    traderId?: string;
    traderName?: string;
  } = {},
): void {
  const progress = ensureTierProgress(accountId, opts);
  const dayKey = (opts.closedAt ?? new Date().toISOString()).slice(0, 10);
  const isNewDay = progress.lastTradeDayKey !== dayKey;

  const updated: TraderTierProgress = {
    ...progress,
    lastTradeDayKey: dayKey,
    tradingDays: isNewDay ? progress.tradingDays + 1 : progress.tradingDays,
  };
  if (isNewDay && opts.isProfitableDay) {
    updated.profitableCycles = progress.profitableCycles + 1;
  }
  if (typeof opts.profitPctDelta === "number") {
    updated.cumulativeProfitPct = progress.cumulativeProfitPct + opts.profitPctDelta;
  }
  updated.firstPayoutHold = {
    ...progress.firstPayoutHold,
    progress: {
      tradingDays: updated.tradingDays,
      profitPct: updated.cumulativeProfitPct,
      profitableCycles: updated.profitableCycles,
      breaches: updated.totalBreaches,
    },
  };
  if (updated.firstPayoutHold.isOnHold && holdMet(updated)) {
    updated.firstPayoutHold.isOnHold = false;
    updated.firstPayoutHold.requirementsMet = true;
    updated.firstPayoutHold.holdReason = undefined;
  }

  state.traderProgress[accountId] = updated;
  notify();

  const newTier = evaluateTierUp(updated);
  if (newTier) applyTierChange(updated, newTier);
}

export function handlePayoutCompleted(accountId: string, amount: number): void {
  const progress = ensureTierProgress(accountId);
  const updated: TraderTierProgress = {
    ...progress,
    profitableCycles: progress.profitableCycles + 1,
    cumulativeProfitPct: 0, // HWM restart after a payout
    firstPayoutHold: {
      ...progress.firstPayoutHold,
      isOnHold: false,
      requirementsMet: true,
      holdReason: undefined,
      progress: {
        ...progress.firstPayoutHold.progress,
        profitableCycles: progress.profitableCycles + 1,
        profitPct: 0,
      },
    },
  };
  state.traderProgress[accountId] = updated;
  notify();

  recordAudit({
    action: "Payout completed — cycle counted",
    entity: "profit-split-tier",
    entityId: accountId,
    summary: `Account ${accountId} completed payout cycle ${updated.profitableCycles} ($${amount.toLocaleString()})`,
    severity: "info",
  });

  const newTier = evaluateTierUp(updated);
  if (newTier) applyTierChange(updated, newTier);
}

export function handleBreach(accountId: string): void {
  const progress = ensureTierProgress(accountId);
  const updated: TraderTierProgress = {
    ...progress,
    totalBreaches: progress.totalBreaches + 1,
    firstPayoutHold: {
      ...progress.firstPayoutHold,
      progress: {
        ...progress.firstPayoutHold.progress,
        breaches: progress.totalBreaches + 1,
      },
    },
  };
  state.traderProgress[accountId] = updated;
  notify();
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

export function useProfitSplitEvaluator(_tenantId: string): void {
  const log = useLifecycleLog();

  useEffect(() => {
    for (const e of freshEvents(log)) {
      if (e.name === "trade.closed") {
        const accountId = typeof e.payload?.accountId === "string" ? e.payload.accountId : "";
        if (!accountId) continue;
        const pnl = typeof e.payload?.pnl === "number" ? e.payload.pnl : 0;
        const accountSize =
          typeof e.payload?.accountSize === "number" ? e.payload.accountSize : 10000;
        handleTradingDay(accountId, {
          isProfitableDay: pnl > 0,
          profitPctDelta: (pnl / accountSize) * 100,
          closedAt: typeof e.payload?.closedAt === "string" ? e.payload.closedAt : e.at,
          traderName:
            typeof e.payload?.accountName === "string" ? e.payload.accountName : undefined,
        });
      } else if (e.name === "payout.paid") {
        // Join cascade (payout-store emits accountId/accountName/traderId/
        // trader): terra account id → display name → trader id → trader
        // name. Fixture payouts carry none of these, so they honestly
        // don't move any progress row.
        const amount = typeof e.payload?.amount === "number" ? e.payload.amount : 0;
        const rows = Object.values(state.traderProgress);
        const pick = (v: unknown, match: (p: TraderTierProgress) => boolean) =>
          typeof v === "string" && v ? rows.find(match) : undefined;
        const target =
          pick(e.payload?.accountId, (p) => p.accountId === e.payload?.accountId) ??
          pick(
            e.payload?.accountName,
            (p) => p.traderName === e.payload?.accountName || p.accountId === e.payload?.accountName,
          ) ??
          pick(e.payload?.traderId, (p) => p.traderId === e.payload?.traderId) ??
          pick(e.payload?.trader, (p) => p.traderName === e.payload?.trader);
        if (target) handlePayoutCompleted(target.accountId, amount);
      } else if (e.name === "risk.alert.raised") {
        if (e.payload?.severity !== "hard-breach") continue;
        const accountId = typeof e.payload?.accountId === "string" ? e.payload.accountId : "";
        if (accountId) handleBreach(accountId);
      }
    }
  }, [log]);
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

export function getProfitSplitStats(): {
  totalAccounts: number;
  averageSplitPct: number;
  tiersDistribution: Record<string, number>;
  firstPayoutHoldsActive: number;
  firstPayoutHoldsReleased: number;
  averageTradingDays: number;
  averageProfitableCycles: number;
} {
  const progressList = Object.values(state.traderProgress);
  const totalAccounts = progressList.length;
  const totalSplitPct = progressList.reduce((sum, p) => {
    const tier = getProfitSplitTier(p.currentTierId);
    return sum + (tier?.traderSplitPct ?? 0);
  }, 0);

  const tiersDistribution: Record<string, number> = {};
  progressList.forEach((p) => {
    tiersDistribution[p.currentTierId] = (tiersDistribution[p.currentTierId] || 0) + 1;
  });

  return {
    totalAccounts,
    averageSplitPct: totalAccounts > 0 ? totalSplitPct / totalAccounts : 0,
    tiersDistribution,
    firstPayoutHoldsActive: progressList.filter((p) => p.firstPayoutHold.isOnHold).length,
    firstPayoutHoldsReleased: progressList.filter(
      (p) => !p.firstPayoutHold.isOnHold && p.firstPayoutHold.requirementsMet,
    ).length,
    averageTradingDays:
      totalAccounts > 0
        ? progressList.reduce((s, p) => s + p.tradingDays, 0) / totalAccounts
        : 0,
    averageProfitableCycles:
      totalAccounts > 0
        ? progressList.reduce((s, p) => s + p.profitableCycles, 0) / totalAccounts
        : 0,
  };
}
