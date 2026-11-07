"use client";
/**
 * R4-01 — Send Queue & Gateway Health store (dummy, store-backed).
 *
 * Models the send gateway's queue lifecycle end-to-end without a runtime:
 *   • queue: per-channel message state (queued/sending/retry/dead)
 *   • retry() — AC-1: re-enqueue a queued/retry/dead message; visible without reload.
 *   • deadLetterReplay(ids, actor) — AC-2: replay dead-lettered messages, audit-logged.
 *   • killSwitch — AC-3: halts dispatch store-wide within one tick.
 *
 * Adapter health/latency/daily-cap reads reuse channel-infra-store shapes.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";
import { listProviders } from "./channel-infra-store";

/* ------------------------------------------------------------------ */
/* Model                                                              */
/* ------------------------------------------------------------------ */

export type QueueState = "queued" | "sending" | "retry" | "dead" | "delivered";

export interface SendMessage {
  id: string;
  campaign: string;
  tenant: string;
  channel: "email" | "sms" | "whatsapp" | "push" | "in-app";
  state: QueueState;
  attempts: number;
  maxAttempts: number;
  nextAttempt?: string;
  providerResponse?: string;
  providerId?: string;
  createdAt: string;
  updatedAt: string;
  halted?: boolean;
  trace: SendTraceEntry[];
}

export interface SendTraceEntry {
  at: string;
  event: string;
  detail?: string;
}

export interface QueueMetric {
  channel: string;
  depth: number;
}

export interface AdapterState {
  id: string;
  name: string;
  channel: string;
  health: "ok" | "degraded" | "down";
  latencyMs: number;
  dailyCap?: number;
  usedToday?: number;
  circuitBreaker: "closed" | "open" | "half-open";
}

const now = () => new Date().toISOString();

function trace(...entries: { event: string; detail?: string; offsetMs: number }[]): SendTraceEntry[] {
  const base = Date.now();
  return entries.map(e => ({ at: new Date(base - e.offsetMs).toISOString(), event: e.event, detail: e.detail }));
}

/* ------------------------------------------------------------------ */
/* Seed Queue                                                         */
/* ------------------------------------------------------------------ */

let QUEUES: SendMessage[] = [
  {
    id: "msg-001", campaign: "Q4-Sale-Blast", tenant: "tenant-alpha", channel: "email",
    state: "queued", attempts: 1, maxAttempts: 5, providerId: "prov-sendgrid",
    createdAt: now(), updatedAt: now(),
    trace: trace({ event: "enqueue", detail: "segment=high-value (consent OK)", offsetMs: 90000 },
                   { event: "consent-check", detail: "opted-in: yes", offsetMs: 89500 },
                   { event: "segment-decision", detail: "admitted (642 contacts)", offsetMs: 89000 }),
  },
  {
    id: "msg-002", campaign: "Q4-Sale-Blast", tenant: "tenant-alpha", channel: "sms",
    state: "sending", attempts: 2, maxAttempts: 5, nextAttempt: undefined,
    providerResponse: "accepted by Twilio (queued)", providerId: "prov-twilio",
    createdAt: now(), updatedAt: now(),
    trace: trace({ event: "enqueue", detail: "segment=new-signups", offsetMs: 45000 },
                   { event: "dispatch", detail: "Twilio API 201", offsetMs: 12000 }),
  },
  {
    id: "msg-003", campaign: "Welcome-Journey", tenant: "tenant-alpha", channel: "email",
    state: "retry", attempts: 3, maxAttempts: 5, nextAttempt: new Date(Date.now() + 5 * 60000).toISOString(),
    providerResponse: "421 temporarily deferred", providerId: "prov-sendgrid",
    createdAt: now(), updatedAt: now(),
    trace: trace({ event: "enqueue", offsetMs: 200000 },
                   { event: "dispatch", detail: "421 temporarily deferred", offsetMs: 60000 },
                   { event: "retry-scheduled", detail: "+5m", offsetMs: 30000 }),
  },
  {
    id: "msg-004", campaign: "Promo-Flash", tenant: "tenant-beta", channel: "whatsapp",
    state: "dead", attempts: 5, maxAttempts: 5,
    providerResponse: "rejected: template not approved", providerId: "prov-meta-wa",
    createdAt: now(), updatedAt: now(),
    trace: trace({ event: "enqueue", offsetMs: 300000 },
                   { event: "dispatch", detail: "rejected: template not approved", offsetMs: 90000 },
                   { event: "dead-lettered", detail: "max attempts reached", offsetMs: 0 }),
  },
  {
    id: "msg-005", campaign: "Q4-Sale-Blast", tenant: "tenant-alpha", channel: "push",
    state: "queued", attempts: 1, maxAttempts: 5, providerId: "prov-fcm",
    createdAt: now(), updatedAt: now(),
    trace: trace({ event: "enqueue", offsetMs: 15000 }),
  },
  {
    id: "msg-006", campaign: "Onboarding-Series", tenant: "tenant-gamma", channel: "email",
    state: "delivered", attempts: 1, maxAttempts: 5, providerResponse: "250 OK", providerId: "prov-sendgrid",
    createdAt: now(), updatedAt: now(),
    trace: trace({ event: "enqueue", offsetMs: 500000 },
                   { event: "dispatch", detail: "250 OK (delivered)", offsetMs: 10000 }),
  },
  {
    id: "msg-007", campaign: "Security-Alert", tenant: "tenant-beta", channel: "sms",
    state: "dead", attempts: 5, maxAttempts: 5,
    providerResponse: "blocked: do-not-disturb window", providerId: "prov-twilio",
    createdAt: now(), updatedAt: now(),
    trace: trace({ event: "enqueue", offsetMs: 180000 },
                   { event: "dead-lettered", detail: "DND window", offsetMs: 60000 }),
  },
  {
    id: "msg-008", campaign: "Q4-Sale-Blast", tenant: "tenant-alpha", channel: "email",
    state: "sending", attempts: 1, maxAttempts: 5, providerId: "prov-sendgrid",
    createdAt: now(), updatedAt: now(),
    trace: trace({ event: "enqueue", offsetMs: 10000 },
                   { event: "dispatch", detail: "SendGrid API 202", offsetMs: 2000 }),
  },
];

let KILL_SWITCH = false;

/* ------------------------------------------------------------------ */
/* Reads                                                              */
/* ------------------------------------------------------------------ */

export function listQueue() { return [...QUEUES].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }

export function getMessage(id: string) { return QUEUES.find(m => m.id === id); }

export function deadLetterCount() { return QUEUES.filter(m => m.state === "dead").length; }

export function queueDepthByChannel() {
  const out: Record<string, number> = {};
  for (const m of QUEUES) {
    if (m.state !== "delivered") out[m.channel] = (out[m.channel] || 0) + 1;
  }
  return out;
}

export function oldestQueuedAgeMs() {
  const q = QUEUES.filter(m => m.state === "queued");
  if (!q.length) return 0;
  return Math.max(...q.map(m => Date.now() - new Date(m.createdAt).getTime()));
}

export function dispatchRateLastHour() {
  const hourAgo = Date.now() - 3600000;
  return QUEUES.filter(m => new Date(m.updatedAt).getTime() > hourAgo).length;
}

export function adapters(): AdapterState[] {
  return listProviders().map(p => ({
    id: p.id,
    name: p.name,
    channel: p.channel,
    health: p.health,
    latencyMs: p.health === "down" ? 0 : Math.round(60 + Math.random() * 300),
    dailyCap: p.dailyCap,
    usedToday: p.usedToday,
    circuitBreaker: p.health === "down" ? "open" : "closed",
  }));
}

export function isKillSwitchOn() { return KILL_SWITCH; }

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

export interface RetryResult { id: string; state: QueueState; }

/** AC-1: re-enqueue a queued/retry/dead message; visible without reload. */
export function retry(id: string): RetryResult | null {
  const m = QUEUES.find(x => x.id === id);
  if (!m || m.state === "delivered") return null;
  const next: SendMessage = {
    ...m, state: "queued", attempts: m.attempts + 1, nextAttempt: undefined,
    halted: false, providerResponse: undefined, updatedAt: now(),
    trace: [...m.trace, { at: now(), event: "retry", detail: "re-enqueued by operator" }],
  };
  QUEUES = QUEUES.map(x => x.id === id ? next : x);
  return { id: next.id, state: next.state };
}

/** AC-2: replay dead-lettered message(s); audit-logged with actor + target. */
export function deadLetterReplay(ids: string[], actor: string): string[] {
  const replayed: string[] = [];
  for (const id of ids) {
    const m = QUEUES.find(x => x.id === id);
    if (!m || m.state !== "dead") continue;
    const next: SendMessage = {
      ...m, state: "queued", attempts: 0, nextAttempt: undefined, halted: false,
      providerResponse: undefined, updatedAt: now(),
      trace: [...m.trace, { at: now(), event: "dead-letter-replay", detail: `replayed by ${actor}` }],
    };
    QUEUES = QUEUES.map(x => x.id === id ? next : x);
    replayed.push(id);
    recordAudit({
      action: "dead-letter.replay", entity: "send-message", entityId: id,
      summary: `Dead-lettered message ${id} (${m.campaign}, ${m.channel}) replayed by ${actor}`,
      module: "marketing",
      severity: "info",
      actor,
    });
  }
  return replayed;
}

/** AC-3: kill-switch halts dispatch store-wide within one tick. */
export function setKillSwitch(on: boolean, actor: string) {
  KILL_SWITCH = on;
  QUEUES = QUEUES.map(m => {
    if (m.state === "queued" || m.state === "sending" || m.state === "retry") {
      return { ...m, halted: on, updatedAt: now(),
        trace: [...m.trace, { at: now(), event: on ? "kill-switch-engage" : "kill-switch-release", detail: on ? "dispatch halted store-wide" : "dispatch released by operator" }] };
    }
    return m;
  });
  recordAudit({
    action: on ? "kill-switch.engage" : "kill-switch.release", entity: "send-gateway", entityId: "global",
    summary: `Send gateway kill-switch ${on ? "engaged" : "released"} by ${actor}`,
    module: "marketing", severity: on ? "warning" : "info", actor,
  });
}

export function haltCampaign(campaign: string, actor: string) {
  QUEUES = QUEUES.map(m => m.campaign === campaign && (m.state === "queued" || m.state === "sending" || m.state === "retry")
    ? { ...m, halted: true, updatedAt: now(), trace: [...m.trace, { at: now(), event: "campaign-halt", detail: `campaign ${campaign} halted by ${actor}` }] }
    : m);
  recordAudit({ action: "campaign.halt", entity: "campaign", entityId: campaign,
    summary: `Campaign ${campaign} halted by ${actor}`, module: "marketing", severity: "warning", actor });
}

/* ------------------------------------------------------------------ */
/* React subscription                                                 */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() { version += 1; listeners.forEach(l => l()); }

// Mutations above mutate QUEUES directly; emits wired via the $ wrappers below.

export function retry$(id: string) { const r = retry(id); emit(); return r; }
export function deadLetterReplay$(ids: string[], actor: string) { const r = deadLetterReplay(ids, actor); emit(); return r; }
export function setKillSwitch$(on: boolean, actor: string) { setKillSwitch(on, actor); emit(); }
export function haltCampaign$(campaign: string, actor: string) { haltCampaign(campaign, actor); emit(); }

export function useQueueVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return v;
}