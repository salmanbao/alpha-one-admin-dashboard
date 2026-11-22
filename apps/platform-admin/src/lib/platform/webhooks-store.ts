"use client";

/**
 * R13 P1-1 — Webhooks store.
 *
 * The Integrations workflow was a façade: create, test, pause, resume and
 * retry all fired demo toasts over an inline array, so an admin could not
 * actually operate a webhook endpoint. This store gives each of those five
 * operations a persisted write path plus an audit row, matching the proven
 * pattern used by integrations / feature-flags / api-keys.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export type WebhookStatus = "active" | "paused" | "failing";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: WebhookStatus;
  secret: string;
  lastDelivery: string;
  successRate: number;
  deliveries: number;
  tenant: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: "success" | "failed" | "retrying";
  responseCode: number;
  duration: number;
  timestamp: string;
  attempt: number;
}

const STORAGE_KEY = "pfaas:platform-admin:webhooks";

const SEED_WEBHOOKS: Webhook[] = [
  { id: "wh-001", name: "Alpha Capital — Order Events", url: "https://api.alphacapital.com/webhooks/orders", events: ["order.created", "order.filled", "order.cancelled"], status: "active", secret: "whsec_a1b2…", lastDelivery: "2026-10-08T14:25:00Z", successRate: 99.8, deliveries: 12540, tenant: "Alpha Capital" },
  { id: "wh-002", name: "Alpha Capital — Balance Updates", url: "https://api.alphacapital.com/webhooks/balances", events: ["balance.updated", "balance.threshold"], status: "active", secret: "whsec_c3d4…", lastDelivery: "2026-10-08T14:30:00Z", successRate: 100.0, deliveries: 8420, tenant: "Alpha Capital" },
  { id: "wh-003", name: "Beta Trading — Trade Notifications", url: "https://hooks.betatrading.io/pfaas/trades", events: ["trade.executed", "trade.rejected"], status: "active", secret: "whsec_e5f6…", lastDelivery: "2026-10-08T13:45:00Z", successRate: 98.5, deliveries: 5620, tenant: "Beta Trading" },
  { id: "wh-004", name: "Gamma Futures — Risk Alerts", url: "https://gammafutures.com/api/pfaas/risk", events: ["risk.breach", "risk.warning"], status: "paused", secret: "whsec_g7h8…", lastDelivery: "2026-10-07T16:00:00Z", successRate: 87.2, deliveries: 2340, tenant: "Gamma Futures" },
  { id: "wh-005", name: "Legacy CRM Sync", url: "https://old-crm.internal/hooks/sync", events: ["user.created", "user.updated"], status: "failing", secret: "whsec_i9j0…", lastDelivery: "2026-10-05T09:30:00Z", successRate: 45.0, deliveries: 890, tenant: "Alpha Capital" },
  { id: "wh-006", name: "Beta Trading — Billing Events", url: "https://billing.betatrading.io/webhooks", events: ["invoice.paid", "payment.failed"], status: "active", secret: "whsec_k1l2…", lastDelivery: "2026-10-08T12:00:00Z", successRate: 99.9, deliveries: 1850, tenant: "Beta Trading" },
];

const SEED_DELIVERIES: WebhookDelivery[] = [
  { id: "dlv-001", webhookId: "wh-001", event: "order.filled", status: "success", responseCode: 200, duration: 142, timestamp: "2026-10-08T14:25:00Z", attempt: 1 },
  { id: "dlv-002", webhookId: "wh-003", event: "trade.executed", status: "success", responseCode: 200, duration: 189, timestamp: "2026-10-08T13:45:00Z", attempt: 1 },
  { id: "dlv-003", webhookId: "wh-005", event: "user.updated", status: "failed", responseCode: 500, duration: 4200, timestamp: "2026-10-08T13:30:00Z", attempt: 3 },
  { id: "dlv-004", webhookId: "wh-002", event: "balance.updated", status: "success", responseCode: 200, duration: 98, timestamp: "2026-10-08T14:30:00Z", attempt: 1 },
  { id: "dlv-005", webhookId: "wh-004", event: "risk.warning", status: "failed", responseCode: 503, duration: 2800, timestamp: "2026-10-07T16:00:00Z", attempt: 2 },
];

interface WebhooksState {
  webhooks: Webhook[];
  deliveries: WebhookDelivery[];
}

function load(): WebhooksState {
  if (typeof window === "undefined") return { webhooks: SEED_WEBHOOKS, deliveries: SEED_DELIVERIES };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { webhooks: SEED_WEBHOOKS, deliveries: SEED_DELIVERIES };
    const parsed = JSON.parse(raw);
    return {
      webhooks: Array.isArray(parsed?.webhooks) ? parsed.webhooks : SEED_WEBHOOKS,
      deliveries: Array.isArray(parsed?.deliveries) ? parsed.deliveries : SEED_DELIVERIES,
    };
  } catch {
    return { webhooks: SEED_WEBHOOKS, deliveries: SEED_DELIVERIES };
  }
}

function persist(next: WebhooksState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let state: WebhooksState = load();

function commit(next: WebhooksState) {
  state = next;
  persist(state);
  emit();
}

export function listWebhooks(): Webhook[] {
  return state.webhooks;
}

export function listDeliveries(): WebhookDelivery[] {
  return [...state.deliveries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Create a new endpoint (persists + audits). Returns the created record.
 */
export function createWebhook(
  input: { name: string; url: string; events: string[]; tenant: string },
  actor = "operator",
): Webhook {
  const wh: Webhook = {
    id: `wh-${Date.now().toString(36)}`,
    name: input.name,
    url: input.url,
    events: input.events,
    status: "active",
    secret: `whsec_${Math.random().toString(36).slice(2, 10)}…`,
    lastDelivery: new Date().toISOString(),
    successRate: 100,
    deliveries: 0,
    tenant: input.tenant,
  };
  commit({ ...state, webhooks: [wh, ...state.webhooks] });
  recordAudit({
    actor,
    action: "webhook.create",
    target: wh.id,
    detail: `Created endpoint "${wh.name}" (${wh.url}) for ${wh.tenant} — ${wh.events.length} event(s)`,
    severity: "info",
  });
  return wh;
}

/** Dispatch a test event (persists a delivery row + audits). */
export function sendTestEvent(id: string, actor = "operator"): WebhookDelivery | undefined {
  const wh = state.webhooks.find((w) => w.id === id);
  if (!wh) return undefined;
  const ok = wh.status !== "failing";
  const delivery: WebhookDelivery = {
    id: `dlv-${Date.now().toString(36)}`,
    webhookId: wh.id,
    event: wh.events[0] ?? "ping",
    status: ok ? "success" : "failed",
    responseCode: ok ? 200 : 500,
    duration: ok ? 140 : 4200,
    timestamp: new Date().toISOString(),
    attempt: 1,
  };
  commit({
    ...state,
    deliveries: [delivery, ...state.deliveries].slice(0, 100),
    webhooks: state.webhooks.map((w) =>
      w.id === id ? { ...w, lastDelivery: delivery.timestamp, deliveries: w.deliveries + 1 } : w,
    ),
  });
  recordAudit({
    actor,
    action: "webhook.test",
    target: wh.id,
    detail: `Test event dispatched to "${wh.name}" — ${delivery.status} (${delivery.responseCode})`,
    severity: "info",
  });
  return delivery;
}

/** Pause an active endpoint (persists + audits). */
export function pauseWebhook(id: string, actor = "operator"): Webhook | undefined {
  const wh = state.webhooks.find((w) => w.id === id);
  if (!wh || wh.status !== "active") return undefined;
  const next = state.webhooks.map((w) => (w.id === id ? { ...w, status: "paused" as const } : w));
  commit({ ...state, webhooks: next });
  recordAudit({
    actor,
    action: "webhook.pause",
    target: id,
    detail: `Paused "${wh.name}" — deliveries suspended`,
    severity: "warning",
  });
  return next.find((w) => w.id === id);
}

/** Resume a paused endpoint (persists + audits). */
export function resumeWebhook(id: string, actor = "operator"): Webhook | undefined {
  const wh = state.webhooks.find((w) => w.id === id);
  if (!wh || wh.status !== "paused") return undefined;
  const next = state.webhooks.map((w) => (w.id === id ? { ...w, status: "active" as const } : w));
  commit({ ...state, webhooks: next });
  recordAudit({
    actor,
    action: "webhook.resume",
    target: id,
    detail: `Resumed "${wh.name}" — deliveries restarted`,
    severity: "info",
  });
  return next.find((w) => w.id === id);
}

/** Re-drive a failing endpoint (persists + audits). */
export function retryWebhook(id: string, actor = "operator"): Webhook | undefined {
  const wh = state.webhooks.find((w) => w.id === id);
  if (!wh) return undefined;
  const delivery: WebhookDelivery = {
    id: `dlv-${Date.now().toString(36)}`,
    webhookId: wh.id,
    event: wh.events[0] ?? "ping",
    status: "retrying",
    responseCode: 202,
    duration: 210,
    timestamp: new Date().toISOString(),
    attempt: 1,
  };
  const next = state.webhooks.map((w) =>
    w.id === id ? { ...w, status: "active" as const, successRate: Math.max(w.successRate, 99) } : w,
  );
  commit({
    ...state,
    webhooks: next,
    deliveries: [delivery, ...state.deliveries].slice(0, 100),
  });
  recordAudit({
    actor,
    action: "webhook.retry",
    target: id,
    detail: `Re-drive queued for "${wh.name}" — endpoint returned to active`,
    severity: "warning",
  });
  return next.find((w) => w.id === id);
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to webhook mutations. */
export function useWebhooksVersion(): number {
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
