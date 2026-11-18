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
 *   competition.joined → a competition join record (participant list on
 *                        the operator's competition detail, R7 I3)
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
 *
 * Typed with `| undefined` on purpose: not every lifecycle event maps to
 * a queue (competition.joined/prize-claimed, trade.*, comms.* …), and
 * pretending otherwise once made the dispatcher coerce them into payout
 * rows. Unmapped events are skipped explicitly.
 */
export type IntakeQueueKind = "kyc" | "payout" | "purchase" | "provisioning" | "escalation" | "method" | "pause";

/** Which queue a given intake event maps to (`undefined` = not queued). */
const QUEUE_BY_EVENT: Record<string, IntakeQueueKind | undefined> = {
  "kyc.submitted": "kyc",
  "payout.requested": "payout",
  "purchase.completed": "purchase",
  "provisioning.started": "provisioning",
  "provisioning.dispatched": "provisioning",
  "provisioning.activated": "provisioning",
  "provisioning.credentials": "provisioning",
  "payout.escalated": "escalation",
  "payout-method.added": "method",
  "payout-method.updated": "method",
  "payout-method.rejected": "method",
  "payout-method.unverified": "method",
  "payout-method.removed": "method",
  "payout-method.primary-set": "method",
  "purchase.refunded": "purchase",
  "provisioning.retry": "provisioning",
  "provisioning.failed": "provisioning",
  // R9 W5 UC-T9 — trader pause requests queue for operator approve/reject.
  "account.pause-requested": "pause",
};

export const INTAKE_EVENTS = [
  "kyc.submitted",
  "payout.requested",
  "purchase.completed",
  "purchase.refunded",
  "provisioning.started",
  "provisioning.dispatched",
  "provisioning.activated",
  "provisioning.credentials",
  "provisioning.retry",
  "provisioning.failed",
  "payout.escalated",
  "payout-method.added",
  "payout-method.updated",
  "payout-method.rejected",
  "payout-method.unverified",
  "payout-method.removed",
  "payout-method.primary-set",
  "account.pause-requested",
] as const;
type IntakeEventName = (typeof INTAKE_EVENTS)[number];

function queueKindFor(name: string): IntakeQueueKind | undefined {
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
  status: "pending" | "awaiting-provisioning" | "refunded";
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
  status: "in-progress" | "credentials-delivered" | "active" | "failed" | "retry";
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
  /** Coarse payment-method label (crypto|paypal|skrill|bank-transfer) for display. */
  method: Payout["method"];
  /** The trader's actual method id (e.g. `wm-wise`, `wm-custom-...`) — used to
   *  key verdict events so the trader's fold can match them. */
  traderMethodId?: string;
  action: "added" | "updated" | "removed" | "primary-set" | "rejected" | "unverified";
  createdAt: string;
  source: typeof CROSS_APP_SOURCE;
}

/**
 * Trader-app competition joins (R7 I3) — the participant list on the
 * operator's competition detail ("Joined via trader app"). Derived from
 * the shared log exactly like the other queues.
 */
export interface CompetitionJoinRecord {
  id: string; // intake:<event id>
  tenantId: string;
  competitionId: string;
  competitionName: string;
  traderName: string;
  joinedAt: string;
  source: typeof CROSS_APP_SOURCE;
}

/**
 * R9 W5 UC-T9 — trader account-pause requests. One row per account (the
 * latest request), with the operator's verdict applied from
 * `account.pause-approved` / `account.pause-rejected` on the same log.
 */
export interface PauseRecord {
  id: string; // intake:<event id>
  tenantId: string;
  traderId: string;
  traderName: string;
  accountId: string;
  accountLogin?: string;
  accountName?: string;
  /** Requested length in days (trader policy caps at 14). */
  days: number;
  /** When the pause would end (request time + days). */
  until: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  /** Operator's rejection reason, verbatim. */
  reason?: string;
  createdAt: string;
  source: typeof CROSS_APP_SOURCE;
}

/* ------------------------------------------------------------------ */
/* Dispatch: the full intake in one place                              */
/* ------------------------------------------------------------------ */

/**
 * Pending items landed in the prop-admin hub from the trader app across
 * every queue kind (R3-06). Union of the kind-specific readers below.
 * Events without a queue mapping (competition, trade, comms lifecycle
 * noise) are skipped — they have their own dedicated readers.
 */
export function crossAppIntakeRecords(tenantId: string): IntakeRecord[] {
  return readLifecycleLog()
    .filter((e) => e.actor === "trader" && inTenant(e, tenantId))
    .flatMap((e) => {
      const kind = queueKindFor(e.name);
      return kind ? [{ kind, record: toRecord(e, kind, tenantId) }] : [];
    });
}

type IntakeRecord = {
  kind: IntakeQueueKind;
  record: PurchaseRecord | ProvisioningRecord | EscalationRecord | MethodChangeRecord | KycRecord | Payout | PauseRecord;
};

function toRecord(e: LifecycleEvent, kind: IntakeQueueKind, tenantId: string): IntakeRecord["record"] {
  switch (kind) {
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
    case "pause":
      return toPauseRecord(e, tenantId);
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
  const completed = intakeEvents(tenantId, "purchase", "purchase.completed");
  // R4-09: reconcile refunds — a purchase.refunded from prop-admin flips the row.
  const refundedOrderIds = new Set(
    intakeEvents(tenantId, "purchase", "purchase.refunded").map((e) =>
      String(e.payload?.orderId ?? e.entity.id),
    ),
  );
  return completed
    .map((e) => {
      const rec = toPurchaseRecord(e, tenantId);
      if (refundedOrderIds.has(rec.orderId)) rec.status = "refunded";
      return rec;
    });
}
export function useCrossAppPurchases(tenantId: string): PurchaseRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppPurchases(tenantId), [log, tenantId]);
}

export function crossAppProvisioning(tenantId: string): ProvisioningRecord[] {
  // De-dupe by entity id — provisioning emits started+activated for same entity
  const raw = intakeEvents(tenantId, "provisioning", "provisioning.started")
    .concat(intakeEvents(tenantId, "provisioning", "provisioning.dispatched"))
    .concat(intakeEvents(tenantId, "provisioning", "provisioning.activated"))
    .concat(intakeEvents(tenantId, "provisioning", "provisioning.credentials"))
    .concat(intakeEvents(tenantId, "provisioning", "provisioning.retry"))
    .concat(intakeEvents(tenantId, "provisioning", "provisioning.failed"));
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
    .concat(intakeEvents(tenantId, "payout-method", "payout-method.rejected"))
    .concat(intakeEvents(tenantId, "payout-method", "payout-method.unverified"))
    .concat(intakeEvents(tenantId, "payout-method", "payout-method.removed"))
    .concat(intakeEvents(tenantId, "payout-method", "payout-method.primary-set"))
    .map((e) => toMethodChangeRecord(e, tenantId));
}
export function useCrossAppMethodChanges(tenantId: string): MethodChangeRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppMethodChanges(tenantId), [log, tenantId]);
}

/**
 * R9 W5 UC-T9 — pause requests per account (latest request wins), with
 * the operator verdict applied from the same log. A verdict older than a
 * record's request is ignored so a re-request never shows a stale decision.
 */
export function crossAppPauses(tenantId: string): PauseRecord[] {
  const events = readLifecycleLog();
  const byAccount = new Map<string, PauseRecord>();
  for (const e of intakeEvents(tenantId, "account", "account.pause-requested", events)) {
    const rec = toPauseRecord(e, tenantId);
    const prev = byAccount.get(rec.accountId);
    if (!prev || Date.parse(rec.createdAt) > Date.parse(prev.createdAt)) {
      byAccount.set(rec.accountId, rec);
    }
  }
  for (const rec of byAccount.values()) {
    const verdict = events
      .filter(
        (v) =>
          (v.name === "account.pause-approved" || v.name === "account.pause-rejected") &&
          v.entity.id === rec.accountId &&
          Date.parse(v.at) >= Date.parse(rec.createdAt),
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .pop();
    if (!verdict) continue;
    rec.status = verdict.name === "account.pause-approved" ? "approved" : "rejected";
    rec.decidedAt = verdict.at;
    rec.reason = typeof verdict.payload?.reason === "string" ? verdict.payload.reason : undefined;
  }
  return Array.from(byAccount.values());
}
export function useCrossAppPauses(tenantId: string): PauseRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppPauses(tenantId), [log, tenantId]);
}

/** Trader-app joins per competition (R7 I3) — participant list reader.
 *
 * `events` is optional so the reactive hook can pass the `useLifecycleLog`
 * snapshot: during hydration that snapshot is the server's `[]`, and
 * reading localStorage directly would render differently from the server
 * HTML (hydration mismatch). Default = current persisted log.
 *
 * A join whose trader later emitted `competition.left` for the same
 * competition is dropped — the list is the current roster, not history. */
export function crossAppCompetitionJoins(
  tenantId: string,
  events: LifecycleEvent[] = readLifecycleLog(),
): CompetitionJoinRecord[] {
  const leaves = events.filter(
    (e) => e.actor === "trader" && e.name === "competition.left" && inTenant(e, tenantId),
  );
  return intakeEvents(tenantId, "competition", "competition.joined", events)
    .map((e) => toCompetitionJoin(e, tenantId))
    .filter(
      (j) =>
        !leaves.some((l) => {
          if (String(l.payload?.competitionId ?? l.entity.id) !== j.competitionId) return false;
          if (Date.parse(l.at) < Date.parse(j.joinedAt)) return false;
          const name = l.payload?.traderName;
          // Unnamed leaves (legacy events) can't be attributed — treat
          // them as matching any trader for that competition.
          return typeof name !== "string" || name === j.traderName;
        }),
    );
}
export function useCrossAppCompetitionJoins(tenantId: string): CompetitionJoinRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppCompetitionJoins(tenantId, log), [log, tenantId]);
}

/* --- helpers shared by all mappers --- */

function intakeEvents(
  tenantId: string,
  kind: LifecycleEntityKind,
  name: string,
  events: LifecycleEvent[] = readLifecycleLog(),
): LifecycleEvent[] {
  return events.filter(
    (e) =>
      (e.actor === "trader" ||
        (kind === "payout" && (name === "payout.escalated" || name === "payout.cancelled")) ||
        (kind === "purchase" && name === "purchase.refunded") ||
        (kind === "provisioning" &&
          (name === "provisioning.retry" || name === "provisioning.failed")) ||
        (kind === "payout-method" &&
          (name === "payout-method.rejected" || name === "payout-method.unverified"))) &&
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
    status: e.name === "provisioning.started" || e.name === "provisioning.dispatched"
      ? "in-progress"
      : e.name === "provisioning.credentials"
        ? "credentials-delivered"
        : e.name === "provisioning.retry"
          ? "retry"
          : e.name === "provisioning.failed"
            ? "failed"
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
    "payout-method.rejected": "rejected",
    "payout-method.unverified": "unverified",
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
    traderMethodId: e.entity.id,
    action: actionMap[e.name],
    createdAt: e.at,
    source: CROSS_APP_SOURCE,
  };
}

/* --- account pause mapper (R9 W5 UC-T9) --- */

function toPauseRecord(e: LifecycleEvent, tenantId: string): PauseRecord {
  return {
    id: intakeEntityId(e),
    tenantId,
    traderId: `trader-${e.entity.id}`,
    traderName: applicantOf(e),
    accountId: e.entity.id,
    accountLogin:
      typeof e.payload?.accountLogin === "string" ? e.payload.accountLogin : undefined,
    accountName:
      typeof e.payload?.accountName === "string" ? e.payload.accountName : undefined,
    days: numberOr(e.payload?.days, 1),
    until: typeof e.payload?.until === "string" ? e.payload.until : e.at,
    status: "pending",
    createdAt: e.at,
    source: CROSS_APP_SOURCE,
  };
}

/* --- competition join mapper (R7 I3) --- */

function toCompetitionJoin(e: LifecycleEvent, tenantId: string): CompetitionJoinRecord {
  const rawName = e.payload?.traderName;
  return {
    id: intakeEntityId(e),
    tenantId,
    competitionId: String(e.payload?.competitionId ?? e.entity.id),
    competitionName: typeof e.payload?.name === "string" && e.payload.name ? e.payload.name : "Competition",
    traderName: typeof rawName === "string" && rawName.trim() ? rawName.trim() : "Demo trader",
    joinedAt: e.at,
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
    // R9 W2 UC-O8 — carry the trader's promise into the operator queue
    // (SLA panel + fraud/overdue buckets count down the same deadline).
    promisedBy:
      typeof e.payload?.promisedBy === "string" && e.payload.promisedBy
        ? e.payload.promisedBy
        : undefined,
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
  /** R9 W5 UC-T9 — trader account-pause requests (latest per account). */
  pauses: PauseRecord[];
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
      pauses: crossAppPauses(tenantId),
      logVersion: log.length,
    }),
    [log, tenantId],
  );
}