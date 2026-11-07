"use client";
/**
 * R2-10 — Global Consent & Suppression Ledger store (round-3 depth uplift).
 *
 * The contributing-tenant evidence model becomes a real drill-down: each
 * ledger row carries structured tenant receipts/events (consent wording,
 * policy version, source, provider reference, capture context) instead of
 * one-line strings, and the stub "exported (dummy)" toast becomes a real
 * ESP-importable suppression file built from the ledger.
 *
 * Service contract:
 *  • listLedger / ledgerRow — rows with structured evidence
 *  • receiptDetail — the drill-down payload shown per contributing receipt
 *  • exportSuppression — deterministic RFC 4180 CSV (identity, state,
 *    tenants, evidence refs, first/last seen) + audit entry
 */
import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import { csvCell } from "./bundle-utils";

export type GState = "suppressed" | "bounced" | "complained" | "opted_out" | "clear";
export type EvidenceKind =
  | "consent-receipt"   // N10 receipt (grant/withdrawal wording)
  | "optout-receipt"    // channel opt-out (STOP, unsubscribe)
  | "complaint-event"   // ISP complaint feedback loop
  | "bounce-event"      // delivery bounce
  | "spamtrap-event";   // trap / seed-list hit

/** One contributing-tenant evidence record — the drill-down unit (AC-2). */
export interface TenantReceipt {
  id: string;
  tenant: string;
  kind: EvidenceKind;
  at: string;
  summary: string;
  /** Consent wording shown to the data subject (receipts only). */
  wording?: string;
  /** Where the evidence was captured: form / esp / carrier / feedback-loop. */
  source?: string;
  policyVersion?: string;
  channel?: string;
  providerRef?: string;
  /** Capture context (IP / user agent) held with the receipt. */
  ip?: string;
}

export interface LedgerRow {
  id: string;
  identity: string;
  state: GState;
  tenants: string[];
  receipts: TenantReceipt[];
  first: string;
  latest: string;
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

let ROWS: LedgerRow[] = [
  {
    id: "g1", identity: "h:9f2a…@mailinator.com", state: "suppressed",
    tenants: ["Alpha Funded", "Beta Prop"], first: "2026-08-01", latest: "2026-11-01",
    receipts: [
      {
        id: "rcpt-a1", tenant: "Alpha Funded", kind: "spamtrap-event", at: daysAgo(12),
        summary: "Trap address hit on Q4 Scale send",
        source: "esp:sendgrid", channel: "email", providerRef: "sg-evt-88213",
        ip: "203.0.113.44", wording: "n/a — trap address, no consent on record",
      },
      {
        id: "ev-b7", tenant: "Beta Prop", kind: "complaint-event", at: daysAgo(8),
        summary: "ISP complaint (feedback loop)",
        source: "feedback-loop", channel: "email", providerRef: "fbl-yahoo-5510",
        policyVersion: "privacy-2026.09", ip: "198.51.100.7",
        wording: "You signed up to product updates; one-click unsubscribe was present in the footer.",
      },
      {
        id: "rcpt-a9", tenant: "Alpha Funded", kind: "consent-receipt", at: daysAgo(90),
        summary: "Original marketing consent granted",
        source: "form", channel: "email", policyVersion: "privacy-2026.06",
        ip: "203.0.113.10",
        wording: "Yes — email me trading challenges and offers from AlphaOne. I can unsubscribe anytime.",
      },
    ],
  },
  {
    id: "g2", identity: "h:ab44…@disposable.test", state: "bounced",
    tenants: ["Gamma"], first: "2026-10-12", latest: "2026-10-12",
    receipts: [
      {
        id: "b-441", tenant: "Gamma", kind: "bounce-event", at: daysAgo(26),
        summary: "Hard bounce — 550 mailbox unavailable",
        source: "esp:mailchimp", channel: "email", providerRef: "mc-bounce-441",
        ip: "192.0.2.19",
      },
      {
        id: "rule-disposable", tenant: "Gamma", kind: "spamtrap-event", at: daysAgo(26),
        summary: "Disposable domain rule (hits: 142)",
        source: "global-rule", channel: "email", policyVersion: "suppression-rules-2026.10",
      },
    ],
  },
  {
    id: "g3", identity: "h:cc10…+1555", state: "opted_out",
    tenants: ["Alpha Funded"], first: "2026-09-20", latest: "2026-09-20",
    receipts: [
      {
        id: "sms-out-77", tenant: "Alpha Funded", kind: "optout-receipt", at: daysAgo(48),
        summary: "SMS opt-out received (STOP)",
        source: "carrier", channel: "sms", providerRef: "tw-STOP-7781",
        policyVersion: "privacy-2026.06", ip: "—",
        wording: "Reply STOP to +1 555 0100 → \"Sorry to see you go. You will receive no further messages.\"",
      },
    ],
  },
];

export function listLedger(): LedgerRow[] { return ROWS; }
export function ledgerRow(id: string): LedgerRow | undefined { return ROWS.find(r => r.id === id); }

/** Drill-down rows for a ledger identity (AC-2: every row traces to evidence). */
export function receiptDetail(rowId: string): TenantReceipt[] {
  return ledgerRow(rowId)?.receipts ?? [];
}

export interface SuppressionExport {
  ok: boolean;
  filename: string;
  mime: string;
  content: string;
  count: number;
}

/**
 * ESP-importable suppression file: deterministic (sorted by identity) RFC
 * 4180 CSV with the evidence references that justify each suppression, so
 * a provider import and a regulator review read the same artifact.
 */
export function exportSuppression(rows: LedgerRow[], actor = "operator"): SuppressionExport {
  const sorted = [...rows].sort((a, b) => a.identity.localeCompare(b.identity));
  const header = [
    "identity_hash", "state", "tenants", "evidence_count", "evidence_refs",
    "first_seen", "last_seen", "reason",
  ];
  const lines = sorted.map(r => [
    r.identity,
    r.state,
    csvCell(r.tenants.join("; ")),
    r.receipts.length,
    csvCell(r.receipts.map(e => `${e.tenant}:${e.id}`).join("; ")),
    r.first,
    r.latest,
    csvCell(r.receipts[0]?.summary ?? r.state),
  ].join(","));
  const content = [header.join(","), ...lines].join("\n") + "\n";
  const filename = `suppression-global-${new Date().toISOString().slice(0, 10)}.csv`;
  recordAudit({
    actor,
    action: "suppression.export",
    target: "global-ledger",
    detail: `${sorted.length} suppressed identity(ies) exported as ESP-importable CSV (${filename}); evidence refs included`,
    severity: "info",
  });
  return { ok: sorted.length > 0, filename, mime: "text/csv", content, count: sorted.length };
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach(l => l());
}

/** Subscribe the calling component to ledger-store mutations. */
export function useLedgerVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}

/** Force a refresh after page-local mutations (enforcement toggle etc.). */
export function touchLedger(): void { emit(); }
