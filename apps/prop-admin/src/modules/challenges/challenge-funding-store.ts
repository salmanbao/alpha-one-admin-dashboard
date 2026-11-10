"use client";

import { useSyncExternalStore } from "react";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoChallengeFundingSchema } from "@/lib/platform/validation";
import { recordAudit } from "@/lib/audit";
import { setNavBadge } from "@/lib/platform/nav-badges";
import { emitLifecycle } from "@pfaas/lifecycle";

export type ChallengeFundingStatus = "passed" | "funding-requested" | "funded";

export interface ChallengeFunding {
  challengeId: string;
  status: ChallengeFundingStatus;
  fundedAt?: string;
  payoutRef?: string;
}

const SLOT = "challenge-funding";
const listeners = new Set<() => void>();
let state: Record<string, ChallengeFunding> = {};

try {
  // R3-02: the previous `null as any` schema made safeParse throw on every
  // load, so funded decisions silently reset on reload — real schema now.
  const persisted = loadDemoState(SLOT, demoChallengeFundingSchema, {});
  if (persisted && typeof persisted === "object") state = persisted as any;
} catch {
  state = {};
}

function notify() {
  listeners.forEach((l) => l());
  try {
    saveDemoState(SLOT, state);
  } catch {
    /* ignore */
  }
}

export function readChallengeFunding(challengeId: string): ChallengeFunding | undefined {
  return state[challengeId];
}

export function markFundingRequested(challengeId: string): void {
  state = { ...state, [challengeId]: { challengeId, status: "funding-requested" } };
  recordAudit({ action: "Challenge funding requested", entity: "challenge", entityId: challengeId, summary: challengeId, severity: "info" });
  emitLifecycle({
    entity: { kind: "challenge", id: challengeId },
    name: "challenge.funding-requested",
    actor: "prop-admin",
    key: `${challengeId}:funding-requested`,
    payload: { challengeId },
  });
  notify();
}

/**
 * R3-02 — the funding chain's single publish point:
 *
 *   gate (confirm dialog) → markFunded → provisioning.started → trader
 *
 * The trader app reads `provisioning.started` off the shared lifecycle
 * log (actor prop-admin) and renders the credentials moment, so this one
 * call completes the firm-side half of the chain. `traderName` and
 * `accountSize` ride the payload because the trader's fixtures are a
 * separate world — the event must carry what the trader needs to show.
 */
export function markFunded(
  challengeId: string,
  opts?: {
    payoutRef?: string;
    traderName?: string;
    accountSize?: number;
  },
): void {
  const payoutRef = opts?.payoutRef;
  state = { ...state, [challengeId]: { challengeId, status: "funded", fundedAt: new Date().toISOString(), payoutRef } };
  recordAudit({ action: "Challenge funded", entity: "challenge", entityId: challengeId, summary: `${challengeId}${payoutRef ? ` → ${payoutRef}` : ""}`, severity: "info" });
  emitLifecycle({
    entity: { kind: "challenge", id: challengeId },
    name: "challenge.funded",
    actor: "prop-admin",
    key: `${challengeId}:funded`,
    payload: {
      challengeId,
      payoutRef: payoutRef ?? null,
      traderName: opts?.traderName ?? null,
      accountSize: opts?.accountSize ?? null,
    },
  });
  // R3-02: funding starts provisioning of the trader's live account —
  // distinct entity from the trader's own purchase provisioning
  // (kind provisioning:<orderId>, actor trader), so the two never collide.
  emitLifecycle({
    entity: { kind: "provisioning", id: challengeId },
    name: "provisioning.started",
    actor: "prop-admin",
    key: `started:${challengeId}`,
    payload: {
      challengeId,
      traderName: opts?.traderName ?? null,
      accountSize: opts?.accountSize ?? null,
    },
  });
  notify();
}

export function useChallengeFunding(challengeId: string): ChallengeFunding | undefined {
  const raw = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => JSON.stringify(state[challengeId] ?? null),
    () => "null",
  );
  return raw === "null" ? undefined : (JSON.parse(raw) as ChallengeFunding);
}

export function useChallengeFundingMap(): Record<string, ChallengeFunding> {
  const raw = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => JSON.stringify(state),
    () => "{}",
  );
  return JSON.parse(raw) as Record<string, ChallengeFunding>;
}
