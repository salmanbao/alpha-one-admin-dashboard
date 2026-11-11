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
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";
import { pushInboxMessage } from "@/lib/inbox/inbox-store";
import { getPayoutStage } from "@/lib/status-progression";
import type { PayoutRejection } from "@/lib/fixtures/terra-fixtures";

const STORAGE_KEY = "pfaas:trader:payoutRequests";

// Demo progression timings (hours from requestedAt)
const PROCESSING_AFTER_HOURS = 2;
const PAID_AFTER_HOURS = 48;

export type StoredPayoutRequest = {
  id: string;
  reference: string;
  accountId: string;
  accountLogin: string;
  amount: number;
  methodId: string;
  method: string;
  feeAmount: number;
  requestedAt: string;
  // base status is "submitted" in storage; R4-05 may flip it to the
  // "cancelled" tombstone; effective status is derived on read
  status: "submitted" | "cancelled";
};

export type DisplayPayout = {
  id: string;
  reference: string;
  account: string;
  accountLogin: string;
  amount: number;
  methodId?: string;
  method: string;
  status: "submitted" | "processing" | "paid" | "rejected" | "cancelled";
  requestedAt: string;
  expectedAt: string;
  rejection: PayoutRejection | null;
  /** true for requests created by the trader in this session/store */
  isUserRequest?: boolean;
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
): { status: "processing" | "paid" | "rejected"; reason: string | null; at: string } | null {
  const decided = readLifecycleLog().filter(
    (e) =>
      (e.entity.kind === "payout" && (e.entity.id === req.reference || e.entity.id === req.id)) &&
      (e.name === "payout.approved" ||
        e.name === "payout.processing" ||
        e.name === "payout.paid" ||
        e.name === "payout.rejected"),
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
      methodId: req.methodId,
      method: req.method,
      status: "cancelled",
      requestedAt: req.requestedAt,
      expectedAt: req.requestedAt,
      rejection: null,
      isUserRequest: true,
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
  return {
    id: req.id,
    reference: req.reference,
    account: req.accountId,
    accountLogin: req.accountLogin,
    amount: req.amount,
    methodId: req.methodId,
    method: req.method,
    status,
    requestedAt: req.requestedAt,
    expectedAt: deriveExpectedAt(req.requestedAt, status),
    rejection,
    isUserRequest: true,
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
}): StoredPayoutRequest {
  const acc = terraAccounts.find((a) => a.id === input.accountId);
  const now = new Date();
  const stamp = now.getTime().toString(36).toUpperCase().slice(-6);
  const req: StoredPayoutRequest = {
    id: `po-req-${now.getTime().toString(36)}`,
    reference: `PO-R${stamp}`,
    accountId: input.accountId,
    accountLogin: acc?.login ?? input.accountId,
    amount: input.amount,
    methodId: input.methodId,
    method: input.methodName,
    feeAmount: input.feeAmount,
    requestedAt: now.toISOString(),
    status: "submitted",
  };
  writeRequests([req, ...readRawRequests()]);
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
      currency: "USD", // trader money surfaces render in USD (formatMoney default)
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
