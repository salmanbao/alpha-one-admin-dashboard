"use client";

import { useSyncExternalStore } from "react";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { recordAudit } from "@/lib/audit";
import { setNavBadge } from "@/lib/platform/nav-badges";

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
  const persisted = loadDemoState(SLOT, null as any, {});
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
  notify();
}

export function markFunded(challengeId: string, payoutRef?: string): void {
  state = { ...state, [challengeId]: { challengeId, status: "funded", fundedAt: new Date().toISOString(), payoutRef } };
  recordAudit({ action: "Challenge funded", entity: "challenge", entityId: challengeId, summary: `${challengeId}${payoutRef ? ` → ${payoutRef}` : ""}`, severity: "info" });
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
