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
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";
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
  // base status is always "submitted" in storage; effective status is derived
  status: "submitted";
};

export type DisplayPayout = {
  id: string;
  reference: string;
  account: string;
  accountLogin: string;
  amount: number;
  methodId?: string;
  method: string;
  status: "submitted" | "processing" | "paid" | "rejected";
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

export function toDisplayPayout(req: StoredPayoutRequest): DisplayPayout {
  const status = deriveStatus(req.requestedAt);
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
    rejection: null,
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

export function usePayoutRequests(): DisplayPayout[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (JSON.parse(raw) as StoredPayoutRequest[]).map(toDisplayPayout);
}
