"use client";

/**
 * Payout requests store — R2-02.
 * 
 * Persists trader-submitted payout requests so they survive reload and
 * appear in history/detail. Store entries merge ahead of fixture payouts
 * and use deterministic, time-seeded progression on read:
 *   submitted → processing → paid
 * 
 * Pattern mirrors payout-methods-store: localStorage backing,
 * useSyncExternalStore reactivity, cross-tab sync.
 */

import { useSyncExternalStore } from "react";
import { emitLifecycle, readLifecycleLog, useLifecycleLog } from "@pfaas/lifecycle";
import { terraAccounts, payoutEntitlement } from "@/lib/fixtures/terra-fixtures";
import { hashStr } from "@/lib/fixtures/trader-fixtures";
import { readPayoutMethods } from "@/lib/payouts/payout-methods-store";
import { pushInboxMessage } from "@/lib/inbox/inbox-store";
import { getPayoutStage } from "@/lib/status-progression";
import { payoutWindow } from "@/lib/payouts/payout-window";
import type { PayoutRejection } from "@/lib/fixtures/terra-fixtures";

const STORAGE_KEY = "pfaas:trader:payoutRequests";

/* Demo progression timings (hours from requestedAt) */
const PROCESSING_AFTER_HOURS = 2;
const PAID_AFTER_HOURS = 48;

/* Stored request type with partial approval fields */
export type StoredPayoutRequest = {
  id: string;
  reference: string;
  accountId: string;
  accountLogin: string;
  amount: number;
  // R12 GAP-T2 — explicit currency on the money model (phase 1: stamped
  // everywhere, no FX conversion yet). Defaults to "USD" for rows that
  // predate the field.
  currency: string;
  methodId: string;
  method: string;
  feeAmount: number;
  requestedAt: string;
  // R9 W2 UC-T4 — the firm's promise, stamped at submission from the
  // payout schedule (deriveExpectedAt's payment horizon, i.e. requestedAt
  // + PAID_AFTER_HOURS). Older rows without the field derive it on read.
  promisedBy?: string;
  // R12 GAP-T4 — reference continuity for a retry: the reference of the
  // failed request this one replaces.
  retryOf?: string;
  // base status is "submitted" in storage; R4-05 may flip it to the
  // "cancelled" tombstone; effective status is derived on read
  status:
    | "submitted"
    | "cancelled"
    | "failed";
  // R12 GAP-T6 — partial approval fields
  /** The original requested amount */
  originalAmount: number;
  /** The amount after partial approval (reduced amount) */
  reducedAmount?: number;
  /** The delta between originalAmount and reducedAmount (positive = reduced) */
  amountDelta: number;
  /** R12 GAP-T6 — true if this request has been partially approved */
  partialApproved?: boolean;
  /** R12 GAP-T6 — when partial approval was granted (ISO string) */
  partialApprovedAt?: string;
};

/* Display request type with partial approval fields */
export type DisplayPayout = {
  id: string;
  reference: string;
  account: string;
  accountLogin: string;
  amount: number;
  /** R12 GAP-T2 — ISO 4217 code every money surface renders with. */
  currency: string;
  methodId?: string;
  method: string;
  /** R12 GAP-T4 — `failed` is a rail outcome (bounced transfer, PSP
   *  decline), distinct from `rejected`, which is a firm decision. */
  status: "submitted" | "processing" | "paid" | "rejected" | "cancelled" | "failed";
  requestedAt: string;
  expectedAt: string;
  /** R9 W2 — promise ISO (stored at submission, derived for old rows). */
  promisedBy?: string;
  /** R9 W2 — when money actually landed (admin event or wall clock). */
  paidAt?: string | null;
  /** R12 GAP-T4 — when the rail failed (admin `payout.failed` event). */
  failedAt?: string | null;
  rejection: PayoutRejection | null;
  /** true for requests created by the trader in this session/store */
  isUserRequest?: boolean;
  /** R12 GAP-T6 — partial approval fields */
  /** The original requested amount */
  originalAmount?: number;
  /** The amount after partial approval (reduced amount) */
  reducedAmount?: number;
  /** The delta between originalAmount and reducedAmount (positive = reduced) */
  amountDelta?: number;
  /** R12 GAP-T6 — true if this request has been partially approved */
  partialApproved?: boolean;
  /** R12 GAP-T6 — when partial approval was granted (ISO string) */
  partialApprovedAt?: string;
};

function readRawRequests(): StoredPayoutRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredPayoutRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRequests(requests: StoredPayoutRequest[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch {
    /* storage unavailable */
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
function getSnapshot(): string {
  return JSON.stringify(readRawRequests());
}
function getServerSnapshot(): string {
  return "[]";
}

function deriveStatus(requestedAt: string): "submitted" | "processing" | "paid" {
  const ms = new Date(requestedAt).getTime();
  if (!Number.isFinite(ms)) return "submitted";
  const elapsedHours = (Date.now() - ms) / (1000 * 60 * 60);
  if (elapsedHours >= PAID_AFTER_HOURS) return "paid";
  if (elapsedHours >= PROCESSING_AFTER_HOURS) return "processing";
  return "submitted";
}

function deriveExpectedAt(requestedAt: string, status: DisplayPayout["status"]): string {
  const ms = new Date(requestedAt).getTime();
  if (!Number.isFinite(ms)) return requestedAt;
  if (status === "paid") {
    return new Date(ms + PAID_AFTER_HOURS * 60 * 60 * 1000).toISOString();
  }
  if (status === "processing") {
    return new Date(ms + PAID_AFTER_HOURS * 60 * 60 * 1000).toISOString();
  }
  return new Date(ms + PROCESSING_AFTER_HOURS * 60 * 60 * 1000).toISOString();
}

/**
 * R9 W2 UC-T4 — the promise stamped at submission (payment horizon:
 * requestedAt + PAID_AFTER_HOURS, i.e. the `deriveExpectedAt` "processing"
 * branch). Rows written before W2 derive the same value on read, so old
 * requests get an honest clock without a storage migration.
 */
export function promisedByOf(req: Pick<StoredPayoutRequest, "requestedAt" | "promisedBy">): string {
  if (req.promisedBy) return req.promisedBy;
  return deriveExpectedAt(req.requestedAt, "processing");
}

/**
 * R3-01 — the firm's decision, read from the shared lifecycle log.
 * 
 * prop-admin's payout queue emits `payout.*` under the request's
 * reference (R2-W3-01 publish point; intake rows carry the same
 * reference), so the trader's own request can see the real verdict
 * instead of guessing from elapsed time. Returns the LATEST decision
 * event, or null when nobody has decided yet (the wall-clock fallback
 * in `deriveStatus` then applies, as before).
 */
function adminDecision(
  req: StoredPayoutRequest,
):
  | { status: "processing" | "paid" | "rejected" | "failed"; reason: string | null; at: string }
  | null {
  const decided = readLifecycleLog().filter(
    (e) =>
      (e.entity.kind === "payout" && (e.entity.id === req.reference || e.entity.id === req.id)) &&
      (e.name === "payout.approved" ||
        e.name === "payout.processing" ||
        e.name === "payout.paid" ||
        e.name === "payout.rejected" ||
        // R12 GAP-T4 — the rail outcome (bounced transfer / PSP decline)
        // the operator emits from the payouts exception queue; prop-admin
        // writes it under the same entity id (the request reference).
        e.name === "payout.failed"),
  );
  const latest = decided[decided.length - 1];
  if (!latest) return null;
  const reason = typeof latest.payload?.reason === "string" && latest.payload.reason.trim()
    ? latest.payload.reason
    : null;
  // "approved" means the firm signed off — money is on its way, so the
  // trader sees the same "processing" the wall-clock path would show.
  const status =
    latest.name === "payout.rejected"
      ? "rejected"
      : latest.name === "payout.failed"
        ? "failed"
        : latest.name === "payout.paid"
          ? "paid"
          : "processing";
  return { status, reason, at: latest.at };
}

export function toDisplayPayout(req: StoredPayoutRequest): DisplayPayout {
  // R4-05: a cancelled tombstone always displays as cancelled — no admin
  // decision or wall-clock derivation can revive it.
  if (req.status === "cancelled") {
    return {
      id: req.id,
      reference: req.reference,
      account: req.accountId,
      accountLogin: req.accountLogin,
      amount: req.amount,
      currency: req.currency ?? "USD",
      methodId: req.methodId,
      method: req.method,
      status: "cancelled",
      requestedAt: req.requestedAt,
      expectedAt: req.requestedAt,
      promisedBy: promisedByOf(req),
      paidAt: null,
      failedAt: null,
      rejection: null,
      isUserRequest: true,
      originalAmount: req.amount,
      reducedAmount: req.reducedAmount,
      amountDelta: req.amountDelta,
      partialApproved: req.partialApproved,
      partialApprovedAt: req.partialApprovedAt,
    };
  }
  // R3-01: an admin decision overrides the time-based derivation — a
  // rejected request must stop displaying "processing → paid".
  const admin = adminDecision(req);
  const status: DisplayPayout["status"] = admin ? admin.status : deriveStatus(req.requestedAt);
  const rejection: PayoutRejection | null =
    admin && admin.status === "rejected"
      ? {
          at: admin.at,
          code: "REJECTED_BY_FIRM",
          summary:
            admin.reason ??
            "This request was reviewed by the firm and rejected. See the reason above or contact support for details.",
          checks: [],
          nextSteps: [
            "Address the reason above, then submit a new request when you are eligible again.",
            "Contact support if you believe this decision was made in error.",
          ],
        }
      : null;
  // R9 W2 — when the money actually landed: the admin `payout.paid`
  // event timestamp when the firm decided, else the wall-clock payment
  // horizon the demo progression uses. Null while in flight.
  const paidAt =
    status === "paid"
      ? admin
        ? admin.at
        : new Date(new Date(req.requestedAt).getTime() + PAID_AFTER_HOURS * 60 * 60 * 1000).toISOString()
      : null;
  // R12 GAP-T4 — when the rail failed: the operator's `payout.failed`
  // event timestamp (admin path only — wall-clock never invents a fail).
  const failedAt = status === "failed" && admin ? admin.at : null;
  return {
    id: req.id,
    reference: req.reference,
    account: req.accountId,
    accountLogin: req.accountLogin,
    amount: req.amount,
    currency: req.currency ?? "USD",
    methodId: req.methodId,
    method: req.method,
    status,
    requestedAt: req.requestedAt,
    expectedAt: deriveExpectedAt(req.requestedAt, status),
    promisedBy: promisedByOf(req),
    paidAt,
    failedAt,
    rejection,
    isUserRequest: true,
    originalAmount: req.amount,
    reducedAmount: req.reducedAmount,
    amountDelta: req.amountDelta,
    partialApproved: req.partialApproved,
    partialApprovedAt: req.partialApprovedAt,
  };
}

/** Append a submitted request and return it. */
export function addPayoutRequest(input: {
  accountId: string;
  amount: number;
  methodId: string;
  methodName: string;
  feeAmount: number;
  /** Profit split of the requesting account — carried to the intake queue. */
  profitSplit?: number;
  /** R12 GAP-T2 — explicit currency; defaults to USD (no FX yet). */
  currency?: string;
  /** R12 GAP-T4 — reference of the failed request this one retries. */
  retryOf?: string;
  /** R12 GAP-T6 — auto-payout schedule preference */
  autoPayoutSchedule?: "none" | "biweekly" | "monthly" | "quarterly";
}): StoredPayoutRequest {
  const acc = terraAccounts.find((a) => a.id === input.accountId);
  const now = new Date();
  const stamp = now.getTime().toString(36).toUpperCase().slice(-6);
  const requestedAt = now.toISOString();
  const currency = input.currency ?? "USD";
  // R9 W2 — the promise is stamped at submission from the payout
  // schedule (payment horizon) and travels to the operator queue so
  // both sides count down the same deadline.
  const promisedBy = deriveExpectedAt(requestedAt, "processing");
  const req: StoredPayoutRequest = {
    id: `po-req-${now.getTime().toString(36)}`,
    reference: `PO-R${stamp}`,
    accountId: input.accountId,
    accountLogin: acc?.login ?? input.accountId,
    amount: input.amount,
    currency,
    methodId: input.methodId,
    method: input.methodName,
    feeAmount: input.feeAmount,
    requestedAt,
    promisedBy,
    retryOf: input.retryOf,
    status: "submitted",
    // R12 GAP-T6 — partial approval fields default to original amount,
    // no partial approval yet
    originalAmount: input.amount,
    reducedAmount: undefined,
    amountDelta: 0,
    partialApproved: false,
  };
  writeRequests([req, ...readRawRequests()]);
  // R9 W2 fraud signals (UC-O5) — the intake row carries what the
  // prop-admin payout-fraud-store needs at intake time: the method
  // fingerprint (hash of the method detail, e.g. IBAN tail) for
  // cross-trader reuse, the program for rapid-cycle detection, and the
  // promise for the operator SLA panel.
  const methodDetail = readPayoutMethods().find((m) => m.id === input.methodId)?.detail ?? "";
  // R2-W3-01 publish point — prop-admin's payout queue and pendings hub
  // pick this up from the shared log (demo transport, same origin).
  emitLifecycle({
    entity: { kind: "payout", id: req.id },
    name: "payout.requested",
    actor: "trader",
    key: req.id,
    payload: {
      reference: req.reference,
      amount: req.amount,
      feeAmount: req.feeAmount,
      accountId: req.accountId,
      accountLogin: req.accountLogin,
      method: req.method,
      methodId: req.methodId,
      methodFingerprint: methodDetail ? `fp-${hashStr(methodDetail).toString(36)}` : null,
      program: acc?.program ?? null,
      promisedBy,
      currency, // R12 GAP-T2 — stamped from the request's explicit currency
      retryOf: req.retryOf ?? null,
      profitSplit: input.profitSplit ?? null,
      source: "trader-app",
    },
  });
  return req;
}

export function readPayoutRequests(): DisplayPayout[] {
  return readRawRequests().map(toDisplayPayout);
}

export function findPayoutRequestById(id: string | null): DisplayPayout | null {
  if (!id) return null;
  const found = readRawRequests().find((r) => r.id === id);
  return found ? toDisplayPayout(found) : null;
}

export function cancelPayoutRequest(id: string): boolean {
  if (!id) return false;
  const requests = readRawRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  const req = requests[idx];
  // Only allow cancel while the request is still in "submitted" state
  // (audit #7: pending payout can't be cancelled once past submitted)
  if (req.status !== "submitted") return false;
  // Flip status to "cancelled" instead of removing — tombstone survives reload
  requests[idx] = { ...req, status: "cancelled" };
  // Emit cancelled lifecycle event
  emitLifecycle({
    entity: { kind: "payout", id: req.id },
    name: "payout.cancelled",
    actor: "trader",
    key: `cancelled:${req.id}`,
    payload: {
      reference: req.reference,
      amount: req.amount,
      method: req.method,
      requestedAt: req.requestedAt,
    },
  });
  writeRequests(requests);
  // R4-05: inbox receipt for the cancellation (survives reload via pushedMessages)
  pushInboxMessage({
    id: `inbox-cancelled-${req.id}`,
    subject: "Payout cancelled — withdrawn by you",
    body:
      `Your payout request ${req.reference} for ${req.amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} was cancelled. No funds were moved. You can submit a new request when ready.`,
    category: "Payouts",
    sender: "Payouts Team",
    at: new Date().toISOString(),
    read: false,
    actionType: undefined,
  });
  notify();
  return true;
}

export function usePayoutRequests(): DisplayPayout[] {
  // R3-01: subscribe to the shared lifecycle log so a decision made in
  // prop-admin (same-origin demo transport) re-renders every consumer
  // live instead of waiting for the next reload.
  useLifecycleLog();
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (JSON.parse(raw) as StoredPayoutRequest[]).map(toDisplayPayout);
}

/* ------------------------------------------------------------------ */
/* R9 W2 UC-T4 — on-time honesty stats (rolling window, pure)          */
/* ------------------------------------------------------------------ */

/** Payout SLA Row - tracks requestedAt, promisedBy, and status */
export type PayoutSlaRow = {
  requestedAt: string;
  /** Promise ISO — request rows use `promisedBy`, fixtures their `expectedAt`. */
  promisedBy: string;
  status: DisplayPayout["status"];
  paidAt?: string | null;
};

/** Payout SLA Statistics - tracks paid rows, on-time %, avg hours, etc. */
export type PayoutSlaStats = {
  /** Paid rows inside the window (the denominator for on-time %). */
  paid: number;
  /** % of paid rows landed at or before the promise — null with no data. */
  onTimePct: number | null;
  /** Mean requested→paid hours across paid rows — null with no data. */
  avgHours: number | null;
  /** Paid rows that landed after the promise. */
  late: number;
  rejected: number;
  windowDays: 90;
};

/**
 * Rolling-window honesty figures computed from actual history — only
 * rows that moved money (paid) score on-time/late; rejected/cancelled
 * never did, so they are counted separately. `null` percentages keep the
 * UI honest when there is nothing to measure yet.
 */
export function computePayoutSlaStats(
  rows: readonly PayoutSlaRow[],
  now: number = Date.now(),
): PayoutSlaStats {
  const cutoff = now - 90 * 24 * 60 * 60 * 1000;
  const inWindow = rows.filter((r) => {
    const ms = new Date(r.requestedAt).getTime();
    return Number.isFinite(ms) && ms >= cutoff;
  });
  const paidRows = inWindow.filter(
    (r) => r.status === "paid" && r.paidAt && Number.isFinite(new Date(r.paidAt).getTime()),
  );
  let late = 0;
  let hoursTotal = 0;
  for (const r of paidRows) {
    const paidMs = new Date(r.paidAt as string).getTime();
    const promisedMs = new Date(r.promisedBy).getTime();
    hoursTotal += (paidMs - new Date(r.requestedAt).getTime()) / (60 * 60 * 1000);
    if (Number.isFinite(promisedMs) && paidMs > promisedMs) late += 1;
  }
  const paidCount = paidRows.length;
  return {
    paid: paidCount,
    onTimePct: paidCount ? Math.round(((paidCount - late) / paidCount) * 100) : null,
    avgHours: paidCount ? Math.round((hoursTotal / paidCount) * 10) / 10 : null,
    late,
    rejected: inWindow.filter((r) => r.status === "rejected").length,
    windowDays: 90,
  };
}

/**
 * Project the next payout date and amount based on current payout criteria.
 * @param accountId Account ID for the trader
 * @returns Object with projected payout info or null if not eligible
 */
export function projectPayoutProjection(accountId: string): {
  eligible: boolean;
  projectedAmount: number;
  projectedDate: string;
  nextWindowStart: string;
  currentWithdrawable: number;
} | null {
  const account = terraAccounts.find((a) => a.id === accountId);
  if (!account) return null;

  const entitlement = payoutEntitlement(accountId);
  const { isFunded, eligible, withdrawable, splitPct } = entitlement;

  if (!isFunded || !eligible || withdrawable === 0) {
    return null;
  }

  // Calculate next window dates
  const window = payoutWindow();
  const windowStart = window.opensAt.toISOString();
  const windowEnd = window.closesAt.toISOString();

  // Project based on current profit and split
  const projectedAmount = Math.round(entitlement.netProfit * (splitPct / 100) * 100) / 100;

  // Project to next window start
  const projectedDate = new Date(windowStart).toISOString();

  return {
    eligible: true,
    projectedAmount,
    projectedDate,
    nextWindowStart: windowStart,
    currentWithdrawable: withdrawable,
  };
}