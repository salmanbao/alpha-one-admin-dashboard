"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { recordAudit } from "@/lib/audit";
import { emitLifecycle } from "@pfaas/lifecycle";

/**
 * Trader secondary-profile store (R7 I9).
 *
 * The trader-detail edit-save and payout-schedule-save sheets were
 * toast-only (nothing persisted, no audit). Both now write through here so
 * the change survives reload, lands in the session audit trail and is
 * published as a lifecycle event.
 */

const profileSchema = z.record(
  z.string(),
  z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    country: z.string().optional(),
    tags: z.string().optional(),
    payoutSchedule: z.string().optional(),
  }),
);

const SLOT = "trader-profile";
const listeners = new Set<() => void>();
let version = 0;

type Profile = {
  name?: string;
  email?: string;
  country?: string;
  tags?: string;
  payoutSchedule?: string;
};

function load(): Record<string, Profile> {
  try {
    const parsed = profileSchema.safeParse(loadDemoState(SLOT, profileSchema, {}));
    if (parsed.success) return parsed.data as Record<string, Profile>;
  } catch {
    /* fall through */
  }
  return {};
}

const state: Record<string, Profile> = load();

function emit() {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

/** Persist trader profile edits (edit-save sheet). */
export function saveTraderProfile(traderId: string, patch: Profile, traderName: string) {
  state[traderId] = { ...state[traderId], ...patch };
  recordAudit({
    action: "Edited trader profile",
    entity: "trader",
    entityId: traderId,
    summary: `${traderName} — profile updated`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "trader", id: traderId },
    name: "trader.reactivated",
    actor: "prop-admin",
    key: `${traderId}:profile-updated`,
    payload: { trader: traderName, fields: Object.keys(patch).join(",") },
  });
  emit();
}

/** Persist a payout-schedule change (payout-schedule sheet). */
export function savePayoutSchedule(traderId: string, schedule: string, traderName: string) {
  state[traderId] = { ...state[traderId], payoutSchedule: schedule };
  recordAudit({
    action: "Saved payout schedule",
    entity: "trader",
    entityId: traderId,
    summary: `${traderName} — payout schedule: ${schedule}`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "trader", id: traderId },
    name: "trader.reactivated",
    actor: "prop-admin",
    key: `${traderId}:payout-schedule`,
    payload: { trader: traderName, schedule },
  });
  emit();
}

export function getTraderProfile(traderId: string): Profile | undefined {
  return state[traderId];
}

export function useTraderProfileVersion(): number {
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