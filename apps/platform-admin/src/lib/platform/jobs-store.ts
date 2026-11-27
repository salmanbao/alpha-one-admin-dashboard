"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Jobs store — P0-4: wire fake write-path to store + audit.
 * Run Now / Pause / Retry / Resume persist under pfaas:platform-admin:jobs.
 * Acceptance test: action → reload → state + audit row + toast agree.
 *
 * Stores only the operator's overrides (status, timestamps, lock holder, etc.) keyed by job id;
 * the seed job list lives here too (single source of truth — Operations
 * Home derives its failed-jobs signal from the same list the dashboard
 * renders), while durations/next-run stay static seed values.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:jobs";

export interface Job {
  id: string;
  name: string;
  schedule?: string;
  lastRunAt: number | null;
  durationMs: number | null;
  nextRunAt: number | null;
  status: "succeeded" | "running" | "failed" | "paused";
  lockHolder: string | null;
  failureCount: number;
  lastFailure: string;
  failures: Array<{ at: number; message: string }>;
}

export interface JobOverride {
  status?: Job["status"];
  lastRunAt?: number | null;
  durationMs?: number | null;
  nextRunAt?: number | null;
  lockHolder?: string | null;
  failureCount?: number;
  lastFailure?: string;
}

type OverrideMap = Record<string, JobOverride>;

/**
 * Derive human-readable relative time label from an epoch-ms timestamp.
 * Never stored — computed at render time so labels never go stale.
 */
export function formatRelativeTime(timestamp: number | null, now: number = Date.now()): string {
  if (timestamp === null) return "—";
  const diff = now - timestamp;
  if (diff < 0) return "in future";
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/** Format an epoch-ms duration into a human string like "2.3s" or "15.3s". */
export function formatDurationMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Seed job list — the scheduler's jobs as of boot. Statuses are
 * operator-overridable (Run Now / Pause / Retry / Resume persist via
 * `markJobStatus`); read through `effectiveJobs()` for the merged truth.
 * 
 * All times are stored as epoch ms. Relative labels are derived at render time.
 */
const now = Date.now();
const ms = (val: number) => val * 60 * 1000;
const hs = (val: number) => val * 60 * 60 * 1000;

export const jobs: Job[] = [
  { id: "metering-rollup", name: "Metering Rollup", schedule: "*/5 * * * *", lastRunAt: now - ms(5), durationMs: 2300, nextRunAt: now + ms(25), status: "succeeded", lockHolder: null, failureCount: 0, lastFailure: "—", failures: [] },
  { id: "reconciliation", name: "Payout Reconciliation", schedule: "0 */2 * * *", lastRunAt: now - hs(1), durationMs: 8700, nextRunAt: now + hs(2), status: "succeeded", lockHolder: null, failureCount: 0, lastFailure: "—", failures: [] },
  { id: "notification-batch", name: "Notification Batch", schedule: "*/2 * * * *", lastRunAt: now - ms(3), durationMs: 1100, nextRunAt: now + ms(2), status: "succeeded", lockHolder: null, failureCount: 0, lastFailure: "—", failures: [] },
  { id: "doc-generation", name: "Document Generation", schedule: "*/15 * * * *", lastRunAt: now - ms(12), durationMs: 4200, nextRunAt: now + ms(18), status: "succeeded", lockHolder: null, failureCount: 0, lastFailure: "—", failures: [] },
  { id: "data-cleanup", name: "Data Cleanup", schedule: "0 3 * * *", lastRunAt: now - hs(6), durationMs: 15300, nextRunAt: now + hs(18), status: "succeeded", lockHolder: null, failureCount: 0, lastFailure: "—", failures: [] },
  { id: "backup-wal", name: "WAL Backup", schedule: "0 */6 * * *", lastRunAt: now - hs(18), durationMs: 42100, nextRunAt: now + hs(6), status: "succeeded", lockHolder: null, failureCount: 0, lastFailure: "—", failures: [] },
  { id: "provider-health", name: "Provider Health Check", schedule: "*/30 * * * *", lastRunAt: now - 30000, durationMs: 800, nextRunAt: now + 30000, status: "running", lockHolder: "worker-3", failureCount: 0, lastFailure: "—", failures: [] },
  { id: "sync-accounts", name: "Account Sync (MT5)", schedule: "*/1 * * * *", lastRunAt: now - ms(2), durationMs: 3500, nextRunAt: now + ms(1), status: "failed", lockHolder: null, failureCount: 3, lastFailure: "2m ago", failures: [{ at: now - ms(2), message: "Authentication expired" }, { at: now - ms(4), message: "Connection timeout" }, { at: now - ms(10), message: "Authentication expired" }] },
  { id: "eval-engine", name: "Evaluation Engine Sweep", schedule: "*/2 * * * *", lastRunAt: now - ms(8), durationMs: 5600, nextRunAt: now + ms(2), status: "succeeded", lockHolder: null, failureCount: 0, lastFailure: "—", failures: [] },
  { id: "audit-archive", name: "Audit Archive", schedule: "0 0 * * *", lastRunAt: null, durationMs: null, nextRunAt: now + hs(12), status: "paused", lockHolder: null, failureCount: 0, lastFailure: "—", failures: [] },
];

/** Seed merged with persisted operator overrides — the effective job list. */
export function effectiveJobs(overrides: OverrideMap): Job[] {
  return jobs.map((j) => ({ ...j, ...(overrides[j.id] ?? {}) }));
}

function readRaw(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === "object") return parsed as OverrideMap;
  } catch {
    /* fall through */
  }
  return {};
}

function writeRaw(next: OverrideMap): boolean {
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    /* ignore quota */
    return false;
  } finally {
    notify();
  }
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

export function readJobOverrides(): OverrideMap {
  return readRaw();
}

export function useJobOverrides(): OverrideMap {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify({}),
  );
  return useMemo(() => {
    try {
      return JSON.parse(snapshot) as OverrideMap;
    } catch {
      return {};
    }
  }, [snapshot]);
}

/** Apply a job status transition + append an audit row. */
export function markJobStatus(
  jobId: string,
  jobName: string,
  override: JobOverride,
  audit: { action: string; detail: string; severity: "info" | "warning" | "critical" },
  actor: string,
): void {
  writeRaw({ ...readRaw(), [jobId]: { ...(readRaw()[jobId] ?? {}), ...override } });
  recordAudit({
    actor,
    action: audit.action,
    target: jobId,
    severity: audit.severity,
    detail: `${jobName} — ${audit.detail}`,
  });
}