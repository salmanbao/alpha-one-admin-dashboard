"use client";

/**
 * R9 W5 UC-T9 — account pause / vacation mode (trader side).
 *
 * A trader requests a pause (1..PAUSE_MAX_DAYS) on an evaluation or funded
 * account. The request persists under `pfaas:trader:accountPause`
 * (storage-census: prefix-wiped by `deleteCurrentAccount()`) and is
 * published as `account.pause-requested` — named consumer: prop-admin's
 * cross-app intake pause queue.
 *
 * The operator's verdict arrives on the shared lifecycle log:
 * `usePauseSync` (mounted once in the app shell) is the named consumer of
 * `account.pause-approved` / `account.pause-rejected` and flips the local
 * record, which every "Paused until {date}" surface and the frozen day
 * counters read. Receipts go to the inbox bridge.
 */

import { useEffect, useSyncExternalStore } from "react";
import { emitLifecycle, useLifecycleLog, type LifecycleEvent } from "@pfaas/lifecycle";
import { daysFromNow } from "@/lib/fixtures/terra-fixtures";

const STORAGE_KEY = "pfaas:trader:accountPause";

/** Policy constant — a pause can never exceed 14 days (Demo policy). */
export const PAUSE_MAX_DAYS = 14;

export interface PauseRecord {
  id: string;
  accountId: string;
  accountLogin: string;
  accountName: string;
  /** Requested length in days (1..PAUSE_MAX_DAYS). */
  days: number;
  /** When the pause ends — request time + days (daysFromNow, §1 rule 5). */
  until: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  decidedAt?: string;
  /** Operator's rejection reason, verbatim. */
  reason?: string;
}

/** accountId → latest pause record. */
export type PauseMap = Record<string, PauseRecord>;

/* ------------------------------------------------------------------ */
/* Persistence (localStorage — R10)                                     */
/* ------------------------------------------------------------------ */

function readStored(): PauseMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PauseMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let state: PauseMap = readStored();
const listeners = new Set<() => void>();

function commit(next: PauseMap): void {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — in-memory state still works for the session */
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
  return "{}";
}

/* ------------------------------------------------------------------ */
/* Reactive state                                                      */
/* ------------------------------------------------------------------ */

export function useAccountPause(): PauseMap {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as PauseMap;
}

/** True while an approved pause is still in force (before its `until`). */
export function isPauseActive(rec: PauseRecord | undefined): rec is PauseRecord {
  return !!rec && rec.status === "approved" && Date.now() < Date.parse(rec.until);
}

/** The in-force pause for an account, or null. */
export function activePauseFor(accountId: string, pauses: PauseMap = state): PauseRecord | null {
  const rec = pauses[accountId];
  return isPauseActive(rec) ? rec : null;
}

/* ------------------------------------------------------------------ */
/* Request (trader write)                                              */
/* ------------------------------------------------------------------ */

export type PauseRequestResult =
  | { ok: true; record: PauseRecord }
  | { ok: false; reason: string };

/**
 * Persist the request and publish `account.pause-requested` (named
 * consumer: prop-admin cross-app intake pause queue).
 */
export function requestPause(
  account: { id: string; login: string; name: string },
  days: number,
): PauseRequestResult {
  if (!Number.isFinite(days) || days < 1) {
    return { ok: false, reason: "Choose at least 1 day." };
  }
  if (days > PAUSE_MAX_DAYS) {
    return { ok: false, reason: `A pause is capped at ${PAUSE_MAX_DAYS} days by policy (Demo).` };
  }
  const existing = state[account.id];
  if (existing && existing.status === "pending") {
    return { ok: false, reason: "A pause request for this account is already awaiting an operator decision." };
  }
  if (isPauseActive(existing)) {
    return { ok: false, reason: `This account is already paused until ${new Date(existing.until).toLocaleDateString()}.` };
  }

  const requestedAt = new Date().toISOString();
  const record: PauseRecord = {
    id: `pause-${account.id}-${Date.now()}`,
    accountId: account.id,
    accountLogin: account.login,
    accountName: account.name,
    days,
    until: daysFromNow(days),
    status: "pending",
    requestedAt,
  };
  commit({ ...state, [account.id]: record });
  emitLifecycle({
    entity: { kind: "account", id: account.id },
    name: "account.pause-requested",
    actor: "trader",
    key: `pause-requested:${account.id}:${requestedAt}`,
    payload: {
      accountId: account.id,
      accountLogin: account.login,
      accountName: account.name,
      applicant: account.name,
      days,
      until: record.until,
    },
  });
  return { ok: true, record };
}

/* ------------------------------------------------------------------ */
/* Event consumer (lifecycle log → local verdict sync)                  */
/* ------------------------------------------------------------------ */

/**
 * Apply operator verdicts from the shared log. Named consumer of
 * `account.pause-approved` / `account.pause-rejected` (emitted by the
 * prop-admin pause queue). A verdict older than the current record's
 * request is skipped so a fresh re-request is never flipped by a stale
 * decision; later events in the log win (append-only order).
 */
export function syncPauseFromEvents(events: LifecycleEvent[]): void {
  let changed = false;
  const next = { ...state };
  for (const e of events) {
    if (e.name !== "account.pause-approved" && e.name !== "account.pause-rejected") continue;
    const accountId = String(e.payload?.accountId ?? e.entity.id ?? "");
    if (!accountId) continue;
    const prev = next[accountId];
    if (prev && Date.parse(e.at) < Date.parse(prev.requestedAt)) continue;

    const base: PauseRecord = prev ?? {
      id: `pause-${accountId}-${e.id}`,
      accountId,
      accountLogin: String(e.payload?.accountLogin ?? ""),
      accountName: String(e.payload?.accountName ?? ""),
      days: Number(e.payload?.days ?? 0),
      until: typeof e.payload?.until === "string" ? e.payload.until : daysFromNow(PAUSE_MAX_DAYS),
      status: "pending",
      requestedAt: e.at,
    };
    next[accountId] =
      e.name === "account.pause-approved"
        ? {
            ...base,
            status: "approved",
            decidedAt: e.at,
            until: typeof e.payload?.until === "string" ? e.payload.until : base.until,
            reason: undefined,
          }
        : {
            ...base,
            status: "rejected",
            decidedAt: e.at,
            reason: typeof e.payload?.reason === "string" ? e.payload.reason : undefined,
          };
    changed = true;
  }
  if (changed) commit(next);
}

/** Subscribe to the log and apply verdicts — mounted once in the app shell. */
export function usePauseSync(): void {
  const events = useLifecycleLog();
  useEffect(() => {
    syncPauseFromEvents(events);
  }, [events]);
}
