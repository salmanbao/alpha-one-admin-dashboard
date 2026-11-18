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

import { useEffect, useSyncExternalStore } from "react";
import { emitLifecycle, useLifecycleLog, readLifecycleLog } from "@pfaas/lifecycle";
import { terraAccounts, terraPayouts } from "@/lib/fixtures/terra-fixtures";
import { readPayoutRequests } from "@/lib/payouts/payout-requests-store";

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
  /**
   * R9 W2 UC-T6 — fee-back ledger: migrated onto every row on read
   * (existing rows get `pending`), flipped to `refunded` when a paid
   * payout settles this program's fee. Store-owned (persisted under
   * pfaas:trader:purchases), emitted once with a dedupe key.
   */
  feeRefund?: { status: "pending" | "refunded"; payoutId?: string; refundedAt?: string };
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
    // R9 W2 read-migration — rows written before the fee-back ledger
    // existed start as "pending"; the flip persists on the next write.
    return parsed.filter(isValidOrder).map((o) => ({
      ...o,
      feeRefund: o.feeRefund ?? { status: "pending" as const },
    }));
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

/* ------------------------------------------------------------------ */
/* Fee-refund ledger — R9 W2 UC-T6 ("challenge fee refunded with the
/* first payout on funded accounts", terra-fixtures payoutEntitlement)  */
/* ------------------------------------------------------------------ */

/**
 * Flip `feeRefund` to "refunded" on every purchase whose program matches
 * a paid payout's account program (the fee-back promise: the challenge
 * fee is refunded with the first payout on funded accounts). Idempotent:
 * already-refunded rows are left alone, so repeated calls (page mounts,
 * log changes) never double-emit — `purchase.fee-refunded` also carries
 * a dedupe key.
 *
 * Returns the orders flipped by THIS call (for callers that want to
 * know something new happened); the ledger itself lives on the record.
 */
export function syncFeeRefunds(): PurchaseOrder[] {
  try {
    const paid = paidPayoutPrograms(); // program -> payout reference
    if (paid.size === 0) return [];
    const orders = readPurchases();
    const pending = orders.filter(
      (o) => o.feeRefund?.status !== "refunded" && paid.has(o.program),
    );
    if (pending.length === 0) return [];
    const flipped: PurchaseOrder[] = [];
    const next = orders.map((o) => {
      if (o.feeRefund?.status === "refunded") return o;
      const ref = paid.get(o.program);
      if (!ref) return o;
      const refundedAt = new Date().toISOString();
      const updated: PurchaseOrder = {
        ...o,
        feeRefund: { status: "refunded", payoutId: ref.payoutReference, refundedAt },
      };
      flipped.push(updated);
      // Consumer: purchase-history/invoice ledger line + trader
      // inbox-lifecycle-bridge receipt ("Challenge fee refunded with
      // payout PO-x (Demo)").
      emitLifecycle({
        entity: { kind: "purchase", id: o.orderId },
        name: "purchase.fee-refunded",
        actor: "trader",
        key: o.orderId,
        payload: {
          orderId: o.orderId,
          program: o.program,
          amount: o.amount,
          currency: o.currency,
          payoutReference: ref.payoutReference,
        },
      });
      return updated;
    });
    if (flipped.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      emitOrders();
    }
    return flipped;
  } catch {
    return [];
  }
}

/** Paid payouts by the account's program → which payout settled it. */
function paidPayoutPrograms(): Map<string, { payoutReference: string }> {
  const out = new Map<string, { payoutReference: string }>();
  const paidRows = [
    ...readPayoutRequests().filter((p) => p.status === "paid"),
    ...terraPayouts.filter((p) => p.status === "paid"),
  ];
  for (const p of paidRows) {
    const program = terraAccounts.find((a) => a.id === p.account)?.program;
    if (program && !out.has(program)) out.set(program, { payoutReference: p.reference });
  }
  return out;
}

/**
 * Run the fee-refund sync whenever the shared log changes (a payout
 * flipping to paid in prop-admin lands here live). Mount once on the
 * pages that render the ledger.
 */
export function useFeeRefundSync(): void {
  const log = useLifecycleLog();
  useEffect(() => {
    syncFeeRefunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log]);
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
