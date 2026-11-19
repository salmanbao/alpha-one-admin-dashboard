"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Backup Policies store — P0-4: wire fake write-path to store + audit.
 * Policy edits / Create Policy / Pause / Resume persist under pfaas:platform-admin:backup-policies.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:backup-policies";

export interface BackupPolicy {
  id: string;
  name: string;
  scope: string;
  frequency: string;
  retentionDays: number;
  keepVersions: number;
  encryption: string;
  crossRegion: boolean;
  lastRun: string;
  nextRun: string;
  status: "active" | "paused" | "failed" | "danger";
  sizeGB: number;
}

const SEED_POLICIES: BackupPolicy[] = [
  {
    id: "pol-001",
    name: "Core Platform DB",
    scope: "Platform",
    frequency: "Every 6 hours",
    retentionDays: 30,
    keepVersions: 12,
    encryption: "AES-256",
    crossRegion: true,
    lastRun: "2026-10-08T12:00:00Z",
    nextRun: "2026-10-08T18:00:00Z",
    status: "active",
    sizeGB: 412,
  },
  {
    id: "pol-002",
    name: "Tenant Data Snapshots",
    scope: "Platform",
    frequency: "Daily 02:00 UTC",
    retentionDays: 90,
    keepVersions: 30,
    encryption: "AES-256",
    crossRegion: true,
    lastRun: "2026-10-08T02:00:00Z",
    nextRun: "2026-10-09T02:00:00Z",
    status: "active",
    sizeGB: 1280,
  },
  {
    id: "pol-003",
    name: "Audit Log Archive",
    scope: "Platform",
    frequency: "Weekly (Sun 01:00)",
    retentionDays: 365,
    keepVersions: 52,
    encryption: "AES-256",
    crossRegion: false,
    lastRun: "2026-10-05T01:00:00Z",
    nextRun: "2026-10-12T01:00:00Z",
    status: "active",
    sizeGB: 96,
  },
  {
    id: "pol-004",
    name: "Alpha Capital — Override",
    scope: "Tenant: Alpha Capital",
    frequency: "Every 1 hour",
    retentionDays: 14,
    keepVersions: 24,
    encryption: "AES-256",
    crossRegion: true,
    lastRun: "2026-10-08T14:00:00Z",
    nextRun: "2026-10-08T15:00:00Z",
    status: "active",
    sizeGB: 210,
  },
  {
    id: "pol-005",
    name: "Beta Trading — Override",
    scope: "Tenant: Beta Trading",
    frequency: "Daily 04:00 UTC",
    retentionDays: 30,
    keepVersions: 14,
    encryption: "AES-256",
    crossRegion: false,
    lastRun: "2026-10-08T04:00:00Z",
    nextRun: "2026-10-09T04:00:00Z",
    status: "paused",
    sizeGB: 145,
  },
  {
    id: "pol-006",
    name: "Model Weights Archive",
    scope: "Platform",
    frequency: "Monthly (1st 03:00)",
    retentionDays: 730,
    keepVersions: 24,
    encryption: "AES-256",
    crossRegion: true,
    lastRun: "2026-10-01T03:00:00Z",
    nextRun: "2026-11-01T03:00:00Z",
    status: "active",
    sizeGB: 860,
  },
];

function readRaw(): BackupPolicy[] {
  if (typeof window === "undefined") return SEED_POLICIES;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return SEED_POLICIES;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed.map((p: any) => ({ ...p, lastRun: new Date(p.lastRun).toISOString(), nextRun: new Date(p.nextRun).toISOString() }));
  } catch {
    /* fall through */
  }
  return SEED_POLICIES.map((p) => ({ ...p, lastRun: new Date(p.lastRun).toISOString(), nextRun: new Date(p.nextRun).toISOString() }));
}

function writeRaw(next: BackupPolicy[]): void {
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

export function readBackupPolicies(): BackupPolicy[] {
  return readRaw().map((p: any) => ({ ...p, lastRun: new Date(p.lastRun).toISOString(), nextRun: new Date(p.nextRun).toISOString() }));
}

export function useBackupPolicies(): BackupPolicy[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(SEED_POLICIES.map((p) => ({ ...p, lastRun: new Date(p.lastRun).toISOString(), nextRun: new Date(p.nextRun).toISOString() }))),
  );
  return useMemo(() => {
    try {
      return (JSON.parse(snapshot) as BackupPolicy[]).map((p) => ({ ...p, lastRun: new Date(p.lastRun).toISOString(), nextRun: new Date(p.nextRun).toISOString() }));
    } catch {
      return SEED_POLICIES.map((p) => ({ ...p, lastRun: new Date(p.lastRun).toISOString(), nextRun: new Date(p.nextRun).toISOString() }));
    }
  }, [snapshot]);
}

// Mutations
export function savePolicy(policy: BackupPolicy): void {
  const policies = readRaw();
  const idx = policies.findIndex((p) => p.id === policy.id);
  if (idx >= 0) {
    const updated = { ...policy, lastRun: new Date().toISOString(), nextRun: new Date().toISOString() };
    writeRaw([...policies.slice(0, idx), updated, ...policies.slice(idx + 1)]);
    recordAudit({
      actor: "Console operator",
      action: "backup.policy_saved",
      target: policy.id,
      severity: "info",
      detail: `${policy.name}: every ${policy.frequency}, keep ${policy.retentionDays} days / ${policy.keepVersions} versions.`,
    });
  } else {
    const newPolicy: BackupPolicy = {
      ...policy,
      lastRun: new Date().toISOString(),
      nextRun: new Date().toISOString(),
    };
    writeRaw([newPolicy, ...policies]);
    recordAudit({
      actor: "Console operator",
      action: "backup.policy_created",
      target: policy.id,
      severity: "warning",
      detail: `${policy.name}: ${policy.frequency} ${policy.retentionDays}d ${policy.keepVersions}v, ${policy.scope}`,
    });
  }
}

export function pausePolicy(policyId: string): void {
  const policies = readRaw();
  const idx = policies.findIndex((p) => p.id === policyId);
  if (idx >= 0) {
    const policy = policies[idx];
    const updated: BackupPolicy = { ...policies[idx], status: "paused" };
    writeRaw([...policies.slice(0, idx), updated, ...policies.slice(idx + 1)]);
    recordAudit({
      actor: "Console operator",
      action: "backup.policy_paused",
      target: policyId,
      severity: "warning",
      detail: `${policy.name} paused.`,
    });
  }
}