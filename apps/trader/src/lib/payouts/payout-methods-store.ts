"use client";

/**
 * Payout methods store — W1-01 (one payout-method source of truth).
 *
 * Before this, methods added in /withdrawal-methods lived in component
 * state while /payout-request read the fixture and hardcoded `wm-wise`
 * as the default — so a trader could add a method and still be unable
 * to select it at the moment of truth.
 *
 * This module owns the single persisted payout-methods list. Every
 * surface that consumes methods (request form, eligibility strip,
 * history, dashboard card) reads from here; the fixture is only the
 * seed on first run. Adds/edits/removes/primaries survive reload and
 * are reflected everywhere immediately.
 *
 * Pattern mirrors journey-store / verification-store: localStorage
 * backing, useSyncExternalStore reactivity, cross-tab sync, and an
 * invariant that exactly one method is primary at all times.
 *
 * Each method carries a numeric `feeAmount` (parsed from the human
 * readable `fee` string) so the request form can show a fee-inclusive
 * total that always sums: fee + total = amount.
 *
 * Each method also carries a `verification` state ("unverified" |
 * "pending" | "verified" | "rejected") seeded as "verified" for fixture
 * methods and "pending" for trader-added methods. Operators on
 * prop-admin override the verdict by writing `payout-method.rejected` /
 * `payout-method.unverified` lifecycle events (rule R5: one object,
 * one write path — verdicts are overlaid on the stored record).
 *
 * R12 GAP-T3 — rail taxonomy: define and validate rail types for payout methods
 * R12 GAP-T7 — method-change security flow: require verification for method changes
 * R12 GAP-T8 — ownership proof: link methods to verified identity for payouts
 *
 * R2-W3-01: methods are a lifecycle-tracked entity, not local state. */
import { useSyncExternalStore } from "react";
import { LIFECYCLE_LOG_KEY } from "@pfaas/lifecycle";
import { emitLifecycle, type LifecycleEventName } from "@pfaas/lifecycle";
import { withdrawalMethods } from "@/lib/fixtures/terra-fixtures";

/** The shape every surface consumes — the numeric feeAmount is store-owned. */
export type VerificationState = "unverified" | "pending" | "verified" | "rejected";

export type RailType = "domestic" | "swift" | "sepa" | "faster-payments" | "crypto" | "other";

export interface PayoutMethod {
  id: string;
  name: string;
  detail: string;
  fee: string;
  /** Numeric fee for total math (parsed from `fee`). */
  feeAmount: number;
  eta: string;
  primary: boolean;
  /** Verification state — unverified / pending / verified / rejected. */
  verification: VerificationState;
  /** Rail type for the payout method */
  rail: RailType;
  /** Ownership proof status — verified identity for payout method */
  ownership: VerificationState;
  /** Rail-specific fields */
  iban?: string;
  bic?: string;
  cryptoNetwork?: string;
  destinationTag?: string;
  sortCode?: string;
  accountNumber?: string;
  /** Ownership proof filename (null = no proof uploaded) */
  ownershipProof?: string | null;
}

/** Parse fee amount from string */
function parseFeeAmount(fee: string): number {
  const match = fee.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

/** Validate IBAN format (modulo 97 check) */
export function isValidIBAN(iban: string): boolean {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(clean)) return false;
  // Modulo 97 check
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let mod = 0;
  for (const char of rearranged) {
    const val = char >= "A" ? char.charCodeAt(0) - 55 : parseInt(char, 10);
    mod = (mod * 10 + val) % 97;
  }
  return mod === 1;
}

/** Validate crypto address format (basic check) */
export function isValidCryptoAddress(address: string, network: string): boolean {
  const clean = address.trim();
  if (!clean) return false;
  switch (network) {
    case "ERC-20":
    case "BEP-20":
      return /^0x[a-fA-F0-9]{40}$/.test(clean);
    case "TRC-20":
      return /^T[a-zA-Z0-9]{33}$/.test(clean);
    case "SOLANA":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean);
    case "BITCOIN":
      return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(clean);
    default:
      return clean.length >= 20; // Generic check
  }
}



/** Validate rail type is known */
export function isValidRail(rail: string): rail is RailType {
  return ["domestic", "swift", "sepa", "faster-payments", "crypto", "other"].includes(rail);
}

/** Map fixture withdrawal method to PayoutMethod with rail and ownership */
function mapToPayoutMethod(
  m: { id: string; name: string; detail: string; fee: string; eta: string; primary?: boolean; verification?: string; rail?: string; },
): PayoutMethod {
  return {
    id: m.id,
    name: m.name,
    detail: m.detail,
    fee: m.fee,
    feeAmount: parseFeeAmount(m.fee),
    eta: m.eta,
    primary: m.primary ?? false,
    verification: (m.verification ?? "verified") as VerificationState,
    rail: (m.rail ?? "domestic") as RailType,
    ownership: (m.verification === "verified" && m.rail === "domestic") ? "verified" : "unverified",
  };
}

/** Normalize withdrawal method from fixture - ensure rail and ownership */
function normalizeMethod(m: typeof withdrawalMethods[number]): PayoutMethod {
  const mapped = mapToPayoutMethod(m);
  // Ensure rail is never undefined — default to domestic if missing
  if (!mapped.rail) mapped.rail = "domestic";
  // Ensure ownership is verified for verified methods with domestic rail
  if (mapped.verification === "verified" && mapped.rail === "domestic") {
    mapped.ownership = "verified";
  } else {
    mapped.ownership = mapped.verification;
  }
  return mapped;
}

/** Ensure exactly one primary method exists */
function ensureOnePrimary(methods: PayoutMethod[]): PayoutMethod[] {
  const hasPrimary = methods.some((m) => m.primary);
  if (hasPrimary || methods.length === 0) return methods;
  return methods.map((m, i) => ({ ...m, primary: i === 0 }));
}

/** R2-W3-01 publish lifecycle event for method changes. */
function publish(
  name: LifecycleEventName,
  method: { id: string; name?: string; primary?: boolean },
  key?: string,
): void {
  emitLifecycle({
    entity: { kind: "payout-method", id: method.id },
    name,
    actor: "trader",
    key,
    payload: { method: method.name ?? method.id, primary: method.primary ?? false },
  });
}

/** The storage key for persisted methods. */
const STORAGE_KEY = "pfaas:trader:payoutMethods";

/** Read raw methods from storage */
function readRawMethods(): PayoutMethod[] {
  if (typeof window === "undefined") return seedMethods;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedMethods;
    const parsed = JSON.parse(raw) as PayoutMethod[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedMethods;
    // Overlay verification verdicts from the shared lifecycle log so
    // operator decisions (verify / reject / unverify) take precedence.
    const overlay = verificationOverlay();
    return ensureOnePrimary(
      parsed.map((m) => {
        const normalized: PayoutMethod = normalizeMethod(m as any);
        const verdict = overlay.get(normalized.id);
        if (verdict) normalized.verification = verdict;
        // Ensure ownership is verified for verified methods
        if (normalized.verification === "verified" && normalized.rail === "domestic") {
          normalized.ownership = "verified";
        }
        return normalized;
      }),
    );
  } catch {
    return seedMethods;
  }
}

/** Write methods to storage */
function writeMethods(methods: PayoutMethod[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(ensureOnePrimary(methods.map(normalizeMethod))),
    );
  } catch {
    /* storage unavailable — store works in-session only */
  }
  notify();
}

/** Get server snapshot for SSR */
function getServerSnapshot(): string {
  return JSON.stringify(seedMethods);
}

/** Reads payout-method.rejected / payout-method.unverified / payout-method.updated verdicts
 * from the shared lifecycle log so operator decisions are reflected
 * immediately on every consumer of this store (rule R5). */
function verificationOverlay(): Map<string, VerificationState> {
  const map = new Map<string, VerificationState>();
  if (typeof window === "undefined") return map;
  try {
    const raw = window.localStorage.getItem(LIFECYCLE_LOG_KEY);
    const log = raw ? (JSON.parse(raw) as Array<{ entity?: { kind?: string; id?: string }; name?: string; payload?: any }>) : [];
    for (const e of log) {
      if (!e.entity || e.entity.kind !== "payout-method" || !e.entity.id) continue;
      if (e.name === "payout-method.rejected") map.set(e.entity.id, "rejected");
      if (e.name === "payout-method.unverified") map.set(e.entity.id, "unverified");
      if (e.name === "payout-method.updated" && e.payload?.verification === "verified") map.set(e.entity.id, "verified");
    }
  } catch {
    /* log unavailable — store works in-session only */
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* External store: localStorage with same-tab change notifications     */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Cross-tab sync: the storage event fires in OTHER tabs on write;
  // same-tab writes go through notify() below.
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string {
  return JSON.stringify(readRawMethods());
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** All methods, primary first. */
export function readPayoutMethods(): PayoutMethod[] {
  return [...readRawMethods()].sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
}

/** The single primary method (always defined once methods exist). */
export function readPrimaryPayoutMethod(): PayoutMethod | undefined {
  return readRawMethods().find((m) => m.primary);
}

/** Add a new method (non-primary by default). */
export function addPayoutMethod(input: {
  name: string;
  detail: string;
  fee: string;
  eta: string;
  rail: RailType;
  /** Rail-specific fields */
  iban?: string;
  bic?: string;
  cryptoNetwork?: string;
  destinationTag?: string;
  sortCode?: string;
  accountNumber?: string;
  /** Ownership proof filename */
  ownershipProof?: string;
}): void {
  const method: PayoutMethod = {
    id: `wm-custom-${Date.now().toString(36)}`,
    name: input.name,
    detail: input.detail,
    fee: input.fee,
    feeAmount: parseFeeAmount(input.fee),
    eta: input.eta,
    primary: false,
    verification: "pending",
    rail: input.rail,
    ownership: "pending",
    // Store rail-specific details
    iban: input.iban,
    bic: input.bic,
    cryptoNetwork: input.cryptoNetwork,
    destinationTag: input.destinationTag,
    sortCode: input.sortCode,
    accountNumber: input.accountNumber,
    ownershipProof: input.ownershipProof,
  };
  writeMethods([method, ...readRawMethods()]);
  publish("payout-method.added", method, method.id);
}

/** Replace fields on an existing method. */
export function editPayoutMethod(id: string, patch: Partial<PayoutMethod>): void {
  const updated = readRawMethods().map((m) => {
    if (m.id !== id) return m;
    const next: PayoutMethod = { ...m, ...patch };
    // Ensure ownership is verified for verified methods
    if (next.verification === "verified" && next.rail === "domestic") {
      next.ownership = "verified";
    }
    return next;
  });
  writeMethods(updated);
  const target = updated.find((m) => m.id === id);
  if (target) publish("payout-method.updated", target);
}

/** Remove a method, promoting the first survivor if it was primary. */
export function removePayoutMethod(id: string): void {
  const target = readRawMethods().find((m) => m.id === id);
  const next = readRawMethods().filter((m) => m.id !== id);
  writeMethods(ensureOnePrimary(next));
  if (target) publish("payout-method.removed", target);
}

/** Set the primary method (exactly one after this). */
export function setPrimaryPayoutMethod(id: string): void {
  const methods = readRawMethods();
  const target = methods.find((m) => m.id === id);
  if (!target) return;

  // R12 GAP-T7 — method-change security flow: changing the primary payout
  // method is a security-sensitive action. The new primary must be verified
  // (not pending/unverified/rejected). Rejections are recorded so the
  // trader sees why the change was blocked.
  if (target.verification !== "verified") {
    publish("payout-method.primary-set", target);
    throw new Error(
      `Cannot set ${target.name} as primary — method verification status is "${target.verification}". Verified methods only.`,
    );
  }

  const updated = methods.map((m) => ({ ...m, primary: m.id === id }));
  writeMethods(updated);
  publish("payout-method.primary-set", target);
}

/** Reactive methods list for components. */
export function usePayoutMethods(): PayoutMethod[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as PayoutMethod[];
}

/** Seed methods on first run */
const seedMethods: PayoutMethod[] = withdrawalMethods.map(normalizeMethod);
