"use client";

import { useEffect, useState } from "react";
import { setNavBadge } from "@/lib/platform/nav-badges";
import { recordAudit } from "@/lib/audit";

/**
 * Session-scoped evaluation decision store (PRD §4.3 / §4.17).
 *
 * The Evaluation Queue is the admin review step for challenge instances
 * that reached their profit target (or need a manual decision):
 *   POST /evaluation/:id/approve   → approved
 *   POST /evaluation/:id/reject    → rejected (with reason)
 *   POST /evaluation/:id/override  → manual force pass / force fail (with reason)
 *
 * Decisions live here so the queue table, KPI cards and the sidebar
 * "Evaluation Queue" count badge (PRD §4.6.2 pending_evaluations) all
 * react to a single source of truth — see nav-badges.
 */

export type EvaluationStatus = "pending" | "approved" | "rejected" | "overridden";

export interface Evaluation {
  id: string;
  traderName: string;
  traderEmail: string;
  accountLogin: string;
  challengeName: string;
  /** Phase label, e.g. "Phase 2" */
  phase: string;
  /** Current profit vs target, in percent of target progress */
  profitPct: number;
  targetPct: number;
  daysTraded: number;
  minDays: number;
  /** Max drawdown used, in percent */
  drawdownUsedPct: number;
  requestedAt: string;
  status: EvaluationStatus;
  /** Present once decided */
  reason?: string;
  decidedAt?: string;
  /** For overridden decisions — which way the reviewer forced it */
  overrideOutcome?: "pass" | "fail";
}

const seed: Evaluation[] = [
  {
    id: "eval-1041",
    traderName: "Alex Morgan",
    traderEmail: "alex.morgan@example.com",
    accountLogin: "ACC-8921",
    challengeName: "2-Step Evaluation $50K",
    phase: "Phase 2",
    profitPct: 9.4,
    targetPct: 10,
    daysTraded: 7,
    minDays: 5,
    drawdownUsedPct: 3.1,
    requestedAt: "2026-10-27T08:12:00.000Z",
    status: "pending",
  },
  {
    id: "eval-1040",
    traderName: "Priya Sharma",
    traderEmail: "priya.sharma@example.com",
    accountLogin: "ACC-7742",
    challengeName: "1-Step Fast Track $25K",
    phase: "Phase 1",
    profitPct: 10.2,
    targetPct: 10,
    daysTraded: 6,
    minDays: 5,
    drawdownUsedPct: 2.4,
    requestedAt: "2026-10-27T06:40:00.000Z",
    status: "pending",
  },
  {
    id: "eval-1039",
    traderName: "Diego Alvarez",
    traderEmail: "diego.alvarez@example.com",
    accountLogin: "ACC-6510",
    challengeName: "2-Step Evaluation $100K",
    phase: "Phase 1",
    profitPct: 8.1,
    targetPct: 10,
    daysTraded: 5,
    minDays: 5,
    drawdownUsedPct: 4.7,
    requestedAt: "2026-10-26T19:05:00.000Z",
    status: "pending",
  },
  {
    id: "eval-1038",
    traderName: "Emma Chen",
    traderEmail: "emma.chen@example.com",
    accountLogin: "ACC-5567",
    challengeName: "3-Step Master $10K",
    phase: "Phase 3",
    profitPct: 6.0,
    targetPct: 6,
    daysTraded: 9,
    minDays: 7,
    drawdownUsedPct: 1.9,
    requestedAt: "2026-10-26T14:22:00.000Z",
    status: "pending",
  },
  {
    id: "eval-1037",
    traderName: "Tomás Rivera",
    traderEmail: "tomas.rivera@example.com",
    accountLogin: "ACC-4419",
    challengeName: "Instant Funding $5K",
    phase: "Funded review",
    profitPct: 5.3,
    targetPct: 5,
    daysTraded: 4,
    minDays: 3,
    drawdownUsedPct: 5.8,
    requestedAt: "2026-10-26T09:58:00.000Z",
    status: "pending",
  },
  {
    id: "eval-1036",
    traderName: "Sofia Novak",
    traderEmail: "sofia.novak@example.com",
    accountLogin: "ACC-3382",
    challengeName: "2-Step Evaluation $50K",
    phase: "Phase 2",
    profitPct: 11.7,
    targetPct: 10,
    daysTraded: 8,
    minDays: 5,
    drawdownUsedPct: 2.2,
    requestedAt: "2026-10-25T16:30:00.000Z",
    status: "approved",
    reason: "Targets met with clean drawdown profile.",
    decidedAt: "2026-10-25T17:02:00.000Z",
  },
  {
    id: "eval-1035",
    traderName: "Liam O'Connor",
    traderEmail: "liam.oconnor@example.com",
    accountLogin: "ACC-2204",
    challengeName: "1-Step Fast Track $25K",
    phase: "Phase 1",
    profitPct: 10.1,
    targetPct: 10,
    daysTraded: 5,
    minDays: 5,
    drawdownUsedPct: 6.9,
    requestedAt: "2026-10-25T11:14:00.000Z",
    status: "rejected",
    reason: "Consistency rule breached — 78% of profit from one position.",
    decidedAt: "2026-10-25T12:40:00.000Z",
  },
];

const evaluations = new Map<string, Evaluation>(seed.map((e) => [e.id, e]));
const listeners = new Set<() => void>();
let version = 0;

function syncBadge() {
  let pending = 0;
  evaluations.forEach((e) => {
    if (e.status === "pending") pending += 1;
  });
  // PRD §4.6.2 — sidebar count badge for the Evaluation Queue.
  setNavBadge("evaluation-queue", pending);
}

function emit() {
  version += 1;
  syncBadge();
  listeners.forEach((l) => l());
}

// Seed the sidebar badge at boot (this module is imported by the trading
// manifest, which module-bootstrap loads eagerly).
syncBadge();

/** All evaluations, newest request first. */
export function getEvaluations(): Evaluation[] {
  return Array.from(evaluations.values()).sort(
    (a, b) => b.requestedAt.localeCompare(a.requestedAt),
  );
}

export function getEvaluation(id: string): Evaluation | undefined {
  return evaluations.get(id);
}

export function pendingEvaluationCount(): number {
  let n = 0;
  evaluations.forEach((e) => {
    if (e.status === "pending") n += 1;
  });
  return n;
}

export type EvaluationDecision = "approved" | "rejected" | "overridden";

/**
 * Record a review decision (PRD §4.17 approve / reject / override).
 * `reason` is required by the UI for reject and override.
 */
export function decideEvaluation(
  id: string,
  decision: EvaluationDecision,
  reason?: string,
  overrideOutcome?: "pass" | "fail",
): void {
  const ev = evaluations.get(id);
  if (!ev || ev.status !== "pending") return;
  evaluations.set(id, {
    ...ev,
    status: decision,
    reason: reason?.trim() || undefined,
    decidedAt: new Date().toISOString(),
    overrideOutcome: decision === "overridden" ? overrideOutcome : undefined,
  });
  // Audit chokepoint (lib/audit.ts) — approve/reject/override all land here.
  recordAudit({
    action:
      decision === "approved"
        ? "Approved evaluation"
        : decision === "rejected"
          ? "Rejected evaluation"
          : "Overrode evaluation",
    entity: "evaluation",
    entityId: id,
    summary: reason?.trim()
      ? `${ev.traderName} — ${ev.challengeName} ${decision}: ${reason.trim()}`
      : `${ev.traderName} — ${ev.challengeName} ${decision}`,
    severity: decision === "rejected" ? "warning" : "info",
  });
  emit();
}

/** Subscribe the calling component to store mutations. */
export function useEvaluationVersion(): number {
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
