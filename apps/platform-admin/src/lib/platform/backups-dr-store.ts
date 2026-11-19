"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Backups & Disaster Recovery store — P0-4: wire fake write-path to store + audit.
 * Verify backup / Start restore drill / Restore PITR persist under
 * pfaas:platform-admin:backups-dr.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:backups-dr";

export interface BackupEvent {
  id: string;
  type: "verify" | "drill" | "restore";
  action: "verify" | "drill_started" | "restore_pitr";
  status: "queued" | "running" | "completed" | "failed";
  target?: string;
  startedAt: string;
  finishedAt?: string;
  detail?: string;
}

export interface BackupState {
  lastVerify?: string;
  lastDrill?: string;
  drillStatus?: string;
  lastRestore?: string;
  events: BackupEvent[];
}

const DEFAULT_STATE: BackupState = {
  lastVerify: undefined,
  lastDrill: undefined,
  drillStatus: undefined,
  lastRestore: undefined,
  events: [],
};

function readRaw(): BackupState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    const parsed = JSON.parse(stored) as Partial<BackupState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeRaw(next: BackupState): void {
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

export function readBackupsDr(): BackupState {
  return readRaw();
}

export function useBackupsDr(): BackupState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(DEFAULT_STATE),
  );
  return useMemo(() => {
    try {
      return JSON.parse(snapshot) as BackupState;
    } catch {
      return DEFAULT_STATE;
    }
  }, [snapshot]);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function verifyBackup(actor: string): { title: string; description: string } {
  const nowIso = new Date().toISOString();
  const event: BackupEvent = {
    id: `bk-${Date.now()}`,
    type: "verify",
    action: "verify",
    status: "completed",
    target: "WAL-2026-10-26-18h",
    startedAt: nowIso,
    finishedAt: nowIso,
    detail: "Integrity check completed — checksums valid.",
  };
  const state = readRaw();
  writeRaw({
    ...state,
    lastVerify: nowIso,
    events: [event, ...state.events],
  });
  recordAudit({
    actor,
    action: "backups.verify",
    target: event.target,
    severity: "info",
    detail: "Backup integrity verified — all checksums passed.",
  });
  return {
    title: "Backup verified",
    description: "Integrity check completed — checksums valid.",
  };
}

export function startDrill(actor: string): { title: string; description: string } {
  const nowIso = new Date().toISOString();
  const event: BackupEvent = {
    id: `drill-${Date.now()}`,
    type: "drill",
    action: "drill_started",
    status: "completed",
    target: "WAL-2026-10-26-18h",
    startedAt: nowIso,
    finishedAt: nowIso,
    detail: "Restore drill completed in isolated environment.",
  };
  const state = readRaw();
  writeRaw({
    ...state,
    lastDrill: nowIso,
    drillStatus: "passed",
    events: [event, ...state.events],
  });
  recordAudit({
    actor,
    action: "backups.drill_started",
    target: "restore drill",
    severity: "warning",
    detail: "Restore drill started in isolated environment — no production impact.",
  });
  return {
    title: "Restore drill started",
    description: "Isolated restore environment provisioned — drill progress will update in restore history.",
  };
}

export function restorePITR(artifactId: string, actor: string): { title: string; description: string } {
  const nowIso = new Date().toISOString();
  const event: BackupEvent = {
    id: `restore-${Date.now()}`,
    type: "restore",
    action: "restore_pitr",
    status: "completed",
    target: artifactId,
    startedAt: nowIso,
    finishedAt: nowIso,
    detail: `Point-in-time restore from ${artifactId} to current state completed.`,
  };
  const state = readRaw();
  writeRaw({
    ...state,
    lastRestore: nowIso,
    events: [event, ...state.events],
  });
  recordAudit({
    actor,
    action: "backups.restore_pitr",
    target: artifactId,
    severity: "warning",
    detail: `Point-in-time restore from ${artifactId} to current state completed — audited.`,
  });
  return {
    title: "Point-in-time restore queued",
    description: `Restoring from ${artifactId} to current state.`,
  };
}