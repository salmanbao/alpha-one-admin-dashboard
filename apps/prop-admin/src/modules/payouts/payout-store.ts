"use client";

import { useEffect, useState } from "react";
import type { Payout } from "@/lib/platform/mock-data";
import { payouts as seedPayouts } from "@/lib/platform/mock-data";
import { setNavBadge } from "@/lib/platform/nav-badges";
import { recordAudit } from "@/lib/audit";

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

const decisions = new Map<string, { status: PayoutDecision; at: string }>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
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
) {
  decisions.set(reference, { status: decision, at: new Date().toISOString() });
  // Audit chokepoint (lib/audit.ts): every decision surface — table row,
  // review card, dashboard widget, batch action — lands here, so the
  // trail is written exactly once per decision regardless of entry point.
  const p = seedPayouts.find((x) => x.reference === reference);
  const who = p ? p.traderName : reference;
  const amount = p ? `${p.amount} ${p.currency}` : "";
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

// Seed the sidebar badge at boot (this module is imported by the payouts
// manifest, which module-bootstrap loads eagerly).
syncBadge();
