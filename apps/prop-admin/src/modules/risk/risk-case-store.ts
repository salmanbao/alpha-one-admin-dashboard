"use client";

/**
 * Session-scoped risk case store (PRD §4.5 risk_cases, §4.11 Risk
 * Dashboard, §4.17 /risk/cases endpoints).
 *
 * Seed cases are built once per tenant from the mock breaches / payouts /
 * traders (previously the page rebuilt them on every render, so no action
 * could ever persist). Workflow mutations — create, investigate, escalate,
 * mark action required, assign reviewer, resolve (resolution text + action
 * taken), dismiss, add note — live here so the queue table, KPI cards and
 * the detail panel all render from a single source of truth.
 */

import { useEffect, useState } from "react";
import {
  getTenantTraders,
  getTenantBreaches,
  getTenantPayouts,
  hashStr,
} from "@/lib/platform/mock-data";
import { setNavBadge } from "@/lib/platform/nav-badges";

export type RiskSeverity = "critical" | "high" | "medium" | "low";

export type RiskCaseStatus =
  | "open"
  | "investigating"
  | "escalated"
  | "action-required"
  | "resolved"
  | "dismissed";

/** PRD §4.5 — outcome recorded when a case is resolved. */
export type RiskActionTaken = "warned" | "account_closed" | "payout_blocked" | "none";

export interface RiskCase {
  id: string;
  severity: RiskSeverity;
  status: RiskCaseStatus;
  traderId: string;
  traderName: string;
  accountIds: string[];
  signal: string;
  signalDetail: string;
  currentExposure: number;
  payoutHold: boolean;
  payoutHoldAmount: number;
  opened: string;
  age: string;
  assignedTo: string;
  evidence: string[];
  notes: string[];
  /** PRD resolution field — set when the case is resolved. */
  resolution?: string;
  actionTaken?: RiskActionTaken;
  resolvedAt?: string;
}

function buildRiskCases(tid: string): RiskCase[] {
  const traders = getTenantTraders(tid);
  const breaches = getTenantBreaches(tid);
  const payouts = getTenantPayouts(tid);
  const cases: RiskCase[] = [];

  // Case 1: Drawdown anomaly from breach data
  if (breaches.length > 0) {
    const b = breaches[0];
    cases.push({
      id: `RC-${hashStr(tid + "rc1") % 9000 + 1000}`,
      severity: "critical",
      status: "open",
      traderId: b.traderId,
      traderName: b.traderName,
      accountIds: [b.accountId],
      signal: "Drawdown anomaly",
      signalDetail: `Account breached ${b.rule} — ${b.severity} severity. Triggered ${new Date(b.triggeredAt).toLocaleDateString()}.`,
      currentExposure: 25000,
      payoutHold: true,
      payoutHoldAmount: 4200,
      opened: "2h ago",
      age: "2h",
      assignedTo: "Unassigned",
      evidence: [
        `${b.rule} triggered on ${b.accountId}`,
        `Severity: ${b.severity}`,
        `Status: ${b.status}`,
        `Triggered at: ${new Date(b.triggeredAt).toLocaleString()}`,
      ],
      notes: [],
    });
  }

  // Case 2: Trading pattern anomaly
  if (traders.length > 3) {
    const t = traders[3];
    cases.push({
      id: `RC-${hashStr(tid + "rc2") % 9000 + 1000}`,
      severity: "high",
      status: "investigating",
      traderId: t.id,
      traderName: t.name,
      accountIds: [`acct-${t.id}`],
      signal: "Trading pattern anomaly",
      signalDetail: "Correlation with another trader's positions exceeds 87%. Possible copy-trading or shared strategy.",
      currentExposure: 15000,
      payoutHold: false,
      payoutHoldAmount: 0,
      opened: "6h ago",
      age: "6h",
      assignedTo: "Sarah Chen",
      evidence: [
        "Position correlation 87% with trader TRD-10294",
        "Same symbols: EURUSD, XAUUSD, SP500",
        "Entry times within 30s of each other",
        "Account age: 45 days",
      ],
      notes: ["Investigating IP/device overlap — no match found yet."],
    });
  }

  // Case 3: Multiple account behavior
  if (traders.length > 5) {
    const t = traders[5];
    cases.push({
      id: `RC-${hashStr(tid + "rc3") % 9000 + 1000}`,
      severity: "medium",
      status: "action-required",
      traderId: t.id,
      traderName: t.name,
      accountIds: [`acct-${t.id}-1`, `acct-${t.id}-2`],
      signal: "Multiple account behavior",
      signalDetail: "Trader has 2 funded accounts with identical trading patterns. Possible account farming.",
      currentExposure: 50000,
      payoutHold: true,
      payoutHoldAmount: 8200,
      opened: "1d ago",
      age: "1d",
      assignedTo: "Marcus Webb",
      evidence: [
        "2 funded accounts on same broker (MT5)",
        "Same leverage and position sizing",
        "Entries correlate 94%",
        "Both accounts passed Phase 2 within 2 days of each other",
      ],
      notes: ["Awaiting compliance review.", "Payout held pending investigation."],
    });
  }

  // Case 4: Suspicious payout pattern
  if (payouts.length > 0) {
    const p = payouts[0];
    cases.push({
      id: `RC-${hashStr(tid + "rc4") % 9000 + 1000}`,
      severity: "high",
      status: "open",
      traderId: p.traderId,
      traderName: p.traderName,
      accountIds: [],
      signal: "Suspicious payout pattern",
      signalDetail: `Payout request of $${p.amount.toLocaleString()} shortly after funding. Profit split ${p.profitSplit}%. Unusual withdrawal velocity.`,
      currentExposure: p.amount,
      payoutHold: true,
      payoutHoldAmount: p.amount,
      opened: "3h ago",
      age: "3h",
      assignedTo: "Unassigned",
      evidence: [
        `Payout requested ${p.amount} ${p.currency} via ${p.method}`,
        `Account funded 2 days ago`,
        `Profit split: ${p.profitSplit}%`,
        `No prior payout history`,
      ],
      notes: [],
    });
  }

  // Case 5: Resolved
  cases.push({
    id: `RC-${hashStr(tid + "rc5") % 9000 + 1000}`,
    severity: "low",
    status: "resolved",
    traderId: traders[0]?.id ?? "unknown",
    traderName: traders[0]?.name ?? "Unknown",
    accountIds: [],
    signal: "False positive — device cluster",
    signalDetail: "Device fingerprint matched across 2 accounts — confirmed to be same trader with legitimate multi-device setup.",
    currentExposure: 0,
    payoutHold: false,
    payoutHoldAmount: 0,
    opened: "3d ago",
    age: "3d",
    assignedTo: "Sarah Chen",
    evidence: ["Device fingerprint match confirmed", "Same trader, different devices (desktop + mobile)", "IP addresses from same household"],
    notes: ["False positive confirmed. No action needed."],
    resolution: "Verified same trader via KYC documents — multi-device usage allowed under the trader agreement.",
    actionTaken: "none",
    resolvedAt: "2026-10-24T10:00:00.000Z",
  });

  return cases;
}

const casesByTenant = new Map<string, RiskCase[]>();
const listeners = new Set<() => void>();
let version = 0;
let seq = 9700;

function emit() {
  version += 1;
  syncBadge();
  listeners.forEach((l) => l());
}

/**
 * PRD §4.6.2 critical_risk_cases sidebar badge — every critical case that
 * is not resolved/dismissed counts, across all seeded tenants.
 */
function syncBadge() {
  let n = 0;
  casesByTenant.forEach((arr) => {
    for (const c of arr) {
      if (c.severity === "critical" && c.status !== "resolved" && c.status !== "dismissed") n += 1;
    }
  });
  setNavBadge("risk", n);
}

function ensure(tid: string): RiskCase[] {
  let arr = casesByTenant.get(tid);
  if (!arr) {
    arr = buildRiskCases(tid);
    casesByTenant.set(tid, arr);
  }
  return arr;
}

/** All risk cases for a tenant (seeded once, then mutated in place). */
export function getRiskCases(tid: string): RiskCase[] {
  return ensure(tid);
}

// Seed the sidebar badge at boot: materialize each seeded tenant's cases
// so critical_risk_cases (PRD §4.6.2) has a count on first paint.
for (const tid of ["tenant-alpha", "tenant-beta", "tenant-gamma"]) ensure(tid);
syncBadge();

function update(tid: string, id: string, patch: Partial<RiskCase>): RiskCase | undefined {
  const arr = ensure(tid);
  const idx = arr.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  const next = { ...arr[idx], ...patch };
  arr[idx] = next;
  emit();
  return next;
}

export interface NewRiskCaseInput {
  severity: RiskSeverity;
  traderId: string;
  traderName: string;
  signal: string;
  signalDetail: string;
}

/** PRD POST /risk/cases — open a new case from the queue header. */
export function createRiskCase(tid: string, input: NewRiskCaseInput): RiskCase {
  const arr = ensure(tid);
  const record: RiskCase = {
    id: `RC-${++seq}`,
    severity: input.severity,
    status: "open",
    traderId: input.traderId,
    traderName: input.traderName,
    accountIds: [],
    signal: input.signal,
    signalDetail: input.signalDetail,
    currentExposure: 0,
    payoutHold: false,
    payoutHoldAmount: 0,
    opened: "just now",
    age: "0h",
    assignedTo: "Unassigned",
    evidence: ["Manually opened by admin"],
    notes: [],
  };
  arr.unshift(record);
  emit();
  return record;
}

/** Status transition (investigate / escalate / mark action required). */
export function setRiskCaseStatus(tid: string, id: string, status: RiskCaseStatus): RiskCase | undefined {
  return update(tid, id, { status });
}

/** PRD assigned_to — assign the case to a reviewer. */
export function assignRiskCase(tid: string, id: string, reviewer: string): RiskCase | undefined {
  return update(tid, id, { assignedTo: reviewer });
}

/** Append an internal note (PRD PATCH /risk/cases/:id notes). */
export function addRiskCaseNote(tid: string, id: string, note: string): void {
  const arr = ensure(tid);
  const idx = arr.findIndex((c) => c.id === id);
  if (idx === -1 || !note.trim()) return;
  const target = arr[idx];
  arr[idx] = { ...target, notes: [...target.notes, note.trim()] };
  emit();
}

/** PRD POST /risk/cases/:id/resolve — resolution text + action taken. */
export function resolveRiskCase(
  tid: string,
  id: string,
  resolution: string,
  actionTaken: RiskActionTaken,
): RiskCase | undefined {
  return update(tid, id, {
    status: "resolved",
    resolution,
    actionTaken,
    resolvedAt: new Date().toISOString(),
  });
}

/** Close the case without further action (stays visible under Dismissed). */
export function dismissRiskCase(tid: string, id: string): RiskCase | undefined {
  return update(tid, id, { status: "dismissed" });
}

/** Subscribe the calling component to store mutations. */
export function useRiskCaseVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}
