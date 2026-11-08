"use client";

/**
 * Journey tracker — SF-02 (state-driven Getting Started checklist).
 *
 * The dashboard tour hard-coded its ticks: four manually-toggled items
 * no screen ever completed for you, and purchase-completed's "What
 * happens next" shipped `done: true` frozen in source. This module is
 * the single store behind both surfaces:
 *
 *   Purchased     → journey flag, written by /purchase-completed
 *                   (the order-confirmation surface)
 *   Verified      → derived from the lifecycle log's `kyc.approved`
 *                   (emitted by the SF-01 verification store on approval —
 *                   the wizard stays the single writer, the log the single
 *                   reader)
 *   Provisioned   → journey flag, written by /account-provisioning
 *   Credentialed  → journey flag, written by /trading-credentials
 *   First trade   → journey flag, written by the order ticket when an
 *                   order is accepted
 *
 * Flags persist in localStorage (`pfaas:trader:journey`, the same
 * convention as checkout-recovery / verification) so progress survives
 * reloads; the tour card's dismissed preference keeps its own original
 * key (terra.getting-started.v1).
 *
 * Demo note: with no backend the provisioning and credentials screens
 * ARE the delivery surfaces — reaching them is the event a real
 * provisioning webhook / delivery email would send.
 *
 * Subscription follows the getting-started-tour pattern:
 * useSyncExternalStore with a serialized snapshot (a stable string, so
 * no tearing), same-tab notify() plus the cross-tab `storage` event.
 * "Verified" is re-read on every mount — sessionStorage writes happen
 * on /verification, a route where no checklist is mounted.
 */

import { useSyncExternalStore } from "react";
import { readLifecycleLog, useLifecycleLog } from "@pfaas/lifecycle";

export type JourneyStepId =
  | "purchased"
  | "verified"
  | "provisioned"
  | "credentialed"
  | "firstTrade";

/** Steps an owning screen writes; "verified" is derived (SF-01). */
export type WritableJourneyStep = Exclude<JourneyStepId, "verified">;

const STORAGE_KEY = "pfaas:trader:journey";

const EMPTY_FLAGS: Record<WritableJourneyStep, boolean> = {
  purchased: false,
  provisioned: false,
  credentialed: false,
  firstTrade: false,
};

/** Server / hydration render: every step outstanding (matches SSR HTML). */
const SERVER_SNAPSHOT = JSON.stringify({
  ...EMPTY_FLAGS,
  verified: false,
});

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

function readFlags(): Record<WritableJourneyStep, boolean> {
  if (typeof window === "undefined") return EMPTY_FLAGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_FLAGS;
    return {
      ...EMPTY_FLAGS,
      ...(JSON.parse(raw) as Partial<Record<WritableJourneyStep, boolean>>),
    };
  } catch {
    return EMPTY_FLAGS;
  }
}

/** Non-reactive read of the checklist — exported for the stage-check script. */
export function readJourneyDone(): Record<JourneyStepId, boolean> {
  const flags = readFlags();
  // "Verified" comes from the lifecycle log (R2-W3-01/02): the verification
  // store emits `kyc.approved` on the exact write that approves, so the
  // checklist, dashboard card and provisioning page all flip together —
  // no second derivation of the same fact.
  const verified = readLifecycleLog().some(
    (e) => e.entity.kind === "kyc" && e.entity.id === "self" && e.name === "kyc.approved",
  );
  // Fixed key order → JSON.stringify is referentially stable across
  // renders when nothing changed (useSyncExternalStore requirement).
  return {
    purchased: flags.purchased,
    verified,
    provisioned: flags.provisioned,
    credentialed: flags.credentialed,
    firstTrade: flags.firstTrade,
  };
}

function getSnapshot(): string {
  return JSON.stringify(readJourneyDone());
}

function getServerSnapshot(): string {
  return SERVER_SNAPSHOT;
}

/**
 * Record a journey milestone. Idempotent — re-visiting a screen never
 * rewrites or re-notifies.
 */
export function markJourney(step: WritableJourneyStep): void {
  const flags = readFlags();
  if (flags[step]) return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...flags, [step]: true }),
    );
  } catch {
    /* storage unavailable — checklist just won't persist */
  }
  notify();
}

/** Read the full done-map directly (non-reactive callers/tests). */
export function readJourney(): Record<JourneyStepId, boolean> {
  return readJourneyDone();
}

/** Reactive done-map for the checklist surfaces. */
export function useJourneyDone(): Record<JourneyStepId, boolean> {
  // R2-W3-02 — the log is a second source of "verified", so subscribe to it
  // too: a KYC verdict re-renders the checklist without touching storage.
  useLifecycleLog();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as Record<JourneyStepId, boolean>;
}
