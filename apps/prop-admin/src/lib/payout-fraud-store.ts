"use client";

/**
 * Payout fraud & abuse queue — R9 W2 UC-O5.
 *
 * Turns ad-hoc payout denials into a queue with evidence. Signals are
 * computed from the shared lifecycle log at intake (one derivation,
 * read-only — the log is the source of truth):
 *
 *   method-reuse    (a) the same payout-method fingerprint (hash of the
 *                     method detail, carried in `payout.requested`) is
 *                     used by more than one trading account.
 *   rapid-cycle     (b) a purchase → payout request within 7 days for
 *                     the same program label (buy, get funded fast,
 *                     extract — the classic challenge abuse).
 *   round-amount    (c) the amount sits just under a round threshold
 *                     ($1,950 under $2,000) — structuring around
 *                     review/limit cutoffs.
 *
 * A flag is `FraudFlag { id: pf-<reference>; payoutRequestId; traderId;
 * signals[]; status: "open"|"cleared"|"blocked"|"escalated" }` plus the
 * evidence lines the reviewer acts on. Verdicts persist under
 * `pfaas:demo:payout-fraud` (R10), `recordAudit` and emit
 * `payout.fraud-cleared/blocked/escalated`.
 *
 * Enforcement: `payoutFraudBlock(reference)` is the chokepoint the
 * payout decision path consults (mirroring `payoutAmlBlock`) — a
 * `blocked` flag refuses approve/process/pay until cleared; the queue,
 * review panels and gate filter render the reason.
 *
 * Named consumers of every emitted event (rule 7):
 *   payout.fraud-cleared/blocked/escalated → this projection (verdict
 *                            overlay on the queue rows) + trader
 *                            inbox-lifecycle-bridge receipts.
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoPayoutFraudSchema } from "@/lib/platform/validation";
import {
  emitLifecycle,
  readLifecycleLog,
  useLifecycleLog,
  type LifecycleEvent,
} from "@pfaas/lifecycle";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type FraudSignal = "method-reuse" | "rapid-cycle" | "round-amount";
export type FraudFlagStatus = "open" | "cleared" | "blocked" | "escalated";

export interface FraudFlag {
  /** `pf-<payout reference>` — stable across log and persistence. */
  id: string;
  /** Event entity id of the `payout.requested` that tripped intake. */
  payoutRequestId: string;
  reference: string;
  traderId: string;
  traderName: string;
  accountLogin: string;
  amount: number;
  currency: string;
  signals: FraudSignal[];
  /** Human-readable evidence, one line per signal — what the queue shows. */
  evidence: string[];
  status: FraudFlagStatus;
  openedAt: string;
  verdictReason?: string;
  decidedAt?: string;
}

interface FraudState {
  /** Verdicts keyed by flag id — decided rows win over derivation. */
  verdicts: Record<string, { status: "cleared" | "blocked" | "escalated"; reason?: string; at: string }>;
  /** R9 W4 — manually escalated flags (collusion workbench → fraud queue). */
  manualFlags?: FraudFlag[];
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const SLOT = "payout-fraud";
let state: FraudState = loadDemoState(SLOT, demoPayoutFraudSchema, { verdicts: {}, manualFlags: [] });
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

/** Subscribe payout surfaces to fraud verdicts (block → re-render). */
export function useFraudVersion(): number {
  const log = useLifecycleLog();
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v + log.length;
}

/* ------------------------------------------------------------------ */
/* Signal derivation (pure, log → flags)                               */
/* ------------------------------------------------------------------ */

const RAPID_CYCLE_DAYS = 7;

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** "Terra Pro $100K" vs "terra pro $100k" — labels come from two apps. */
function normLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * (c) Amount just under a round threshold: gap to the next round must
 * be non-zero (exactly-round amounts are normal) and within max($50,
 * 5% of the next round) — $1,950 flags under $2,000, $1,840 does not.
 */
function roundAmountEvidence(amount: number): string | null {
  if (amount <= 0) return null;
  const roundBase = amount >= 1000 ? 1000 : 100;
  const nextRound = Math.ceil(amount / roundBase) * roundBase;
  const gap = nextRound - amount;
  if (gap <= 0) return null;
  const tolerance = Math.max(50, nextRound * 0.05);
  if (gap > tolerance) return null;
  return `Amount ${amount.toLocaleString("en-US")} sits ${gap.toLocaleString("en-US")} under the ${nextRound.toLocaleString("en-US")} threshold (structuring pattern)`;
}

/**
 * Derive the flag set from the shared log. Each `payout.requested` is
 * evaluated against the other requests and against `purchase.completed`
 * history; a request with no signal produces no flag (empty queue is
 * the honest state).
 */
export function projectPayoutFraudFlags(log: LifecycleEvent[]): FraudFlag[] {
  const requested = log.filter(
    (e) => e.name === "payout.requested" && e.entity.kind === "payout",
  );

  // (a) fingerprint → distinct account ids (reuse needs ≥ 2 accounts).
  const byFingerprint = new Map<string, Set<string>>();
  for (const e of requested) {
    const fp = str(e.payload?.methodFingerprint);
    const account = str(e.payload?.accountLogin) ?? str(e.payload?.accountId);
    if (!fp || !account) continue;
    if (!byFingerprint.has(fp)) byFingerprint.set(fp, new Set());
    byFingerprint.get(fp)!.add(account);
  }

  // (b) program label → purchase timestamps (rapid-cycle window).
  const purchasesByProgram = new Map<string, string[]>();
  for (const e of log) {
    if (e.name !== "purchase.completed" || e.entity.kind !== "purchase") continue;
    const label = str(e.payload?.challengeType) ?? str(e.payload?.program);
    if (!label) continue;
    const key = normLabel(label);
    if (!purchasesByProgram.has(key)) purchasesByProgram.set(key, []);
    purchasesByProgram.get(key)!.push(e.at);
  }

  const flags: FraudFlag[] = [];
  for (const e of requested) {
    const reference = str(e.payload?.reference) ?? e.entity.id;
    const signals: FraudSignal[] = [];
    const evidence: string[] = [];

    // (a) method fingerprint reuse across accounts
    const fp = str(e.payload?.methodFingerprint);
    const account = str(e.payload?.accountLogin) ?? str(e.payload?.accountId) ?? "";
    if (fp && (byFingerprint.get(fp)?.size ?? 0) > 1) {
      const others = [...(byFingerprint.get(fp) ?? [])].filter((a) => a !== account);
      signals.push("method-reuse");
      evidence.push(
        `Method fingerprint ${fp} is also used by account #${others.join(", #")} — same withdrawal detail across accounts`,
      );
    }

    // (b) purchase → payout rapid cycle (same program label, ≤ 7 days)
    const program = str(e.payload?.program);
    if (program) {
      const boughtAt = purchasesByProgram.get(normLabel(program)) ?? [];
      const requestedMs = new Date(e.at).getTime();
      const cycle = boughtAt
        .map((at) => ({ at, days: (requestedMs - new Date(at).getTime()) / 86_400_000 }))
        .filter((c) => c.days >= 0 && c.days <= RAPID_CYCLE_DAYS)
        .sort((a, b) => a.days - b.days)[0];
      if (cycle) {
        signals.push("rapid-cycle");
        evidence.push(
          `Purchased ${program} on ${cycle.at.slice(0, 10)} and requested a payout ${cycle.days.toFixed(1)} days later (≤ ${RAPID_CYCLE_DAYS}-day cycle)`,
        );
      }
    }

    // (c) amount just under a round threshold
    const amount = num(e.payload?.amount);
    const roundEvidence = roundAmountEvidence(amount);
    if (roundEvidence) {
      signals.push("round-amount");
      evidence.push(roundEvidence);
    }

    if (signals.length === 0) continue;

    flags.push({
      id: `pf-${reference}`,
      payoutRequestId: e.entity.id,
      reference,
      traderId: str(e.payload?.accountId) ?? `trader-${e.entity.id}`,
      traderName: str(e.payload?.accountLogin) ?? "Trader app request",
      accountLogin: str(e.payload?.accountLogin) ?? "",
      amount,
      currency: str(e.payload?.currency) ?? "USD",
      signals,
      evidence,
      status: "open",
      openedAt: e.at,
    });
  }

  // Verdict overlay — persisted decisions win (survive reload, R10).
  for (const f of flags) {
    const v = state.verdicts[f.id];
    if (v) {
      f.status = v.status;
      f.verdictReason = v.reason;
      f.decidedAt = v.at;
    }
  }

  // R9 W4 — append manually escalated flags (collusion workbench).
  const manual = state.manualFlags ?? [];
  for (const f of manual) {
    const v = state.verdicts[f.id];
    if (v) {
      f.status = v.status;
      f.verdictReason = v.reason;
      f.decidedAt = v.at;
    }
  }

  return [...flags, ...manual].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

/** Reactive flags (queue view + badges). */
export function usePayoutFraudFlags(): FraudFlag[] {
  const log = useLifecycleLog();
  useFraudVersion();
  return projectPayoutFraudFlags(log);
}

/** Non-reactive read (callers outside React — chokepoint, badge sync). */
export function getPayoutFraudFlags(): FraudFlag[] {
  return projectPayoutFraudFlags(readLifecycleLog());
}

/* ------------------------------------------------------------------ */
/* Chokepoint (mirrors payoutAmlBlock in the payout decision path)     */
/* ------------------------------------------------------------------ */

export interface PayoutFraudBlock {
  flagId: string;
  signals: FraudSignal[];
  reason: string;
}

/** The active fraud hold blocking a payout, or null when it may proceed. */
export function payoutFraudBlock(reference: string): PayoutFraudBlock | null {
  const flag = getPayoutFraudFlags().find((f) => f.reference === reference);
  if (!flag || flag.status !== "blocked") return null;
  return {
    flagId: flag.id,
    signals: flag.signals,
    reason: flag.verdictReason
      ? `Fraud hold ${flag.id} — ${flag.verdictReason}`
      : `Fraud hold ${flag.id} — ${flag.signals.join(", ")}`,
  };
}

/* ------------------------------------------------------------------ */
/* Verdicts (persisted + audited + published)                          */
/* ------------------------------------------------------------------ */

export type FraudVerdict = "cleared" | "blocked" | "escalated";

/**
 * Decide a flag. Persists the verdict (R10), audits, and publishes the
 * matching lifecycle event — consumers: this projection (the queue row
 * flips) and the trader's inbox bridge (receipt naming the signal).
 */
export function setPayoutFraudVerdict(
  reference: string,
  verdict: FraudVerdict,
  reason?: string,
): FraudFlag | null {
  const flag = getPayoutFraudFlags().find((f) => f.reference === reference);
  if (!flag) return null;

  const at = new Date().toISOString();
  state.verdicts = {
    ...state.verdicts,
    [flag.id]: { status: verdict, reason: reason?.trim() || undefined, at },
  };
  notify();

  recordAudit({
    action:
      verdict === "cleared"
        ? "Cleared payout fraud flag"
        : verdict === "blocked"
          ? "Blocked payout on fraud hold"
          : "Escalated payout fraud flag",
    entity: "payout",
    entityId: reference,
    summary: `${flag.traderName} — ${flag.amount} ${flag.currency} (${flag.signals.join(", ")}): ${verdict}${reason ? `. ${reason}` : ""}`,
    severity: verdict === "cleared" ? "info" : "warning",
    module: "payouts",
  });

  // Consumer: payout queue chokepoint (block refuses money-moving
  // decisions until cleared) + trader inbox-lifecycle-bridge receipts.
  emitLifecycle({
    entity: { kind: "payout", id: reference },
    name: `payout.fraud-${verdict}`,
    actor: "prop-admin",
    key: `fraud:${reference}:${verdict}:${at}`,
    payload: {
      reference,
      flagId: flag.id,
      traderId: flag.traderId,
      traderName: flag.traderName,
      amount: flag.amount,
      currency: flag.currency,
      signal: flag.signals.join(", "),
      detail: flag.evidence.join(" | "),
      reason: reason?.trim() ?? null,
      status: verdict,
    },
  });

  return getPayoutFraudFlags().find((f) => f.reference === reference) ?? null;
}

/* ------------------------------------------------------------------ */
/* R9 W4 — Manual escalation (collusion workbench → fraud queue)        */
/* ------------------------------------------------------------------ */

/**
 * Escalate a cluster case to the payout fraud queue. Creates a manual
 * flag with the cluster's signals as evidence, persists it (R10), audits,
 * and emits `payout.fraud-escalated` — consumers: this projection (the
 * queue row appears) and the trader's inbox bridge (receipt).
 */
export function escalateClusterToFraud(input: {
  clusterId: string;
  accountLogins: string[];
  traderIds: string[];
  traderNames: string[];
  signals: string[];
  evidence: string[];
  reason?: string;
}): FraudFlag | null {
  const at = new Date().toISOString();
  const reference = `cluster-${input.clusterId}`;
  const flagId = `pf-${reference}`;

  const flag: FraudFlag = {
    id: flagId,
    payoutRequestId: `escalated-${input.clusterId}`,
    reference,
    traderId: input.traderIds[0] ?? "unknown",
    traderName: input.traderNames[0] ?? "Cluster escalation",
    accountLogin: input.accountLogins.join(", "),
    amount: 0,
    currency: "USD",
    signals: input.signals as FraudSignal[],
    evidence: input.evidence,
    status: "escalated",
    openedAt: at,
    verdictReason: input.reason?.trim() || `Escalated from collusion workbench — ${input.signals.join(", ")}`,
    decidedAt: at,
  };

  state.manualFlags = [...(state.manualFlags ?? []), flag];
  state.verdicts = {
    ...state.verdicts,
    [flagId]: { status: "escalated", reason: flag.verdictReason, at },
  };
  notify();

  recordAudit({
    action: "Escalated collusion cluster to fraud queue",
    entity: "payout",
    entityId: reference,
    summary: `Cluster ${input.clusterId} — accounts #${input.accountLogins.join(", #")} (${input.signals.join(", ")}): escalated to fraud queue${input.reason ? `. ${input.reason}` : ""}`,
    severity: "warning",
    module: "risk",
  });

  emitLifecycle({
    entity: { kind: "payout", id: reference },
    name: "payout.fraud-escalated",
    actor: "prop-admin",
    key: `fraud:${reference}:escalated:${at}`,
    payload: {
      reference,
      flagId,
      clusterId: input.clusterId,
      accountLogins: input.accountLogins,
      traderIds: input.traderIds,
      traderNames: input.traderNames,
      signal: input.signals.join(", "),
      detail: input.evidence.join(" | "),
      reason: input.reason?.trim() ?? null,
      status: "escalated",
    },
  });

  return flag;
}
