"use client";

import { useEffect, useState } from "react";
import type { Payout } from "@/lib/platform/mock-data";
import { payouts as seedPayouts } from "@/lib/platform/mock-data";
import { setNavBadge } from "@/lib/platform/nav-badges";
import { recordAudit } from "@/lib/audit";
import { getAmlCase, getAmlHoldCaseForTrader, useAmlVersion } from "@/modules/risk/aml-store";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoPayoutsSchema } from "@/lib/platform/validation";

/**
 * Session-scoped payout decision store.
 *
 * Approve / Reject / Request-Info actions can originate from several
 * surfaces (payout table rows, Pending review cards, the dashboard
 * Payout Queue widget). This store is the single source of truth for
 * those in-session decisions: every surface renders from
 * `effectivePayoutStatus()` and subscribes via `usePayoutVersion()`,
 * so a decision made anywhere updates every payout view instantly —
 * instead of the previous toast-only behavior that left rows pending.
 */
export type PayoutDecision =
  | "approved"
  | "rejected"
  | "info-requested"
  | "processing"
  | "paid"
  | "escalated";

// Rehydrate decisions from a previous visit (demo persistence).
/**
 * R3-F02 — why a payout is frozen by AML. Payout decision surfaces (table
 * row, review panel, queue widget, batch toolbar) render this as a blocked
 * badge + disabled Approve with the case ID in the reason.
 */
export interface PayoutAmlBlock {
  caseId: string;
  traderId: string;
  traderName: string;
  typology: string;
  risk: string;
  slaDue: string;
}

/** The active AML hold blocking a payout, or null when it may proceed. */
export function payoutAmlBlock(reference: string): PayoutAmlBlock | null {
  const p = seedPayouts.find((x) => x.reference === reference);
  const c = p ? getAmlHoldCaseForTrader(p.traderId) : undefined;
  if (!p || !c) return null;
  return { caseId: c.id, traderId: c.traderId, traderName: c.traderName, typology: c.typology, risk: c.risk, slaDue: c.slaDue };
}

/**
 * R3-F02 — every decision made through `applyPayoutDecision` returns this so
 * surfaces can report a block instead of toasting a success that did not
 * happen. Rejections/info/escalations are never AML-blocked (they move no
 * money); release of the hold itself requires compliance.aml.approve on the
 * AML case detail (four-eyes, R2-07).
 */
export type PayoutDecisionResult =
  | { ok: true }
  | { ok: false; reason: string; caseId: string };

/** Pending payouts a case's hold currently freezes (AML case detail shows these). */
export function payoutsHeldByCase(caseId: string): Payout[] {
  const c = getAmlCase(caseId);
  if (!c || !c.payoutHold) return [];
  return seedPayouts.filter((p) => p.traderId === c.traderId && effectivePayoutStatus(p) === "pending");
}

// Rehydrate decisions from a previous visit (demo persistence).
const decisions = new Map<string, { status: PayoutDecision; at: string }>(
  Object.entries(loadDemoState("payouts", demoPayoutsSchema, {})),
);
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  saveDemoState("payouts", Object.fromEntries(decisions));
  syncBadge();
  listeners.forEach((l) => l());
}

/**
 * PRD §4.6.2 pending_payouts sidebar badge — count every payout still
 * pending after session decisions (escalated/info-requested stay pending).
 */
function syncBadge() {
  let n = 0;
  for (const p of seedPayouts) {
    if (effectivePayoutStatus(p) === "pending") n += 1;
  }
  setNavBadge("payouts", n);
}

/** Record a decision for a payout (keyed by its unique reference). */
export function applyPayoutDecision(
  reference: string,
  decision: PayoutDecision,
  opts?: { reason?: string },
): PayoutDecisionResult {
  const p = seedPayouts.find((x) => x.reference === reference);
  const who = p ? p.traderName : reference;
  const amount = p ? `${p.amount} ${p.currency}` : "";

  // R3-F02 enforcement chokepoint: a frozen AML case blocks every decision
  // that would move money (approve / process / pay), whichever surface it
  // originates from — single row, review panel, queue widget or batch.
  if (decision === "approved" || decision === "processing" || decision === "paid") {
    const block = payoutAmlBlock(reference);
    if (block) {
      const reason = `${block.caseId} — ${block.typology} (${block.risk} risk)`;
      recordAudit({
        action: "Payout decision blocked by AML hold",
        entity: "payout",
        entityId: reference,
        summary: `${who} — ${amount} (${decision}) blocked: ${reason}`,
        severity: "warning",
      });
      return { ok: false, reason, caseId: block.caseId };
    }
  }

  decisions.set(reference, { status: decision, at: new Date().toISOString() });
  // Audit chokepoint (lib/audit.ts): every decision surface — table row,
  // review card, dashboard widget, batch action — lands here, so the
  // trail is written exactly once per decision regardless of entry point.
  recordAudit({
    action:
      decision === "approved"
        ? "Approved payout"
        : decision === "rejected"
          ? "Rejected payout"
          : decision === "escalated"
            ? "Escalated payout"
            : decision === "processing"
              ? "Payout processing started"
              : decision === "paid"
                ? "Payout marked paid"
                : "Requested payout info",
    entity: "payout",
    entityId: reference,
    summary: opts?.reason
      ? `${who} — ${amount} (${decision}): ${opts.reason}`
      : `${who} — ${amount} (${decision})`,
    severity: decision === "rejected" || decision === "escalated" ? "warning" : "info",
  });
  emit();
  return { ok: true };
}

export function getPayoutDecision(reference: string) {
  return decisions.get(reference);
}

/**
 * Effective status of a payout, honoring session decisions.
 * - "info-requested" keeps the payout pending (the trader was contacted,
 *   the queue position is unchanged).
 * - "escalated" (PRD §4.5 multi-level approval) also keeps the payout
 *   pending — it waits for senior sign-off; surfaces read
 *   `payoutEscalated()` to surface the escalation badge.
 * - "processing" / "paid" advance the lifecycle (PRD POST
 *   /payouts/:id/process).
 */
export function effectivePayoutStatus(
  p: Pick<Payout, "reference" | "status">,
): Payout["status"] {
  const d = decisions.get(p.reference);
  if (!d) return p.status;
  if (d.status === "approved") return "approved";
  if (d.status === "rejected") return "rejected";
  if (d.status === "processing") return "processing";
  if (d.status === "paid") return "paid";
  if (d.status === "escalated") return "pending";
  return p.status;
}

/** True when the payout was escalated for senior/multi-level approval. */
export function payoutEscalated(reference: string): boolean {
  return decisions.get(reference)?.status === "escalated";
}

/** Subscribe the calling component to store mutations (re-renders on change). */
export function usePayoutVersion(): number {
  // R3-F02: an AML hold release/creation (AML store) changes which payouts
  // are decidable, so payout surfaces subscribe to both stores here.
  const amlV = useAmlVersion();
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v + amlV;
}

// Seed the sidebar badge at boot (this module is imported by the payouts
// manifest, which module-bootstrap loads eagerly).
syncBadge();
