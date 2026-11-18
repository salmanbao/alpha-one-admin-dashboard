"use client";

/**
 * Ladder enforcement — trader side (R9 W4 UC-T7).
 *
 * Named consumer of `risk.ladder-moved` events (prop-admin's risk rule
 * engine). When an account's enforcement rung advances, this store syncs
 * the compliance config:
 *   • rung 0 (warn)      — no enforcement change
 *   • rung 1 (size-cap)  — sets `maxLots` from the rule's ladder config
 *   • rung 2 (suspend)   — sets `ladderRung = 2` (order ticket blocks)
 *   • rung 3 (breach)    — sets `ladderRung = 3` (order ticket blocks)
 *
 * Persisted under `pfaas:trader:ladder` (storage-census: prefix-wiped).
 * Also handles `risk.ladder-reset` to clear enforcement.
 */

import { useEffect, useSyncExternalStore } from "react";
import { useLifecycleLog, type LifecycleEvent } from "@pfaas/lifecycle";
import { setMaxLotsForAccount, setLadderRungForAccount } from "@/lib/compliance/compliance-store";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface LadderState {
  /** accountId → current rung (0=warn, 1=size-cap, 2=suspend, 3=breach). */
  rungs: Record<string, number>;
  /** accountId → max lots (size-cap rung). */
  maxLots: Record<string, number>;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "pfaas:trader:ladder";

function readStored(): LadderState {
  if (typeof window === "undefined") return { rungs: {}, maxLots: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rungs: {}, maxLots: {} };
    const parsed = JSON.parse(raw) as Partial<LadderState>;
    return {
      rungs: parsed.rungs ?? {},
      maxLots: parsed.maxLots ?? {},
    };
  } catch {
    return { rungs: {}, maxLots: {} };
  }
}

let state: LadderState = readStored();
const listeners = new Set<() => void>();

function commit(next: LadderState): void {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full — best-effort */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): string {
  return JSON.stringify(state);
}

function getServerSnapshot(): string {
  return JSON.stringify({ rungs: {}, maxLots: {} });
}

/* ------------------------------------------------------------------ */
/* Reactive state                                                      */
/* ------------------------------------------------------------------ */

export function useLadderStore(): LadderState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as LadderState;
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function getLadderRung(accountId: string): number {
  return state.rungs[accountId] ?? 0;
}

export function getMaxLots(accountId: string): number | undefined {
  return state.maxLots[accountId];
}

/* ------------------------------------------------------------------ */
/* Event consumer (lifecycle log → compliance config sync)             */
/* ------------------------------------------------------------------ */

/**
 * Sync ladder state from lifecycle events. Called by a React hook that
 * subscribes to the lifecycle log.
 */
export function syncLadderFromEvents(events: LifecycleEvent[]): void {
  let changed = false;
  const nextRungs = { ...state.rungs };
  const nextMaxLots = { ...state.maxLots };

  for (const e of events) {
    if (e.name === "risk.ladder-moved") {
      const accountId = String(e.payload?.accountId ?? "");
      if (!accountId) continue;
      const rung = Number(e.payload?.rung);
      if (!Number.isFinite(rung) || rung < 0) continue;

      nextRungs[accountId] = rung;
      changed = true;

      // Size-cap rung: publish maxLots from the ladder config.
      // The prop-admin payload includes `ladderRungs` — rung index 1 = size-cap.
      // We derive a default cap of 1.0 lot for demo purposes when not specified.
      if (rung === 1) {
        const ladderRungs = Array.isArray(e.payload?.ladderRungs) ? e.payload.ladderRungs : [];
        const sizeCapIndex = ladderRungs.indexOf("size-cap");
        // Default cap: 1.0 lot (demo). In production this would come from the rule config.
        nextMaxLots[accountId] = 1.0;
        setMaxLotsForAccount(accountId, 1.0);
      } else if (rung >= 2) {
        // Suspend/breach: clear maxLots (order ticket blocks entirely).
        delete nextMaxLots[accountId];
        setMaxLotsForAccount(accountId, undefined);
      }

      setLadderRungForAccount(accountId, rung);
    } else if (e.name === "risk.ladder-reset") {
      const accountId = String(e.payload?.accountId ?? "");
      if (!accountId) continue;
      delete nextRungs[accountId];
      delete nextMaxLots[accountId];
      changed = true;
      setMaxLotsForAccount(accountId, undefined);
      setLadderRungForAccount(accountId, undefined);
    }
  }

  if (changed) {
    commit({ rungs: nextRungs, maxLots: nextMaxLots });
  }
}

/**
 * React hook: subscribe to lifecycle log and sync ladder state.
 * Call once in the app shell or a top-level layout.
 */
export function useLadderSync(): void {
  const events = useLifecycleLog();
  useEffect(() => {
    syncLadderFromEvents(events);
  }, [events]);
}

/* ------------------------------------------------------------------ */
/* Order ticket enforcement helpers                                     */
/* ------------------------------------------------------------------ */

export interface OrderTicketEnforcement {
  blocked: boolean;
  blockReason?: string;
  maxLots?: number;
  rung: number;
}

/**
 * Check whether an order is allowed for an account given its ladder rung.
 * Called by the order ticket before submitting.
 */
export function checkOrderEnforcement(
  accountId: string,
  requestedLots: number,
): OrderTicketEnforcement {
  const rung = getLadderRung(accountId);
  const maxLots = getMaxLots(accountId);

  if (rung >= 3) {
    return {
      blocked: true,
      blockReason: "Account is in breach — all trading suspended.",
      rung,
    };
  }
  if (rung >= 2) {
    return {
      blocked: true,
      blockReason: "Account is suspended — trading is temporarily disabled.",
      rung,
    };
  }
  if (rung === 1 && maxLots !== undefined && requestedLots > maxLots) {
    return {
      blocked: false, // clamp, not block
      blockReason: `Size cap: maximum ${maxLots.toFixed(2)} lots per order (rung 1 enforcement).`,
      maxLots,
      rung,
    };
  }
  return { blocked: false, rung };
}