"use client";

/**
 * Payout methods store — W1-01 (one payout-method source of truth).
 *
 * Before this, methods added in /withdrawal-methods lived in component
 * state while /payout-request read the fixture and hardcoded `wm-wise`
 * as the default — so a trader could add a method and still be unable
 * to select it at the moment of truth.
 *
 * This module owns the single persisted payout-methods list. Every
 * surface that consumes methods (request form, eligibility strip,
 * history, dashboard card) reads from here; the fixture is only the
 * seed on first run. Adds/edits/removes/primaries survive reload and
 * are reflected everywhere immediately.
 *
 * Pattern mirrors journey-store / verification-store: localStorage
 * backing, useSyncExternalStore reactivity, cross-tab sync, and an
 * invariant that exactly one method is primary at all times.
 *
 * Each method carries a numeric `feeAmount` (parsed from the human
 * readable `fee` string) so the request form can show a fee-inclusive
 * total that always sums: fee + total = amount.
 *
 * Each method also carries a `verification` state ("unverified" |
 * "pending" | "verified" | "rejected") seeded as "verified" for fixture
 * methods and "pending" for trader-added methods. Operators on
 * prop-admin override the verdict by writing `payout-method.rejected` /
 * `payout-method.unverified` lifecycle events (rule R5: one object,
 * one write path — verdicts are overlaid on the stored record).
 */

import { useSyncExternalStore } from "react";
import { LIFECYCLE_LOG_KEY } from "@pfaas/lifecycle";
import { emitLifecycle, type LifecycleEventName } from "@pfaas/lifecycle";
import { withdrawalMethods } from "@/lib/fixtures/terra-fixtures";

/** R2-W3-01: methods are a lifecycle-tracked entity, not local state. */
function publish(
  name: LifecycleEventName,
  method: { id: string; name?: string; primary?: boolean },
  key?: string,
): void {
  emitLifecycle({
    entity: { kind: "payout-method", id: method.id },
    name,
    actor: "trader",
    key,
    payload: { method: method.name ?? method.id, primary: method.primary ?? false },
  });
}

const STORAGE_KEY = "pfaas:trader:payoutMethods";

/** The shape every surface consumes — the numeric feeAmount is store-owned. */
export type VerificationState = "unverified" | "pending" | "verified" | "rejected";

export interface PayoutMethod {
  id: string;
  name: string;
  detail: string;
  fee: string;
  /** Numeric fee for total math (parsed from `fee`). */
  feeAmount: number;
  eta: string;
  primary: boolean;
  /** Verification state — unverified / pending / verified / rejected. */
  verification: VerificationState;
}

function parseFeeAmount(fee: string): number {
  const match = fee.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function normalize(m: (typeof withdrawalMethods)[number]): PayoutMethod {
  return {
    ...m,
    feeAmount: parseFeeAmount(m.fee),
    /** Seeded fixture methods are pre-verified (known good). */
    verification: "verified",
  };
}

/** Seed on first run only. After that localStorage is the source of truth. */
const seedMethods: PayoutMethod[] = withdrawalMethods.map(normalize);

function ensureOnePrimary(methods: PayoutMethod[]): PayoutMethod[] {
  const hasPrimary = methods.some((m) => m.primary);
  if (hasPrimary || methods.length === 0) return methods;
  return methods.map((m, i) => ({ ...m, primary: i === 0 }));
}

function readRawMethods(): PayoutMethod[] {
  if (typeof window === "undefined") return seedMethods;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedMethods;
    const parsed = JSON.parse(raw) as PayoutMethod[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedMethods;
    // Overlay verification verdicts from the shared lifecycle log so
    // operator decisions (verify / reject / unverify) take precedence.
    const overlay = verificationOverlay();
    return ensureOnePrimary(
      parsed.map((m) => {
        const normalized: PayoutMethod = normalize(m as any);
        const verdict = overlay.get(normalized.id);
        if (verdict) normalized.verification = verdict;
        return normalized;
      }),
    );
  } catch {
    return seedMethods;
  }
}

function writeMethods(methods: PayoutMethod[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(ensureOnePrimary(methods.map(normalize))),
    );
  } catch {
    /* storage unavailable — store works in-session only */
  }
  notify();
}

/* ------------------------------------------------------------------ */
/* External store: localStorage with same-tab change notifications     */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Cross-tab sync: the storage event fires in OTHER tabs on write;
  // same-tab writes go through notify() below.
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string {
  return JSON.stringify(readRawMethods());
}

function getServerSnapshot(): string {
  return JSON.stringify(seedMethods);
}



/** Reads `payout-method.rejected` / `payout-method.unverified` verdicts
 * from the shared lifecycle log so operator decisions are reflected
 * immediately on every consumer of this store (rule R5). */
function verificationOverlay(): Map<string, VerificationState> {
  const map = new Map<string, VerificationState>();
  if (typeof window === "undefined") return map;
  try {
    const raw = window.localStorage.getItem(LIFECYCLE_LOG_KEY);
    const log = raw ? (JSON.parse(raw) as Array<{ entity?: { kind?: string; id?: string }; name?: string }>) : [];
    for (const e of log) {
      if (!e.entity || e.entity.kind !== "payout-method" || !e.entity.id) continue;
      if (e.name === "payout-method.rejected") map.set(e.entity.id, "rejected");
      if (e.name === "payout-method.unverified") map.set(e.entity.id, "unverified");
    }
  } catch {
    /* log unavailable — store works in-session only */
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** All methods, primary first. */
export function readPayoutMethods(): PayoutMethod[] {
  return [...readRawMethods()].sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
}

/** The single primary method (always defined once methods exist). */
export function readPrimaryPayoutMethod(): PayoutMethod | undefined {
  return readRawMethods().find((m) => m.primary);
}


/** Add a new method (non-primary by default). */
export function addPayoutMethod(input: {
  name: string;
  detail: string;
  fee: string;
  eta: string;
}): void {
  const method: PayoutMethod = {
    id: `wm-custom-${Date.now().toString(36)}`,
    name: input.name,
    detail: input.detail,
    fee: input.fee,
    feeAmount: parseFeeAmount(input.fee),
    eta: input.eta,
    primary: false,
    verification: "pending",
  };
  writeMethods([method, ...readRawMethods()]);
  publish("payout-method.added", method, method.id);
}

/** Replace fields on an existing method. */
export function editPayoutMethod(id: string, patch: Partial<PayoutMethod>): void {
  const updated = readRawMethods().map((m) => {
    if (m.id !== id) return m;
    const next: PayoutMethod = { ...m, ...patch };
    if (patch.fee !== undefined) next.feeAmount = parseFeeAmount(patch.fee);
    return next;
  });
  writeMethods(updated);
  const target = updated.find((m) => m.id === id);
  if (target) publish("payout-method.updated", target);
}

/** Remove a method, promoting the first survivor if it was primary. */
export function removePayoutMethod(id: string): void {
  const target = readRawMethods().find((m) => m.id === id);
  const next = readRawMethods().filter((m) => m.id !== id);
  writeMethods(ensureOnePrimary(next));
  if (target) publish("payout-method.removed", target);
}

/** Set the primary method (exactly one after this). */
export function setPrimaryPayoutMethod(id: string): void {
  const updated = readRawMethods().map((m) => ({ ...m, primary: m.id === id }));
  writeMethods(updated);
  const target = updated.find((m) => m.id === id);
  if (target) publish("payout-method.primary-set", target);
}

/** Reactive methods list for components. */
export function usePayoutMethods(): PayoutMethod[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as PayoutMethod[];
}
