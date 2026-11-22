"use client";

/**
 * Transaction entity store — P0-3.
 *
 * Persisted cross-tenant transaction ledger under
 * pfaas:platform-admin:transactions. Real create/refund/retry mutations
 * with audit rows. Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:transactions";

export type TransactionType = "payout" | "refund" | "revenue" | "chargeback";

export type TransactionStatus = "completed" | "processing" | "pending" | "failed";

export interface Transaction {
  id: string;
  tenant: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  date: string;
  fee: number;
  method: string;
}

/** Seed fixtures — deterministic transaction ledger per cycle. */
const SEED_TRANSACTIONS: Transaction[] = [
  { id: "tx-001", tenant: "Alpha Capital", type: "payout", amount: 42500, currency: "USD", status: "completed", date: "2026-10-08T14:30:00Z", fee: 127.50, method: "wire" },
  { id: "tx-002", tenant: "Beta Trading", type: "payout", amount: 28900, currency: "USD", status: "processing", date: "2026-10-08T13:15:00Z", fee: 86.70, method: "wire" },
  { id: "tx-003", tenant: "Gamma Futures", type: "refund", amount: 1500, currency: "USD", status: "completed", date: "2026-10-08T11:45:00Z", fee: 0, method: "credit" },
  { id: "tx-004", tenant: "Alpha Capital", type: "payout", amount: 56000, currency: "USD", status: "pending", date: "2026-10-08T10:00:00Z", fee: 168, method: "wire" },
  { id: "tx-005", tenant: "Alpha Capital", type: "revenue", amount: 125000, currency: "USD", status: "completed", date: "2026-10-08T09:30:00Z", fee: 0, method: "platform" },
  { id: "tx-006", tenant: "Beta Trading", type: "payout", amount: 18750, currency: "USD", status: "completed", date: "2026-10-07T16:45:00Z", fee: 56.25, method: "wire" },
  { id: "tx-007", tenant: "Gamma Futures", type: "chargeback", amount: 3200, currency: "USD", status: "processing", date: "2026-10-07T15:20:00Z", fee: 96, method: "credit" },
  { id: "tx-008", tenant: "Beta Trading", type: "payout", amount: 34200, currency: "USD", status: "completed", date: "2026-10-07T14:00:00Z", fee: 102.60, method: "wire" },
  { id: "tx-009", tenant: "Gamma Futures", type: "revenue", amount: 89000, currency: "USD", status: "completed", date: "2026-10-07T11:00:00Z", fee: 0, method: "platform" },
  { id: "tx-010", tenant: "Alpha Capital", type: "refund", amount: 2500, currency: "USD", status: "completed", date: "2026-10-07T09:15:00Z", fee: 0, method: "credit" },
  { id: "tx-011", tenant: "Alpha Capital", type: "payout", amount: 67800, currency: "USD", status: "processing", date: "2026-10-07T08:30:00Z", fee: 203.40, method: "wire" },
  { id: "tx-012", tenant: "Beta Trading", type: "payout", amount: 45300, currency: "USD", status: "pending", date: "2026-10-06T17:00:00Z", fee: 135.90, method: "wire" },
];

function readSeedList(list: unknown): Transaction[] {
  if (!Array.isArray(list)) return SEED_TRANSACTIONS;
  return list.filter(
    (t): t is Transaction =>
      !!t &&
      typeof t === "object" &&
      typeof (t as Transaction).id === "string" &&
      typeof (t as Transaction).tenant === "string",
  );
}

function readRaw(): Transaction[] {
  if (typeof window === "undefined") return SEED_TRANSACTIONS;
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY ?? "null") ?? "[]",
    );
    const persisted = readSeedList(stored);
    const byId = new Map<string, Transaction>();
    for (const s of SEED_TRANSACTIONS) byId.set(s.id, { ...s });
    for (const p of persisted) byId.set(p.id, { ...byId.get(p.id) ?? {}, ...p });
    return [...byId.values()];
  } catch {
    return SEED_TRANSACTIONS;
  }
}

function writeRaw(next: Transaction[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
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
  return JSON.stringify(readRaw());
}
function getServerSnapshot(): string {
  return JSON.stringify(SEED_TRANSACTIONS);
}

export function readTransactions(): Transaction[] {
  return readRaw();
}

export function useTransactions(): Transaction[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as Transaction[];
}

export function getTransaction(id: string): Transaction | undefined {
  return readRaw().find((t) => t.id === id);
}

/** Create a new transaction entry. */
export function createTransaction(
  tx: Omit<Transaction, "id">,
): { title: string; description: string } {
  const transactions = readRaw();
  const nextTx: Transaction = {
    ...tx,
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
  const next = [...transactions, nextTx];
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "transactions.created",
    target: tx.tenant,
    severity: "info",
    detail: `Transaction ${nextTx.id} created for ${tx.tenant}: ${tx.type} ${tx.currency} ${tx.amount}.`,
  });
  return {
    title: "Transaction created",
    description: `${tx.type} of ${tx.currency} ${tx.amount} recorded for ${tx.tenant}.`,
  };
}

/** Retry a pending or failed transaction. */
export function retryTransaction(id: string): { title: string; description: string } {
  const transactions = readRaw();
  const idx = transactions.findIndex((t) => t.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Transaction not found." };
  }
  const next = [...transactions];
  next[idx] = { ...next[idx], status: "processing" };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "transactions.retried",
    target: next[idx].tenant,
    severity: "info",
    detail: `Transaction ${next[idx].id} retried (status → processing).`,
  });
  return {
    title: "Transaction retried",
    description: `Transaction ${next[idx].id} queued for retry.`,
  };
}

/** Refund a transaction (money-moving action — requires reason). */
export function refundTransaction(id: string, reason: string): { title: string; description: string } {
  const transactions = readRaw();
  const idx = transactions.findIndex((t) => t.id === id);
  if (idx < 0) {
    return { title: "(Demo)", description: "Transaction not found." };
  }
  const next = [...transactions];
  next[idx] = { ...next[idx], status: "refunded" as TransactionStatus };
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "transactions.refunded",
    target: next[idx].tenant,
    severity: "warning",
    detail: `Transaction ${next[idx].id} refunded. Reason: ${reason}.`,
  });
  return {
    title: "Transaction refunded",
    description: `Refund recorded for ${next[idx].tenant} (${next[idx].id}): ${next[idx].currency} ${next[idx].amount}.`,
  };
}
