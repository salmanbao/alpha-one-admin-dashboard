"use client";

import { useEffect, useState } from "react";
import { traders as seedTraders, type Trader } from "@/lib/platform/mock-data";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoTradersSchema } from "@/lib/platform/validation";

/**
 * Session-scoped trader status store (PRD §4.8.1 / §4.17).
 *
 *   POST /traders/:id/suspend     → suspended
 *   POST /traders/:id/reactivate  → active
 *
 * Suspend / Reactivate can originate from the trader list row menu or the
 * trader-360 header. Both surfaces render from `effectiveTraderStatus()`
 * and subscribe via `useTraderStatusVersion()`, so a decision made
 * anywhere updates the status badge, the status filter options and the
 * KPI counts instantly — instead of the previous toast-only behavior.
 */
// Rehydrate status changes from a previous visit (demo persistence).
const overrides = new Map<string, Trader["status"]>(
  Object.entries(loadDemoState("traders", demoTradersSchema, {})),
);
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  saveDemoState("traders", Object.fromEntries(overrides));
  listeners.forEach((l) => l());
}

/** Record a status change for a trader (session-scoped, mock only). */
export function applyTraderStatus(traderId: string, status: Trader["status"]) {
  overrides.set(traderId, status);
  emit();
}

/** Effective status = session override, falling back to the seed data. */
export function effectiveTraderStatus(trader: Pick<Trader, "id" | "status">): Trader["status"] {
  return overrides.get(trader.id) ?? trader.status;
}

/** Subscribe this component to trader status changes. */
export function useTraderStatusVersion(): number {
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

/** Resolve effective status for the seed list (used by list KPIs/filters). */
export function effectiveTraders(): Trader[] {
  return seedTraders.map((t) => ({ ...t, status: effectiveTraderStatus(t) }));
}
