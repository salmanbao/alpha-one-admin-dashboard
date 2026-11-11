"use client";

/**
 * Purchase records — R4-09 (AUDIT-R4 §2.5 / R5-H4).
 *
 * Checkout writes the order the moment payment succeeds; purchase
 * history and the invoice page read it. This is the one write path for
 * trader-side purchases (rule R5) — the fixture rows are gone.
 *
 * Refund status is NOT written here: prop-admin owns the refund decision
 * and publishes `purchase.refunded` on the shared lifecycle bus, so
 * `usePurchaseOrders()` overlays that event onto the records (one writer
 * per fact — the event owns "refunded", this store owns the order).
 */

import { useSyncExternalStore } from "react";
import { useLifecycleLog, readLifecycleLog } from "@pfaas/lifecycle";

export interface PurchaseOrder {
  orderId: string;
  /** Product label, e.g. "Terra Pro $100K" — what the operator assigns. */
  program: string;
  challengeId: string | null;
  amount: number;
  currency: string;
  /** Payment method display label, e.g. "Credit / Debit Card". */
  method: string;
  /** Who bought it (session display name) — carried for operator rows. */
  applicantName: string | null;
  status: "completed";
  createdAt: string;
}

const STORAGE_KEY = "pfaas:trader:purchases";
const SERVER_SNAPSHOT = "[]";

function isValidOrder(value: unknown): value is PurchaseOrder {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.orderId === "string" &&
    typeof o.program === "string" &&
    typeof o.amount === "number" &&
    typeof o.method === "string" &&
    typeof o.createdAt === "string"
  );
}

function parseOrders(raw: string | null): PurchaseOrder[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidOrder);
  } catch {
    return [];
  }
}

export function readPurchases(): PurchaseOrder[] {
  try {
    return parseOrders(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function readPurchase(orderId: string): PurchaseOrder | undefined {
  return readPurchases().find((p) => p.orderId === orderId);
}

/** Record the completed order at checkout (idempotent per orderId). */
export function recordPurchase(
  order: Omit<PurchaseOrder, "status" | "createdAt">,
): PurchaseOrder | null {
  const record: PurchaseOrder = {
    ...order,
    status: "completed",
    createdAt: new Date().toISOString(),
  };
  try {
    const orders = readPurchases();
    if (!orders.some((o) => o.orderId === record.orderId)) {
      orders.unshift(record);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    }
    emitOrders();
    return record;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Reactive plumbing (house pattern — competitions-store)              */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let snapshot: string | undefined;

function emitOrders(): void {
  snapshot = undefined;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === null || e.key === STORAGE_KEY) emitOrders();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string {
  if (snapshot === undefined) snapshot = JSON.stringify(readPurchases());
  return snapshot;
}

const getServerSnapshot = (): string => SERVER_SNAPSHOT;

/** Orders as recorded by checkout (no refund overlay). */
export function usePurchases(): PurchaseOrder[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as PurchaseOrder[];
}

/* ------------------------------------------------------------------ */
/* Refund overlay — `purchase.refunded` on the shared log (R4-09)      */
/* ------------------------------------------------------------------ */

/** Order ids refunded by the firm (prop-admin actor), with the reason. */
export function readRefunds(): Map<string, { at: string; reason: string }> {
  const out = new Map<string, { at: string; reason: string }>();
  for (const e of readLifecycleLog()) {
    if (e.name !== "purchase.refunded") continue;
    const orderId = String(e.payload?.orderId ?? e.entity.id);
    out.set(orderId, {
      at: e.at,
      reason: typeof e.payload?.reason === "string" ? e.payload.reason : "",
    });
  }
  return out;
}

export type PurchaseOrderView = PurchaseOrder & {
  refunded: boolean;
  refundedAt?: string;
  refundReason?: string;
};

/** Orders with the refund decision overlaid — what the history and
 *  invoice pages render. */
export function usePurchaseOrders(): PurchaseOrderView[] {
  const orders = usePurchases();
  const log = useLifecycleLog();
  const refunds = new Map<string, { at: string; reason: string }>();
  for (const e of log) {
    if (e.name !== "purchase.refunded") continue;
    refunds.set(String(e.payload?.orderId ?? e.entity.id), {
      at: e.at,
      reason: typeof e.payload?.reason === "string" ? e.payload.reason : "",
    });
  }
  return orders.map((o) => {
    const r = refunds.get(o.orderId);
    return r
      ? { ...o, refunded: true, refundedAt: r.at, refundReason: r.reason }
      : { ...o, refunded: false };
  });
}
