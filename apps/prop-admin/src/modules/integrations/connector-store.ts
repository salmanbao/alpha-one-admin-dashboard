"use client";

/**
 * M1 — Connector store (spec §5).
 *
 * Single source of truth for configured connector records. The hub
 * table, the configuration drawer (5.2), the add-connector wizard
 * (5.3) and the activity log (5.4) all render from this store, so a
 * mutation on one surface updates every other surface instantly.
 *
 * Dummy data only — no network calls. Mutations:
 *  - apply optimistic local updates,
 *  - write an entry through the audit chokepoint (lib/audit.ts),
 *  - are confirmed by the caller via toast,
 *  - mirror into localStorage (demo-persistence) so a reload keeps
 *    the session's changes (reset via topbar → Reset demo session).
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoConnectorsSchema } from "@/lib/platform/validation";
import { getConnectorDefinition } from "./registry";
import type { ConnectorRecord, HubStatusFilter } from "./types";

/* ------------------------------------------------------------------ */
/* Seed data (deterministic offsets from load time — no Math.random)   */
/* ------------------------------------------------------------------ */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Active connectors 24h ago — baseline for the KPI delta chip. */
const ACTIVE_PREV_24H = 6;

function iso(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

function seedRecords(): ConnectorRecord[] {
  return [
    {
      id: "con-klaviyo",
      definitionId: "klaviyo",
      status: "connected",
      active: true,
      eventLogging: true,
      config: { credentials: '{"private_key": "pk_demo_not_real"}', list_id: "XyZ123" },
      connectedAt: iso(42 * DAY),
      lastSync: iso(4 * MIN),
      nextSync: iso(-11 * MIN),
      events24h: 1284,
      eventsPrev24h: 1102,
      health: "ok",
      latencyMs: 182,
      accountLabel: "Alpha Capital",
    },
    {
      id: "con-mailchimp",
      definitionId: "mailchimp",
      status: "connected",
      active: true,
      eventLogging: true,
      config: { api_key: "abc123def456-us1", server: "us1" },
      connectedAt: iso(38 * DAY),
      lastSync: iso(12 * MIN),
      nextSync: iso(-3 * MIN),
      events24h: 842,
      eventsPrev24h: 890,
      health: "ok",
      latencyMs: 240,
      accountLabel: "alpha-capital",
    },
    {
      id: "con-ga4",
      definitionId: "ga4",
      status: "connected",
      active: true,
      eventLogging: true,
      config: { measurement_id: "G-DEMO12345", api_secret: "demo_secret_not_real" },
      connectedAt: iso(30 * DAY),
      lastSync: iso(2 * MIN),
      nextSync: iso(-13 * MIN),
      events24h: 5120,
      eventsPrev24h: 4877,
      health: "ok",
      latencyMs: 96,
      accountLabel: "properties/448129017",
    },
    {
      id: "con-meta-pixel",
      definitionId: "meta-pixel",
      status: "degraded",
      active: true,
      eventLogging: true,
      config: { pixel_id: "1234567890123456", access_token: "demo_token_not_real" },
      connectedAt: iso(21 * DAY),
      lastSync: iso(2 * HOUR),
      lastError: "Rate limited by Meta Graph API (HTTP 429) — retrying with backoff.",
      lastErrorAt: iso(40 * MIN),
      events24h: 2310,
      eventsPrev24h: 3005,
      health: "warn",
      latencyMs: 610,
      accountLabel: "pixel 1234567890123456",
    },
    {
      id: "con-hubspot",
      definitionId: "hubspot",
      status: "error",
      active: true,
      eventLogging: true,
      config: { portal_id: "12345678" },
      connectedAt: iso(15 * DAY),
      lastSync: iso(3 * HOUR),
      lastError: "OAuth refresh token expired — HTTP 401 invalid_grant. Reconnect to resume sync.",
      lastErrorAt: iso(25 * MIN),
      events24h: 12,
      eventsPrev24h: 402,
      health: "fail",
      accountLabel: "Alpha Capital CRM",
    },
    {
      id: "con-slack",
      definitionId: "slack",
      status: "connected",
      active: false,
      eventLogging: true,
      config: { webhook_url: "https://hooks.slack.com/services/demo/not-real", channel: "#alerts" },
      connectedAt: iso(10 * HOUR),
      lastSync: iso(30 * MIN),
      nextSync: iso(-6 * MIN),
      events24h: 96,
      eventsPrev24h: 88,
      health: "ok",
      latencyMs: 133,
    },
    {
      id: "con-discord",
      definitionId: "discord",
      status: "connected",
      active: true,
      eventLogging: false,
      config: { webhook_url: "https://discord.com/api/webhooks/demo/not-real" },
      connectedAt: iso(9 * DAY),
      lastSync: iso(65 * MIN),
      events24h: 41,
      eventsPrev24h: 39,
      health: "ok",
      latencyMs: 210,
    },
    {
      id: "con-listmonk",
      definitionId: "listmonk",
      status: "connected",
      active: true,
      eventLogging: true,
      config: { base_url: "https://lists.alphacapital.io", token: "demo_token_not_real" },
      connectedAt: iso(6 * HOUR),
      lastSync: iso(18 * MIN),
      nextSync: iso(-7 * MIN),
      events24h: 264,
      eventsPrev24h: 250,
      health: "ok",
      latencyMs: 305,
      accountLabel: "listmonk@alphacapital.io",
    },
    {
      id: "con-google-ads",
      definitionId: "google-ads",
      status: "disconnected",
      active: false,
      eventLogging: false,
      config: {},
      events24h: 0,
      eventsPrev24h: 0,
      health: "idle",
    },
    {
      id: "con-sendgrid",
      definitionId: "sendgrid",
      status: "disconnected",
      active: false,
      eventLogging: false,
      config: {},
      events24h: 0,
      eventsPrev24h: 0,
      health: "idle",
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

let records: ConnectorRecord[] = loadDemoState(
  "connectors",
  demoConnectorsSchema,
  seedRecords(),
);

const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version += 1;
  saveDemoState("connectors", records);
  listeners.forEach((l) => l());
}

function replace(id: string, patch: Partial<ConnectorRecord>): void {
  records = records.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

function byId(id: string): ConnectorRecord | undefined {
  return records.find((r) => r.id === id);
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function getConnectors(): ConnectorRecord[] {
  return records;
}

export function getConnector(id: string): ConnectorRecord | undefined {
  return byId(id);
}

/** Subscribe the calling component to store mutations. */
export function useConnectorVersion(): number {
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

/** KPI aggregates for the hub MetricCard row (spec 5.1). */
export interface HubKpis {
  total: number;
  totalDelta: number;
  connected: number;
  connectedDelta: number;
  active: number;
  activeDelta: number;
  events24h: number;
  eventsDelta: number;
  needsAttention: number;
}

/**
 * Hub KPI row. 24h deltas compare against the previous 24h window:
 * events are summed from the records; connector-count deltas come from
 * `added24h` (records connected within the last 24h) since a count has
 * no per-hour series in the dummy data.
 */
export function getHubKpis(list: ConnectorRecord[] = records): HubKpis {
  const total = list.length;
  const connected = list.filter((r) => r.status !== "disconnected").length;
  const active = list.filter((r) => r.active).length;
  const events24h = list.reduce((s, r) => s + r.events24h, 0);
  const eventsPrev = list.reduce((s, r) => s + r.eventsPrev24h, 0);
  const added24h = list.filter((r) => {
    if (!r.connectedAt) return false;
    return Date.now() - new Date(r.connectedAt).getTime() < DAY;
  }).length;
  const needsAttention = list.filter(
    (r) => r.status === "degraded" || r.status === "error",
  ).length;

  const pct = (now: number, before: number): number => {
    if (before <= 0) return now > 0 ? 100 : 0;
    return Math.round(((now - before) / before) * 100);
  };

  return {
    total,
    // Total vs. what it was 24h ago (before the recently added rows).
    totalDelta: pct(total, total - added24h),
    connected,
    connectedDelta: pct(connected, Math.max(1, connected - added24h)),
    active,
    activeDelta: pct(active, ACTIVE_PREV_24H),
    events24h,
    eventsDelta: pct(events24h, eventsPrev),
    needsAttention,
  };
}

/** Row predicate for the hub toolbar filters. */
export function matchesHubFilters(
  r: ConnectorRecord,
  opts: {
    preset: string;
    status: HubStatusFilter;
    categories: readonly string[];
    query: string;
  },
): boolean {
  const def = getConnectorDefinition(r.definitionId);
  if (opts.preset === "attention" && r.status !== "degraded" && r.status !== "error") {
    return false;
  }
  if (opts.preset === "connected" && r.status !== "connected") return false;
  if (opts.status !== "all" && r.status !== opts.status) return false;
  if (opts.categories.length > 0 && (!def || !opts.categories.includes(def.category))) {
    return false;
  }
  if (opts.query.trim()) {
    const q = opts.query.trim().toLowerCase();
    const haystack = `${def?.name ?? ""} ${def?.category ?? ""} ${def?.authKind ?? ""}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Writes (optimistic + audit; caller confirms with toast)             */
/* ------------------------------------------------------------------ */

function audit(
  action: string,
  entityId: string,
  summary: string,
  severity: "info" | "warning" | "critical" = "info",
): void {
  recordAudit({
    action,
    entity: "connector",
    entityId,
    module: "marketing",
    summary,
    severity,
  });
}

/** Active switch — optimistic, audit + toast handled by the caller. */
export function toggleConnectorActive(id: string): boolean {
  const rec = byId(id);
  if (!rec) return false;
  const next = !rec.active;
  replace(id, { active: next });
  audit(
    next ? "Activated connector" : "Paused connector",
    id,
    `${getConnectorDefinition(rec.definitionId)?.name ?? rec.definitionId} → ${next ? "active" : "inactive"}`,
  );
  emit();
  return next;
}

/** Event-logging switch — optimistic, audit + toast handled by the caller. */
export function toggleConnectorEventLogging(id: string): boolean {
  const rec = byId(id);
  if (!rec) return false;
  const next = !rec.eventLogging;
  replace(id, { eventLogging: next });
  audit(
    next ? "Enabled connector event logging" : "Disabled connector event logging",
    id,
    `${getConnectorDefinition(rec.definitionId)?.name ?? rec.definitionId} event logging ${next ? "on" : "off"}`,
    next ? "info" : "warning",
  );
  emit();
  return next;
}

/**
 * Save config/options from the drawer (5.2). Validates JSON fields
 * before writing; returns the list of invalid field keys (empty = ok).
 * The audit entry records field names only — never values.
 */
export function saveConnectorConfig(
  id: string,
  patch: Partial<
    Pick<
      ConnectorRecord,
      "config" | "active" | "eventLogging" | "nextSync" | "syncFrequency" | "audienceTarget"
    >
  >,
): string[] {
  const rec = byId(id);
  if (!rec) return ["__missing"];
  const def = getConnectorDefinition(rec.definitionId);

  if (patch.config) {
    const invalid: string[] = [];
    for (const field of def?.fields ?? []) {
      if (!field.json) continue;
      const value = patch.config[field.key];
      if (!value) continue;
      try {
        JSON.parse(value);
      } catch {
        invalid.push(field.key);
      }
    }
    if (invalid.length > 0) return invalid;
  }

  const changedFields = patch.config
    ? Object.keys(patch.config).filter((k) => rec.config[k] !== patch.config![k])
    : [];
  replace(id, patch);
  audit(
    "Updated connector config",
    id,
    `${def?.name ?? rec.definitionId} — changed fields: ${changedFields.length > 0 ? changedFields.join(", ") : "options only"}`,
  );
  emit();
  return [];
}

/**
 * Disconnect — flips status to disconnected, purges credentials and
 * stops sync. The row stays so it can be reconnected later.
 */
export function disconnectConnector(id: string): void {
  const rec = byId(id);
  if (!rec) return;
  const name = getConnectorDefinition(rec.definitionId)?.name ?? rec.definitionId;
  replace(id, {
    status: "disconnected",
    active: false,
    eventLogging: false,
    config: {},
    health: "idle",
    lastSync: undefined,
    nextSync: undefined,
    lastError: undefined,
    lastErrorAt: undefined,
    connectedAt: undefined,
    accountLabel: undefined,
    events24h: 0,
    eventsPrev24h: 0,
    latencyMs: undefined,
  });
  audit(
    "Disconnected connector",
    id,
    `${name} — credentials purged, event sync stopped`,
    "warning",
  );
  emit();
}

/** Result of a simulated provider test call. */
export interface TestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
  accountLabel?: string;
}

/**
 * Test Connection — simulated round-trip against the *current* form
 * values (no network). Lets the drawer and the wizard test unsaved
 * credentials before committing them. Deterministic rules:
 *  - missing required fields / malformed JSON → failure naming the field,
 *  - a secret shorter than 8 chars → HTTP 401-class failure naming the
 *    invalid field (the wizard's "invalid API key" path),
 *  - an unchanged record already in Error state → the stored provider
 *    message (scope / token class errors),
 *  - otherwise → success with latency and account label.
 */
export function testConnectorValues(
  definitionId: string,
  config: Record<string, string>,
): Promise<TestResult> {
  const def = getConnectorDefinition(definitionId);
  const rec = records.find((r) => r.definitionId === definitionId);
  const latencyMs = 120 + ((definitionId.length * 37) % 380);

  return new Promise<TestResult>((resolve) => {
    setTimeout(() => {
      if (!def) {
        resolve({
          ok: false,
          latencyMs,
          message: "Unknown connector — it is not in the registry.",
        });
        return;
      }
      const missing = def.fields
        .filter((f) => f.required && !(config[f.key] ?? "").trim())
        .map((f) => f.label);
      if (missing.length > 0) {
        resolve({
          ok: false,
          latencyMs,
          message: `Missing required credentials: ${missing.join(", ")}.`,
        });
        return;
      }
      for (const f of def.fields) {
        if (f.json && config[f.key]) {
          try {
            JSON.parse(config[f.key]);
          } catch {
            resolve({
              ok: false,
              latencyMs,
              message: `${f.label} is not valid JSON — the provider rejected it.`,
            });
            return;
          }
        }
        if (f.secret && (config[f.key] ?? "").length < 8) {
          resolve({
            ok: false,
            latencyMs,
            message: `HTTP 401 invalid credentials — ${f.label} looks too short to be a valid key.`,
          });
          return;
        }
      }
      const unchanged =
        rec !== undefined && JSON.stringify(rec.config) === JSON.stringify(config);
      if (unchanged && rec!.status === "error") {
        resolve({
          ok: false,
          latencyMs,
          message: rec!.lastError ?? `${def.name} rejected the credentials (HTTP 401).`,
        });
        return;
      }
      if (unchanged && rec!.status === "disconnected") {
        resolve({
          ok: false,
          latencyMs,
          message: "Credentials missing — open Configure and save the connector first.",
        });
        return;
      }
      resolve({
        ok: true,
        latencyMs,
        message: `${def.name} responded OK.`,
        accountLabel: rec?.accountLabel ?? `${def.name} workspace`,
      });
    }, 450 + (latencyMs % 300));
  });
}

/** Test a saved record using its stored credentials. */
export function testConnector(id: string): Promise<TestResult> {
  const rec = byId(id);
  if (!rec) {
    return Promise.resolve({ ok: false, latencyMs: 250, message: "Connector not found." });
  }
  return testConnectorValues(rec.definitionId, rec.config);
}

/** Id of the connector created this session (wizard Finish) — the
 *  activity log (5.4) preselects it in its connector filter. */
let lastCreatedConnectorId: string | null = null;

export function getLastCreatedConnectorId(): string | null {
  return lastCreatedConnectorId;
}

/**
 * Install a connector from the catalog (wizard Finish / JSON import).
 * New records land Connected with event logging on by default.
 */
export function addConnector(
  definitionId: string,
  config: Record<string, string>,
  opts?: {
    eventLogging?: boolean;
    syncFrequency?: ConnectorRecord["syncFrequency"];
    audienceTarget?: string;
  },
): ConnectorRecord | undefined {
  const def = getConnectorDefinition(definitionId);
  if (!def) return undefined;
  const existing = records.find((r) => r.definitionId === definitionId);
  const record: ConnectorRecord = {
    id: `con-${definitionId}-${Date.now().toString(36)}`,
    definitionId,
    status: "connected",
    active: true,
    eventLogging: opts?.eventLogging ?? true,
    config,
    connectedAt: new Date().toISOString(),
    lastSync: new Date().toISOString(),
    events24h: 0,
    eventsPrev24h: 0,
    health: "ok",
    latencyMs: 200,
    syncFrequency: opts?.syncFrequency ?? "hourly",
    audienceTarget: opts?.audienceTarget,
  };
  // Re-installing an existing catalog entry replaces its record.
  records = existing
    ? records.map((r) => (r.id === existing.id ? record : r))
    : [record, ...records];
  lastCreatedConnectorId = record.id;
  audit(
    "Created connector",
    record.id,
    `${def.name} (${def.category}, ${def.authKind}) connected`,
  );
  emit();
  return record;
}
