"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Jobs store — P0-4: wire fake write-path to store + audit.
 * Run Now / Pause / Retry / Resume persist under pfaas:platform-admin:jobs.
 * Acceptance test: action → reload → state + audit row + toast agree.
 *
 * Stores only the operator's overrides (status + last-run), keyed by job id;
 * the seed job list lives here too (single source of truth — Operations
 * Home derives its failed-jobs signal from the same list the dashboard
 * renders), while durations/next-run stay static seed values.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:jobs";

export interface Job {
  id: string;
  name: string;
  lastRun: string;
  duration: string;
  nextRun: string;
  status: "succeeded" | "running" | "failed" | "paused";
  lockHolder: string;
  failureCount: number;
  lastFailure: string;
}

export interface JobOverride {
  status?: Job["status"];
  lastRun?: string;
  failureCount?: number;
  lastFailure?: string;
}

type OverrideMap = Record<string, JobOverride>;

/**
 * Seed job list — the scheduler's jobs as of boot. Statuses are
 * operator-overridable (Run Now / Pause / Retry / Resume persist via
 * `markJobStatus`); read through `effectiveJobs()` for the merged truth.
 */
export const jobs: Job[] = [
  { id: "metering-rollup", name: "Metering Rollup", lastRun: "5m ago", duration: "2.3s", nextRun: "in 25m", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "reconciliation", name: "Payout Reconciliation", lastRun: "1h ago", duration: "8.7s", nextRun: "in 2h", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "notification-batch", name: "Notification Batch", lastRun: "3m ago", duration: "1.1s", nextRun: "in 2m", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "doc-generation", name: "Document Generation", lastRun: "12m ago", duration: "4.2s", nextRun: "in 18m", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "data-cleanup", name: "Data Cleanup", lastRun: "6h ago", duration: "15.3s", nextRun: "in 18h", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "backup-wal", name: "WAL Backup", lastRun: "18h ago", duration: "42.1s", nextRun: "in 6h", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "provider-health", name: "Provider Health Check", lastRun: "30s ago", duration: "0.8s", nextRun: "in 30s", status: "running", lockHolder: "worker-3", failureCount: 0, lastFailure: "—" },
  { id: "sync-accounts", name: "Account Sync (MT5)", lastRun: "2m ago", duration: "3.5s", nextRun: "in 1m", status: "failed", lockHolder: "—", failureCount: 3, lastFailure: "2m ago" },
  { id: "eval-engine", name: "Evaluation Engine Sweep", lastRun: "8m ago", duration: "5.6s", nextRun: "in 2m", status: "succeeded", lockHolder: "—", failureCount: 0, lastFailure: "—" },
  { id: "audit-archive", name: "Audit Archive", lastRun: "—", duration: "—", nextRun: "in 12h", status: "paused", lockHolder: "—", failureCount: 0, lastFailure: "—" },
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

function writeRaw(next: OverrideMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
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