"use client";

/**
 * Incident Control Center store — R9 W6 UC-P4 (cross-tenant incident
 * correlation) + R10 persistence for the page's operator state.
 *
 * Why a store: the page kept incidents in a module const and operator
 * state (owner reassignments, escalations, resolutions) in `useState` —
 * an escalation vanished on reload (toast-only-ish action). This store
 * is the persisted layer: seed → stored merge by id, single write path
 * `setIncidentOverride` (the page's assign/escalate/resolve handlers
 * audit with their own action names, as before).
 *
 * UC-P4 adds **provider-root-cause correlation**: every incident may
 * carry a `providerId` from the provider registry (`provider-catalog`);
 * `correlationsFor()` groups OPEN incidents sharing that root cause
 * (≥2 incidents) and unions the affected tenants, which the page shows
 * as the banner "N tenants affected by provider X" with per-tenant
 * deep-links to that tenant's Incidents tab. Acknowledging a correlation
 * persists (`acks`) and writes a `console.correlate_incidents` audit row
 * in one step — no orphan audit, no un-persisted ack.
 *
 * Named consumers: the Incident Control Center correlation banner and
 * the tenant-detail "Incidents" tab (reads the same seed + overrides);
 * the ack's audit row is consumed by the Platform Audit Log. No
 * lifecycle event is emitted — consistent with this page's existing
 * audit-only action convention (assign/escalate/resolve).
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import {
  providerById,
  providerName,
  type Provider,
} from "@/lib/platform/provider-catalog";

const STORAGE_KEY = "pfaas:platform-admin:incident-center";

export type IncidentSeverity = "critical" | "high" | "medium" | "resolved";

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  /** Tenants hit — ids from the tenant roster (deep-link targets). */
  affectedTenantIds: string[];
  /** Provider-registry root cause, when the incident traces to one. */
  providerId?: string;
  affectedServices: string[];
  started: string;
  currentImpact: string;
  owner: string;
  runbook: string;
  relatedAlerts: string[];
}

export interface IncidentOverrides {
  owner?: string;
  severity?: IncidentSeverity;
}

export interface CorrelationAck {
  by: string;
  at: string;
}

export interface IncidentCenterState {
  /** Per-incident operator overrides (assign / escalate / resolve). */
  overrides: Record<string, IncidentOverrides>;
  /** Per-provider correlation acknowledgements (UC-P4). */
  acks: Record<string, CorrelationAck>;
}

/* ------------------------------------------------------------------ */
/* Seed — two correlated groups: Postmark (3 tenants) + MetaApi (2)    */
/* ------------------------------------------------------------------ */

const SEED_INCIDENTS: Incident[] = [
  {
    id: "INC-001",
    title: "MT5 Bridge latency degradation",
    severity: "high",
    affectedTenantIds: ["tenant-alpha", "tenant-beta"],
    providerId: "metaapi",
    affectedServices: ["mt5-bridge", "account-sync"],
    started: "12m ago",
    currentImpact: "Account sync delayed by 30s. Trading unaffected.",
    owner: "Sarah Chen",
    runbook: "RB-MT5-001",
    relatedAlerts: ["ALT-101 (MT5 latency >200ms)", "ALT-104 (Sync job failures: 3)"],
  },
  {
    id: "INC-002",
    title: "Postmark email delivery slow",
    severity: "medium",
    affectedTenantIds: ["tenant-alpha", "tenant-beta", "tenant-gamma"],
    providerId: "postmark",
    affectedServices: ["notification-service"],
    started: "45m ago",
    currentImpact: "Email delivery latency 680ms (normal <200ms). No emails lost.",
    owner: "Marcus Webb",
    runbook: "RB-POSTMARK-001",
    relatedAlerts: ["ALT-202 (Postmark latency >500ms)"],
  },
  {
    id: "INC-003",
    title: "Payment provider timeout (resolved)",
    severity: "resolved",
    affectedTenantIds: ["tenant-gamma"],
    providerId: "nowpayments",
    affectedServices: ["payment-processor"],
    started: "3h ago",
    currentImpact: "Resolved — provider restored after restart. Monitoring for recurrence.",
    owner: "Priya Nair",
    runbook: "RB-PAY-001",
    relatedAlerts: ["ALT-301 (NOWPayments timeout)"],
  },
  {
    // Second Postmark incident — gives the correlation banner its
    // "3 tenants affected by provider Postmark" group (UC-P4).
    id: "INC-004",
    title: "Postmark bounce webhook delays",
    severity: "medium",
    affectedTenantIds: ["tenant-alpha"],
    providerId: "postmark",
    affectedServices: ["notification-service"],
    started: "1h ago",
    currentImpact: "Bounce webhooks delayed up to 4m; suppression list updates lag.",
    owner: "Marcus Webb",
    runbook: "RB-POSTMARK-002",
    relatedAlerts: ["ALT-205 (Webhook queue >60s)"],
  },
  {
    // Second MetaApi incident — the second correlated group.
    id: "INC-005",
    title: "MetaApi bridge disconnects (SG POP)",
    severity: "high",
    affectedTenantIds: ["tenant-beta"],
    providerId: "metaapi",
    affectedServices: ["mt5-bridge"],
    started: "26m ago",
    currentImpact: "2 session drops in 10m on the Singapore POP; orders retried, none lost.",
    owner: "Sarah Chen",
    runbook: "RB-MT5-002",
    relatedAlerts: ["ALT-107 (Bridge session drops: 2)"],
  },
];

const DEFAULT_STATE: IncidentCenterState = { overrides: {}, acks: {} };

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function readRaw(): IncidentCenterState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
    const p = parsed as Partial<IncidentCenterState>;
    return {
      overrides: p.overrides && typeof p.overrides === "object" ? p.overrides : {},
      acks: p.acks && typeof p.acks === "object" ? p.acks : {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeRaw(next: IncidentCenterState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* best-effort persistence */
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
function getSnapshot(): string {
  return JSON.stringify(readRaw());
}
function getServerSnapshot(): string {
  return JSON.stringify(DEFAULT_STATE);
}

export function readIncidentCenter(): IncidentCenterState {
  return readRaw();
}

export function useIncidentCenter(): IncidentCenterState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as IncidentCenterState;
}

/** The seed incidents (module const — read-only source of truth). */
export function readIncidents(): Incident[] {
  return SEED_INCIDENTS.map((i) => ({ ...i }));
}

/* ------------------------------------------------------------------ */
/* Effective view (seed + persisted overrides)                         */
/* ------------------------------------------------------------------ */

export function effectiveSeverity(
  inc: Incident,
  overrides: IncidentCenterState["overrides"],
): IncidentSeverity {
  return overrides[inc.id]?.severity ?? inc.severity;
}

export function effectiveOwner(
  inc: Incident,
  overrides: IncidentCenterState["overrides"],
): string {
  return overrides[inc.id]?.owner ?? inc.owner;
}

/** Assign / escalate / resolve — persistence only; page keeps its audit. */
export function setIncidentOverride(id: string, patch: IncidentOverrides): void {
  const state = readRaw();
  writeRaw({
    ...state,
    overrides: { ...state.overrides, [id]: { ...state.overrides[id], ...patch } },
  });
}

/* ------------------------------------------------------------------ */
/* Correlation (UC-P4)                                                 */
/* ------------------------------------------------------------------ */

export interface Correlation {
  providerId: string;
  providerName: string;
  /** Registry health of the shared root cause, when catalogued. */
  providerStatus?: Provider["status"];
  /** Open incidents sharing the root cause (≥2 to qualify). */
  incidents: Incident[];
  /** Distinct affected tenants across those incidents, in seed order. */
  tenantIds: string[];
  ack?: CorrelationAck;
}

/**
 * Group OPEN incidents by provider-registry root cause. A group needs
 * at least two incidents (that's what "sharing a root cause" means);
 * resolved incidents drop out, so a fixed provider's history stops
 * correlating the moment its incidents are resolved.
 */
export function correlationsFor(
  incidents: Incident[],
  state: IncidentCenterState,
): Correlation[] {
  const byProvider = new Map<string, Incident[]>();
  for (const inc of incidents) {
    if (!inc.providerId) continue;
    if (effectiveSeverity(inc, state.overrides) === "resolved") continue;
    const list = byProvider.get(inc.providerId);
    if (list) list.push(inc);
    else byProvider.set(inc.providerId, [inc]);
  }
  const groups: Correlation[] = [];
  for (const [pid, list] of byProvider) {
    if (list.length < 2) continue;
    const tenantIds: string[] = [];
    for (const inc of list) {
      for (const t of inc.affectedTenantIds) {
        if (!tenantIds.includes(t)) tenantIds.push(t);
      }
    }
    groups.push({
      providerId: pid,
      providerName: providerName(pid),
      providerStatus: providerById(pid)?.status,
      incidents: list,
      tenantIds,
      ack: state.acks[pid],
    });
  }
  return groups.sort((a, b) => b.tenantIds.length - a.tenantIds.length);
}

/**
 * Acknowledge a correlation — persists the ack AND writes the
 * `console.correlate_incidents` audit row in one step (single write
 * path; the Platform Audit Log is the named consumer).
 */
export function acknowledgeCorrelation(
  group: {
    providerId: string;
    providerName: string;
    incidentIds: string[];
    tenantCount: number;
  },
  actor: string,
): void {
  const state = readRaw();
  if (state.acks[group.providerId]) return;
  writeRaw({
    ...state,
    acks: {
      ...state.acks,
      [group.providerId]: { by: actor, at: new Date().toISOString() },
    },
  });
  recordAudit({
    actor,
    action: "console.correlate_incidents",
    target: group.providerName,
    severity: "info",
    detail: `${group.tenantCount} tenants affected by provider ${group.providerName} — correlated ${group.incidentIds.join(", ")}; correlation acknowledged`,
  });
}
