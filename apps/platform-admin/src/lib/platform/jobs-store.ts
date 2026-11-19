"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Jobs store — P0-4: wire fake write-path to store + audit.
 * Run Now / Pause / Retry / Resume persist under pfaas:platform-admin:jobs.
 * Acceptance test: action → reload → state + audit row + toast agree.
 *
 * Stores only the operator's overrides (status + last-run), keyed by job id;
 * the seed job list stays in the page so durations/next-run stay derived.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:jobs";

export interface JobOverride {
  status?: "succeeded" | "running" | "failed" | "paused";
  lastRun?: string;
  failureCount?: number;
  lastFailure?: string;
}

type OverrideMap = Record<string, JobOverride>;

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