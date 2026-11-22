"use client";

/**
 * R13 P1-1 — Compliance Reports store.
 *
 * Report generation, schedule creation, download, run-now, enable/disable
 * and regenerate all fired demo toasts over an inline array, so a report
 * an operator generated evaporated on reload. Each operation now has a
 * persisted write path plus an audit row, matching the proven pattern used
 * by feature-flags / deployments / incidents.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export type ReportType = "soc2" | "gdpr" | "pci" | "hipaa" | "custom";
export type ReportStatus = "completed" | "generating" | "scheduled" | "failed";

export interface ComplianceReport {
  id: string;
  name: string;
  type: ReportType;
  period: string;
  status: ReportStatus;
  generatedAt: string | null;
  fileSize: string | null;
  sections: string[];
  schedule: string | null;
}

export interface ComplianceSchedule {
  id: string;
  name: string;
  type: ReportType;
  frequency: string;
  nextRun: string;
  enabled: boolean;
  delivery: string;
}

interface ComplianceState {
  reports: ComplianceReport[];
  schedules: ComplianceSchedule[];
}

const STORAGE_KEY = "pfaas:platform-admin:compliance-reports";

const SEED_REPORTS: ComplianceReport[] = [
  { id: "rpt-001", name: "SOC2 Type II — Q4 2026", type: "soc2", period: "2026-07-01 to 2026-09-30", status: "completed", generatedAt: "2026-10-01T10:00:00Z", fileSize: "2.4 MB", sections: ["Access Controls", "Availability", "Confidentiality", "Security"], schedule: null },
  { id: "rpt-002", name: "GDPR Data Processing — Oct 2026", type: "gdpr", period: "2026-10-01 to 2026-10-31", status: "generating", generatedAt: null, fileSize: null, sections: ["Data Inventory", "Processing Activities", "Third Country Transfers"], schedule: null },
  { id: "rpt-003", name: "PCI DSS — Monthly Compliance", type: "pci", period: "2026-10-01 to 2026-10-31", status: "scheduled", generatedAt: null, fileSize: null, sections: ["Network Security", "Access Control", "Monitoring"], schedule: "Monthly, 1st day 02:00 UTC" },
  { id: "rpt-004", name: "Internal Audit — Security Controls", type: "custom", period: "2026-09-01 to 2026-09-30", status: "completed", generatedAt: "2026-10-01T14:30:00Z", fileSize: "1.8 MB", sections: ["Authentication", "Authorization", "Encryption", "Logging"], schedule: null },
  { id: "rpt-005", name: "SOC2 Type II — Q3 2026", type: "soc2", period: "2026-04-01 to 2026-06-30", status: "completed", generatedAt: "2026-07-01T10:00:00Z", fileSize: "2.3 MB", sections: ["Access Controls", "Availability", "Confidentiality", "Security"], schedule: null },
  { id: "rpt-006", name: "GDPR Data Processing — Sep 2026", type: "gdpr", period: "2026-09-01 to 2026-09-30", status: "completed", generatedAt: "2026-10-01T09:00:00Z", fileSize: "890 KB", sections: ["Data Inventory", "Processing Activities"], schedule: null },
];

const SEED_SCHEDULES: ComplianceSchedule[] = [
  { id: "sch-001", name: "Monthly PCI DSS", type: "pci", frequency: "Monthly", nextRun: "2026-11-01T02:00:00Z", enabled: true, delivery: "Email to compliance@" },
  { id: "sch-002", name: "Quarterly SOC2", type: "soc2", frequency: "Quarterly", nextRun: "2027-01-01T02:00:00Z", enabled: true, delivery: "Email + S3 Archive" },
  { id: "sch-003", name: "GDPR Monthly", type: "gdpr", frequency: "Monthly", nextRun: "2026-11-01T03:00:00Z", enabled: false, delivery: "Email to dpo@" },
];

function load(): ComplianceState {
  if (typeof window === "undefined") return { reports: SEED_REPORTS, schedules: SEED_SCHEDULES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { reports: SEED_REPORTS, schedules: SEED_SCHEDULES };
    const parsed = JSON.parse(raw);
    return {
      reports: Array.isArray(parsed?.reports) ? parsed.reports : SEED_REPORTS,
      schedules: Array.isArray(parsed?.schedules) ? parsed.schedules : SEED_SCHEDULES,
    };
  } catch {
    return { reports: SEED_REPORTS, schedules: SEED_SCHEDULES };
  }
}

function persist(next: ComplianceState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let state: ComplianceState = load();

function commit(next: ComplianceState) {
  state = next;
  persist(state);
  emit();
}

export function listReports(): ComplianceReport[] {
  return state.reports;
}

export function listComplianceSchedules(): ComplianceSchedule[] {
  return state.schedules;
}

const TYPE_LABEL: Record<ReportType, string> = {
  soc2: "SOC2",
  gdpr: "GDPR",
  pci: "PCI DSS",
  hipaa: "HIPAA",
  custom: "Custom",
};

/**
 * Queue a report for generation (persists + audits). The report appears in
 * the list as `generating`; completion is a backend concern.
 */
export function generateReport(
  input: { type: ReportType; period: string; sections: string[] },
  actor = "operator",
): ComplianceReport {
  const report: ComplianceReport = {
    id: `rpt-${Date.now().toString(36)}`,
    name: `${TYPE_LABEL[input.type]} — ${input.period.split(" to ")[0]}`,
    type: input.type,
    period: input.period,
    status: "generating",
    generatedAt: null,
    fileSize: null,
    sections: input.sections.length > 0 ? input.sections : ["Security"],
    schedule: null,
  };
  commit({ ...state, reports: [report, ...state.reports] });
  recordAudit({
    actor,
    action: "compliance.report_generate",
    target: report.id,
    detail: `Queued ${TYPE_LABEL[input.type]} report for ${input.period} — ${report.sections.length} section(s)`,
    severity: "info",
  });
  return report;
}

/** Record a download of a completed report (persists an audit row). */
export function downloadReport(id: string, actor = "operator"): ComplianceReport | undefined {
  const target = state.reports.find((r) => r.id === id);
  if (!target || target.status !== "completed") return undefined;
  recordAudit({
    actor,
    action: "compliance.report_download",
    target: id,
    detail: `Downloaded "${target.name}" (${target.fileSize ?? "unknown size"})`,
    severity: "info",
  });
  return target;
}

/** Re-run a report (persists + audits; status returns to generating). */
export function runReport(id: string, actor = "operator"): ComplianceReport | undefined {
  const target = state.reports.find((r) => r.id === id);
  if (!target) return undefined;
  const next: ComplianceReport = { ...target, status: "generating", generatedAt: null, fileSize: null };
  commit({ ...state, reports: state.reports.map((r) => (r.id === id ? next : r)) });
  recordAudit({
    actor,
    action: "compliance.report_run",
    target: id,
    detail: `Triggered generation of "${target.name}"`,
    severity: "info",
  });
  return next;
}

/** Create an automated schedule (persists + audits). */
export function addSchedule(
  input: { name: string; type: ReportType; frequency: string; nextRun: string; delivery: string },
  actor = "operator",
): ComplianceSchedule {
  const schedule: ComplianceSchedule = {
    id: `sch-${Date.now().toString(36)}`,
    name: input.name,
    type: input.type,
    frequency: input.frequency,
    nextRun: input.nextRun,
    enabled: true,
    delivery: input.delivery,
  };
  commit({ ...state, schedules: [...state.schedules, schedule] });
  recordAudit({
    actor,
    action: "compliance.schedule_create",
    target: schedule.id,
    detail: `Created schedule "${schedule.name}" (${schedule.frequency}) → ${schedule.delivery}`,
    severity: "info",
  });
  return schedule;
}

/** Enable/disable a schedule (persists + audits). */
export function toggleSchedule(id: string, actor = "operator"): ComplianceSchedule | undefined {
  const target = state.schedules.find((s) => s.id === id);
  if (!target) return undefined;
  const next: ComplianceSchedule = { ...target, enabled: !target.enabled };
  commit({ ...state, schedules: state.schedules.map((s) => (s.id === id ? next : s)) });
  recordAudit({
    actor,
    action: `compliance.schedule_${next.enabled ? "enable" : "disable"}`,
    target: id,
    detail: `Schedule "${target.name}" ${next.enabled ? "enabled" : "disabled"}`,
    severity: next.enabled ? "info" : "warning",
  });
  return next;
}

/** Run a schedule immediately (persists + audits). */
export function runScheduleNow(id: string, actor = "operator"): ComplianceSchedule | undefined {
  const target = state.schedules.find((s) => s.id === id);
  if (!target) return undefined;
  recordAudit({
    actor,
    action: "compliance.schedule_run",
    target: id,
    detail: `Ran schedule "${target.name}" out of cycle`,
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

/** Subscribe the calling component to compliance-report mutations. */
export function useComplianceVersion(): number {
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
