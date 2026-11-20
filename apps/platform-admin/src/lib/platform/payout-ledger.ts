"use client";

/**
 * Payout Money-Movement Ledger — R10 PS-08.
 *
 * Append-only journal of payout entries: request, hold, release, approve,
 * execute, fail, retry, clawback — each with actor, timestamp, reason and
 * amount, in payout currency. Complements R9 B-20 (billing-side edit
 * ledger) and becomes the reconciliation source for PS-04 and the evidence
 * base for PU-03.
 *
 * Every payout-store mutation writes a matching ledger entry. The ledger is
 * itself append-only: entries are never edited or deleted, only added.
 * Persists under pfaas:platform-admin:payout-ledger.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";

const STORAGE_KEY = "pfaas:platform-admin:payout-ledger";

/** Ledger entry type — one per payout money-movement event. */
export type PayoutLedgerEntryType =
  | "request"
  | "hold"
  | "release"
  | "approve"
  | "execute"
  | "fail"
  | "retry"
  | "clawback"
  | "reissue"
  | "evidence"
  | "note"
  | "beneficiary";

/** A single append-only ledger entry. */
export interface PayoutLedgerEntry {
  id: string;
  payoutId: string;
  reference: string;
  tenantId: string;
  traderName: string;
  amount: number;
  currency: string;
  type: PayoutLedgerEntryType;
  fromStatus?: string;
  toStatus?: string;
  actor: string;
  reason: string;
  at: string;
  /** Signed amount — negative for clawbacks/reversals. */
  signedAmount: number;
}

/** Seed ledger entries mirroring the initial payout state. */
function seedLedger(): PayoutLedgerEntry[] {
  // The ledger starts empty; entries are written as payouts are acted on.
  return [];
}

function isValidEntry(v: unknown): v is PayoutLedgerEntry {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as PayoutLedgerEntry).id === "string" &&
    typeof (v as PayoutLedgerEntry).payoutId === "string"
  );
}

function readRaw(): PayoutLedgerEntry[] {
  if (typeof window === "undefined") return seedLedger();
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    const persisted: PayoutLedgerEntry[] = Array.isArray(stored)
      ? stored.filter(isValidEntry)
      : [];
    return persisted;
  } catch {
    return seedLedger();
  }
}

function writeRaw(next: PayoutLedgerEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
  notify();
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((cb) => cb());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function getSnapshot() {
  return JSON.stringify(readRaw());
}
function getServerSnapshot() {
  return JSON.stringify(seedLedger());
}

/** Append an entry to the ledger. */
function appendEntry(entry: Omit<PayoutLedgerEntry, "id">): PayoutLedgerEntry {
  const raw = readRaw();
  const entryWithId: PayoutLedgerEntry = {
    ...entry,
    id: `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
  const next = [entryWithId, ...raw]; // newest first
  writeRaw(next);
  return entryWithId;
}

/** Write a payout money-movement entry to the ledger. */
export function writeLedgerEntry({
  payoutId,
  reference,
  tenantId,
  traderName,
  amount,
  currency,
  type,
  actor,
  reason,
  fromStatus,
  toStatus,
  signedAmount,
}: {
  payoutId: string;
  reference: string;
  tenantId: string;
  traderName: string;
  amount: number;
  currency: string;
  type: PayoutLedgerEntryType;
  actor: string;
  reason: string;
  fromStatus?: string;
  toStatus?: string;
  signedAmount: number;
}): PayoutLedgerEntry {
  const entry = appendEntry({
    payoutId,
    reference,
    tenantId,
    traderName,
    amount,
    currency,
    type,
    fromStatus,
    toStatus,
    actor,
    reason,
    at: new Date().toISOString(),
    signedAmount,
  });

  recordAudit({
    actor,
    action: `payout.ledger.${type}`,
    target: payoutId,
    tenantId,
    severity: type === "clawback" || type === "fail" ? "critical" : "info",
    detail: `Ledger: ${type} payout ${reference} — ${signedAmount >= 0 ? "+" : ""}${signedAmount} ${currency} — ${reason}`,
  });

  return entry;
}

/** Read all ledger entries (newest first). */
export function readLedger(): PayoutLedgerEntry[] {
  return readRaw();
}

/** Read ledger entries for a specific payout. */
export function readLedgerForPayout(payoutId: string): PayoutLedgerEntry[] {
  return readRaw().filter((e) => e.payoutId === payoutId);
}

/** Read ledger entries for a specific tenant. */
export function readLedgerForTenant(tenantId: string): PayoutLedgerEntry[] {
  return readRaw().filter((e) => e.tenantId === tenantId);
}

/** React hook for all ledger entries. */
export function useLedger(): PayoutLedgerEntry[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as PayoutLedgerEntry[];
}

/** React hook for tenant-scoped ledger entries. */
export function useLedgerForTenant(tenantId: string): PayoutLedgerEntry[] {
  return useLedger().filter((e) => e.tenantId === tenantId);
}

/** Money-denominated ledger totals — per currency, never summed across currencies. */
export function getLedgerTotals(tenantId?: string): {
  byCurrency: Record<string, { in: number; out: number; net: number; count: number }>;
  totalEntries: number;
} {
  const entries = tenantId ? readLedgerForTenant(tenantId) : readLedger();
  const byCurrency: Record<string, { in: number; out: number; net: number; count: number }> = {};

  for (const e of entries) {
    if (!byCurrency[e.currency]) {
      byCurrency[e.currency] = { in: 0, out: 0, net: 0, count: 0 };
    }
    const bucket = byCurrency[e.currency];
    bucket.count++;
    if (e.signedAmount > 0) {
      bucket.in += e.signedAmount;
    } else {
      bucket.out += Math.abs(e.signedAmount);
    }
    bucket.net += e.signedAmount;
  }

  return { byCurrency, totalEntries: entries.length };
}

/** Get tenant name for display. */
export function getLedgerTenantName(tenantId: string): string {
  const tenant = allTenants.find((t) => t.id === tenantId);
  return tenant ? tenant.name : tenantId;
}
