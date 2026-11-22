"use client";

/**
 * R13 P1-1 — Scheduled Reports store.
 *
 * Run Now / pause / resume / download all fired demo toasts over an inline
 * array, and the schedule state reset on reload. Each operation now has a
 * persisted write path plus an audit row, matching the proven pattern used
 * by feature-flags / deployments / incidents.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export type ScheduleCategory = "finance" | "analytics" | "growth";

export interface ReportSchedule {
  id: string;
  name: string;
  category: ScheduleCategory;
  frequency: string;
  recipients: string[];
  format: string;
  lastRun: string;
  nextRun: string;
  status: "active" | "paused";
  lastDelivery: "delivered" | "failed";
}

const STORAGE_KEY = "pfaas:platform-admin:report-schedules";

const SEED: ReportSchedule[] = [
  { id: "sch-001", name: "Weekly Revenue Digest", category: "finance", frequency: "Weekly (Mon 07:00 UTC)", recipients: ["finance@pfaas.com", "ceo@pfaas.com"], format: "PDF + CSV", lastRun: "2026-10-06T07:00:00Z", nextRun: "2026-10-13T07:00:00Z", status: "active", lastDelivery: "delivered" },
  { id: "sch-002", name: "Daily Tenant Usage Meter", category: "analytics", frequency: "Daily 06:00 UTC", recipients: ["ops@pfaas.com"], format: "CSV", lastRun: "2026-10-08T06:00:00Z", nextRun: "2026-10-09T06:00:00Z", status: "active", lastDelivery: "delivered" },
  { id: "sch-003", name: "Monthly Churn & Retention", category: "growth", frequency: "Monthly (1st 08:00)", recipients: ["growth@pfaas.com"], format: "PDF", lastRun: "2026-10-01T08:00:00Z", nextRun: "2026-11-01T08:00:00Z", status: "active", lastDelivery: "delivered" },
  { id: "sch-004", name: "Payout Reconciliation", category: "finance", frequency: "Daily 23:00 UTC", recipients: ["finance@pfaas.com", "treasury@pfaas.com"], format: "CSV", lastRun: "2026-10-07T23:00:00Z", nextRun: "2026-10-08T23:00:00Z", status: "active", lastDelivery: "failed" },
  { id: "sch-005", name: "Quarterly Board Metrics", category: "analytics", frequency: "Quarterly (1st 09:00)", recipients: ["board@pfaas.com"], format: "PDF", lastRun: "2026-07-01T09:00:00Z", nextRun: "2027-01-01T09:00:00Z", status: "active", lastDelivery: "delivered" },
  { id: "sch-006", name: "API Usage Export", category: "analytics", frequency: "Weekly (Fri 18:00)", recipients: ["platform@pfaas.com"], format: "CSV", lastRun: "2026-10-02T18:00:00Z", nextRun: "2026-10-09T18:00:00Z", status: "paused", lastDelivery: "delivered" },
];

function load(): ReportSchedule[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReportSchedule[]) : SEED;
  } catch {
    return SEED;
  }
}

function persist(next: ReportSchedule[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let schedules: ReportSchedule[] = load();

export function listSchedules(): ReportSchedule[] {
  return schedules;
}

function commit(next: ReportSchedule[]) {
  schedules = next;
  persist(schedules);
  emit();
}

/** Run a schedule immediately (persists lastRun + audits). */
export function runSchedule(id: string, actor = "operator"): ReportSchedule | undefined {
  const target = schedules.find((s) => s.id === id);
  if (!target) return undefined;
  const now = new Date().toISOString();
  const next: ReportSchedule = { ...target, lastRun: now, lastDelivery: "delivered" };
  commit(schedules.map((s) => (s.id === id ? next : s)));
  recordAudit({
    actor,
    action: "report.run",
    target: id,
    detail: `Ran "${target.name}" out of schedule — queued for ${target.recipients.length} recipient(s)`,
    severity: "info",
  });
  return next;
}

/** Pause an active schedule (persists + audits). */
export function pauseSchedule(id: string, actor = "operator"): ReportSchedule | undefined {
  const target = schedules.find((s) => s.id === id);
  if (!target || target.status !== "active") return undefined;
  const next: ReportSchedule = { ...target, status: "paused" };
  commit(schedules.map((s) => (s.id === id ? next : s)));
  recordAudit({
    actor,
    action: "report.pause",
    target: id,
    detail: `Paused schedule "${target.name}"`,
    severity: "warning",
  });
  return next;
}

/** Resume a paused schedule (persists + audits). */
export function resumeSchedule(id: string, actor = "operator"): ReportSchedule | undefined {
  const target = schedules.find((s) => s.id === id);
  if (!target || target.status !== "paused") return undefined;
  const next: ReportSchedule = { ...target, status: "active" };
  commit(schedules.map((s) => (s.id === id ? next : s)));
  recordAudit({
    actor,
    action: "report.resume",
    target: id,
    detail: `Resumed schedule "${target.name}"`,
    severity: "info",
  });
  return next;
}

/** Create a new schedule (persists + audits). */
export function createSchedule(
  input: { name: string; category: ScheduleCategory; frequency: string; recipients: string[]; format: string },
  actor = "operator",
): ReportSchedule {
  const now = new Date();
  const schedule: ReportSchedule = {
    id: `sch-${Date.now().toString(36)}`,
    name: input.name,
    category: input.category,
    frequency: input.frequency,
    recipients: input.recipients,
    format: input.format,
    lastRun: now.toISOString(),
    nextRun: new Date(now.getTime() + 86_400_000).toISOString(),
    status: "active",
    lastDelivery: "delivered",
  };
  commit([schedule, ...schedules]);
  recordAudit({
    actor,
    action: "report.create",
    target: schedule.id,
    detail: `Created schedule "${schedule.name}" (${schedule.frequency}) → ${schedule.recipients.join(", ")}`,
    severity: "info",
  });
  return schedule;
}

/** Record a download of the last generated file (persists + audits). */
export function downloadLastRun(id: string, actor = "operator"): ReportSchedule | undefined {
  const target = schedules.find((s) => s.id === id);
  if (!target) return undefined;
  recordAudit({
    actor,
    action: "report.download",
    target: id,
    detail: `Downloaded last generated file for "${target.name}" (${target.format})`,
    severity: "info",
  });
  return target;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to schedule mutations. */
export function useSchedulesVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}
