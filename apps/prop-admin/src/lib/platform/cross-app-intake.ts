"use client";

/**
 * Cross-app intake — R2-W3-01 (demo transport).
 *
 * The trader app and this app normally run on different dev ports, but the
 * demo gateway (`Caddyfile`, `:81`) serves all three apps under ONE origin,
 * so they genuinely share `localStorage`. `@pfaas/lifecycle` persists its
 * event log under a single shared key and every app appends to it — this
 * module turns the trader's events into rows this app can queue:
 *
 *   kyc.submitted       → a pending KYC record (queue, counts, decisions)
 *   payout.requested   → a pending payout row (queue, KPIs, decisions)
 *   purchase.completed → a pending purchase record (queued for provisioning)
 *   provisioning.*     → an account-provisioning record (started / active)
 *   payout.escalated   → a payout escalation record (second signature)
 *   payout-method.*    → a payout-method change record (added/updated/…")
 *
 * The intake is **derived from the persisted log**, not stored twice, so it
 * survives reload exactly as the log does and can never disagree with it.
 *
 * Demo-only transport (rule R3): this is not a queue API. Rows are tagged
 * `source: "cross-app-intake"` and every surface that renders them must
 * carry the "(demo transport)" label. The real transport (prop-admin
 * ingesting trader submissions over HTTP) is out of scope for Round 2.
 *
 * Entity scoping: prop-admin decides intake rows under their own entity id
 * (`intake:<event id>`), never under the trader's `self` entity — the
 * trader's KYC verdict is owned by its own seeded reviewer (R2-01), so the
 * two flows can't contradict each other.
 *
 * Queue kinds (item 6): `kyc`, `payout`, `purchase`, `provisioning`,
 * `escalation`, `method`. A single dispatcher covers all of them; consumers
 * opt in to whichever queues matter to them.
 */

import { useMemo } from "react";
import { useLifecycleLog, readLifecycleLog, type LifecycleEvent, type LifecycleEntityKind } from "@pfaas/lifecycle";
import type { KycRecord, Payout } from "@/lib/platform/mock-data";

/** Marker stored on every derived row — surfaces render it as a chip. */
export const CROSS_APP_SOURCE = "cross-app-intake";

/**
 * Queue kinds a consumer opts into. Dispatch the full intake through
 * `crossAppIntakeRecords` so callers can union only what they care about
 * instead of subscribing to every event separately.
 */
export type IntakeQueueKind = "kyc" | "payout" | "purchase" | "provisioning" | "escalation" | "method";

/** Which queue a given intake event maps to. */
const QUEUE_BY_EVENT: Record<string, IntakeQueueKind> = {
  "kyc.submitted": "kyc",
  "payout.requested": "payout",
  "purchase.completed": "purchase",
  "provisioning.started": "provisioning",
  "provisioning.activated": "provisioning",
  "provisioning.credentials": "provisioning",
  "payout.escalated": "escalation",
  "payout-method.added": "method",
  "payout-method.updated": "method",
  "payout-method.removed": "method",
  "payout-method.primary-set": "method",
};

export const INTAKE_EVENTS = [
  "kyc.submitted",
  "payout.requested",
  "purchase.completed",
  "provisioning.started",
  "provisioning.activated",
  "provisioning.credentials",
  "payout.escalated",
  "payout-method.added",
  "payout-method.updated",
  "payout-method.removed",
  "payout-method.primary-set",
] as const;
type IntakeEventName = (typeof INTAKE_EVENTS)[number];

function queueKindFor(name: string): IntakeQueueKind {
  return QUEUE_BY_EVENT[name];
}

/**
 * Tenant scoping for a transport event. Events carry `payload.tenantId`
 * when the emitting store knows it; unscoped events are attributed to the
 * active demo tenant (single-firm demo).
 */
function inTenant(e: LifecycleEvent, tenantId: string): boolean {
  const scoped = e.payload?.tenantId;
  return typeof scoped !== "string" || scoped === tenantId;
}

/* ------------------------------------------------------------------ */
/* Type definitions for the new queues (R3-06)                         */
/* ------------------------------------------------------------------ */

/** Pending challenge purchases queued by the trader app (R3-06). */
export interface PurchaseRecord {
  id: string; // intake:<event id>
  tenantId: string;
  traderId: string;
  traderName: string;
  accountName: string;
  status: "pending" | "awaiting-provisioning";
  orderId: string;
  amount: number;
  currency: string;
  challengeType?: string;
  /** Payment method label as the trader checkout recorded it (R4-09). */
  method?: string;
  createdAt: string;
  source: typeof CROSS_APP_SOURCE;
}

/** Account provisioning queues: started = underway, active = live. */
export interface ProvisioningRecord {
  id: string; // intake:<event id>
  tenantId: string;
  traderId: string;
  traderName: string;
  accountName: string;
  status: "in-progress" | "credentials-delivered" | "active";
  startedAt: string;
  credentialsDeliveredAt?: string;
  activatedAt?: string;
  reason?: string;
  createdAt: string;
  source: typeof CROSS_APP_SOURCE;
}

/** Payout escalations — second signature required (R3-06). */
export interface EscalationRecord {
  id: string; // intake:<event id>
  tenantId: string;
  traderId: string;
  traderName: string;
  accountName?: string;
  payoutReference: string;
  amount: number;
  currency: string;
  reason?: string;
  status: "open";
  createdAt: string;
  source: typeof CROSS_APP_SOURCE;
}

/** Payout-method changes made by the trader (R3-06). */
export interface MethodChangeRecord {
  id: string; // intake:<event id>
  tenantId: string;
  traderId: string;
  traderName: string;
  accountName?: string;
  method: Payout["method"];
  action: "added" | "updated" | "removed" | "primary-set";
  createdAt: string;
  source: typeof CROSS_APP_SOURCE;
}

/* ------------------------------------------------------------------ */
/* Dispatch: the full intake in one place                              */
/* ------------------------------------------------------------------ */

/**
 * Pending items landed in the prop-admin hub from the trader app across
 * every queue kind (R3-06). Union of the kind-specific readers below.
 */
export function crossAppIntakeRecords(tenantId: string): IntakeRecord[] {
  return readLifecycleLog()
    .filter((e) => e.actor === "trader" && inTenant(e, tenantId))
    .map((e) => ({ kind: queueKindFor(e.name), record: toRecord(e, tenantId) }));
}

type IntakeRecord = {
  kind: IntakeQueueKind;
  record: PurchaseRecord | ProvisioningRecord | EscalationRecord | MethodChangeRecord | KycRecord | Payout;
};

function toRecord(e: LifecycleEvent, tenantId: string): IntakeRecord["record"] {
  switch (queueKindFor(e.name)) {
    case "kyc":
      return toKycRecord(e, tenantId);
    case "purchase":
      return toPurchaseRecord(e, tenantId);
    case "provisioning":
      return toProvisioningRecord(e, tenantId);
    case "escalation":
      return toEscalationRecord(e, tenantId);
    case "method":
      return toMethodChangeRecord(e, tenantId);
    case "payout":
      return toPayout(e, tenantId);
    default:
      return toPayout(e, tenantId);
  }
}

/* ------------------------------------------------------------------ */
/* Per-queue readers (legacy surface — kept for symmetry)              */
/* ------------------------------------------------------------------ */

export function crossAppKycRecords(tenantId: string): KycRecord[] {
  return intakeEvents(tenantId, "kyc", "kyc.submitted").map((e) => toKycRecord(e, tenantId));
}
export function useCrossAppKycRecords(tenantId: string): KycRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppKycRecords(tenantId), [log, tenantId]);
}

export function crossAppPayouts(tenantId: string): Payout[] {
  const requested = intakeEvents(tenantId, "payout", "payout.requested");
  // R4-05: reconcile cancelled payouts by reference
  const cancelled = new Set(
    intakeEvents(tenantId, "payout", "payout.cancelled").map((e) => String(e.payload?.reference ?? "")),
  );
  return requested.filter((e) => !cancelled.has(String(e.payload?.reference ?? ""))).map((e) => toPayout(e, tenantId));
}
export function useCrossAppPayouts(tenantId: string): Payout[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppPayouts(tenantId), [log, tenantId]);
}

/* --- New queue readers (R3-06) --- */

export function crossAppPurchases(tenantId: string): PurchaseRecord[] {
  return intakeEvents(tenantId, "purchase", "purchase.completed").map((e) => toPurchaseRecord(e, tenantId));
}
export function useCrossAppPurchases(tenantId: string): PurchaseRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppPurchases(tenantId), [log, tenantId]);
}

export function crossAppProvisioning(tenantId: string): ProvisioningRecord[] {
  // De-dupe by entity id — provisioning emits started+activated for same entity
  const raw = intakeEvents(tenantId, "provisioning", "provisioning.started")
    .concat(intakeEvents(tenantId, "provisioning", "provisioning.activated"))
    .concat(intakeEvents(tenantId, "provisioning", "provisioning.credentials"));
  const byEntity = new Map<string, ProvisioningRecord>();
  for (const e of raw) {
    const rec = toProvisioningRecord(e, tenantId);
    const existing = byEntity.get(rec.id);
    if (!existing || Date.parse(rec.createdAt) > Date.parse(existing.createdAt)) {
      byEntity.set(rec.id, rec);
    }
  }
  return Array.from(byEntity.values());
}
export function useCrossAppProvisioning(tenantId: string): ProvisioningRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppProvisioning(tenantId), [log, tenantId]);
}

export function crossAppEscalations(tenantId: string): EscalationRecord[] {
  return intakeEvents(tenantId, "payout", "payout.escalated").map((e) => toEscalationRecord(e, tenantId));
}
export function useCrossAppEscalations(tenantId: string): EscalationRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppEscalations(tenantId), [log, tenantId]);
}

export function crossAppMethodChanges(tenantId: string): MethodChangeRecord[] {
  return intakeEvents(tenantId, "payout-method", "payout-method.added")
    .concat(intakeEvents(tenantId, "payout-method", "payout-method.updated"))
    .concat(intakeEvents(tenantId, "payout-method", "payout-method.removed"))
    .concat(intakeEvents(tenantId, "payout-method", "payout-method.primary-set"))
    .map((e) => toMethodChangeRecord(e, tenantId));
}
export function useCrossAppMethodChanges(tenantId: string): MethodChangeRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppMethodChanges(tenantId), [log, tenantId]);
}

/* --- helpers shared by all mappers --- */

function intakeEvents(
  tenantId: string,
  kind: LifecycleEntityKind,
  name: string,
): LifecycleEvent[] {
  return readLifecycleLog().filter(
    (e) =>
      (e.actor === "trader" ||
        (kind === "payout" && (name === "payout.escalated" || name === "payout.cancelled"))) &&
      e.name === name &&
      e.entity.kind === kind &&
      inTenant(e, tenantId),
  );
}

function applicantOf(e: LifecycleEvent): string {
  const v = e.payload?.applicant;
  return typeof v === "string" && v.trim() ? v.trim() : "Trader app submission";
}

function mapChallengeType(raw: unknown): string | undefined {
  const s = typeof raw === "string" ? raw.toLowerCase() : "";
  if (s.includes("instant")) return "Instant Funded";
  if (s.includes("evaluation")) return "Evaluation";
  if (s.includes("free trial")) return "Free Trial";
  if (s.includes("competition")) return "Competition";
  return undefined;
}

function mapMethod(raw: unknown): Payout["method"] {
  const s = String(raw ?? "").toLowerCase();
  if (s.includes("crypto") || s.includes("btc") || s.includes("usdt")) return "crypto";
  if (s.includes("paypal")) return "paypal";
  if (s.includes("skrill")) return "skrill";
  return "bank-transfer";
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/* --- purchase mapper --- */

function toPurchaseRecord(e: LifecycleEvent, tenantId: string): PurchaseRecord {
  return {
    id: intakeEntityId(e),
    tenantId,
    traderId: `trader-${e.entity.id}`,
    traderName: applicantOf(e),
    accountName: applicantOf(e),
    status: "pending",
    orderId: String(e.payload?.orderId ?? ""),
    amount: numberOr(e.payload?.amount, 0),
    currency: typeof e.payload?.currency === "string" ? e.payload.currency : "USD",
    challengeType: e.payload?.challengeType != null ? String(e.payload.challengeType) : mapChallengeType(e.payload?.challengeTypeId),
    method: typeof e.payload?.method === "string" ? e.payload.method : undefined,
    createdAt: e.at,
    source: CROSS_APP_SOURCE,
  };
}

/* --- provisioning mapper (deduped by entity id) --- */

function toProvisioningRecord(e: LifecycleEvent, tenantId: string): ProvisioningRecord {
  return {
    id: intakeEntityId(e),
    tenantId,
    traderId: `trader-${e.entity.id}`,
    traderName: applicantOf(e),
    accountName: applicantOf(e),
    status: e.name === "provisioning.started"
      ? "in-progress"
      : e.name === "provisioning.credentials"
        ? "credentials-delivered"
        : "active",
    startedAt: e.at,
    credentialsDeliveredAt: typeof e.payload?.credentialsDeliveredAt === "string" ? e.payload.credentialsDeliveredAt : undefined,
    activatedAt: typeof e.payload?.activatedAt === "string" ? e.payload.activatedAt : undefined,
    reason: typeof e.payload?.reason === "string" ? e.payload.reason : undefined,
    createdAt: e.at,
    source: CROSS_APP_SOURCE,
  };
}

/* --- escalation mapper --- */

function toEscalationRecord(e: LifecycleEvent, tenantId: string): EscalationRecord {
  return {
    id: intakeEntityId(e),
    tenantId,
    traderId: `trader-${e.entity.id}`,
    traderName:
      typeof e.payload?.accountLogin === "string" && e.payload.accountLogin
        ? e.payload.accountLogin
        : "Trader app request",
    accountName:
      typeof e.payload?.accountLogin === "string" && e.payload.accountLogin
        ? e.payload.accountLogin
        : undefined,
    payoutReference: String(e.payload?.reference ?? ""),
    amount: numberOr(e.payload?.amount, 0),
    currency: typeof e.payload?.currency === "string" ? e.payload.currency : "USD",
    reason: typeof e.payload?.reason === "string" ? e.payload.reason : undefined,
    status: "open",
    createdAt: e.at,
    source: CROSS_APP_SOURCE,
  };
}

/* --- method change mapper --- */

function toMethodChangeRecord(e: LifecycleEvent, tenantId: string): MethodChangeRecord {
  const actionMap = {
    "payout-method.added": "added",
    "payout-method.updated": "updated",
    "payout-method.removed": "removed",
    "payout-method.primary-set": "primary-set",
  } as const satisfies Record<string, MethodChangeRecord["action"]>;
  return {
    id: intakeEntityId(e),
    tenantId,
    traderId: `trader-${e.entity.id}`,
    traderName: applicantOf(e),
    accountName: applicantOf(e),
    method: mapMethod(e.payload?.method),
    action: actionMap[e.name],
    createdAt: e.at,
    source: CROSS_APP_SOURCE,
  };
}

/* --- KYC (legacy) --- */

function toKycRecord(e: LifecycleEvent, tenantId: string): KycRecord {
  return ({
    id: intakeEntityId(e),
    tenantId,
    traderId: `trader-${e.entity.id}`,
    traderName: applicantOf(e),
    accountName: applicantOf(e),
    status: "pending" as const,
    documentType: "national-id" as const,
    country: typeof e.payload?.country === "string" ? e.payload.country : "—",
    submittedAt: e.at,
    riskLevel: "medium" as const,
    source: CROSS_APP_SOURCE,
  });
}

export function findCrossAppKyc(recordId: string): KycRecord | undefined {
  if (!recordId.startsWith("intake:")) return undefined;
  const e = readLifecycleLog().find(
    (ev) => ev.actor === "trader" && ev.name === "kyc.submitted" && intakeEntityId(ev) === recordId,
  );
  return e ? toKycRecord(e, typeof e.payload?.tenantId === "string" ? e.payload.tenantId : "") : undefined;
}

/* --- Payouts (legacy) --- */

function toPayout(e: LifecycleEvent, tenantId: string): Payout {
  return ({
    id: intakeEntityId(e),
    tenantId,
    traderId: `trader-${e.entity.id}`,
    traderName:
      typeof e.payload?.accountLogin === "string" && e.payload.accountLogin
        ? e.payload.accountLogin
        : "Trader app request",
    accountName:
      typeof e.payload?.accountLogin === "string" && e.payload.accountLogin
        ? e.payload.accountLogin
        : undefined,
    amount: numberOr(e.payload?.amount, 0),
    currency: typeof e.payload?.currency === "string" ? e.payload.currency : "USD",
    method: mapMethod(e.payload?.method),
    status: "pending" as const,
    profitSplit: numberOr(e.payload?.profitSplit, 80),
    createdAt: e.at,
    reference: String(e.payload?.reference ?? e.id),
    source: CROSS_APP_SOURCE,
  });
}

export function findCrossAppPayout(reference: string): Payout | undefined {
  const e = readLifecycleLog().find(
    (ev) => ev.actor === "trader" && ev.name === "payout.requested" && String(ev.payload?.reference) === reference,
  );
  return e ? toPayout(e, typeof e.payload?.tenantId === "string" ? e.payload.tenantId : "") : undefined;
}

/** Entity id prop-admin decides an intake row under. */
export function intakeEntityId(event: LifecycleEvent): string {
  return `intake:${event.id}`;
}

/**
 * Convenience for queue/hub pages: subscribe to the log once and re-derive
 * all intakes. Import this (not `useLifecycleLog`) from pages so the
 * intent — "this surface is fed by the transport" — stays explicit.
 */
export function useCrossAppIntake(tenantId: string): {
  kyc: KycRecord[];
  payouts: Payout[];
  purchases: PurchaseRecord[];
  provisioning: ProvisioningRecord[];
  escalations: EscalationRecord[];
  methodChanges: MethodChangeRecord[];
  logVersion: number;
} {
  const log = useLifecycleLog();
  return useMemo(
    () => ({
      kyc: crossAppKycRecords(tenantId),
      payouts: crossAppPayouts(tenantId),
      purchases: crossAppPurchases(tenantId),
      provisioning: crossAppProvisioning(tenantId),
      escalations: crossAppEscalations(tenantId),
      methodChanges: crossAppMethodChanges(tenantId),
      logVersion: log.length,
    }),
    [log, tenantId],
  );
}