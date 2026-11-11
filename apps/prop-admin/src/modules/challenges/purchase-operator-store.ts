"use client";

/**
 * Purchase operator store — R4-09 (rule R5: one object, one write path).
 *
 * The purchase queue's four operator actions all write through this
 * module, persisted under the `pfaas:demo:` prefix like every other
 * decision store:
 *
 *   assignProduct       → product mapping for the order
 *   triggerProvisioning → `provisioning.started` on the shared bus
 *                         (the trader's credentials moment derives it)
 *   refundPurchase      → refund record + `purchase.refunded` (read by
 *                         the trader's history/invoice + inbox bridge)
 *   contactTrader       → `comms.message-sent` (read by the trader's
 *                         inbox bridge — rule R6 names the reader)
 *
 * Every action also writes `recordAudit` (AC 4).
 */

import { useSyncExternalStore } from "react";
import { emitLifecycle } from "@pfaas/lifecycle";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoPurchaseOpsSchema } from "@/lib/platform/validation";
import { recordAudit } from "@/lib/audit";
import type { PurchaseRecord } from "@/lib/platform/cross-app-intake";

export interface ProductAssignment {
  productId: string;
  productName: string;
  assignedAt: string;
  assignedBy: string;
}

export interface RefundRecord {
  amount: number;
  currency: string;
  reason: string;
  issuedAt: string;
  issuedBy: string;
}

export interface ContactNote {
  at: string;
  subject: string;
  by: string;
}

export interface ProvisioningTrigger {
  triggeredAt: string;
  triggeredBy: string;
}

/** Per-order operator actions. */
export interface OrderOps {
  assignment?: ProductAssignment;
  refund?: RefundRecord;
  contacts?: ContactNote[];
  provisioning?: ProvisioningTrigger;
}

const SLOT = "purchase-ops";
const listeners = new Set<() => void>();
let state: Record<string, OrderOps> = {};

try {
  const persisted = loadDemoState(SLOT, demoPurchaseOpsSchema, {});
  if (persisted && typeof persisted === "object") state = persisted;
} catch {
  state = {};
}

function notify(): void {
  listeners.forEach((l) => l());
  try {
    saveDemoState(SLOT, state);
  } catch {
    /* persistence is best-effort */
  }
}

export function readOrderOps(orderId: string): OrderOps | undefined {
  return state[orderId];
}

export function readAllOrderOps(): Record<string, OrderOps> {
  return state;
}

function setOps(orderId: string, patch: OrderOps): void {
  state = { ...state, [orderId]: { ...state[orderId], ...patch } };
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** AC: "Assign challenge product" — writes the product mapping. */
export function assignProduct(
  rec: PurchaseRecord,
  product: { id: string; name: string },
  actor?: string,
): void {
  const now = new Date().toISOString();
  const by = actor ?? "operator";
  setOps(rec.orderId, {
    assignment: {
      productId: product.id,
      productName: product.name,
      assignedAt: now,
      assignedBy: by,
    },
  });
  recordAudit({
    action: "Assigned challenge product",
    entity: "purchase",
    entityId: rec.orderId,
    summary: `#${rec.orderId} → ${product.name} (${rec.traderName})`,
    severity: "info",
  });
  notify();
}

/** AC: "Trigger provisioning" — publishes `provisioning.started` with
 *  everything the trader's credentials moment needs. */
export function triggerProvisioning(rec: PurchaseRecord, actor?: string): void {
  const now = new Date().toISOString();
  const by = actor ?? "operator";
  const ops = state[rec.orderId] ?? {};
  setOps(rec.orderId, { provisioning: { triggeredAt: now, triggeredBy: by } });
  recordAudit({
    action: "Triggered provisioning",
    entity: "purchase",
    entityId: rec.orderId,
    summary: `#${rec.orderId} → provisioning started (${rec.traderName})`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "provisioning", id: rec.orderId },
    name: "provisioning.started",
    actor: "prop-admin",
    key: `started:${rec.orderId}`,
    payload: {
      orderId: rec.orderId,
      challengeType: rec.challengeType ?? null,
      product: ops.assignment?.productName ?? null,
      traderName: rec.traderName,
      triggeredAt: now,
    },
  });
  notify();
}

/** AC: "Refund" — refund record + `purchase.refunded` + trader receipt
 *  (purchase-history row, invoice flip and an inbox message). */
export function refundPurchase(
  rec: PurchaseRecord,
  reason: string,
  actor?: string,
): void {
  const now = new Date().toISOString();
  const by = actor ?? "operator";
  setOps(rec.orderId, {
    refund: {
      amount: rec.amount,
      currency: rec.currency,
      reason,
      issuedAt: now,
      issuedBy: by,
    },
  });
  recordAudit({
    action: "Refunded purchase",
    entity: "purchase",
    entityId: rec.orderId,
    summary: `#${rec.orderId} refunded ${rec.amount} ${rec.currency} — ${reason}`,
    severity: "warning",
  });
  emitLifecycle({
    entity: { kind: "purchase", id: rec.orderId },
    name: "purchase.refunded",
    actor: "prop-admin",
    key: `refunded:${rec.orderId}`,
    payload: {
      orderId: rec.orderId,
      amount: rec.amount,
      currency: rec.currency,
      reason,
      applicant: rec.traderName,
      refundedAt: now,
    },
  });
  notify();
}

/** AC: "Contact trader" — an inbox event; the trader's
 *  inbox-lifecycle-bridge is the named reader (rule R6). */
export function contactTrader(
  rec: PurchaseRecord,
  subject: string,
  body: string,
  actor?: string,
): void {
  const now = new Date().toISOString();
  const by = actor ?? "operator";
  const ops = state[rec.orderId] ?? {};
  setOps(rec.orderId, {
    contacts: [...(ops.contacts ?? []), { at: now, subject, by }],
  });
  recordAudit({
    action: "Contacted trader",
    entity: "purchase",
    entityId: rec.orderId,
    summary: `#${rec.orderId}: ${subject}`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "purchase", id: rec.orderId },
    name: "comms.message-sent",
    actor: "prop-admin",
    // Unique key — traders can be contacted more than once per order.
    key: `contact:${rec.orderId}:${Date.now().toString(36)}`,
    payload: {
      orderId: rec.orderId,
      subject,
      body,
      channel: "inbox",
      sender: "Terra Support",
      applicant: rec.traderName,
    },
  });
  notify();
}

/* ------------------------------------------------------------------ */
/* Reactive read                                                       */
/* ------------------------------------------------------------------ */

export function useOrderOps(orderId: string): OrderOps | undefined {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => JSON.stringify(state[orderId] ?? null),
    () => "null",
  );
  return raw === "null" ? undefined : (JSON.parse(raw) as OrderOps);
}

export function useAllOrderOps(): Record<string, OrderOps> {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => JSON.stringify(state),
    () => "{}",
  );
  return JSON.parse(raw) as Record<string, OrderOps>;
}
