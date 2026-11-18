"use client";

/**
 * Appeals queue — R9 W1 Part B5/B6 (UC-O1 operator verdicts, UC-O9
 * support escalation).
 *
 * The trader files an outage claim (trader `lib/appeals/claims-store`,
 * event `appeal.claim-submitted`); this module is the operator's named
 * consumer of that event — it projects claims into Appeal rows for the
 * `appeals-queue` view and closes the loop:
 *
 *   escalateTicketToAppeal()  support ticket → breach-dispute appeal
 *     (ticket subject/body as initial notes; optional link to an open
 *     hard-breach alert carries rule + threshold + observed into the
 *     evidence packet). Audits BOTH sides (support-ticket row + appeal
 *     row) and emits `appeal.claim-submitted`.
 *
 *   decideAppeal()            accept/reject — persists the decided row
 *     (evidence snapshot frozen at decision time, R10), `recordAudit`s,
 *     emits `appeal.accepted` / `appeal.rejected`. Accepting also
 *     reverses the linked breach (or the account's open hard-breach):
 *     `reverseBreach()` in risk-rules-store clears the alert + risk case
 *     and emits `breach.reversed`.
 *
 * Read model: `projectAppeals(log)` merges
 *   1. `appeal.claim-submitted` events   → base rows (status "open")
 *   2. `appeal.accepted`/`rejected` events → verdict overlay
 *   3. persisted rows (decided + escalated) → win (evidence snapshot)
 * so the queue and the trader's claim list — which reads the same log —
 * can never disagree. Persisted under `pfaas:demo:appeals` (R10).
 *
 * Named consumers of every emitted event (rule 7):
 *   appeal.claim-submitted → this projection (queue rows) + trader inbox
 *                            bridge (escalation notice / own-claim receipt)
 *   appeal.accepted/rejected → this projection + trader inbox bridge
 *                            (verdict receipt with the reason)
 *   breach.reversed        → trader inbox bridge + risk alert detail
 */

import { useEffect, useMemo } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import {
  emitLifecycle,
  readLifecycleLog,
  useLifecycleLog,
  type LifecycleEvent,
} from "@pfaas/lifecycle";
import { getRiskAlerts, reverseBreach, type RiskAlert } from "@/lib/risk-rules-store";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type AppealKind = "outage-claim" | "breach-dispute";
export type AppealStatus = "open" | "under-review" | "accepted" | "rejected";
export type AppealVerdict = "accepted" | "rejected";

export interface AppealEvidence {
  ruleId?: string;
  threshold?: number;
  observed?: number;
  /** Linked risk alert — accepted verdicts reverse it (or its account's). */
  breachAlertId?: string;
  tradeRefs: string[];
  window?: { from: string; to: string };
}

export interface Appeal {
  id: string;
  traderId: string;
  accountId: string;
  kind: AppealKind;
  status: AppealStatus;
  evidence: AppealEvidence;
  /** Initial notes (escalation carries the ticket subject/body). */
  notes?: string;
  verdictReason?: string;
  openedAt: string;
  decidedAt?: string;
}

interface AppealsState {
  /** Decided + escalated rows — full snapshots (evidence frozen). */
  appeals: Record<string, Appeal>;
}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const evidenceSchema = z.object({
  ruleId: z.string().optional(),
  threshold: z.number().optional(),
  observed: z.number().optional(),
  breachAlertId: z.string().optional(),
  tradeRefs: z.array(z.string()),
  window: z.object({ from: z.string(), to: z.string() }).optional(),
});

const appealSchema = z.object({
  id: z.string().min(1),
  traderId: z.string(),
  accountId: z.string(),
  kind: z.enum(["outage-claim", "breach-dispute"]),
  status: z.enum(["open", "under-review", "accepted", "rejected"]),
  evidence: evidenceSchema,
  notes: z.string().optional(),
  verdictReason: z.string().optional(),
  openedAt: z.string().min(1),
  decidedAt: z.string().optional(),
});

const stateSchema = z.object({ appeals: z.record(z.string(), appealSchema) });

const SLOT = "appeals";

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let state: AppealsState = loadDemoState(SLOT, stateSchema, { appeals: {} });
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((l) => l());
}

function persist(): void {
  saveDemoState(SLOT, state);
}

/* ------------------------------------------------------------------ */
/* Projection (shared log → appeal rows)                               */
/* ------------------------------------------------------------------ */

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

/** `appeal.claim-submitted` → base Appeal row (trader claim or escalation). */
function baseFromEvent(e: LifecycleEvent): Appeal | null {
  if (e.name !== "appeal.claim-submitted") return null;
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const id = str(p.claimId) ?? e.entity?.id ?? "";
  if (!id) return null;
  const accountId = str(p.accountId) ?? "";
  const windowFrom = str(p.windowFrom);
  const windowTo = str(p.windowTo);
  return {
    id,
    traderId: str(p.traderId) ?? accountId,
    accountId,
    kind: p.kind === "breach-dispute" ? "breach-dispute" : "outage-claim",
    status: "open",
    evidence: {
      ruleId: str(p.ruleId),
      threshold: num(p.threshold),
      observed: num(p.observed),
      breachAlertId: str(p.breachAlertId),
      tradeRefs: Array.isArray(p.tradeRefs) ? p.tradeRefs.map(String) : [],
      window: windowFrom && windowTo ? { from: windowFrom, to: windowTo } : undefined,
    },
    notes: str(p.notes) ?? str(p.description),
    openedAt: e.at,
  };
}

/** `appeal.accepted` / `appeal.rejected` → verdict overlay. */
function verdictFromEvent(
  e: LifecycleEvent,
): { id: string; status: AppealStatus; verdictReason: string; decidedAt: string } | null {
  if (e.name !== "appeal.accepted" && e.name !== "appeal.rejected") return null;
  const p = (e.payload ?? {}) as Record<string, unknown>;
  const id = str(p.appealId) ?? e.entity?.id ?? "";
  if (!id) return null;
  return {
    id,
    status: e.name === "appeal.accepted" ? "accepted" : "rejected",
    verdictReason: str(p.verdictReason) ?? "",
    decidedAt: e.at,
  };
}

/**
 * Derive the queue from the shared lifecycle log. Takes the log as an
 * argument so hooks derive from the `useLifecycleLog` snapshot.
 */
export function projectAppeals(log: LifecycleEvent[]): Appeal[] {
  const byId = new Map<string, Appeal>();

  // 1. base rows from claim submissions (dedupe: latest event wins)
  for (const e of log) {
    const base = baseFromEvent(e);
    if (base) byId.set(base.id, base);
  }

  // 2. verdict events overlay (log is persisted — verdicts survive reload)
  for (const e of log) {
    const v = verdictFromEvent(e);
    const row = v ? byId.get(v.id) : undefined;
    if (v && row) {
      byId.set(v.id, {
        ...row,
        status: v.status,
        verdictReason: v.verdictReason || row.verdictReason,
        decidedAt: v.decidedAt,
      });
    }
  }

  // 3. persisted rows win — they carry the evidence snapshot frozen at
  //    decision time (risk alerts rotate out of the store's 100-row cap).
  for (const [id, row] of Object.entries(state.appeals)) {
    const derived = byId.get(id);
    byId.set(id, derived ? { ...derived, ...row } : row);
  }

  return [...byId.values()].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

/** Reactive appeals (queue view). */
export function useAppeals(): Appeal[] {
  const log = useLifecycleLog();
  return useMemo(() => projectAppeals(log), [log]);
}

/** Non-reactive read (callers outside React). */
export function getAppeals(): Appeal[] {
  return projectAppeals(readLifecycleLog());
}

/* ------------------------------------------------------------------ */
/* Mutations (persisted + audited + published)                         */
/* ------------------------------------------------------------------ */

export interface EscalateTicketInput {
  ticketId: string;
  subject: string;
  /** Ticket body/first message — carried as the appeal's initial notes. */
  body?: string;
  traderId: string;
  /** Optional open hard-breach alert to dispute (rule + numbers join). */
  breachAlertId?: string;
}

/**
 * UC-O9 — escalate a support ticket into a `breach-dispute` appeal.
 * Audits both sides (the ticket row and the appeal row), then publishes
 * `appeal.claim-submitted` (consumers: this queue + trader inbox bridge).
 */
export function escalateTicketToAppeal(input: EscalateTicketInput): Appeal {
  const alert = input.breachAlertId
    ? getRiskAlerts().find((a) => a.id === input.breachAlertId)
    : undefined;
  const id = `escal-${input.ticketId}`;
  const notes =
    `Escalated from support ticket ${input.ticketId} — ${input.subject}` +
    (input.body ? `: ${input.body}` : "");

  const appeal: Appeal = {
    id,
    traderId: input.traderId,
    accountId: alert?.accountId ?? input.traderId,
    kind: "breach-dispute",
    status: "open",
    evidence: {
      ruleId: alert?.ruleId,
      threshold: alert?.threshold,
      observed: alert?.value,
      breachAlertId: alert?.id,
      tradeRefs: alert?.tradeId ? [alert.tradeId] : [],
    },
    notes,
    openedAt: new Date().toISOString(),
  };

  state.appeals = { ...state.appeals, [id]: appeal };
  persist();
  notify();

  // Both sides audited: the ticket the operator escalated …
  recordAudit({
    action: "Escalated support ticket to appeal",
    entity: "support-ticket",
    entityId: input.ticketId,
    summary: `${input.ticketId} "${input.subject}" escalated to appeal ${id}${
      alert ? ` (disputing breach ${alert.id} — ${alert.ruleName})` : " (no linked breach)"
    }.`,
    severity: "warning",
    module: "support",
  });
  // … and the appeal it opened.
  recordAudit({
    action: "Opened appeal",
    entity: "appeal",
    entityId: id,
    summary: notes,
    severity: "warning",
    module: "risk",
  });

  emitLifecycle({
    entity: { kind: "appeal", id },
    name: "appeal.claim-submitted",
    actor: "prop-admin",
    key: `escalated:${input.ticketId}`,
    payload: {
      claimId: id,
      kind: "breach-dispute",
      traderId: appeal.traderId,
      accountId: appeal.accountId,
      notes,
      ruleId: appeal.evidence.ruleId,
      threshold: appeal.evidence.threshold,
      observed: appeal.evidence.observed,
      breachAlertId: appeal.evidence.breachAlertId,
      tradeRefs: appeal.evidence.tradeRefs,
      source: "support-escalation",
    },
  });

  return appeal;
}

/** The breach an accepted verdict would reverse (for the confirm dialog). */
export function breachToReverse(appeal: Appeal): RiskAlert | undefined {
  if (appeal.evidence.breachAlertId) {
    return getRiskAlerts().find((a) => a.id === appeal.evidence.breachAlertId);
  }
  if (!appeal.accountId) return undefined;
  return getRiskAlerts().find(
    (a) => a.accountId === appeal.accountId && a.severity === "hard-breach" && a.status === "open",
  );
}

/**
 * UC-O1 — decide an appeal. Persists the decided row (evidence snapshot),
 * audits, emits the verdict, and — when accepted — reverses the linked
 * breach (`reverseBreach` clears alert + risk case, emits
 * `breach.reversed`).
 */
export function decideAppeal(
  tid: string,
  appealId: string,
  verdict: AppealVerdict,
  reason: string,
): Appeal | null {
  const base = getAppeals().find((a) => a.id === appealId);
  if (!base || base.status === "accepted" || base.status === "rejected") return null;

  const decidedAt = new Date().toISOString();
  const final: Appeal = {
    ...base,
    status: verdict,
    verdictReason: reason.trim() || "(no reason supplied)",
    decidedAt,
  };
  state.appeals = { ...state.appeals, [appealId]: final };
  persist();
  notify();

  recordAudit({
    action: verdict === "accepted" ? "Accepted appeal" : "Rejected appeal",
    entity: "appeal",
    entityId: appealId,
    summary: `${final.kind === "outage-claim" ? "Outage claim" : "Breach dispute"} ${appealId} (trader ${final.traderId}) ${verdict}. ${final.verdictReason}`,
    severity: verdict === "accepted" ? "info" : "warning",
    module: "risk",
  });

  emitLifecycle({
    entity: { kind: "appeal", id: appealId },
    name: verdict === "accepted" ? "appeal.accepted" : "appeal.rejected",
    actor: "prop-admin",
    key: `decided:${appealId}:${verdict}`,
    payload: {
      appealId,
      kind: final.kind,
      traderId: final.traderId,
      accountId: final.accountId,
      verdictReason: final.verdictReason,
      ruleId: final.evidence.ruleId,
      threshold: final.evidence.threshold,
      observed: final.evidence.observed,
      breachAlertId: final.evidence.breachAlertId,
    },
  });

  // Accept → the disputed breach is cleared (alert reversed, case
  // dismissed, `breach.reversed` published to the trader's inbox).
  if (verdict === "accepted") {
    const linked = breachToReverse(final);
    if (linked) reverseBreach(tid, linked.id, appealId, final.verdictReason ?? "(no reason supplied)");
  }

  return final;
}
