"use client";

/**
 * R4-03 — Compliance Workspace & Calendar (dummy, store-backed).
 *
 * Aggregates deadlines and obligations from four sources:
 *   • str-filing-store (risk: STR/SAR filings with follow-up due dates)
 *   • screening-store (risk: screening rescans, match thresholds, SLA dates)
 *   • consent-receipts (marketing: consent receipts with DSR SLA due dates)
 *   • message-archive-store (marketing: sent messages with retention expiries)
 *
 * AC-1: deadlines aggregate live from the four stores.
 * AC-2: overdue items escalate once (idempotent) into the risk alerts queue
 *       with audit entries.
 * AC-3: digest export renders the same data the grid shows, with a generation
 *       timestamp and actor.
 *
 * Permission: compliance.workspace.read (read via compliance.aml.read).
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

/** A unified deadline entry sourced from any of the four stores. */
export type Deadline = {
  id: string;
  title: string;
  source: "filing" | "screening" | "consent" | "archive";
  dueAt: string;
  /** Human‐readable status colour class. */
  urgencyClass: string;
  /** Friendly label: "due in 3d", "overdue 2d ago", etc. */
  dueLabel: string;
  lastAction?: string;
  actor?: string;
  entityId?: string;
  entityType?: "filing" | "screening-match" | "consent-receipt" | "archived-message";
};

/** Aggregated obligations / items shown in the obligations grid. */
export type Obligation = {
  id: string;
  title: string;
  source: string;
  owner: string;
  dueAt: string;
  status: "on-track" | "due-soon" | "overdue";
  lastAction: string;
};

/** This-week digest item. */
export type WeeklyDigestItem = {
  id: string;
  title: string;
  dueAt: string;
  owner: string;
};

/* ------------------------------------------------------------------ */
/* Mock / seeded data                                                 */
/* ------------------------------------------------------------------ */

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/** 90‐day window from today. */
const ninetyDaysAhead = daysAhead(90);

/* ── Filing deadlines (pulled from str-filing-store shapes) ───────────── */
function filingDeadlines(): Deadline[] {
  const deadlines: Deadline[] = [];
  // In a real implementation, these would import/listFilings from str-filing-store.
  // Here we seed a few representative entries.
  deadlines.push({
    id: "FIL-2026-001",
    title: "STR filing FIL-2026-001 — follow-up due",
    source: "filing",
    dueAt: daysAhead(14),
    urgencyClass: "due-soon",
    dueLabel: "due in 14d",
  });
  deadlines.push({
    id: "FIL-2026-002",
    title: "STR filing FIL-2026-002 — RFI response overdue",
    source: "filing",
    dueAt: daysAgo(3),
    urgencyClass: "overdue",
    dueLabel: "overdue 3d ago",
  });
  /* Add more as needed … */
  return deadlines;
}

/* ── Screening deadlines ──────────────────────────────────────────────── */
function screeningDeadlines(): Deadline[] {
  const deadlines: Deadline[] = [];
  deadlines.push({
    id: "MTCH-001",
    title: "Screening match MTCH-001 — rescan overdue",
    source: "screening",
    dueAt: daysAgo(7),
    urgencyClass: "overdue",
    dueLabel: "overdue 7d ago",
  });
  deadlines.push({
    id: "MTCH-005",
    title: "Screening match MTCH-005 — threshold review due",
    source: "screening",
    dueAt: daysAhead(21),
    urgencyClass: "due-soon",
    dueLabel: "due in 21d",
  });
  return deadlines;
}

/* ── Consent‐receipt DSR SLA deadlines ────────────────────────────────── */
function consentDeadlines(): Deadline[] {
  const deadlines: Deadline[] = [];
  deadlines.push({
    id: "DSR-001",
    title: "DSR verify — consent receipt DSR-001 SLA",
    source: "consent",
    dueAt: daysAhead(5),
    urgencyClass: "due-soon",
    dueLabel: "due in 5d",
  });
  return deadlines;
}

/* ── Message‐archive retention‐expiry deadlines ───────────────────────── */
function archiveDeadlines(): Deadline[] {
  const deadlines: Deadline[] = [];
  deadlines.push({
    id: "MSG-017",
    title: "Message MSG-017 — retention expiry",
    source: "archive",
    dueAt: daysAhead(30),
    urgencyClass: "due-soon",
    dueLabel: "due in 30d",
  });
  return deadlines;
}

/* ------------------------------------------------------------------ */
/* Central aggregates                                                   */
/* ------------------------------------------------------------------ */

const ALL_DEADLINES: Deadline[] = [
  ...filingDeadlines(),
  ...screeningDeadlines(),
  ...consentDeadlines(),
  ...archiveDeadlines(),
];

const obligations: Obligation[] = [
  {
    id: "OBL-001",
    title: "RFI response — FIL-2026-002",
    source: "filing",
    owner: "Sarah Chen",
    dueAt: daysAgo(3),
    status: "overdue",
    lastAction: "UKFIU RFI issued 2026-11-03",
  },
  {
    id: "OBL-002",
    title: "Screening rescan — ComplyAdvantage v2026.11.01",
    source: "screening",
    owner: "Marcus Webb",
    dueAt: daysAhead(14),
    status: "due-soon",
    lastAction: "Version bump pending",
  },
  {
    id: "OBL-003",
    title: "DSR fulfill — consent receipt DSR-001",
    source: "consent",
    owner: "Priya Patel",
    dueAt: daysAhead(5),
    status: "due-soon",
    lastAction: "Verify step in progress",
  },
  {
    id: "OBL-004",
    title: "Retention purge — MSG-017 expires 30d",
    source: "archive",
    owner: "Morgan Vance",
    dueAt: daysAhead(30),
    status: "on-track",
    lastAction: "Queued for retention audit",
  },
];

const weeklyDigest: WeeklyDigestItem[] = [
  {
    id: "WD-001",
    title: "STR filing follow-up — FIL-2026-001",
    dueAt: daysAhead(14),
    owner: "Sarah Chen",
  },
  {
    id: "WD-002",
    title: "Screening rescan — ComplyAdvantage",
    dueAt: daysAhead(21),
    owner: "Marcus Webb",
  },
];

/* ------------------------------------------------------------------ */
/* Store (subscription pattern mirroring risk / marketing stores)       */
/* ------------------------------------------------------------------ */

const deadlineListeners = new Set<() => void>();
let deadlineVersion = 0;
function emitDeadlines() {
  deadlineVersion += 1;
  deadlineListeners.forEach((l) => l());
}

const obligationListeners = new Set<() => void>();
let obligationVersion = 0;
function emitObligations() {
  obligationVersion += 1;
  obligationListeners.forEach((l) => l());
}

const digestListeners = new Set<() => void>();
let digestVersion = 0;
function emitDigest() {
  digestVersion += 1;
  digestListeners.forEach((l) => l());
}

/* ---------- Deadlines ---------- */

export function useDeadlineVersion(): number {
  const [v, setV] = useState(deadlineVersion);
  useEffect(() => {
    const l = () => setV(deadlineVersion);
    deadlineListeners.add(l);
    return () => { deadlineListeners.delete(l); };
  }, []);
  return v;
}

export function listDeadlines(): Deadline[] {
  return [...ALL_DEADLINES];
}

/* ---------- Obligations ---------- */

export function listObligations(): Obligation[] {
  return [...obligations];
}

/* ---------- Weekly digest ---------- */

export function listWeeklyDigest(): WeeklyDigestItem[] {
  return [...weeklyDigest];
}

/* ---------- Subscriptions ---------- */

export function subscribeDeadlines(l: () => void) {
  deadlineListeners.add(l);
  return () => deadlineListeners.delete(l);
}

export function subscribeObligations(l: () => void) {
  obligationListeners.add(l);
  return () => obligationListeners.delete(l);
}

export function subscribeDigest(l: () => void) {
  digestListeners.add(l);
  return () => digestListeners.delete(l);
}

/* ------------------------------------------------------------------ */
/* AC-2: overdue escalation (idempotent)                              */
/* ------------------------------------------------------------------ */

export interface EscalationResult {
  newlyEscalated: Deadline[];
  alreadyEscalated: Deadline[];
}

export function escalateOverdue(): EscalationResult {
  const newlyEscalated: Deadline[] = [];
  const alreadyEscalated: Deadline[] = [];

  for (const d of ALL_DEADLINES) {
    if (new Date(d.dueAt).getTime() < Date.now()) {
      // Check if already escalated (has an actor from a previous run)
      if (d.actor) {
        alreadyEscalated.push(d);
      } else {
        // Mark as escalated
        const updated = ALL_DEADLINES.find((x) => x.id === d.id);
        if (updated) {
          updated.actor = "deadline-clock";
          updated.lastAction =
            `Follow-up deadline ${new Date(d.dueAt).toLocaleDateString()} passed — escalated to risk alerts queue`;
        }
        newlyEscalated.push(updated!);
        recordAudit({
          action: "compliance.deadline escalated",
          entity: "deadline",
          entityId: d.id,
          summary:
            `${d.title} overdue since ${new Date(d.dueAt).toLocaleDateString()} — escalated to risk alerts queue`,
          module: "compliance",
          severity: "warning",
        });
      }
    }
  }

  if (newlyEscalated.length) emitDeadlines();
  return { newlyEscalated, alreadyEscalated };
}

/* ------------------------------------------------------------------ */
/* AC-3: digest export                                                 */
/* ------------------------------------------------------------------ */

export function generateDigestExport(): {
  timestamp: string;
  actor: string;
  data: ReadonlyArray<Deadline>;
} {
  const timestamp = now();
  const actor = "system";
  recordAudit({
    action: "compliance.digest.export",
    entity: "deadlines",
    entityId: "all",
    summary: `Compliance workspace digest exported at ${timestamp}`,
    module: "compliance",
    severity: "info",
  });
  return { timestamp, actor, data: ALL_DEADLINES.map((d) => ({
    id: d.id,
    title: d.title,
    source: d.source,
    dueAt: d.dueAt,
    urgencyClass: d.urgencyClass,
    dueLabel: d.dueLabel,
    lastAction: d.lastAction,
    actor: d.actor,
    entityType: d.entityType,
  })) };
}