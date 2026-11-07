"use client";
/**
 * R3-01 — STR / SAR Filing Register store (dummy, store-backed).
 *
 * The AML console ends at the `sar_filed` status; this register tracks what
 * was actually filed, with whom, when, and what happened next: filing sheet
 * with a snapshotted case-evidence snapshot (AC-1), four-eyes submit behind
 * compliance.aml.approve (AC-2), and a deadline clock that escalates overdue
 * filings into the risk alerts queue (AC-3).
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";
import { getAmlCase, updateAmlCase, type AmlCase } from "./aml-store";

export type FilingType = "SAR" | "STR" | "voluntary";
export type FilingStatus = "draft" | "submitted" | "acknowledged" | "rfi" | "closed";

export interface RegulatorInteraction {
  at: string;
  actor: string;
  kind: "submission" | "ack" | "rfi" | "response" | "note" | "escalation";
  detail: string;
}

/** AC-1 — immutable snapshot of case evidence at filing time. */
export interface FilingEvidenceSnapshot {
  caseId: string;
  traderId: string;
  traderName: string;
  email: string;
  typology: string;
  risk: string;
  amount: number;
  currency: string;
  amountTrail: AmlCase["movements"];
  screening: AmlCase["screening"];
  kycStatus: string;
  kycDocs: string[];
  attachments: string[];
  capturedAt: string;
}

export interface StrFiling {
  id: string;
  caseId: string;
  type: FilingType;
  regulator: string;
  status: FilingStatus;
  createdAt: string;
  submittedAt?: string;
  ackRef?: string;
  followUpDue: string;
  filer: string;
  /** Four-eyes (AC-2): the compliance.aml.approve holder who submitted. */
  approver?: string;
  narrative: string;
  evidence: FilingEvidenceSnapshot;
  interactions: RegulatorInteraction[];
  /** AC-3 — set once the deadline clock escalated this filing. */
  escalatedAt?: string;
}

export const FILING_REGULATORS = ["FinCEN (US FIU)", "UKFIU (NCA)", "FIU-net (EU)", "AUSTRAC"] as const;

const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/** Template prompts for the narrative editor (typology / trail / screening). */
export function defaultNarrativeForCase(c: AmlCase): string {
  const trail = c.movements.map((m) => `  - ${m.type} ${c.currency} ${m.amount.toLocaleString()} via ${m.method}${m.note ? ` — ${m.note}` : ""}`).join("\n");
  const screening = c.screening.map((s) => `  - ${s.provider}: ${s.result} — ${s.detail}`).join("\n");
  return [
    `TYPOLOGY: ${c.typology} (${c.risk} risk, case ${c.id})`,
    `SUBJECT: ${c.traderName} (${c.traderId}) — ${c.email}`,
    `AMOUNT TRAIL (from frozen case movements):`,
    trail || "  (none)",
    `SCREENING EVIDENCE SNAPSHOT:`,
    screening || "  (none)",
    `KYC: ${c.kyc.status} — ${c.kyc.docs.join(", ")}${c.kyc.sanctionsHit ? ` — hit: ${c.kyc.sanctionsHit}` : ""}`,
    ``,
    `NARRATIVE:`,
    ``,
  ].join("\n");
}

function snapshotEvidence(c: AmlCase): FilingEvidenceSnapshot {
  return {
    caseId: c.id,
    traderId: c.traderId,
    traderName: c.traderName,
    email: c.email,
    typology: c.typology,
    risk: c.risk,
    amount: c.amount,
    currency: c.currency,
    amountTrail: [...c.movements],
    screening: c.screening.map((s) => ({ ...s })),
    kycStatus: c.kyc.status,
    kycDocs: [...c.kyc.docs],
    // The filing reuses the frozen case's document set as attachments.
    attachments: [`case-${c.id}-kyc.zip`, `case-${c.id}-movements.csv`, `case-${c.id}-screening.pdf`],
    capturedAt: now(),
  };
}

/** Seed filing evidence from the live AML case (same snapshot path as AC-1). */
function seedEvidence(caseId: string): FilingEvidenceSnapshot {
  const c = getAmlCase(caseId);
  if (!c) {
    return {
      caseId, traderId: "", traderName: "", email: "", typology: "(case unavailable)",
      risk: "low", amount: 0, currency: "USD", amountTrail: [], screening: [],
      kycStatus: "unknown", kycDocs: [], attachments: [], capturedAt: now(),
    };
  }
  return snapshotEvidence(c);
}

let FILINGS: StrFiling[] = [
  {
    id: "FIL-2026-001", caseId: "aml2", type: "SAR", regulator: "FinCEN (US FIU)",
    status: "submitted", createdAt: daysAgo(6), submittedAt: daysAgo(3),
    followUpDue: daysAhead(4), filer: "Morgan Vance", approver: "Sarah Chen",
    narrative: "SAR filed on confirmed PEP association (World-Check hit) with a USDT payout request of 15,000. Subject is a verified funded trader; crypto withdrawal method and PEP relative association raised the risk score to 92.",
    evidence: seedEvidence("aml2"),
    interactions: [
      { at: daysAgo(6), actor: "Morgan Vance", kind: "note", detail: "Draft created from AML case aml2 (evidence snapshotted)." },
      { at: daysAgo(3), actor: "Sarah Chen", kind: "submission", detail: "Submitted to FinCEN via BSA E-Filing (four-eyes: compliance.aml.approve)." },
    ],
  },
  {
    id: "FIL-2026-002", caseId: "aml1", type: "STR", regulator: "UKFIU (NCA)",
    status: "rfi", createdAt: daysAgo(34), submittedAt: daysAgo(31),
    ackRef: "NCA-ACK-88214", followUpDue: daysAgo(2), filer: "Morgan Vance", approver: "Sarah Chen",
    narrative: "STR on structuring: three card deposits under the reporting threshold within 52 minutes followed by a 7,200 payout request. Deposits clustered just below threshold; potential name match unconfirmed at filing time.",
    evidence: seedEvidence("aml1"),
    interactions: [
      { at: daysAgo(34), actor: "Morgan Vance", kind: "note", detail: "Draft created from AML case aml1 (evidence snapshotted)." },
      { at: daysAgo(31), actor: "Sarah Chen", kind: "submission", detail: "Submitted to UKFIU (four-eyes: compliance.aml.approve)." },
      { at: daysAgo(30), actor: "UKFIU", kind: "ack", detail: "Acknowledged — ref NCA-ACK-88214." },
      { at: daysAgo(6), actor: "UKFIU", kind: "rfi", detail: "RFI: provide source-of-funds evidence for the three card deposits and the counterparty wallet." },
    ],
  },
  {
    id: "FIL-2026-003", caseId: "aml3", type: "STR", regulator: "FIU-net (EU)",
    status: "draft", createdAt: daysAgo(2), followUpDue: daysAhead(12), filer: "Analyst",
    narrative: defaultNarrativePlaceholder("aml3"),
    evidence: seedEvidence("aml3"),
    interactions: [
      { at: daysAgo(2), actor: "Analyst", kind: "note", detail: "Draft created from AML case aml3 (evidence snapshotted)." },
    ],
  },
  {
    id: "FIL-2026-004", caseId: "aml4", type: "voluntary", regulator: "AUSTRAC",
    status: "closed", createdAt: daysAgo(52), submittedAt: daysAgo(48), ackRef: "AUSTRAC-VT-4410",
    followUpDue: daysAgo(18), filer: "Morgan Vance", approver: "Sarah Chen",
    narrative: "Voluntary disclosure: rapid deposit-then-withdrawal pattern, closed after source of funds was confirmed and screening cleared on the current list version.",
    evidence: seedEvidence("aml4"),
    interactions: [
      { at: daysAgo(48), actor: "Sarah Chen", kind: "submission", detail: "Submitted to AUSTRAC (four-eyes: compliance.aml.approve)." },
      { at: daysAgo(47), actor: "AUSTRAC", kind: "ack", detail: "Acknowledged — ref AUSTRAC-VT-4410." },
      { at: daysAgo(18), actor: "Morgan Vance", kind: "note", detail: "Regulator closed the matter — no further action." },
    ],
  },
];

function defaultNarrativePlaceholder(caseId: string): string {
  const c = getAmlCase(caseId);
  return c ? defaultNarrativeForCase(c) : `TYPOLOGY: (case ${caseId} unavailable)`;
}

/* Store subscription (mirrors payout/AML store patterns). */
const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

export function listFilings(): StrFiling[] {
  return FILINGS;
}

export function getFiling(id: string): StrFiling | undefined {
  return FILINGS.find((f) => f.id === id);
}

/** True when the follow-up deadline has passed and the filing is still live. */
export function isFilingOverdue(f: StrFiling): boolean {
  return (
    new Date(f.followUpDue).getTime() < Date.now() &&
    (f.status === "draft" || f.status === "submitted" || f.status === "rfi")
  );
}

/** Compliance dashboard strip metrics for the register. */
export function filingStripMetrics() {
  const live = FILINGS.filter((f) => f.status !== "closed");
  const dueIn30 = live.filter((f) => new Date(f.followUpDue).getTime() <= Date.now() + 30 * 86_400_000).length;
  const openRfi = FILINGS.filter((f) => f.status === "rfi").length;
  const overdue = FILINGS.filter(isFilingOverdue).length;
  const filed = FILINGS.filter((f) => f.submittedAt);
  const avgTimeToFile = filed.length
    ? Math.round(
        filed.reduce((s, f) => s + (new Date(f.submittedAt!).getTime() - new Date(f.createdAt).getTime()) / 86_400_000, 0) / filed.length,
      )
    : 0;
  return { dueIn30, openRfi, overdue, avgTimeToFile, total: FILINGS.length };
}

function nextFilingId(): string {
  const year = new Date().getFullYear();
  const n = FILINGS.filter((f) => f.id.startsWith(`FIL-${year}`)).length + 1;
  return `FIL-${year}-${String(n).padStart(3, "0")}`;
}

/**
 * AC-1 — filing from a case creates the register entry, snapshots case
 * evidence into it and locks the case narrative (case gains `filingId`,
 * which the case detail renders as a locked-narrative badge).
 */
export function createFilingFromCase(
  caseId: string,
  input: { type: FilingType; regulator: string; narrative?: string; filer: string },
): StrFiling | null {
  const c = getAmlCase(caseId);
  if (!c) return null;
  const filing: StrFiling = {
    id: nextFilingId(),
    caseId,
    type: input.type,
    regulator: input.regulator,
    status: "draft",
    createdAt: now(),
    followUpDue: daysAhead(30),
    filer: input.filer,
    narrative: input.narrative?.trim() || defaultNarrativeForCase(c),
    evidence: snapshotEvidence(c),
    interactions: [{ at: now(), actor: input.filer, kind: "note", detail: `Draft created from AML case ${caseId} (case evidence snapshotted, narrative locked).` }],
  };
  FILINGS = [filing, ...FILINGS];
  // Lock the case narrative — the case is now the immutable source of the
  // snapshot; further narrative edits happen in the filing sheet.
  updateAmlCase(caseId, { filingId: filing.id }, {
    action: "filing.lock-case",
    summary: `Case narrative locked by filing ${filing.id} (${input.type} → ${input.regulator})`,
  });
  recordAudit({
    action: "STR filing draft created",
    entity: "str-filing",
    entityId: filing.id,
    summary: `${input.type} drafted from case ${caseId} → ${input.regulator} by ${input.filer} (evidence snapshotted)`,
    module: "risk",
    severity: "info",
  });
  emit();
  return filing;
}

export function updateFilingNarrative(id: string, narrative: string, actor: string) {
  const f = getFiling(id);
  if (!f) return;
  FILINGS = FILINGS.map((x) => (x.id === id ? { ...x, narrative } : x));
  recordAudit({
    action: "STR filing narrative edited",
    entity: "str-filing",
    entityId: id,
    summary: `${f.type} ${id} narrative edited by ${actor} (${narrative.length} chars)`,
    module: "risk",
    severity: "info",
  });
  emit();
}

/**
 * AC-2 — four-eyes submit: the caller must hold compliance.aml.approve
 * (enforced by the caller's guard); the store records approver + audit and
 * moves the linked case to `sar_filed`.
 */
export function submitFiling(id: string, opts: { approver: string }): boolean {
  const f = getFiling(id);
  if (!f || f.status !== "draft") return false;
  FILINGS = FILINGS.map((x) =>
    x.id === id
      ? {
          ...x,
          status: "submitted" as FilingStatus,
          submittedAt: now(),
          approver: opts.approver,
          interactions: [
            ...x.interactions,
            { at: now(), actor: opts.approver, kind: "submission" as const, detail: `Submitted to ${x.regulator} (four-eyes: compliance.aml.approve).` },
          ],
        }
      : x,
  );
  updateAmlCase(f.caseId, { status: "sar_filed" }, {
    action: "filing.submit",
    summary: `${f.type} ${id} submitted to ${f.regulator} — case moved to sar_filed`,
  });
  recordAudit({
    action: "STR filing submitted",
    entity: "str-filing",
    entityId: id,
    summary: `${f.type} ${id} (${f.caseId}) submitted to ${f.regulator}; approver ${opts.approver} (compliance.aml.approve)`,
    module: "risk",
    severity: "warning",
  });
  emit();
  return true;
}

/** Append a regulator interaction and derive status transitions. */
export function recordFilingInteraction(
  id: string,
  kind: RegulatorInteraction["kind"],
  detail: string,
  actor: string,
  opts?: { ackRef?: string },
): boolean {
  const f = getFiling(id);
  if (!f) return false;
  const status: FilingStatus =
    kind === "rfi" ? "rfi" : kind === "ack" ? "acknowledged" : kind === "response" && f.status === "rfi" ? "submitted" : f.status;
  FILINGS = FILINGS.map((x) =>
    x.id === id
      ? {
          ...x,
          status,
          ackRef: opts?.ackRef ?? x.ackRef,
          interactions: [...x.interactions, { at: now(), actor, kind, detail }],
        }
      : x,
  );
  recordAudit({
    action: `STR filing ${kind}`,
    entity: "str-filing",
    entityId: id,
    summary: `${f.type} ${id}: ${kind} recorded by ${actor} — ${detail.slice(0, 100)}`,
    module: "risk",
    severity: kind === "rfi" ? "warning" : "info",
  });
  emit();
  return true;
}

export function closeFiling(id: string, actor: string): boolean {
  const f = getFiling(id);
  if (!f || f.status === "closed") return false;
  FILINGS = FILINGS.map((x) =>
    x.id === id
      ? { ...x, status: "closed" as FilingStatus, interactions: [...x.interactions, { at: now(), actor, kind: "note" as const, detail: "Matter closed — no further regulator action." }] }
      : x,
  );
  recordAudit({
    action: "STR filing closed",
    entity: "str-filing",
    entityId: id,
    summary: `${f.type} ${id} closed by ${actor}`,
    module: "risk",
    severity: "info",
  });
  emit();
  return true;
}

/**
 * AC-3 — deadline clock: escalate overdue filings into the risk alerts
 * queue once (audit trail + platform notification), stamping `escalatedAt`
 * so re-syncs do not re-alert. Returns the overdue set + newly escalated
 * ones so the page can push the notifications.
 */
export function syncFilingEscalations(): { overdue: StrFiling[]; newlyEscalated: StrFiling[] } {
  const overdue = FILINGS.filter(isFilingOverdue);
  const newlyEscalated: StrFiling[] = [];
  for (const f of overdue) {
    if (f.escalatedAt) continue;
    FILINGS = FILINGS.map((x) =>
      x.id === f.id
        ? {
            ...x,
            escalatedAt: now(),
            interactions: [
              ...x.interactions,
              { at: now(), actor: "deadline-clock", kind: "escalation" as const, detail: `Follow-up deadline ${new Date(f.followUpDue).toLocaleDateString()} passed — escalated to the risk alerts queue.` },
            ],
          }
        : x,
    );
    newlyEscalated.push(getFiling(f.id)!);
    recordAudit({
      action: "STR filing overdue — escalated",
      entity: "str-filing",
      entityId: f.id,
      summary: `${f.type} ${f.id} (${f.caseId}) overdue since ${new Date(f.followUpDue).toLocaleDateString()} — escalated to risk alerts queue`,
      module: "risk",
      severity: "warning",
    });
  }
  if (newlyEscalated.length) emit();
  return { overdue: FILINGS.filter(isFilingOverdue), newlyEscalated };
}

/** Subscribe the calling component to register mutations. */
export function useStrFilingVersion(): number {
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
