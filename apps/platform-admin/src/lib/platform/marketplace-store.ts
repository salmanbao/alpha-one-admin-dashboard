"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Marketplace App Review store — P0-4: wire fake write-path to store + audit.
 * Publish / Suspend / Revoke / Rollback / Rollout / Sandbox re-test / Security verdicts
 * persist under pfaas:platform-admin:marketplace.
 * Acceptance test: action → reload → state + audit row + toast agree.
 * The `recordAudit` calls already existed; only state persistence was missing.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:marketplace";

export type State = "submitted" | "in_review" | "needs_info" | "published" | "suspended" | "revoked";

export type DiffKind = "added" | "removed" | "changed" | "same";
export interface DiffLine {
  key: string;
  kind: DiffKind;
  prev?: string;
  next?: string;
}
export type TestStatus = "pass" | "fail" | "pending";
export interface SandboxTest {
  id: string;
  name: string;
  status: TestStatus;
  ms: number;
}
export type Verdict = "pass" | "fail" | "pending";
export interface SecurityQ {
  id: string;
  q: string;
  a: string;
  verdict: Verdict;
}
export interface HistoryEntry {
  at: string;
  actor: string;
  note: string;
}
export interface Sub {
  id: string;
  app: string;
  publisher: string;
  version: string;
  publishedVersion: string;
  state: State;
  perms: string[];
  notes: string;
  manifest: DiffLine[];
  sandbox: SandboxTest[];
  security: SecurityQ[];
  rollout: number;
  ramp: string[];
  history: HistoryEntry[];
}

const SEED: Sub[] = [
  {
    id: "s1",
    app: "SignalPush",
    publisher: "Acme Labs",
    version: "1.3.0",
    publishedVersion: "1.2.0",
    state: "in_review",
    perms: ["events.read", "contacts.read", "segments:read"],
    notes: "",
    manifest: [
      { key: "id", kind: "same", prev: "com.acme.signalpush", next: "com.acme.signalpush" },
      { key: "version", kind: "changed", prev: "1.2.0", next: "1.3.0" },
      { key: "scopes[].segments:read", kind: "added", next: "read-only segment lookup" },
      { key: "scopes[].contacts.write", kind: "added", next: "write back push token state" },
      { key: "scopes[].events.relay", kind: "removed", prev: "server event forwarding" },
      { key: "webhooks[]", kind: "changed", prev: "1 endpoint (delivered)", next: "2 endpoints (delivered, bounced)" },
      { key: "data.retention_days", kind: "changed", prev: "30", next: "90" },
      { key: "permissions[].notifications", kind: "same", prev: "granted", next: "granted" },
    ],
    sandbox: [
      { id: "t1", name: "Install on sandbox tenant", status: "pass", ms: 820 },
      { id: "t2", name: "OAuth scope handshake", status: "pass", ms: 410 },
      { id: "t3", name: "GET /v2/segments (scopes:read)", status: "pass", ms: 190 },
      { id: "t4", name: "POST /v2/contacts/{id}/push-token", status: "fail", ms: 1240 },
      { id: "t5", name: "Webhook signature verification", status: "pending", ms: 0 },
      { id: "t6", name: "Rate-limit 429 handling", status: "pass", ms: 60 },
    ],
    security: [
      { id: "q1", q: "Where is tenant data stored at rest?", a: "EU (Frankfurt) region, AES-256 at rest via managed KMS.", verdict: "pass" },
      { id: "q2", q: "Describe retention & deletion of webhook payloads.", a: "Payloads purged after 30 days; deletion API exposed to tenant admins.", verdict: "pass" },
      { id: "q3", q: "Is customer data used for model training or resale?", a: "No. Data is processed only to deliver the app's functionality.", verdict: "pass" },
      { id: "q4", q: "Incident notification SLA (sub-processor breach)?", a: "— not answered —", verdict: "pending" },
      { id: "q5", q: "Independent security assessment in last 12 months?", a: "SOC 2 Type II dated 2026-03 (uploaded).", verdict: "pass" },
    ],
    rollout: 25,
    ramp: ["Day 0 — 10% (internal tenants)", "Day 3 — 25%", "Day 7 — 50%", "Day 14 — 100%"],
    history: [
      { at: new Date().toLocaleString(), actor: "marketplace-bot", note: "Submission received for v1.3.0." },
      { at: new Date().toLocaleString(), actor: "reviewer.kim", note: "Review started; sandbox suite queued." },
    ],
  },
  {
    id: "s2",
    app: "LedgerSync",
    publisher: "FinCo",
    version: "2.1.0",
    publishedVersion: "2.0.1",
    state: "submitted",
    perms: ["payouts.read"],
    notes: "",
    manifest: [
      { key: "id", kind: "same", prev: "fi.finco.ledgersync", next: "fi.finco.ledgersync" },
      { key: "version", kind: "changed", prev: "2.0.1", next: "2.1.0" },
      { key: "scopes[].payouts.read", kind: "same", prev: "read payouts", next: "read payouts" },
      { key: "scopes[].payouts.write", kind: "added", next: "propose payout batches (needs approval)" },
      { key: "ui.embedded_views[]", kind: "added", next: "payout-reconciliation" },
    ],
    sandbox: [
      { id: "t1", name: "Install on sandbox tenant", status: "pass", ms: 640 },
      { id: "t2", name: "OAuth scope handshake", status: "pending", ms: 0 },
      { id: "t3", name: "GET /v2/payouts (scopes:read)", status: "pending", ms: 0 },
      { id: "t4", name: "Approval-gated write path", status: "pending", ms: 0 },
    ],
    security: [
      { id: "q1", q: "Where is tenant data stored at rest?", a: "US (Iowa), SOC 2 Type II.", verdict: "pass" },
      { id: "q2", q: "Sub-processor list published & versioned?", a: "Yes — /subprocessors, 30-day change notice.", verdict: "pass" },
      { id: "q3", q: "Write-path approval enforcement?", a: "— not answered —", verdict: "pending" },
    ],
    rollout: 0,
    ramp: ["Not scheduled — publish gates the ramp"],
    history: [{ at: new Date().toLocaleString(), actor: "marketplace-bot", note: "Submission received for v2.1.0." }],
  },
  {
    id: "s3",
    app: "OldWebhook",
    publisher: "Legacy Inc",
    version: "0.9.0",
    publishedVersion: "0.9.0",
    state: "needs_info",
    perms: ["events.read"],
    notes: "Clarify data retention.",
    manifest: [
      { key: "id", kind: "same", prev: "io.legacy.oldwebhook", next: "io.legacy.oldwebhook" },
      { key: "version", kind: "changed", prev: "0.8.4", next: "0.9.0" },
      { key: "data.retention_days", kind: "changed", prev: "365", next: "unlimited" },
      { key: "webhooks[].verify", kind: "removed", prev: "HMAC sha256" },
    ],
    sandbox: [
      { id: "t1", name: "Install on sandbox tenant", status: "pass", ms: 910 },
      { id: "t2", name: "Webhook signature verification", status: "fail", ms: 2100 },
    ],
    security: [
      { id: "q1", q: "Retention & deletion of webhook payloads?", a: "\"Unlimited until tenant deletes app\" — flagged by reviewer.", verdict: "fail" },
      { id: "q2", q: "Sub-processor list published & versioned?", a: "No published list.", verdict: "fail" },
    ],
    rollout: 0,
    ramp: ["Blocked — security questionnaire failed"],
    history: [
      { at: new Date().toLocaleString(), actor: "marketplace-bot", note: "Submission received for v0.9.0." },
      { at: new Date().toLocaleString(), actor: "reviewer.kim", note: "Requested info: retention + sub-processors." },
    ],
  },
  {
    id: "s4",
    app: "ChatRelay",
    publisher: "Slipstream",
    version: "3.4.2",
    publishedVersion: "3.4.2",
    state: "published",
    perms: ["events.read", "contacts.read"],
    notes: "Healthy; 12% rollout last ramp completed.",
    manifest: [
      { key: "id", kind: "same", prev: "co.slipstream.chatrelay", next: "co.slipstream.chatrelay" },
      { key: "version", kind: "same", prev: "3.4.2", next: "3.4.2" },
      { key: "scopes[].events.read", kind: "same", prev: "read events", next: "read events" },
    ],
    sandbox: [
      { id: "t1", name: "Install on sandbox tenant", status: "pass", ms: 700 },
      { id: "t2", name: "Webhook signature verification", status: "pass", ms: 320 },
    ],
    security: [
      { id: "q1", q: "Where is tenant data stored at rest?", a: "EU region, encrypted.", verdict: "pass" },
      { id: "q2", q: "Incident notification SLA?", a: "24h to tenant admin + platform.", verdict: "pass" },
    ],
    rollout: 100,
    ramp: ["Completed — full availability since 2026-10-02"],
    history: [{ at: new Date().toLocaleString(), actor: "reviewer.kim", note: "Published v3.4.2 at 100%." }],
  },
];

function readRaw(): Sub[] {
  if (typeof window === "undefined") return [...SEED];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [...SEED];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as Sub[];
  } catch {
    /* fall through */
  }
  return [...SEED];
}

function writeRaw(next: Sub[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
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

export function readMarketplace(): Sub[] {
  return readRaw().map((s) => ({ ...s, history: [...s.history] }));
}

export function useMarketplace(): Sub[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(SEED),
  );
  return useMemo(() => {
    try {
      return (JSON.parse(snapshot) as Sub[]).map((s) => ({ ...s, history: [...s.history] }));
    } catch {
      return SEED.map((s) => ({ ...s, history: [...s.history] }));
    }
  }, [snapshot]);
}

// Mutations
export function publishMarketplaceApp(id: string, rolloutPct: number, msg: string): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = {
    ...subs[idx],
    state: "published" as State,
    rollout: rolloutPct,
    publishedVersion: subs[idx].version,
    ramp: [
      `Day 0 — 10% (internal tenants)`,
      `Day 3 — ${rolloutPct}%`,
      `Day 7 — ${Math.min(100, rolloutPct * 2)}%`,
      `Day 14 — 100%`,
    ],
    history: [...subs[idx].history, { at: new Date().toLocaleString(), actor: "operator", note: `${subs[idx].app} → published at ${rolloutPct}% rollout${msg ? `. ${msg}` : "."}` }],
  };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
  recordAudit({
    actor: "operator",
    action: "marketplace.review",
    target: id,
    detail: `${subs[idx].app} ${subs[idx].version} → published at ${rolloutPct}% rollout. ${msg}`,
    severity: "info",
  });
}

export function needsInfoMarketplaceApp(id: string, msg: string): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = {
    ...subs[idx],
    state: "needs_info" as State,
    notes: msg,
    history: [...subs[idx].history, { at: new Date().toLocaleString(), actor: "operator", note: `Requested info${msg ? `: ${msg}` : ""}` }],
  };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
  recordAudit({
    actor: "operator",
    action: "marketplace.review",
    target: id,
    detail: `${subs[idx].app} ${subs[idx].version} → needs_info. ${msg}`,
    severity: "warning",
  });
}

export function suspendMarketplaceApp(id: string, msg: string): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = {
    ...subs[idx],
    state: "suspended" as State,
    notes: msg,
    history: [...subs[idx].history, { at: new Date().toLocaleString(), actor: "operator", note: `Suspended${msg ? `: ${msg}` : ""}` }],
  };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
  recordAudit({
    actor: "operator",
    action: "marketplace.review",
    target: id,
    detail: `${subs[idx].app} ${subs[idx].version} → suspended. ${msg}`,
    severity: "critical",
  });
}

export function rollbackMarketplaceApp(id: string, publishedVersion: string): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = {
    ...subs[idx],
    version: publishedVersion,
    history: [...subs[idx].history, { at: new Date().toLocaleString(), actor: "operator", note: `Rolled back to previous version (${publishedVersion}).` }],
  };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
  recordAudit({
    actor: "operator",
    action: "marketplace.rollback",
    target: id,
    detail: `${subs[idx].app} rolled back to ${publishedVersion}`,
    severity: "warning",
  });
}

export function revokeMarketplaceApp(id: string): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = {
    ...subs[idx],
    state: "revoked" as State,
    rollout: 0,
    history: [...subs[idx].history, { at: new Date().toLocaleString(), actor: "operator", note: "App revoked — uninstalled for all tenants, scopes cut." }],
  };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
  recordAudit({
    actor: "operator",
    action: "marketplace.revoke",
    target: id,
    detail: `Revoked ${subs[idx].app} for all tenants`,
    severity: "critical",
  });
}

export function applyRolloutMarketplaceApp(id: string, pct: number): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = {
    ...subs[idx],
    rollout: pct,
    history: [...subs[idx].history, { at: new Date().toLocaleString(), actor: "operator", note: `Rollout moved to ${pct}%.` }],
  };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
  recordAudit({
    actor: "operator",
    action: "marketplace.rollout",
    target: id,
    detail: `${subs[idx].app} rollout → ${pct}%`,
    severity: "info",
  });
}

export function applySecurityVerdictMarketplaceApp(id: string, qId: string, verdict: "pass" | "fail" | "pending"): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = {
    ...subs[idx],
    security: subs[idx].security.map((q) => (q.id === qId ? { ...q, verdict } : q)),
    history: [...subs[idx].history, { at: new Date().toLocaleString(), actor: "operator", note: `Security answer "${qId}" → ${verdict}.` }],
  };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
  recordAudit({
    actor: "operator",
    action: "marketplace.security_verdict",
    target: id,
    detail: `Security answer "${qId}" → ${verdict}`,
    severity: verdict === "fail" ? "critical" : "info",
  });
}

export function applyNotesMarketplaceApp(id: string, notes: string): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = { ...subs[idx], notes };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
}

export function applySandboxRerunMarketplaceApp(id: string): void {
  const subs = readRaw();
  const idx = subs.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const updated = {
    ...subs[idx],
    sandbox: subs[idx].sandbox.map((t) => ({ ...t, status: "pass" as TestStatus, ms: t.ms || 300 })),
    history: [...subs[idx].history, { at: new Date().toLocaleString(), actor: "operator", note: "Sandbox suite re-run: all checks passing." }],
  };
  writeRaw([...subs.slice(0, idx), updated, ...subs.slice(idx + 1)]);
  recordAudit({
    actor: "operator",
    action: "marketplace.sandbox_rerun",
    target: id,
    detail: `${subs[idx].app} sandbox suite re-run — all checks passing.`,
    severity: "info",
  });
}