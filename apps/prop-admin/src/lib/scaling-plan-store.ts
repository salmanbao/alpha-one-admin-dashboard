"use client";

/**
 * R10-A1 — Scaling-plan automation (P0).
 *
 * Milestone detection engine that reacts to `trade.closed` / `payout.paid`
 * on the shared lifecycle log, automatically upgrades account sizes and
 * profit splits when traders hit scaling milestones, and persists every
 * mutation for the audit trail.
 *
 * Idempotency: the log is append-only and re-delivered in full on every
 * change, so the store keeps a `lastProcessedSeq` watermark (event ids are
 * monotonic `${seq}`) — each event is applied exactly once, including
 * across reloads.
 *
 * Reuses existing patterns:
 * - demo-persistence for zod-validated persistence
 * - lifecycle events for milestone detection
 * - recordAudit for audit trails
 * - emitLifecycle for cross-app communication
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { useLifecycleLog, emitLifecycle, type LifecycleEvent } from "@pfaas/lifecycle";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface ScalingMilestone {
  id: string;
  name: string;
  description: string;
  /** Profit target in % from starting balance to trigger this milestone. */
  profitTargetPct: number;
  /** Minimum trading days (ensures minimum trading activity). */
  minTradingDays?: number;
  /** Minimum consecutive profitable trading days. */
  minProfitableDays?: number;
  /** Upgrade account size to this amount (if defined). */
  newAccountSize?: number;
  /** Upgrade profit split to this percentage (if defined). */
  newProfitSplitPct?: number;
  /** Require zero rule breaches during qualification period. */
  requireZeroBreaches?: boolean;
  /** Hold days before the next milestone can be evaluated. */
  holdDays?: number;
}

export interface ScalingProgress {
  /** Account this progress belongs to (trade.closed carries no traderId). */
  accountId: string;
  /** Best-known trader join keys — absent when the log doesn't carry them. */
  traderId?: string;
  traderName?: string;
  currentPhase: "scaling" | "funded" | "blocked";
  currentMilestoneIndex: number;
  profitableDays: number;
  tradingDays: number;
  currentProfitPct: number;
  lastMilestoneReachedAt?: string;
  totalBreaches: number;
  /** Day key (YYYY-MM-DD, UTC) of the last processed trade. */
  lastTradeDayKey?: string;
  /** Cumulative profit since the last reset (payout / milestone). */
  cumulativeProfit: number;
  /** Peak equity observed since start (drawdown reference). */
  peakEquity: number;
  /** Current account size after upgrades. */
  currentAccountSize: number;
  /** Current profit split after upgrades. */
  currentProfitSplitPct: number;
}

export interface ScalingState {
  milestones: ScalingMilestone[];
  /** Progress rows keyed by accountId. */
  progress: Record<string, ScalingProgress>;
  /** Per-milestone operator overrides (edited thresholds). */
  milestoneOverrides: Record<string, Partial<ScalingMilestone>>;
  /** Watermark into the shared lifecycle log (exactly-once processing). */
  lastProcessedSeq: number;
}

/* ------------------------------------------------------------------ */
/* Zod schema for persistence                                          */
/* ------------------------------------------------------------------ */

const scalingMilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  profitTargetPct: z.number(),
  minTradingDays: z.number().optional(),
  minProfitableDays: z.number().optional(),
  newAccountSize: z.number().optional(),
  newProfitSplitPct: z.number().optional(),
  requireZeroBreaches: z.boolean().optional(),
  holdDays: z.number().optional(),
});

const scalingProgressSchema = z.object({
  accountId: z.string(),
  traderId: z.string().optional(),
  traderName: z.string().optional(),
  currentPhase: z.enum(["scaling", "funded", "blocked"]),
  currentMilestoneIndex: z.number(),
  profitableDays: z.number(),
  tradingDays: z.number(),
  currentProfitPct: z.number(),
  lastMilestoneReachedAt: z.string().optional(),
  totalBreaches: z.number(),
  lastTradeDayKey: z.string().optional(),
  cumulativeProfit: z.number(),
  peakEquity: z.number(),
  currentAccountSize: z.number(),
  currentProfitSplitPct: z.number(),
});

const scalingStateSchema = z.object({
  milestones: z.array(scalingMilestoneSchema),
  progress: z.record(z.string(), scalingProgressSchema),
  milestoneOverrides: z.record(z.string(), scalingMilestoneSchema.partial()),
  lastProcessedSeq: z.number(),
});

type ScalingStateType = z.infer<typeof scalingStateSchema>;

/* ------------------------------------------------------------------ */
/* Default milestones                                                  */
/* ------------------------------------------------------------------ */

const DEFAULT_MILESTONES: ScalingMilestone[] = [
  {
    id: "milestone-1",
    name: "First Profit Target",
    description: "Reach 8% profit with minimum 3 trading days and zero breaches",
    profitTargetPct: 8,
    minTradingDays: 3,
    requireZeroBreaches: true,
    newProfitSplitPct: 80,
    holdDays: 7,
  },
  {
    id: "milestone-2",
    name: "Consistency Achievement",
    description: "Reach 12% profit with 5 profitable days",
    profitTargetPct: 12,
    minProfitableDays: 5,
    requireZeroBreaches: true,
    newProfitSplitPct: 85,
    holdDays: 14,
  },
  {
    id: "milestone-3",
    name: "Scaling to $25K",
    description: "Reach 15% profit with 10 profitable days over 30 trading days, zero breaches",
    profitTargetPct: 15,
    minProfitableDays: 10,
    minTradingDays: 30,
    requireZeroBreaches: true,
    newAccountSize: 25000,
    newProfitSplitPct: 85,
    holdDays: 30,
  },
  {
    id: "milestone-4",
    name: "Scaling to $50K",
    description: "Reach 20% profit with 15 profitable days, zero breaches",
    profitTargetPct: 20,
    minProfitableDays: 15,
    requireZeroBreaches: true,
    newAccountSize: 50000,
    newProfitSplitPct: 90,
    holdDays: 60,
  },
  {
    id: "milestone-5",
    name: "Elite Status",
    description: "Reach 25% profit with 20 profitable days, zero breaches",
    profitTargetPct: 25,
    minProfitableDays: 20,
    requireZeroBreaches: true,
    newAccountSize: 100000,
    newProfitSplitPct: 90,
    holdDays: 90,
  },
];

/* ------------------------------------------------------------------ */
/* Store implementation                                                */
/* ------------------------------------------------------------------ */

const SLOT = "scaling-plan";
let state: ScalingStateType = loadDemoState(SLOT, scalingStateSchema, {
  milestones: DEFAULT_MILESTONES,
  progress: {},
  milestoneOverrides: {},
  lastProcessedSeq: 0,
});
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function useScalingVersion(): number {
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
/* Milestone management                                                */
/* ------------------------------------------------------------------ */

export function getScalingMilestones(): ScalingMilestone[] {
  return state.milestones.map((m) => ({ ...m, ...state.milestoneOverrides[m.id] }));
}

export function updateMilestone(
  milestoneId: string,
  updates: Partial<ScalingMilestone>,
  actor: string,
): void {
  const existing = state.milestones.find((m) => m.id === milestoneId);
  if (!existing) return;

  state.milestoneOverrides = {
    ...state.milestoneOverrides,
    [milestoneId]: { ...state.milestoneOverrides[milestoneId], ...updates },
  };
  notify();

  recordAudit({
    action: "Updated scaling milestone",
    entity: "scaling-plan",
    entityId: milestoneId,
    summary: `Scaling milestone "${existing.name}" updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

export function addMilestone(
  milestone: Omit<ScalingMilestone, "id">,
  actor: string,
): ScalingMilestone {
  const id = `milestone-${Date.now()}`;
  const newMilestone: ScalingMilestone = { id, ...milestone };
  state.milestones = [...state.milestones, newMilestone];
  notify();

  recordAudit({
    action: "Added scaling milestone",
    entity: "scaling-plan",
    entityId: id,
    summary: `Scaling milestone "${newMilestone.name}" added by ${actor}`,
    severity: "info",
  });

  return newMilestone;
}

export function removeMilestone(milestoneId: string, actor: string): void {
  const existing = state.milestones.find((m) => m.id === milestoneId);
  if (!existing) return;

  state.milestones = state.milestones.filter((m) => m.id !== milestoneId);
  delete state.milestoneOverrides[milestoneId];
  notify();

  recordAudit({
    action: "Removed scaling milestone",
    entity: "scaling-plan",
    entityId: milestoneId,
    summary: `Scaling milestone "${existing.name}" removed by ${actor}`,
    severity: "warning",
  });
}

/* ------------------------------------------------------------------ */
/* Progress tracking                                                   */
/* ------------------------------------------------------------------ */

export function getScalingProgress(accountId: string): ScalingProgress | null {
  return state.progress[accountId] ?? null;
}

export function getScalingProgressForTrader(traderId: string): ScalingProgress[] {
  return Object.values(state.progress).filter((p) => p.traderId === traderId);
}

export function getAllScalingProgress(): ScalingProgress[] {
  return Object.values(state.progress);
}

function ensureProgress(
  accountId: string,
  opts: { traderId?: string; traderName?: string; accountSize?: number } = {},
): ScalingProgress {
  const existing = state.progress[accountId];
  if (existing) {
    if (opts.traderId && !existing.traderId) existing.traderId = opts.traderId;
    if (opts.traderName && !existing.traderName) existing.traderName = opts.traderName;
    return existing;
  }
  const fresh: ScalingProgress = {
    accountId,
    traderId: opts.traderId,
    traderName: opts.traderName,
    currentPhase: "scaling",
    currentMilestoneIndex: 0,
    profitableDays: 0,
    tradingDays: 0,
    currentProfitPct: 0,
    totalBreaches: 0,
    cumulativeProfit: 0,
    peakEquity: opts.accountSize ?? 10000,
    currentAccountSize: opts.accountSize ?? 10000,
    currentProfitSplitPct: 80,
  };
  state.progress[accountId] = fresh;
  // Silent create — the caller's mutation notifies + persists.
  saveDemoState(SLOT, state);
  return fresh;
}

/* ------------------------------------------------------------------ */
/* Milestone evaluation engine                                         */
/* ------------------------------------------------------------------ */

function evaluateMilestone(
  progress: ScalingProgress,
  milestone: ScalingMilestone,
): boolean {
  if (progress.currentProfitPct < milestone.profitTargetPct) return false;
  if (milestone.minTradingDays && progress.tradingDays < milestone.minTradingDays)
    return false;
  if (milestone.minProfitableDays && progress.profitableDays < milestone.minProfitableDays)
    return false;
  if (milestone.requireZeroBreaches && progress.totalBreaches > 0) return false;
  return true;
}

function applyMilestone(
  progress: ScalingProgress,
  milestone: ScalingMilestone,
): ScalingProgress {
  const updated: ScalingProgress = {
    ...progress,
    currentMilestoneIndex: progress.currentMilestoneIndex + 1,
    lastMilestoneReachedAt: new Date().toISOString(),
    profitableDays: 0, // streak counters restart for the next milestone
    currentProfitPct: 0,
    cumulativeProfit: 0,
  };

  if (milestone.newAccountSize) {
    updated.currentAccountSize = milestone.newAccountSize;
    updated.peakEquity = milestone.newAccountSize;
  }
  if (milestone.newProfitSplitPct) {
    updated.currentProfitSplitPct = milestone.newProfitSplitPct;
  }
  if (updated.currentMilestoneIndex >= getScalingMilestones().length) {
    updated.currentPhase = "funded";
  }

  state.progress[progress.accountId] = updated;
  notify();

  recordAudit({
    action: "Scaling milestone reached",
    entity: "scaling-plan",
    entityId: milestone.id,
    summary: `Account ${progress.accountId} reached milestone "${milestone.name}"${milestone.newAccountSize ? ` → upgraded to $${milestone.newAccountSize.toLocaleString()}` : ""}${milestone.newProfitSplitPct ? ` → profit split ${milestone.newProfitSplitPct}%` : ""}`,
    severity: "info",
  });

  emitLifecycle({
    entity: { kind: "account", id: progress.accountId },
    name: "scaling.milestone-reached",
    actor: "system",
    key: `scaling:${milestone.id}:${progress.accountId}`,
    payload: {
      accountId: progress.accountId,
      traderId: progress.traderId ?? null,
      milestoneId: milestone.id,
      milestoneName: milestone.name,
      newAccountSize: milestone.newAccountSize ?? null,
      newProfitSplitPct: milestone.newProfitSplitPct ?? null,
    },
  });

  return updated;
}

/* ------------------------------------------------------------------ */
/* Event handlers (exported for the UI + evaluator)                    */
/* ------------------------------------------------------------------ */

export function handleTradeClosed(
  accountId: string,
  pnl: number,
  opts: {
    traderId?: string;
    traderName?: string;
    accountSize?: number;
    closedAt?: string;
  } = {},
): void {
  const progress = ensureProgress(accountId, opts);
  const closedAt = opts.closedAt ?? new Date().toISOString();
  const dayKey = closedAt.slice(0, 10);
  const isNewDay = progress.lastTradeDayKey !== dayKey;

  const updated: ScalingProgress = {
    ...progress,
    lastTradeDayKey: dayKey,
    tradingDays: isNewDay ? progress.tradingDays + 1 : progress.tradingDays,
    cumulativeProfit: progress.cumulativeProfit + pnl,
    peakEquity: Math.max(progress.peakEquity, progress.currentAccountSize + progress.cumulativeProfit + pnl),
  };

  if (pnl > 0) {
    // A profitable day counts once — the first win of the UTC day.
    if (isNewDay) updated.profitableDays = progress.profitableDays + 1;
  } else if (pnl < 0) {
    updated.profitableDays = 0; // streak ends on a losing day
  }

  updated.currentProfitPct =
    updated.currentAccountSize > 0
      ? (updated.cumulativeProfit / updated.currentAccountSize) * 100
      : 0;

  // Evaluate the next milestone.
  if (updated.currentPhase === "scaling") {
    const milestones = getScalingMilestones();
    const milestone = milestones[updated.currentMilestoneIndex];
    if (milestone && evaluateMilestone(updated, milestone)) {
      applyMilestone(updated, milestone);
      return;
    }
  }

  state.progress[accountId] = updated;
  notify();
}

export function handlePayoutPaid(
  accountId: string,
  amount: number,
): void {
  const progress = state.progress[accountId];
  if (!progress) return;

  // HWM-consistent: after a payout the balance drops back, so the profit
  // counters restart above the same baseline (mirrors payout-math.ts).
  state.progress[accountId] = {
    ...progress,
    currentProfitPct: 0,
    cumulativeProfit: 0,
  };
  notify();

  recordAudit({
    action: "Scaling profit reset after payout",
    entity: "scaling-plan",
    entityId: accountId,
    summary: `Account ${accountId} profit counters reset after $${amount.toLocaleString()} payout`,
    severity: "info",
  });
}

export function handleBreach(accountId: string): void {
  const progress = state.progress[accountId];
  if (!progress) return;

  state.progress[accountId] = {
    ...progress,
    totalBreaches: progress.totalBreaches + 1,
  };
  notify();
}

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

/** Events newer than the persisted watermark — applied exactly once. */
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
    saveDemoState(SLOT, state); // watermark only — no listener churn
  }
  return fresh;
}

export function useScalingEvaluator(_tenantId: string): void {
  const log = useLifecycleLog();

  useEffect(() => {
    for (const e of freshEvents(log)) {
      if (e.name === "trade.closed") {
        const accountId = typeof e.payload?.accountId === "string" ? e.payload.accountId : "";
        if (!accountId) continue;
        const pnl = typeof e.payload?.pnl === "number" ? e.payload.pnl : 0;
        handleTradeClosed(accountId, pnl, {
          traderName:
            typeof e.payload?.accountName === "string" ? e.payload.accountName : undefined,
          accountSize:
            typeof e.payload?.accountSize === "number" ? e.payload.accountSize : undefined,
          closedAt:
            typeof e.payload?.closedAt === "string" ? e.payload.closedAt : e.at,
        });
      } else if (e.name === "payout.paid") {
        // Join cascade (payout-store emits accountId/accountName/traderId/
        // trader): terra account id → display name → trader id → trader
        // name. Fixture payouts carry none of these, so they honestly
        // don't move any progress row.
        const amount = typeof e.payload?.amount === "number" ? e.payload.amount : 0;
        const rows = Object.values(state.progress);
        const pick = (v: unknown, match: (p: ScalingProgress) => boolean) =>
          typeof v === "string" && v ? rows.find(match) : undefined;
        const target =
          pick(e.payload?.accountId, (p) => p.accountId === e.payload?.accountId) ??
          pick(
            e.payload?.accountName,
            (p) => p.traderName === e.payload?.accountName || p.accountId === e.payload?.accountName,
          ) ??
          pick(e.payload?.traderId, (p) => p.traderId === e.payload?.traderId) ??
          pick(e.payload?.trader, (p) => p.traderName === e.payload?.trader);
        if (target) handlePayoutPaid(target.accountId, amount);
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

export function getScalingStats(): {
  totalAccounts: number;
  averageProfitPct: number;
  milestonesReached: number;
  activeAccounts: number;
  averageSplitPct: number;
} {
  const progressList = Object.values(state.progress);
  const totalAccounts = progressList.length;
  const averageProfitPct =
    totalAccounts > 0
      ? progressList.reduce((sum, p) => sum + p.currentProfitPct, 0) / totalAccounts
      : 0;
  const milestonesReached = progressList.reduce(
    (sum, p) => sum + p.currentMilestoneIndex,
    0,
  );
  const activeAccounts = progressList.filter((p) => p.currentPhase === "scaling").length;
  const averageSplitPct =
    totalAccounts > 0
      ? progressList.reduce((sum, p) => sum + p.currentProfitSplitPct, 0) / totalAccounts
      : 0;

  return { totalAccounts, averageProfitPct, milestonesReached, activeAccounts, averageSplitPct };
}
