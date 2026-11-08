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
 *   kyc.submitted     → a pending KYC record (queue, counts, decisions)
 *   payout.requested  → a pending payout row (queue, KPIs, decisions)
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
 */

import { useMemo } from "react";
import { useLifecycleLog, readLifecycleLog, type LifecycleEvent } from "@pfaas/lifecycle";
import type { KycRecord, Payout } from "@/lib/platform/mock-data";

/** Marker stored on every derived row — surfaces render it as a chip. */
export const CROSS_APP_SOURCE = "cross-app-intake";

/**
 * Tenant scoping for a transport event. Events carry `payload.tenantId`
 * when the emitting store knows it; unscoped events are attributed to the
 * active demo tenant (single-firm demo).
 */
function inTenant(e: LifecycleEvent, tenantId: string): boolean {
  const scoped = e.payload?.tenantId;
  return typeof scoped !== "string" || scoped === tenantId;
}

const INTAKE_EVENTS = ["kyc.submitted", "payout.requested"] as const;
type IntakeEventName = (typeof INTAKE_EVENTS)[number];

function intakeEvents(
  tenantId: string,
  kind: "kyc" | "payout",
  name: IntakeEventName,
): LifecycleEvent[] {
  return readLifecycleLog().filter(
    (e) => e.actor === "trader" && e.name === name && e.entity.kind === kind && inTenant(e, tenantId),
  );
}

/** Entity id prop-admin decides an intake row under. */
export function intakeEntityId(event: LifecycleEvent): string {
  return `intake:${event.id}`;
}

/** Applicant label from the trader's identity form (real user input). */
function applicantOf(e: LifecycleEvent): string {
  const v = e.payload?.applicant;
  return typeof v === "string" && v.trim() ? v.trim() : "Trader app submission";
}

/** Map the trader's free-text method onto the payout method union. */
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

/* ------------------------------------------------------------------ */
/* KYC                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Pending KYC submissions made in the trader app, shaped as queue records.
 * `source` marks them for the "(demo transport)" chip; status stays
 * `pending` until a reviewer decides through `applyKycDecision` (which keys
 * the decision on `intake:<event id>`).
 */
export function crossAppKycRecords(tenantId: string): KycRecord[] {
  return intakeEvents(tenantId, "kyc", "kyc.submitted").map((e) => toKycRecord(e, tenantId));
}

function toKycRecord(e: LifecycleEvent, tenantId: string): KycRecord {
  return ({
    id: intakeEntityId(e),
    tenantId,
    traderId: `trader-${e.entity.id}`,
    traderName: applicantOf(e),
    accountName: applicantOf(e),
    status: "pending" as const,
    // No document artifact crosses the transport — the row states that
    // rather than implying a document type was seen.
    documentType: "national-id" as const,
    country: typeof e.payload?.country === "string" ? e.payload.country : "—",
    submittedAt: e.at,
    riskLevel: "medium" as const,
    source: CROSS_APP_SOURCE,
  });
}

/** Look up one intake KYC row by its decision id (audit fallbacks). */
export function findCrossAppKyc(recordId: string): KycRecord | undefined {
  if (!recordId.startsWith("intake:")) return undefined;
  const e = readLifecycleLog().find(
    (ev) => ev.actor === "trader" && ev.name === "kyc.submitted" && intakeEntityId(ev) === recordId,
  );
  return e ? toKycRecord(e, typeof e.payload?.tenantId === "string" ? e.payload.tenantId : "") : undefined;
}

/** Reactive version for pages that must re-render when an event lands. */
export function useCrossAppKycRecords(tenantId: string): KycRecord[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppKycRecords(tenantId), [log, tenantId]);
}

/* ------------------------------------------------------------------ */
/* Payouts                                                             */
/* ------------------------------------------------------------------ */

/** Pending payout requests submitted in the trader app, shaped as queue rows. */
export function crossAppPayouts(tenantId: string): Payout[] {
  return intakeEvents(tenantId, "payout", "payout.requested").map((e) => toPayout(e, tenantId));
}

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

/** Look up one intake payout row by its reference (audit fallbacks). */
export function findCrossAppPayout(reference: string): Payout | undefined {
  const e = readLifecycleLog().find(
    (ev) => ev.actor === "trader" && ev.name === "payout.requested" && String(ev.payload?.reference) === reference,
  );
  return e ? toPayout(e, typeof e.payload?.tenantId === "string" ? e.payload.tenantId : "") : undefined;
}

/** Reactive version for pages that must re-render when an event lands. */
export function useCrossAppPayouts(tenantId: string): Payout[] {
  const log = useLifecycleLog();
  return useMemo(() => crossAppPayouts(tenantId), [log, tenantId]);
}

/**
 * Convenience for queue/hub pages: subscribe to the log once and re-derive
 * both intakes. Import this (not `useLifecycleLog`) from pages so the
 * intent — "this surface is fed by the transport" — stays explicit.
 */
export function useCrossAppIntake(tenantId: string): {
  kyc: KycRecord[];
  payouts: Payout[];
  logVersion: number;
} {
  const log = useLifecycleLog();
  return useMemo(
    () => ({
      kyc: crossAppKycRecords(tenantId),
      payouts: crossAppPayouts(tenantId),
      logVersion: log.length,
    }),
    [log, tenantId],
  );
}
