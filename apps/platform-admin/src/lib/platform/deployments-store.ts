"use client";

/**
 * Deployments store — P0-4: wire fake write-path to store + audit.
 * Rollback requires two-operator approval (same pattern as apikey./staff.).
 * Current-version change persists under pfaas:platform-admin:deployments.
 *
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useSyncExternalStore, useMemo } from "react";
import { recordAudit, type ApprovalRequest } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:deployments";

export interface Deployment {
  version: string;
  timestamp: string;
  commit: string;
  digest: string;
  status: "production" | "rollback" | "failed";
  services: number;
  isCurrent?: boolean;
}

const SEED_DEPLOYMENTS: Deployment[] = [
  { version: "v1.8.0", timestamp: "3h ago", commit: "a4f2c9b", digest: "sha256:8e9f…d2c1", status: "production", services: 12, isCurrent: true },
  { version: "v1.7.9", timestamp: "2d ago", commit: "b7e3d1a", digest: "sha256:5c1d…9a3f", status: "production", services: 12 },
  { version: "v1.7.8", timestamp: "5d ago", commit: "c2f8a4e", digest: "sha256:3b7e…1f2c", status: "production", services: 12 },
  { version: "v1.7.7", timestamp: "8d ago", commit: "d9a1c5b", digest: "sha256:7f3a…e8b1", status: "rollback", services: 11 },
  { version: "v1.7.6", timestamp: "12d ago", commit: "e5b2d7c", digest: "sha256:1c9f…4a6e", status: "failed", services: 10 },
];

interface DeploymentsState {
  currentVersion: string;
  /** Version rolled back TO (so we can mark the previous current as "rollback"). */
  lastRollbackTo?: string;
}

const DEFAULT_STATE: DeploymentsState = { currentVersion: "v1.8.0" };

function readRaw(): DeploymentsState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    const parsed = JSON.parse(stored) as Partial<DeploymentsState>;
    if (parsed && typeof parsed.currentVersion === "string") return { ...DEFAULT_STATE, ...parsed };
  } catch {
    /* fall through */
  }
  return DEFAULT_STATE;
}

function writeRaw(next: DeploymentsState): void {
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

export function readDeploymentsState(): DeploymentsState {
  return readRaw();
}

export function useDeploymentsState(): DeploymentsState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(DEFAULT_STATE),
  );
  return useMemo(() => {
    try {
      return JSON.parse(snapshot) as DeploymentsState;
    } catch {
      return DEFAULT_STATE;
    }
  }, [snapshot]);
}

/** Resolve the live deployment list: seed with the persisted current-version pinned. */
export function readDeployments(): Deployment[] {
  const state = readRaw();
  return SEED_DEPLOYMENTS.map((d) =>
    d.version === state.currentVersion
      ? { ...d, isCurrent: true, status: "production" as const }
      : { ...d, isCurrent: false },
  );
}

/** Apply an approved rollback — called exactly once by the approval bridge. */
export function applyPlatformApproval(request: ApprovalRequest): { title: string; description: string } | void {
  const mutation = request.payload as { targetVersion: string; reason: string } | undefined;
  if (!mutation?.targetVersion) return;
  const approver = request.approver?.name ?? "second operator";
  const previous = readRaw().currentVersion;
  writeRaw({ currentVersion: mutation.targetVersion, lastRollbackTo: mutation.targetVersion });
  recordAudit({
    actor: approver,
    action: "platform.rollback_applied",
    target: mutation.targetVersion,
    severity: "warning",
    detail: `Rolled back ${previous} → ${mutation.targetVersion}; initiated by ${request.initiator.name}; reason: ${mutation.reason}`,
  });
  return {
    title: "Rollback applied",
    description: `Production is now ${mutation.targetVersion} — approved by ${approver}.`,
  };
}