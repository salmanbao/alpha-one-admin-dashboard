"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { recordAudit } from "@/lib/audit";
import { emitLifecycle } from "@pfaas/lifecycle";

/**
 * Account-state override store (R7 I9).
 *
 * The account-workspace extend / re-enable / block / manual-fail actions
 * were toast-only — nothing persisted and the "logged in the audit trail"
 * copy was a lie. Every action now writes through here: the override is
 * persisted (`pfaas:demo:account-state`), recorded in the session audit
 * trail and published as a typed lifecycle event so the trader's intake
 * (and inbox) sees the state change.
 */

const accountStateSchema = z.record(
  z.string(),
  z.object({
    status: z.string().optional(),
    extendedAt: z.string().optional(),
    deadlineDays: z.number().optional(),
    blockedAt: z.string().optional(),
    failedAt: z.string().optional(),
    failedReason: z.string().optional(),
  }),
);

const SLOT = "account-state";
const listeners = new Set<() => void>();
let version = 0;

type AccountState = {
  status?: string;
  extendedAt?: string;
  deadlineDays?: number;
  blockedAt?: string;
  failedAt?: string;
  failedReason?: string;
};

function load(): Record<string, AccountState> {
  try {
    const parsed = accountStateSchema.safeParse(loadDemoState(SLOT, accountStateSchema, {}));
    if (parsed.success) return parsed.data as Record<string, AccountState>;
  } catch {
    /* fall through */
  }
  return {};
}

const state: Record<string, AccountState> = load();

function emit() {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

function set(patch: AccountState, accountId: string) {
  state[accountId] = { ...state[accountId], ...patch };
}

/** Extend the account's time limit by +7 days. */
export function extendAccount(accountId: string, login: string) {
  const now = new Date().toISOString();
  set({ extendedAt: now, deadlineDays: (state[accountId]?.deadlineDays ?? 0) + 7 }, accountId);
  recordAudit({
    action: "Extended account time limit",
    entity: "account",
    entityId: accountId,
    summary: `${login} — deadline pushed +7 days`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "account", id: accountId },
    name: "account.extended",
    actor: "prop-admin",
    key: `${accountId}:extended`,
    payload: { login, days: 7 },
  });
  emit();
}

/** Re-enable a blocked account (restore trading access). */
export function reenableAccount(accountId: string, login: string) {
  set({ status: "active", blockedAt: undefined }, accountId);
  recordAudit({
    action: "Re-enabled account",
    entity: "account",
    entityId: accountId,
    summary: `${login} — trading access restored`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "account", id: accountId },
    name: "account.re-enabled",
    actor: "prop-admin",
    key: `${accountId}:re-enabled`,
    payload: { login },
  });
  emit();
}

/** Block an account (immediate loss of trading access). */
export function blockAccount(accountId: string, login: string, reason?: string) {
  set({ status: "blocked", blockedAt: new Date().toISOString() }, accountId);
  recordAudit({
    action: "Blocked account",
    entity: "account",
    entityId: accountId,
    summary: `${login} — blocked${reason ? ` — ${reason}` : ""}`,
    severity: "warning",
  });
  emitLifecycle({
    entity: { kind: "account", id: accountId },
    name: "account.blocked",
    actor: "prop-admin",
    key: `${accountId}:blocked`,
    payload: { login, reason: reason ?? null },
  });
  emit();
}

/** Operator-override manual fail of an evaluation account. */
export function manualFailAccount(accountId: string, login: string, reason: string) {
  set({ status: "failed", failedAt: new Date().toISOString(), failedReason: reason }, accountId);
  recordAudit({
    action: "Recorded manual fail",
    entity: "account",
    entityId: accountId,
    summary: `${login} — failed by operator override — ${reason}`,
    severity: "warning",
  });
  emitLifecycle({
    entity: { kind: "account", id: accountId },
    name: "account.failed",
    actor: "prop-admin",
    key: `${accountId}:failed`,
    payload: { login, reason },
  });
  emit();
}

export function getAccountState(accountId: string): AccountState | undefined {
  return state[accountId];
}

export function useAccountStateVersion(): number {
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