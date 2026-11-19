"use client";

/**
 * R10-D1 — Portfolio-wide ongoing screening, KYC document expiry
 * monitoring, and event-triggered re-KYC (P0).
 *
 * The screening store only rescanned OPEN AML cases, so a funded trader
 * screened once at onboarding was never screened again, and KYC
 * "expired" was an enum value nothing could transition into. This store:
 *
 *   • schedules portfolio-wide rescreening jobs (frequency-configurable)
 *     with before/after counts in a job log,
 *   • tracks per-trader screening status across the whole book,
 *   • records KYC document expiry dates and raises alerts N days ahead
 *     (drives the "expired" transition + re-KYC requests),
 *   • reacts to `kyc.submitted` / `trader.reactivated` for event-driven
 *     rescreening, plus a 60s timer for the schedule (the lifecycle log
 *     carries no clock events).
 *
 * Exactly-once event application via the `lastProcessedSeq` watermark.
 *
 * Reuses existing patterns:
 * - demo-persistence for zod-validated persistence
 * - screening-store job machinery (job log with counts)
 * - recordAudit for audit trails
 * - emitLifecycle for cross-app communication
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { useLifecycleLog, emitLifecycle, type LifecycleEvent } from "@pfaas/lifecycle";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type KYCDocumentType =
  | "passport"
  | "drivers-license"
  | "national-id"
  | "utility-bill"
  | "bank-statement"
  | "proof-of-address";

export interface KYCDocument {
  id: string;
  traderId: string;
  traderName?: string;
  documentType: KYCDocumentType;
  documentNumber: string;
  issuingCountry: string;
  issueDate: string;
  /** Absent on non-expiring documents (utility bills). */
  expiryDate?: string;
  uploadedAt: string;
  status: "pending" | "approved" | "rejected" | "expired" | "expiring-soon";
  notes?: string;
}

export interface RescreeningJob {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "partial";
  trigger: "scheduled" | "manual" | "event-driven";
  scope: string; // trader id or "portfolio"
  scannedTraders: number;
  newMatches: number;
  clearedMatches: number;
  failedScans: number;
  durationMs: number;
  error?: string;
}

export interface TraderScreeningStatus {
  traderId: string;
  traderName: string;
  lastScreenedAt: string;
  screeningStatus: "clear" | "potential-match" | "confirmed-match" | "not-screened";
  matchDetails: {
    listName: string;
    matchScore: number;
    matchType: "exact" | "fuzzy" | "partial";
    matchedAt: string;
  }[];
  requiresRescreening: boolean;
}

export interface KYCExpiryAlert {
  id: string;
  traderId: string;
  traderName: string;
  documentId: string;
  documentType: KYCDocumentType;
  expiryDate: string;
  daysUntilExpiry: number;
  status: "expiring-soon" | "expired" | "critical";
  acknowledgedAt?: string;
}

export interface ScreeningSchedule {
  enabled: boolean;
  /** Rescan the whole book every N days. */
  frequencyDays: number;
  lastRunAt?: string;
  nextRunAt?: string;
  autoScreenOnKycSubmit: boolean;
  /** KYC expiry warning threshold in days. */
  kycExpiryWarningDays: number;
}

export interface PortfolioScreeningState {
  jobs: RescreeningJob[];
  traderStatuses: Record<string, TraderScreeningStatus>;
  kycDocuments: KYCDocument[];
  expiryAlerts: KYCExpiryAlert[];
  schedule: ScreeningSchedule;
  /** Watermark into the shared lifecycle log (exactly-once processing). */
  lastProcessedSeq: number;
}

/* ------------------------------------------------------------------ */
/* Zod schema for persistence                                          */
/* ------------------------------------------------------------------ */

const kycDocumentSchema = z.object({
  id: z.string(),
  traderId: z.string(),
  traderName: z.string().optional(),
  documentType: z.enum([
    "passport",
    "drivers-license",
    "national-id",
    "utility-bill",
    "bank-statement",
    "proof-of-address",
  ]),
  documentNumber: z.string(),
  issuingCountry: z.string(),
  issueDate: z.string(),
  expiryDate: z.string().optional(),
  uploadedAt: z.string(),
  status: z.enum(["pending", "approved", "rejected", "expired", "expiring-soon"]),
  notes: z.string().optional(),
});

const rescreeningJobSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  status: z.enum(["running", "completed", "failed", "partial"]),
  trigger: z.enum(["scheduled", "manual", "event-driven"]),
  scope: z.string(),
  scannedTraders: z.number(),
  newMatches: z.number(),
  clearedMatches: z.number(),
  failedScans: z.number(),
  durationMs: z.number(),
  error: z.string().optional(),
});

const traderScreeningStatusSchema = z.object({
  traderId: z.string(),
  traderName: z.string(),
  lastScreenedAt: z.string(),
  screeningStatus: z.enum(["clear", "potential-match", "confirmed-match", "not-screened"]),
  matchDetails: z.array(
    z.object({
      listName: z.string(),
      matchScore: z.number().min(0).max(100),
      matchType: z.enum(["exact", "fuzzy", "partial"]),
      matchedAt: z.string(),
    }),
  ),
  requiresRescreening: z.boolean(),
});

const kycExpiryAlertSchema = z.object({
  id: z.string(),
  traderId: z.string(),
  traderName: z.string(),
  documentId: z.string(),
  documentType: z.enum([
    "passport",
    "drivers-license",
    "national-id",
    "utility-bill",
    "bank-statement",
    "proof-of-address",
  ]),
  expiryDate: z.string(),
  daysUntilExpiry: z.number(),
  status: z.enum(["expiring-soon", "expired", "critical"]),
  acknowledgedAt: z.string().optional(),
});

const screeningScheduleSchema = z.object({
  enabled: z.boolean(),
  frequencyDays: z.number().min(1).max(365),
  lastRunAt: z.string().optional(),
  nextRunAt: z.string().optional(),
  autoScreenOnKycSubmit: z.boolean(),
  kycExpiryWarningDays: z.number().min(1).max(90),
});

const portfolioScreeningStateSchema = z.object({
  jobs: z.array(rescreeningJobSchema),
  traderStatuses: z.record(z.string(), traderScreeningStatusSchema),
  kycDocuments: z.array(kycDocumentSchema),
  expiryAlerts: z.array(kycExpiryAlertSchema),
  schedule: screeningScheduleSchema,
  lastProcessedSeq: z.number(),
});

type PortfolioScreeningStateType = z.infer<typeof portfolioScreeningStateSchema>;

/* ------------------------------------------------------------------ */
/* Default state                                                       */
/* ------------------------------------------------------------------ */

const DEFAULT_SCHEDULE: ScreeningSchedule = {
  enabled: true,
  frequencyDays: 30,
  autoScreenOnKycSubmit: true,
  kycExpiryWarningDays: 30,
};

const SLOT = "portfolio-screening";
let state: PortfolioScreeningStateType = loadDemoState(
  SLOT,
  portfolioScreeningStateSchema,
  {
    jobs: [],
    traderStatuses: {},
    kycDocuments: [],
    expiryAlerts: [],
    schedule: DEFAULT_SCHEDULE,
    lastProcessedSeq: 0,
  },
);
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function usePortfolioScreeningVersion(): number {
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

/* ------------------------------------------------------------------ */
/* Schedule management                                                 */
/* ------------------------------------------------------------------ */

export function getScreeningSchedule(): ScreeningSchedule {
  return state.schedule;
}

export function updateScreeningSchedule(
  updates: Partial<ScreeningSchedule>,
  actor: string,
): void {
  state.schedule = { ...state.schedule, ...updates };
  if (updates.frequencyDays) {
    const base = state.schedule.lastRunAt ? new Date(state.schedule.lastRunAt) : new Date();
    state.schedule.nextRunAt = new Date(
      base.getTime() + updates.frequencyDays * 86_400_000,
    ).toISOString();
  }
  notify();

  recordAudit({
    action: "Updated screening schedule",
    entity: "portfolio-screening",
    entityId: "schedule",
    summary: `Screening schedule updated by ${actor}: every ${state.schedule.frequencyDays} days, ${state.schedule.enabled ? "enabled" : "disabled"}, KYC warning ${state.schedule.kycExpiryWarningDays} days`,
    severity: "info",
  });
}

/* ------------------------------------------------------------------ */
/* KYC document management                                             */
/* ------------------------------------------------------------------ */

export function getKYCDocuments(traderId?: string): KYCDocument[] {
  return traderId
    ? state.kycDocuments.filter((d) => d.traderId === traderId)
    : state.kycDocuments;
}

export function addKYCDocument(
  document: Omit<KYCDocument, "id" | "uploadedAt" | "status">,
  actor: string,
): KYCDocument {
  const id = `kyc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newDocument: KYCDocument = {
    id,
    uploadedAt: new Date().toISOString(),
    status: "pending",
    ...document,
  };
  state.kycDocuments = [...state.kycDocuments, newDocument];
  if (newDocument.expiryDate) evaluateExpiry(newDocument);
  notify();

  recordAudit({
    action: "Added KYC document",
    entity: "kyc-document",
    entityId: id,
    summary: `${newDocument.documentType} (${newDocument.documentNumber}, ${newDocument.issuingCountry}) recorded for ${newDocument.traderName ?? newDocument.traderId} by ${actor}`,
    severity: "info",
  });
  return newDocument;
}

export function updateKYCDocumentStatus(
  documentId: string,
  status: KYCDocument["status"],
  opts: { notes?: string; actor?: string } = {},
): void {
  const existing = state.kycDocuments.find((d) => d.id === documentId);
  if (!existing) return;

  state.kycDocuments = state.kycDocuments.map((d) =>
    d.id === documentId ? { ...d, status, notes: opts.notes ?? d.notes } : d,
  );
  notify();

  recordAudit({
    action: "Updated KYC document status",
    entity: "kyc-document",
    entityId: documentId,
    summary: `${existing.documentType} (${existing.documentNumber}) → ${status} by ${opts.actor ?? "system"}`,
    severity: status === "rejected" || status === "expired" ? "warning" : "info",
  });

  // A rejected/expired identity document invalidates the last screening
  // result — put the trader back in the rescreen queue (event-driven).
  if (status === "rejected" || status === "expired") {
    markRequiresRescreening(existing.traderId);
    triggerRescreening(existing.traderId, "event-driven");
  }
}

function evaluateExpiry(document: KYCDocument): void {
  if (!document.expiryDate) return;
  const days = Math.floor(
    (new Date(document.expiryDate).getTime() - Date.now()) / 86_400_000,
  );
  const warning = state.schedule.kycExpiryWarningDays;
  if (days > warning) return;

  const existing = state.expiryAlerts.find(
    (a) => a.documentId === document.id && !a.acknowledgedAt,
  );
  if (existing) return;

  const alert: KYCExpiryAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    traderId: document.traderId,
    traderName: document.traderName ?? document.traderId,
    documentId: document.id,
    documentType: document.documentType,
    expiryDate: document.expiryDate,
    daysUntilExpiry: days,
    status: days <= 0 ? "expired" : days <= 7 ? "critical" : "expiring-soon",
  };
  state.expiryAlerts = [alert, ...state.expiryAlerts];

  // Transition the document into the enum value nothing used to reach.
  if (days <= 0) {
    state.kycDocuments = state.kycDocuments.map((d) =>
      d.id === document.id ? { ...d, status: "expired" as const } : d,
    );
    markRequiresRescreening(document.traderId);
  } else if (document.status !== "expiring-soon") {
    state.kycDocuments = state.kycDocuments.map((d) =>
      d.id === document.id ? { ...d, status: "expiring-soon" as const } : d,
    );
  }
  notify();

  emitLifecycle({
    entity: { kind: "kyc", id: document.id },
    name: "kyc.document-expiring",
    actor: "system",
    key: `kyc-expiry:${document.id}`,
    payload: {
      traderId: document.traderId,
      documentType: document.documentType,
      expiryDate: document.expiryDate,
      daysUntilExpiry: days,
      status: alert.status,
    },
  });

  recordAudit({
    action: days <= 0 ? "KYC document expired" : "KYC document expiring soon",
    entity: "kyc-document",
    entityId: document.id,
    summary: `${document.documentType} for ${alert.traderName} ${days <= 0 ? "has expired" : `expires in ${days} days`} — re-KYC required`,
    severity: days <= 7 ? "critical" : "warning",
  });
}

function markRequiresRescreening(traderId: string): void {
  const existing = state.traderStatuses[traderId];
  if (existing) {
    state.traderStatuses[traderId] = { ...existing, requiresRescreening: true };
  } else {
    state.traderStatuses[traderId] = {
      traderId,
      traderName: traderId,
      lastScreenedAt: new Date(0).toISOString(),
      screeningStatus: "not-screened",
      matchDetails: [],
      requiresRescreening: true,
    };
  }
}

export function getExpiryAlerts(
  filters?: { status?: KYCExpiryAlert["status"]; traderId?: string },
): KYCExpiryAlert[] {
  let alerts = [...state.expiryAlerts];
  if (filters?.status) alerts = alerts.filter((a) => a.status === filters.status);
  if (filters?.traderId) alerts = alerts.filter((a) => a.traderId === filters.traderId);
  return alerts;
}

export function acknowledgeExpiryAlert(alertId: string, actor: string): void {
  const existing = state.expiryAlerts.find((a) => a.id === alertId);
  if (!existing || existing.acknowledgedAt) return;
  state.expiryAlerts = state.expiryAlerts.map((a) =>
    a.id === alertId ? { ...a, acknowledgedAt: new Date().toISOString() } : a,
  );
  notify();
  recordAudit({
    action: "Acknowledged KYC expiry alert",
    entity: "kyc-alert",
    entityId: alertId,
    summary: `Expiry alert for ${existing.traderName} (${existing.documentType}) acknowledged by ${actor}`,
    severity: "info",
  });
}

/* ------------------------------------------------------------------ */
/* Rescreening engine                                                  */
/* ------------------------------------------------------------------ */

export function triggerRescreening(
  scope?: string,
  trigger: RescreeningJob["trigger"] = "manual",
): RescreeningJob {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const job: RescreeningJob = {
    id: jobId,
    startedAt: new Date().toISOString(),
    status: "running",
    trigger,
    scope: scope ?? "portfolio",
    scannedTraders: 0,
    newMatches: 0,
    clearedMatches: 0,
    failedScans: 0,
    durationMs: 0,
  };
  state.jobs = [job, ...state.jobs].slice(0, 200);
  notify();

  // Demo stand-in for the vendor API sweep: complete on the next tick
  // with deterministic counts (a real deployment calls the list vendor
  // here; the job-log shape is what the operator page renders).
  setTimeout(() => completeJob(jobId), 600);
  return job;
}

function completeJob(jobId: string): void {
  const idx = state.jobs.findIndex((j) => j.id === jobId);
  if (idx === -1) return;
  const job = state.jobs[idx];

  const targets = job.scope === "portfolio"
    ? Object.keys(state.traderStatuses)
    : [job.scope];
  const started = new Date(job.startedAt).toISOString();
  const now = new Date().toISOString();

  // Deterministic demo outcome: traders flagged as requiring rescreening
  // come back clear unless their stored status says otherwise.
  let newMatches = 0;
  let cleared = 0;
  for (const traderId of targets) {
    const prev = state.traderStatuses[traderId];
    const hadPending = prev?.requiresRescreening || prev?.screeningStatus === "not-screened";
    const status: TraderScreeningStatus = {
      traderId,
      traderName: prev?.traderName ?? traderId,
      lastScreenedAt: now,
      screeningStatus: prev?.screeningStatus === "confirmed-match" ? "confirmed-match" : "clear",
      matchDetails: prev?.matchDetails ?? [],
      requiresRescreening: false,
    };
    if (status.screeningStatus === "clear" && prev?.screeningStatus === "potential-match") {
      cleared += 1;
    }
    if (hadPending && !prev) newMatches += 0;
    state.traderStatuses[traderId] = status;
  }

  const completed: RescreeningJob = {
    ...job,
    completedAt: now,
    status: "completed",
    scannedTraders: targets.length,
    newMatches,
    clearedMatches: cleared,
    failedScans: 0,
    durationMs: new Date(now).getTime() - new Date(started).getTime(),
  };
  state.jobs[idx] = completed;

  state.schedule.lastRunAt = now;
  state.schedule.nextRunAt = new Date(
    Date.now() + state.schedule.frequencyDays * 86_400_000,
  ).toISOString();
  notify();

  recordAudit({
    action: "Portfolio rescreening completed",
    entity: "portfolio-screening",
    entityId: jobId,
    summary: `Screened ${completed.scannedTraders} trader(s) (${completed.trigger}): ${cleared} match(es) cleared`,
    severity: "info",
  });

  emitLifecycle({
    entity: { kind: "compliance", id: jobId },
    name: "screening.completed",
    actor: "system",
    key: `screening:${jobId}`,
    payload: {
      jobId,
      scope: completed.scope,
      trigger: completed.trigger,
      scannedTraders: completed.scannedTraders,
      newMatches: completed.newMatches,
      clearedMatches: completed.clearedMatches,
    },
  });
}

export function getRescreeningJobs(
  filters?: { status?: RescreeningJob["status"]; trigger?: RescreeningJob["trigger"] },
): RescreeningJob[] {
  let jobs = [...state.jobs];
  if (filters?.status) jobs = jobs.filter((j) => j.status === filters.status);
  if (filters?.trigger) jobs = jobs.filter((j) => j.trigger === filters.trigger);
  return jobs;
}

/* ------------------------------------------------------------------ */
/* Trader screening status                                             */
/* ------------------------------------------------------------------ */

export function getTraderScreeningStatus(traderId: string): TraderScreeningStatus | null {
  return state.traderStatuses[traderId] ?? null;
}

export function getAllTraderScreeningStatuses(): TraderScreeningStatus[] {
  return Object.values(state.traderStatuses);
}

export function upsertTraderScreeningStatus(
  traderId: string,
  updates: Partial<TraderScreeningStatus> & { traderName?: string },
): void {
  const existing = state.traderStatuses[traderId];
  state.traderStatuses[traderId] = existing
    ? { ...existing, ...updates }
    : {
        traderId,
        traderName: updates.traderName ?? traderId,
        lastScreenedAt: new Date(0).toISOString(),
        screeningStatus: "not-screened",
        matchDetails: [],
        requiresRescreening: true,
        ...updates,
      };
  notify();
}

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

function freshEvents(log: LifecycleEvent[]): LifecycleEvent[] {
  const fresh: LifecycleEvent[] = [];
  let max = state.lastProcessedSeq;
  for (const e of log) {
    const seq = Number(String(e.id).split(":")[0]);
    if (!Number.isFinite(seq)) continue;
    if (seq <= state.lastProcessedSeq) continue;
    fresh.push(e);
    if (seq > max) max = seq;
  }
  if (fresh.length) {
    state.lastProcessedSeq = max;
    saveDemoState(SLOT, state);
  }
  return fresh;
}

function traderIdFrom(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null;
  for (const key of ["traderId", "trader_id", "userId", "user_id"]) {
    if (typeof payload[key] === "string" && payload[key]) return payload[key] as string;
  }
  return null;
}

export function usePortfolioScreeningEvaluator(_tenantId: string): void {
  const log = useLifecycleLog();

  // Event-driven: new submissions and reactivations enter the queue.
  useEffect(() => {
    for (const e of freshEvents(log)) {
      if (e.name === "kyc.submitted") {
        const traderId = traderIdFrom(e.payload);
        if (!traderId || !state.schedule.autoScreenOnKycSubmit) continue;
        markRequiresRescreening(traderId);
        notify();
        triggerRescreening(traderId, "event-driven");
      } else if (e.name === "trader.reactivated") {
        const traderId = traderIdFrom(e.payload);
        if (!traderId) continue;
        // Re-KYC on reactivation: the account re-enters the screened book.
        markRequiresRescreening(traderId);
        notify();
        triggerRescreening(traderId, "event-driven");
      }
    }
  }, [log]);

  // Schedule-driven: due portfolio sweep + KYC expiry scan on a 60s tick
  // (the lifecycle log carries no clock events).
  useEffect(() => {
    const tick = () => {
      if (
        state.schedule.enabled &&
        state.schedule.nextRunAt &&
        Date.now() >= new Date(state.schedule.nextRunAt).getTime()
      ) {
        triggerRescreening(undefined, "scheduled");
      }
      for (const doc of state.kycDocuments) {
        if (doc.expiryDate && doc.status !== "rejected") evaluateExpiry(doc);
      }
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

export function getScreeningStats(): {
  totalTraders: number;
  screenedTraders: number;
  clearTraders: number;
  potentialMatches: number;
  confirmedMatches: number;
  notScreened: number;
  kycExpiringSoon: number;
  kycExpired: number;
  openAlerts: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
} {
  const statuses = Object.values(state.traderStatuses);
  return {
    totalTraders: statuses.length,
    screenedTraders: statuses.filter((s) => s.screeningStatus !== "not-screened").length,
    clearTraders: statuses.filter((s) => s.screeningStatus === "clear").length,
    potentialMatches: statuses.filter((s) => s.screeningStatus === "potential-match").length,
    confirmedMatches: statuses.filter((s) => s.screeningStatus === "confirmed-match").length,
    notScreened: statuses.filter((s) => s.screeningStatus === "not-screened").length,
    kycExpiringSoon: state.kycDocuments.filter((d) => d.status === "expiring-soon").length,
    kycExpired: state.kycDocuments.filter((d) => d.status === "expired").length,
    openAlerts: state.expiryAlerts.filter((a) => !a.acknowledgedAt).length,
    totalJobs: state.jobs.length,
    completedJobs: state.jobs.filter((j) => j.status === "completed").length,
    failedJobs: state.jobs.filter((j) => j.status === "failed").length,
  };
}
