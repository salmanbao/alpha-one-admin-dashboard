"use client";

/**
 * Payout entity store — P0-1 (R10).
 *
 * Platform-side persistent payout store with mutation API and async seam.
 * Mirrors the invoice-store pattern: one store, audited mutations, demo persistence.
 * Payouts are tenant-scoped and persist under pfaas:platform-admin:payouts.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import { tenants as allTenants, payouts as seedPayouts, type Payout } from "@/lib/platform/mock-data";

const STORAGE_KEY = "pfaas:platform-admin:payouts";

/** Extended payout status for platform operations (R10: PW-01, PW-03, PW-09) */
export type PlatformPayoutStatus =
  | "pending"
  | "approved"
  | "processing"
  | "paid"
  | "rejected"
  | "failed"
  | "cancelled"
  | "on-hold";

/** Reason codes for payout failures and rejections (R10: PW-03) */
export type PayoutFailureReason =
  | "rail-declined"
  | "invalid-beneficiary"
  | "insufficient-float"
  | "timeout"
  | "compliance-hold"
  | "fraud-suspected"
  | "duplicate"
  | "cancelled-by-operator"
  | "other";

/** Payout state transition event for audit trail (R10: PW-09) */
export interface PayoutTransition {
  from: PlatformPayoutStatus;
  to: PlatformPayoutStatus;
  at: string;
  actor: string;
  reason: string;
}

/** Extended payout with platform-side fields (R10: PF-12, PF-09, PF-10) */
export interface PlatformPayout extends Omit<Payout, "status"> {
  status: PlatformPayoutStatus;
  /** State transition history */
  history?: PayoutTransition[];
  /** Failure reason when status is failed */
  failureReason?: PayoutFailureReason;
  /** Compliance hold reason when status is on-hold */
  holdReason?: string;
  /** Beneficiary details for cross-tenant anomaly detection (R10: PF-10) */
  beneficiary?: {
    name: string;
    accountLast4?: string;
    walletAddress?: string;
    type: "bank" | "crypto" | "paypal" | "skrill";
  };
  /** Settlement evidence attachment (R10: PF-09) */
  evidence?: {
    type: "bank-confirmation" | "transaction-hash" | "psp-receipt" | "other";
    reference: string;
    attachedAt: string;
  };
  /** Operator annotations (R10: PF-11) */
  notes?: string;
  /** Enriched tenant display name (resolved on read) */
  tenantName?: string;
}

/**
 * Seed fixtures — hydrate from the shared `payouts` fixture in
 * mock-data so every surface starts from the same rows the read-only
 * pages already reconcile against (PF-12: the store replaces the const,
 * it does not fork the data).
 */
const SEED_PAYOUTS: PlatformPayout[] = seedPayouts.map((p) => ({ ...p }));

function isValidPayout(v: unknown): v is PlatformPayout {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as PlatformPayout).id === "string" &&
    typeof (v as PlatformPayout).reference === "string"
  );
}

/** Read raw payouts: seed merged with persisted state (persisted wins). */
function readRaw(): PlatformPayout[] {
  if (typeof window === "undefined") return SEED_PAYOUTS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    const persisted: PlatformPayout[] = Array.isArray(stored)
      ? stored.filter(isValidPayout)
      : [];
    const byId = new Map<string, PlatformPayout>();
    for (const s of SEED_PAYOUTS) byId.set(s.id, { ...s });
    for (const p of persisted) byId.set(p.id, { ...byId.get(p.id) ?? {}, ...p });
    return [...byId.values()];
  } catch {
    return SEED_PAYOUTS;
  }
}

/** Write raw payouts to localStorage */
function writeRaw(next: PlatformPayout[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
  notify();
}

/** Subscribe/unsubscribe pattern for useSyncExternalStore */
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
  return JSON.stringify(SEED_PAYOUTS);
}

/** Read all payouts with tenant names enriched */
export function readPayouts(): PlatformPayout[] {
  const raw = readRaw();
  const tenantMap = new Map(allTenants.map((t) => [t.id, t.name]));
  return raw.map((p) => ({
    ...p,
    tenantName: p.tenantName ?? tenantMap.get(p.tenantId) ?? p.tenantId,
  }));
}

/** Read payouts for a specific tenant */
export function readTenantPayouts(tenantId: string): PlatformPayout[] {
  return readPayouts().filter((p) => p.tenantId === tenantId);
}

/** Get a single payout by ID */
export function getPayout(id: string): PlatformPayout | undefined {
  return readPayouts().find((p) => p.id === id);
}

/** React hook for all payouts */
export function usePayouts(): PlatformPayout[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as PlatformPayout[];
}

/** React hook for tenant-scoped payouts */
export function useTenantPayouts(tenantId: string): PlatformPayout[] {
  const all = usePayouts();
  return all.filter((p) => p.tenantId === tenantId);
}

/**
 * Calculate pending liability in money terms (R10: PF-01).
 * Reported per currency — no FX conversion is invented (the published
 * payout methodology refuses cross-currency summation, and so does this).
 */
export function getPendingLiability(tenantId?: string): { byCurrency: Record<string, number>; rows: number } {
  const payouts = tenantId ? readTenantPayouts(tenantId) : readPayouts();
  const pending = payouts.filter((p) =>
    ["pending", "approved", "processing", "on-hold"].includes(p.status),
  );
  const byCurrency: Record<string, number> = {};
  for (const p of pending) {
    byCurrency[p.currency] = (byCurrency[p.currency] || 0) + p.amount;
  }
  return { byCurrency, rows: pending.length };
}

/** Calculate in-flight aging buckets (R10: PF-02) */
export function getAgingBuckets(tenantId?: string): { "0-24h": number; "24-72h": number; "72h-7d": number; "7d+": number } {
  const payouts = tenantId ? readTenantPayouts(tenantId) : readPayouts();
  const now = Date.now();
  const buckets = { "0-24h": 0, "24-72h": 0, "72h-7d": 0, "7d+": 0 };
  
  for (const p of payouts) {
    if (!["pending", "approved", "processing", "on-hold"].includes(p.status)) continue;
    const ageMs = now - new Date(p.createdAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 24) buckets["0-24h"]++;
    else if (ageHours < 72) buckets["24-72h"]++;
    else if (ageHours < 168) buckets["72h-7d"]++;
    else buckets["7d+"]++;
  }
  return buckets;
}

/** Get payout method mix — count and amount per rail (R10: PF-03) */
export function getMethodMix(tenantId?: string): Record<string, { count: number; totalAmount: number; avgAmount: number }> {
  const payouts = tenantId ? readTenantPayouts(tenantId) : readPayouts();
  const mix: Record<string, { count: number; totalAmount: number; avgAmount: number }> = {};

  for (const p of payouts) {
    if (!mix[p.method]) mix[p.method] = { count: 0, totalAmount: 0, avgAmount: 0 };
    mix[p.method].count++;
    mix[p.method].totalAmount += p.amount;
  }

  for (const method of Object.keys(mix)) {
    mix[method].avgAmount = mix[method].totalAmount / mix[method].count;
  }
  return mix;
}

/** Add a state transition to a payout's history */
function addTransition(p: PlatformPayout, from: PlatformPayoutStatus, to: PlatformPayoutStatus, actor: string, reason: string): PlatformPayout {
  const transition: PayoutTransition = { from, to, at: new Date().toISOString(), actor, reason };
  return {
    ...p,
    status: to,
    history: [...(p.history || []), transition],
  };
}

/** Approve a pending payout (R10: PW-01) */
export function approvePayout(id: string, actor: string, reason: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (p.status !== "pending") return { ok: false, error: `Cannot approve payout in status ${p.status}` };
  
  const updated = addTransition(p, "pending", "approved", actor, reason);
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.approve",
    target: id,
    detail: `Approved payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${reason}`,
    severity: "info",
  });
  
  return { ok: true, payout: updated };
}

/** Hold a payout (R10: PW-02, PW-01) */
export function holdPayout(id: string, actor: string, reason: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (!["pending", "approved", "processing"].includes(p.status)) {
    return { ok: false, error: `Cannot hold payout in status ${p.status}` };
  }
  
  const updated = addTransition(p, p.status, "on-hold", actor, reason);
  updated.holdReason = reason;
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.hold",
    target: id,
    detail: `Held payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${reason}`,
    severity: "warning",
  });
  
  return { ok: true, payout: updated };
}

/** Release a held payout (R10: PW-02) */
export function releasePayout(id: string, actor: string, reason: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (p.status !== "on-hold") return { ok: false, error: "Payout is not on hold" };
  
  // Return to previous status before hold
  const prevStatus = p.history?.findLast((t) => t.to === "on-hold")?.from || "pending";
  const updated = addTransition(p, "on-hold", prevStatus, actor, reason);
  delete updated.holdReason;
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.release",
    target: id,
    detail: `Released payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${reason}`,
    severity: "info",
  });
  
  return { ok: true, payout: updated };
}

/** Reject a payout (R10: PW-01) */
export function rejectPayout(id: string, actor: string, reason: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (!["pending", "approved"].includes(p.status)) {
    return { ok: false, error: `Cannot reject payout in status ${p.status}` };
  }
  
  const updated = addTransition(p, p.status, "rejected", actor, reason);
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.reject",
    target: id,
    detail: `Rejected payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${reason}`,
    severity: "warning",
  });
  
  return { ok: true, payout: updated };
}

/** Mark payout as processing (start execution) (R10: PW-01) */
export function processPayout(id: string, actor: string, reason: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (p.status !== "approved") return { ok: false, error: `Cannot process payout in status ${p.status}` };
  
  const updated = addTransition(p, "approved", "processing", actor, reason);
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.process",
    target: id,
    detail: `Processing payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${reason}`,
    severity: "info",
  });
  
  return { ok: true, payout: updated };
}

/** Mark payout as paid (execution complete) (R10: PW-01) */
export function completePayout(id: string, actor: string, evidenceRef?: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (p.status !== "processing") return { ok: false, error: `Cannot complete payout in status ${p.status}` };
  
  const updated = addTransition(p, "processing", "paid", actor, evidenceRef || "Payment completed");
  updated.processedAt = new Date().toISOString();
  if (evidenceRef) {
    updated.evidence = {
      type: "psp-receipt",
      reference: evidenceRef,
      attachedAt: new Date().toISOString(),
    };
  }
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.complete",
    target: id,
    detail: `Completed payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${evidenceRef || "Payment completed"}`,
    severity: "info",
  });
  
  return { ok: true, payout: updated };
}

/** Fail a payout (R10: PW-03) */
export function failPayout(
  id: string, 
  actor: string, 
  failureReason: PayoutFailureReason, 
  reason: string
): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (!["processing", "approved", "pending"].includes(p.status)) {
    return { ok: false, error: `Cannot fail payout in status ${p.status}` };
  }
  
  const updated = addTransition(p, p.status, "failed", actor, reason);
  updated.failureReason = failureReason;
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.fail",
    target: id,
    detail: `Failed payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${failureReason}: ${reason}`,
    severity: "critical",
  });
  
  return { ok: true, payout: updated };
}

/** Retry a failed payout (R10: PW-03, PS-03) */
export function retryPayout(id: string, actor: string, reason: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (p.status !== "failed") return { ok: false, error: "Can only retry failed payouts" };
  
  const updated = addTransition(p, "failed", "pending", actor, reason);
  delete updated.failureReason;
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.retry",
    target: id,
    detail: `Retry payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${reason}`,
    severity: "info",
  });
  
  return { ok: true, payout: updated };
}

/** Cancel a payout (R10: PW-01) */
export function cancelPayout(id: string, actor: string, reason: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (!["pending", "approved", "on-hold"].includes(p.status)) {
    return { ok: false, error: `Cannot cancel payout in status ${p.status}` };
  }
  
  const updated = addTransition(p, p.status, "cancelled", actor, reason);
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.cancel",
    target: id,
    detail: `Cancelled payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${reason}`,
    severity: "warning",
  });
  
  return { ok: true, payout: updated };
}

/** Clawback a paid payout (R10: PW-04) */
export function clawbackPayout(id: string, actor: string, reason: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (p.status !== "paid") return { ok: false, error: "Can only clawback paid payouts" };
  
  // Create a compensating entry (negative amount) as a new payout record
  const clawbackId = `clawback-${p.id}-${Date.now()}`;
  const clawback: PlatformPayout = {
    ...p,
    id: clawbackId,
    reference: `CB-${p.reference}`,
    amount: -p.amount,
    status: "rejected", // Compensating entry
    createdAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
    history: [{
      from: "paid",
      to: "rejected",
      at: new Date().toISOString(),
      actor,
      reason: `Clawback: ${reason}`,
    }],
    notes: `Clawback of ${p.reference}: ${reason}`,
  };
  
  // Mark original as clawed back
  const updatedOriginal = addTransition(p, "paid", "rejected", actor, `Clawed back: ${reason}`);
  payouts[idx] = updatedOriginal;
  payouts.push(clawback);
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.clawback",
    target: id,
    detail: `Clawed back payout ${p.reference} (${p.amount} ${p.currency}) for ${p.traderName} — ${reason}`,
    severity: "critical",
  });
  
  return { ok: true, payout: clawback };
}

/** Attach settlement evidence (R10: PF-09) */
export function attachEvidence(
  id: string, 
  actor: string, 
  type: "bank-confirmation" | "transaction-hash" | "psp-receipt" | "other", 
  reference: string
): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  const updated = {
    ...p,
    evidence: { type, reference, attachedAt: new Date().toISOString() },
  };
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.evidence",
    target: id,
    detail: `Attached ${type} evidence ${reference} to payout ${p.reference}`,
    severity: "info",
  });
  
  return { ok: true, payout: updated };
}

/** Add operator note (R10: PF-11) */
export function addNote(id: string, actor: string, note: string): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  const updated = {
    ...p,
    notes: p.notes ? `${p.notes}\n${new Date().toISOString()} [${actor}]: ${note}` : `${new Date().toISOString()} [${actor}]: ${note}`,
  };
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.note",
    target: id,
    detail: `Added note to payout ${p.reference}: ${note}`,
    severity: "info",
  });
  
  return { ok: true, payout: updated };
}

/** Update beneficiary details (R10: PF-10) */
export function updateBeneficiary(
  id: string,
  actor: string,
  beneficiary: PlatformPayout["beneficiary"]
): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  const updated = { ...p, beneficiary };
  payouts[idx] = updated;
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.beneficiary",
    target: id,
    detail: `Updated beneficiary for payout ${p.reference}`,
    severity: "info",
  });
  
  return { ok: true, payout: updated };
}

/** Re-issue to corrected beneficiary/method (R10: PW-05) */
export function reissuePayout(
  id: string,
  actor: string,
  reason: string,
  newBeneficiary?: PlatformPayout["beneficiary"],
  newMethod?: Payout["method"]
): { ok: boolean; payout?: PlatformPayout; error?: string } {
  const payouts = readRaw();
  const idx = payouts.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payout not found" };
  
  const p = payouts[idx];
  if (!["paid", "failed", "rejected", "cancelled"].includes(p.status)) {
    return { ok: false, error: `Cannot reissue payout in status ${p.status}` };
  }
  
  // Create new payout with corrected details
  const newId = `reissue-${p.id}-${Date.now()}`;
  const reissue: PlatformPayout = {
    ...p,
    id: newId,
    reference: `RI-${p.reference}`,
    status: "pending",
    createdAt: new Date().toISOString(),
    processedAt: undefined,
    beneficiary: newBeneficiary || p.beneficiary,
    method: newMethod || p.method,
    history: [{
      from: p.status,
      to: "pending",
      at: new Date().toISOString(),
      actor,
      reason: `Re-issue: ${reason}`,
    }],
    notes: `Re-issue of ${p.reference}: ${reason}`,
  };
  
  payouts.push(reissue);
  writeRaw(payouts);
  
  recordAudit({
    actor,
    action: "payout.reissue",
    target: newId,
    detail: `Re-issued payout ${p.reference} as ${reissue.reference} — ${reason}`,
    severity: "info",
  });
  
  return { ok: true, payout: reissue };
}
