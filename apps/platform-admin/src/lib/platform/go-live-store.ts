"use client";

/**
 * Go-live wizard progress (R2-W3-04).
 *
 * Which firm is being stood up, how far the operator got and which
 * steps are complete. Persisted to localStorage (try/catch JSON) so
 * leaving the page — or the browser — and coming back resumes at the
 * right step, per the milestone acceptance.
 *
 * This store tracks PROGRESS only; each step's payload is written to the
 * store it claims (tenants → tenant-store, plan → updateTenant, KYC →
 * integrations/tenant, connectors → integrations-store, risk →
 * risk-defaults-store). The review step reads those stores back — no
 * second copy of the facts lives here.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pfaas:platform-admin:go-live";

export const GO_LIVE_STEPS = [
  "tenant",
  "plan",
  "kyc",
  "connectors",
  "risk",
  "review",
] as const;

export type GoLiveStep = (typeof GO_LIVE_STEPS)[number];

export interface GoLiveProgress {
  /** Tenant created (or picked) for this run — null until step 1 lands. */
  tenantId: string | null;
  /** Index into GO_LIVE_STEPS the operator should resume on. */
  step: number;
  /** Step ids written to their target store. */
  completed: string[];
  /** Final review done — the firm is live. */
  done: boolean;
  updatedAt: string;
}

const DEFAULT_PROGRESS: GoLiveProgress = {
  tenantId: null,
  step: 0,
  completed: [],
  done: false,
  updatedAt: "",
};

function readRaw(): GoLiveProgress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_PROGRESS;
    const p = parsed as Partial<GoLiveProgress>;
    return {
      tenantId: typeof p.tenantId === "string" ? p.tenantId : null,
      step:
        typeof p.step === "number" &&
        p.step >= 0 &&
        p.step < GO_LIVE_STEPS.length
          ? p.step
          : 0,
      completed: Array.isArray(p.completed) ? p.completed.filter((x) => typeof x === "string") : [],
      done: Boolean(p.done),
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : "",
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function writeRaw(next: GoLiveProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...next, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* best-effort persistence */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot(): string {
  return JSON.stringify(readRaw());
}
function getServerSnapshot(): string {
  return JSON.stringify(DEFAULT_PROGRESS);
}

export function readGoLive(): GoLiveProgress {
  return readRaw();
}

export function patchGoLive(patch: Partial<GoLiveProgress>): void {
  writeRaw({ ...readRaw(), ...patch });
}

/** Mark a step complete (idempotent) and park the cursor on `nextStep`. */
export function completeStep(id: GoLiveStep, nextStep: number): void {
  const cur = readRaw();
  const completed = cur.completed.includes(id)
    ? cur.completed
    : [...cur.completed, id];
  writeRaw({ ...cur, completed, step: nextStep });
}

/** Back to step 0 with no tenant picked — target stores are untouched. */
export function resetGoLive(): void {
  writeRaw({ ...DEFAULT_PROGRESS, updatedAt: new Date().toISOString() });
}

export function useGoLive(): GoLiveProgress {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as GoLiveProgress;
}
