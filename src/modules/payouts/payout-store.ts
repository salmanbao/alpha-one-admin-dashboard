"use client";

import { useEffect, useState } from "react";
import type { Payout } from "@/lib/platform/mock-data";

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
export type PayoutDecision = "approved" | "rejected" | "info-requested";

const decisions = new Map<string, { status: PayoutDecision; at: string }>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Record a decision for a payout (keyed by its unique reference). */
export function applyPayoutDecision(reference: string, decision: PayoutDecision) {
  decisions.set(reference, { status: decision, at: new Date().toISOString() });
  emit();
}

export function getPayoutDecision(reference: string) {
  return decisions.get(reference);
}

/**
 * Effective status of a payout, honoring session decisions.
 * "info-requested" keeps the payout pending (the trader was contacted,
 * the queue position is unchanged).
 */
export function effectivePayoutStatus(
  p: Pick<Payout, "reference" | "status">,
): Payout["status"] {
  const d = decisions.get(p.reference);
  if (!d) return p.status;
  if (d.status === "approved") return "approved";
  if (d.status === "rejected") return "rejected";
  return p.status;
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
