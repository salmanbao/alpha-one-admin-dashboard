"use client";

/**
 * Provisioning operator store — R4-10 (rule R5: one object, one write path).
 *
 * The provisioning queue's operator actions all write through this module,
 * persisted under the `pfaas:demo:` prefix like every other decision store:
 *
 *   retryStage       → retry provisioning stage (emits `provisioning.retry`)
 *   deliverCredentials → `provisioning.credentials` on the shared bus
 *   markActivated    → `provisioning.activated` (account becomes live)
 *   failWithReason   → `provisioning.failed` with reason (read by inbox bridge)
 *
 * Every action also writes `recordAudit` (AC 4).
 * Source rows carry `(demo transport)` chip (rule R3).
 */

import { useSyncExternalStore } from "react";
import { emitLifecycle } from "@pfaas/lifecycle";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoProvisioningOpsSchema } from "@/lib/platform/validation";
import { recordAudit } from "@/lib/audit";
import type { PurchaseRecord } from "@/lib/platform/cross-app-intake";

const SLOT = "pfaas:demo:provisioning-ops";
const listeners = new Set<() => void>();
let state: Record<string, ProvisioningOps> = {};

try {
  const persisted = loadDemoState(SLOT, demoProvisioningOpsSchema, {});
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

export interface ProvisioningOps {
  status: "in-progress" | "credentials-delivered" | "active" | "failed";
  reason?: string;
  startedAt: string;
  credentialsDeliveredAt?: string;
  activatedAt?: string;
  failedAt?: string;
  failedReason?: string;
}

export function readProvisioningOps(orderId: string): ProvisioningOps | undefined {
  return state[orderId];
}

export function readAllProvisioningOps(): Record<string, ProvisioningOps> {
  return state;
}

function setOps(orderId: string, patch: ProvisioningOps): void {
  state = { ...state, [orderId]: { ...state[orderId], ...patch } };
}

/** Retry a stuck provisioning stage. */
export function retryStage(rec: PurchaseRecord, reason?: string): void {
  const now = new Date().toISOString();
  const ops = state[rec.orderId] || { status: "in-progress", startedAt: rec.createdAt };
  setOps(rec.orderId, {
    ...ops,
    status: "in-progress",
    reason,
    failedAt: now,
    failedReason: reason,
  });
  recordAudit({
    action: "Retried provisioning stage",
    entity: "purchase",
    entityId: rec.orderId,
    summary: `#${rec.orderId} retry (${reason ?? "stuck"})`,
    severity: "warning",
  });
  emitLifecycle({
    entity: { kind: "provisioning", id: rec.orderId },
    name: "provisioning.retry",
    actor: "prop-admin",
    key: `retry:${rec.orderId}:${now}`,
    payload: { orderId: rec.orderId, reason, traderName: rec.traderName, retriedAt: now },
  });
  notify();
}

/** Deliver credentials to the trader (emits `provisioning.credentials`). */
export function deliverCredentials(rec: PurchaseRecord, actor?: string): void {
  const now = new Date().toISOString();
  const ops = state[rec.orderId] || { status: "in-progress", startedAt: rec.createdAt };
  setOps(rec.orderId, {
    ...ops,
    status: "credentials-delivered",
    credentialsDeliveredAt: now,
    actor: actor ?? "operator",
  });
  recordAudit({
    action: "Credentials delivered",
    entity: "purchase",
    entityId: rec.orderId,
    summary: `#${rec.orderId} credentials delivered (${rec.traderName})`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "provisioning", id: rec.orderId },
    name: "provisioning.credentials",
    actor: actor ?? "prop-admin",
    key: `credentials:${rec.orderId}`,
    payload: { orderId: rec.orderId, traderName: rec.traderName, deliveredAt: now },
  });
  notify();
}

/** Mark the account as activated (emits `provisioning.activated`). */
export function markActivated(rec: PurchaseRecord, actor?: string): void {
  const now = new Date().toISOString();
  const ops = state[rec.orderId] || { status: "credentials-delivered", startedAt: rec.createdAt };
  setOps(rec.orderId, {
    ...ops,
    status: "active",
    activatedAt: now,
    actor: actor ?? "operator",
  });
  recordAudit({
    action: "Account activated",
    entity: "purchase",
    entityId: rec.orderId,
    summary: `#${rec.orderId} activated (${rec.traderName})`,
    severity: "info",
  });
  emitLifecycle({
    entity: { kind: "provisioning", id: rec.orderId },
    name: "provisioning.activated",
    actor: actor ?? "prop-admin",
    key: `activated:${rec.orderId}`,
    payload: { orderId: rec.orderId, traderName: rec.traderName, activatedAt: now },
  });
  notify();
}

/** Mark provisioning as failed with a reason. */
export function failWithReason(rec: PurchaseRecord, reason: string, actor?: string): void {
  const now = new Date().toISOString();
  const ops = state[rec.orderId] || { status: "in-progress", startedAt: rec.createdAt };
  setOps(rec.orderId, {
    ...ops,
    status: "failed",
    reason,
    failedAt: now,
    failedReason: reason,
    actor: actor ?? "operator",
  });
  recordAudit({
    action: "Provisioning failed",
    entity: "purchase",
    entityId: rec.orderId,
    summary: `#${rec.orderId} failed: ${reason}`,
    severity: "error",
  });
  emitLifecycle({
    entity: { kind: "provisioning", id: rec.orderId },
    name: "provisioning.failed",
    actor: actor ?? "prop-admin",
    key: `failed:${rec.orderId}:${now}`,
    payload: { orderId: rec.orderId, reason, traderName: rec.traderName, failedAt: now },
  });
  notify();
}
