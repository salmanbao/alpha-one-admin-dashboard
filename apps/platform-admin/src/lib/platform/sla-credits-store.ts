"use client";

/**
 * Provider SLA credits — R9 W6 UC-P5.
 *
 * Provider downtime incidents in the Incident Control Center turn into
 * per-tenant credit rows here, priced from the tenant's plan tier:
 *
 *   - **Which incidents qualify** (Demo policy, labeled in the UI):
 *     an incident rated `high` or `critical` — by seed severity or by
 *     an operator escalation (so escalating a medium incident to high
 *     makes credits appear). Resolved incidents keep their row (the
 *     outage happened) but flip to `applied`.
 *   - **Rate from plan tier**: `SLA_CREDIT_RATES` — one credit per
 *     qualifying incident per affected tenant on the roster.
 *   - **Adjustments**: an operator may change a row's amount, but only
 *     with a reason — `adjustSlaCredit` persists the adjustment AND
 *     writes the `console.sla_credit_adjusted` audit row in one step
 *     (single write path; no orphan audit, no un-persisted change).
 *
 * Persistence: `pfaas:platform-admin:sla-credits` holds only the
 * operator adjustments (`{ [rowId]: adjustment }`); the rows themselves
 * are derived from incident-center-store + tenant-store so they can
 * never drift from the incidents that produced them.
 *
 * Named consumers: the "Provider SLA credits" card on the tenant-detail
 * Billing tab (rows + totals) and the Platform Audit Log (adjustment
 * rows). No lifecycle event is emitted — consistent with the console's
 * audit-only action convention for platform operator actions.
 */

import { useSyncExternalStore, useMemo } from "react";
import { recordAudit } from "@/lib/platform/console-store";
import {
  readIncidents,
  useIncidentCenter,
  effectiveSeverity,
  type Incident,
  type IncidentCenterState,
} from "@/lib/platform/incident-center-store";
import { providerName } from "@/lib/platform/provider-catalog";
import { useTenants } from "@/lib/platform/tenant-store";
import type { TenantContext } from "@/lib/platform/types";

const STORAGE_KEY = "pfaas:platform-admin:sla-credits";

/**
 * Credit per qualifying incident, per affected tenant, by plan tier —
 * Demo policy (the demo firms' SLA schedule), shown in the UI.
 */
export const SLA_CREDIT_RATES: Record<TenantContext["plan"], number> = {
  starter: 50,
  growth: 100,
  scale: 250,
  enterprise: 500,
};

export interface CreditAdjustment {
  amount: number;
  reason: string;
  by: string;
  at: string;
}

export interface SlaCreditsState {
  /** Operator adjustments keyed by `${incidentId}:${tenantId}`. */
  adjustments: Record<string, CreditAdjustment>;
}

export interface SlaCreditRow {
  /** `${incidentId}:${tenantId}` — stable across reloads. */
  id: string;
  incidentId: string;
  incidentTitle: string;
  providerId: string;
  providerName: string;
  tenantId: string;
  tenantName: string;
  plan: TenantContext["plan"];
  /** Plan-tier rate before any adjustment. */
  baseAmount: number;
  /** Effective amount (adjusted when an operator changed it). */
  amount: number;
  /** `applied` once the incident is resolved; `pending` while open. */
  status: "pending" | "applied";
  adjustment?: CreditAdjustment;
}

const DEFAULT_STATE: SlaCreditsState = { adjustments: {} };

/* ------------------------------------------------------------------ */
/* Persistence — adjustments only                                       */
/* ------------------------------------------------------------------ */

function readRaw(): SlaCreditsState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
    const p = parsed as Partial<SlaCreditsState>;
    return {
      adjustments:
        p.adjustments && typeof p.adjustments === "object" ? p.adjustments : {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeRaw(next: SlaCreditsState): void {
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

export function readSlaCredits(): SlaCreditsState {
  return readRaw();
}

export function useSlaCredits(): SlaCreditsState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as SlaCreditsState;
}

/* ------------------------------------------------------------------ */
/* Derivation — incidents × roster × plan tier                          */
/* ------------------------------------------------------------------ */

/**
 * Qualifies when the incident is rated high/critical by seed severity
 * OR by the operator's effective severity (an escalation on a medium
 * incident brings its credits in; resolving a high one keeps them).
 */
function qualifies(inc: Incident, center: IncidentCenterState): boolean {
  const sev = effectiveSeverity(inc, center.overrides);
  return (
    inc.severity === "high" ||
    inc.severity === "critical" ||
    sev === "high" ||
    sev === "critical"
  );
}

function deriveRows(
  center: IncidentCenterState,
  tenants: TenantContext[],
  adjustments: Record<string, CreditAdjustment>,
  tenantId?: string,
): SlaCreditRow[] {
  const rows: SlaCreditRow[] = [];
  for (const inc of readIncidents()) {
    if (!inc.providerId) continue;
    if (!qualifies(inc, center)) continue;
    const resolved = effectiveSeverity(inc, center.overrides) === "resolved";
    for (const id of inc.affectedTenantIds) {
      if (tenantId && id !== tenantId) continue;
      const tenant = tenants.find((t) => t.id === id);
      // Platform pseudo-tenant and unknown ids never receive credits.
      if (!tenant || tenant.id === "platform") continue;
      const rowId = `${inc.id}:${id}`;
      const base = SLA_CREDIT_RATES[tenant.plan];
      const adjustment = adjustments[rowId];
      rows.push({
        id: rowId,
        incidentId: inc.id,
        incidentTitle: inc.title,
        providerId: inc.providerId,
        providerName: providerName(inc.providerId),
        tenantId: id,
        tenantName: tenant.name,
        plan: tenant.plan,
        baseAmount: base,
        amount: adjustment ? adjustment.amount : base,
        status: resolved ? "applied" : "pending",
        ...(adjustment ? { adjustment } : {}),
      });
    }
  }
  return rows;
}

/**
 * Credit rows for a tenant (or all tenants), live: subscribes to the
 * incident store (escalations/resolutions), the tenant roster (plan
 * changes) and the persisted adjustments.
 */
export function useSlaCreditRows(tenantId?: string): SlaCreditRow[] {
  const center = useIncidentCenter();
  const tenants = useTenants();
  const credits = useSlaCredits();
  return useMemo(
    () => deriveRows(center, tenants, credits.adjustments, tenantId),
    [center, tenants, credits.adjustments, tenantId],
  );
}

/* ------------------------------------------------------------------ */
/* Adjustment — reason required, audit in the same write                */
/* ------------------------------------------------------------------ */

/**
 * Change a credit row's amount. The reason is mandatory (the UI
 * disables save without it) and lands in the audit detail alongside
 * the old → new amounts — one write path for state + audit.
 */
export function adjustSlaCredit(
  row: SlaCreditRow,
  amount: number,
  reason: string,
  actor: string,
): void {
  const state = readRaw();
  const adjustment: CreditAdjustment = {
    amount,
    reason,
    by: actor,
    at: new Date().toISOString(),
  };
  writeRaw({
    ...state,
    adjustments: { ...state.adjustments, [row.id]: adjustment },
  });
  recordAudit({
    actor,
    action: "console.sla_credit_adjusted",
    target: row.tenantName,
    tenantId: row.tenantId,
    severity: "info",
    detail:
      `SLA credit ${row.incidentId} · ${row.providerName} · ${row.tenantName}: ` +
      `${row.baseAmount} → ${amount} (plan-tier ${row.plan}) — reason: ${reason}`,
  });
}
