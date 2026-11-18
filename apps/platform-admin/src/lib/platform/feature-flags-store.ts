"use client";

/**
 * Feature-flag registry — R7 I11 (persistence) + R9 W6 UC-P1.
 *
 * Why a store: the page used to keep its flags in `useState` and say
 * "Change audited" in a toast — the change vanished on reload and no
 * audit row existed (toast-only action, rule R10). This store is the
 * single write path: every flip persists under
 * `pfaas:platform-admin:feature-flags`, appends a `recordAudit` row
 * (Platform Audit Log) and emits a lifecycle event.
 *
 * UC-P1 adds three things on top of persistence:
 *   - **blast radius** — `blastRadiusFor()` computes "affects N tenants /
 *     M accounts" from the tenant-store (+ the per-tenant account roster
 *     in mock-data) *before* the flip, so the confirm dialog can list the
 *     tenants that will actually be touched;
 *   - **staged rollout** — global flags advance 0 → 25 → 50 → 100 % of
 *     tenants, each stage audited and evented (`feature-flag.rollout-stage`);
 *   - **auto-rollback criterion** — the operator states, at flip time,
 *     the condition that makes the stage pull back; a manual rollback is
 *     a first-class audited action (`feature-flag.rollout-rollback`).
 *
 * Named consumer of the emitted events: the feature-flags page
 * "Change history" panel, which projects `entity.kind === "flag"` rows
 * out of the shared lifecycle log. The `recordAudit` row is consumed by
 * the Platform Audit Log view.
 */

import { useSyncExternalStore } from "react";
import { emitLifecycle } from "@pfaas/lifecycle";
import { recordAudit } from "@/lib/platform/console-store";
import { readTenants, updateTenant } from "@/lib/platform/tenant-store";
import { getTenantAccounts } from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";

const STORAGE_KEY = "pfaas:platform-admin:feature-flags";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export const ROLLOUT_STAGES = [0, 25, 50, 100] as const;
export type RolloutStage = (typeof ROLLOUT_STAGES)[number];

export interface RolloutHistoryEntry {
  pct: RolloutStage;
  at: string;
  by: string;
}

export interface FlagRollout {
  /** Where the rollout currently stands (0 = not serving yet). */
  stage: RolloutStage;
  /** Auto-rollback criterion — the condition that makes us pull back. */
  criterion: string;
  /** Per-stage audit trail: every stage advance lands here. */
  history: RolloutHistoryEntry[];
}

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  scope: "global" | "tenant-override" | "environment";
  enabled: boolean;
  isKillSwitch?: boolean;
  updatedBy: string;
  /** ISO timestamp of the last change (§1 rule 5: fixture dates only). */
  updatedAt: string;
  /** Staged rollout state — global flags only (UC-P1). */
  rollout?: FlagRollout;
}

/** What a flag touches — computed from the tenant-store, never guessed. */
export interface BlastRadius {
  tenants: TenantContext[];
  accounts: number;
}

/* ------------------------------------------------------------------ */
/* Date helpers (§1 rule 5 — no hand-written date strings)             */
/* ------------------------------------------------------------------ */

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
const daysFromNow = (n: number) => daysAgo(-n);

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

const SEED: FeatureFlag[] = [
  { id: "evaluation-pause", name: "Evaluation Pause", description: "Pause all challenge evaluations globally.", scope: "global", enabled: false, isKillSwitch: true, updatedBy: "Sarah Chen", updatedAt: daysAgo(5) },
  { id: "auto-approval", name: "Auto-Approval", description: "Enable automatic payout approvals.", scope: "global", enabled: true, updatedBy: "Marcus Webb", updatedAt: daysAgo(12) },
  { id: "payment-rail", name: "Payment Rail Override", description: "Force payment routing through Match2Pay (instead of NOWPayments).", scope: "environment", enabled: false, updatedBy: "Priya Nair", updatedAt: daysAgo(3) },
  { id: "new-onboarding", name: "New Onboarding Flow", description: "Use the v2 tenant onboarding wizard.", scope: "global", enabled: true, updatedBy: "Sarah Chen", updatedAt: daysAgo(8), rollout: { stage: 100, criterion: "Wizard completion rate below 60% for 24h", history: [{ pct: 25, at: daysAgo(8), by: "Sarah Chen" }, { pct: 50, at: daysAgo(7), by: "Sarah Chen" }, { pct: 100, at: daysAgo(6), by: "Sarah Chen" }] } },
  { id: "ai-insights-beta", name: "AI Insights (Beta)", description: "Enable AI-generated insights module.", scope: "global", enabled: true, updatedBy: "Daniel Cooper", updatedAt: daysAgo(2), rollout: { stage: 50, criterion: "Insight error rate above 5% or p95 latency above 3s", history: [{ pct: 25, at: daysAgo(2), by: "Daniel Cooper" }, { pct: 50, at: daysAgo(1), by: "Daniel Cooper" }] } },
  { id: "experimental-chart", name: "Experimental Chart Library", description: "Use the new charting library (D3 instead of Recharts).", scope: "environment", enabled: false, updatedBy: "Elena Rossi", updatedAt: daysAgo(1) },
  { id: "mobile-app", name: "Mobile App Access", description: "Enable the mobile companion app for traders.", scope: "tenant-override", enabled: true, updatedBy: "Sarah Chen", updatedAt: daysAgo(20) },
  { id: "developer-api", name: "Developer API", description: "Enable the public Developer API for tenants.", scope: "global", enabled: true, updatedBy: "Marcus Webb", updatedAt: daysAgo(15) },
];

const isFlag = (x: unknown): x is FeatureFlag =>
  !!x && typeof x === "object" && typeof (x as FeatureFlag).id === "string";

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function readRaw(): FeatureFlag[] {
  if (typeof window === "undefined") return SEED.map((f) => ({ ...f }));
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    // Seed → stored (stored wins): a flag added to the seed later still
    // appears for operators whose browser already persisted an older set.
    const byId = new Map<string, FeatureFlag>(SEED.map((f) => [f.id, { ...f }]));
    if (Array.isArray(stored)) {
      for (const raw of stored) {
        if (!isFlag(raw)) continue;
        byId.set(raw.id, { ...(byId.get(raw.id) ?? {}), ...raw });
      }
    }
    return [...byId.values()];
  } catch {
    return SEED.map((f) => ({ ...f }));
  }
}

function writeRaw(next: FeatureFlag[]): void {
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
  return JSON.stringify(SEED);
}

export function readFeatureFlags(): FeatureFlag[] {
  return readRaw().map((f) => ({ ...f }));
}

export function useFeatureFlags(): FeatureFlag[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as FeatureFlag[];
}

/* ------------------------------------------------------------------ */
/* Blast radius (UC-P1) — computed before the flip                     */
/* ------------------------------------------------------------------ */

/**
 * Which tenants (and how many accounts) a flag touches.
 *   global / environment → every live tenant (not terminated);
 *   tenant-override      → only the tenants carrying the override in
 *                          `enabledFeatures` (or an explicit selection).
 */
export function blastRadiusFor(
  flag: Pick<FeatureFlag, "id" | "scope">,
  selectedTenantIds?: string[],
): BlastRadius {
  const live = readTenants().filter(
    (t) => t.id !== "platform" && t.status !== "terminated",
  );
  const tenants =
    flag.scope === "tenant-override"
      ? live.filter((t) =>
          (selectedTenantIds ?? t.enabledFeatures).includes(flag.id),
        )
      : live;
  const accounts = tenants.reduce(
    (s, t) => s + getTenantAccounts(t.id).length,
    0,
  );
  return { tenants, accounts };
}

/* ------------------------------------------------------------------ */
/* Writes — each persists + audits + events (single write path)        */
/* ------------------------------------------------------------------ */

export interface FlagDecision {
  actor: string;
  reason?: string;
  /** Staged rollout target when enabling a global flag (UC-P1). */
  stage?: RolloutStage;
  /** Auto-rollback criterion captured at flip time (UC-P1). */
  criterion?: string;
  /** tenant-override scope: the tenants to carry the override. */
  tenantIds?: string[];
}

function touch(flag: FeatureFlag, actor: string, patch: Partial<FeatureFlag>): FeatureFlag {
  return { ...flag, ...patch, updatedBy: actor, updatedAt: new Date().toISOString() };
}

function applyOverride(flagId: string, tenantIds: string[], on: boolean): void {
  if (tenantIds.length === 0) return;
  for (const id of tenantIds) {
    const t = readTenants().find((x) => x.id === id);
    if (!t) continue;
    const has = t.enabledFeatures.includes(flagId);
    if (on && !has) updateTenant(id, { enabledFeatures: [...t.enabledFeatures, flagId] });
    if (!on && has)
      updateTenant(id, {
        enabledFeatures: t.enabledFeatures.filter((f) => f !== flagId),
      });
  }
}

// Direct write path — `updateTenant` persists the tenant-store copy, so
// the override lands in `enabledFeatures` (and survives a reload).

function persistFlags(next: FeatureFlag[]): void {
  writeRaw(next);
}

/**
 * Flip a flag (UC-P1): persists, records the audit row and emits
 * `feature-flag.toggled`. Global flags also start their staged rollout
 * at `stage` (default 100 — no staging requested).
 */
export function setFlagEnabled(
  id: string,
  enabled: boolean,
  d: FlagDecision,
): FeatureFlag | null {
  const flags = readRaw();
  const flag = flags.find((f) => f.id === id);
  if (!flag) return null;

  const stage: RolloutStage = flag.scope === "global" ? (d.stage ?? 100) : 100;
  const radius = blastRadiusFor(flag, d.tenantIds);
  const updated = touch(flag, d.actor, {
    enabled,
    ...(enabled && flag.scope === "global"
      ? {
          rollout: {
            stage,
            criterion:
              d.criterion?.trim() ||
              flag.rollout?.criterion ||
              "No rollback criterion recorded (Demo)",
            history: [
              ...(flag.rollout?.history ?? []),
              { pct: stage, at: new Date().toISOString(), by: d.actor },
            ],
          },
        }
      : {}),
  });

  persistFlags(flags.map((f) => (f.id === id ? updated : f)));
  if (flag.scope === "tenant-override") {
    applyOverride(id, d.tenantIds ?? readTenants().filter((t) => t.enabledFeatures.includes(id)).map((t) => t.id), enabled);
  }

  recordAudit({
    actor: d.actor,
    action: enabled ? "feature-flag.enabled" : "feature-flag.disabled",
    target: updated.name,
    severity: updated.isKillSwitch && enabled ? "critical" : "info",
    detail:
      `${enabled ? "Enabled" : "Disabled"} (scope ${updated.scope}` +
      (flag.scope === "global" ? `, rollout ${stage}%` : "") +
      `) — affects ${radius.tenants.length} tenant(s), ${radius.accounts} account(s).` +
      (d.reason ? ` Reason: ${d.reason}` : "") +
      (updated.rollout ? ` Rollback criterion: ${updated.rollout.criterion}.` : ""),
  });

  emitLifecycle({
    entity: { kind: "flag", id: updated.id },
    name: "feature-flag.toggled",
    actor: "platform-admin",
    key: `toggled:${enabled}:${Date.now()}`,
    payload: {
      flagId: updated.id,
      name: updated.name,
      scope: updated.scope,
      enabled,
      stage,
      criterion: updated.rollout?.criterion ?? null,
      affectedTenants: radius.tenants.length,
      affectedAccounts: radius.accounts,
      tenantIds: radius.tenants.map((t) => t.id),
      reason: d.reason ?? "",
    },
  });
  return updated;
}

/** Advance a global flag's rollout to the next stage (UC-P1). */
export function advanceRollout(
  id: string,
  pct: RolloutStage,
  d: FlagDecision,
): FeatureFlag | null {
  const flags = readRaw();
  const flag = flags.find((f) => f.id === id);
  if (!flag?.rollout) return null;
  const from = flag.rollout.stage;
  const radius = blastRadiusFor(flag);
  const updated = touch(flag, d.actor, {
    enabled: pct > 0,
    rollout: {
      ...flag.rollout,
      stage: pct,
      criterion: d.criterion?.trim() || flag.rollout.criterion,
      history: [...flag.rollout.history, { pct, at: new Date().toISOString(), by: d.actor }],
    },
  });
  persistFlags(flags.map((f) => (f.id === id ? updated : f)));

  recordAudit({
    actor: d.actor,
    action: "feature-flag.rollout_stage",
    target: updated.name,
    severity: "info",
    detail: `Rollout ${from}% → ${pct}% — affects ${radius.tenants.length} tenant(s), ${radius.accounts} account(s).${d.reason ? ` Reason: ${d.reason}` : ""} Rollback criterion: ${updated.rollout!.criterion}.`,
  });

  emitLifecycle({
    entity: { kind: "flag", id: updated.id },
    name: "feature-flag.rollout-stage",
    actor: "platform-admin",
    key: `stage:${pct}:${Date.now()}`,
    payload: {
      flagId: updated.id,
      name: updated.name,
      from,
      to: pct,
      criterion: updated.rollout!.criterion,
      affectedTenants: radius.tenants.length,
      affectedAccounts: radius.accounts,
      reason: d.reason ?? "",
    },
  });
  return updated;
}

/** Pull a staged rollout back to the previous stage (UC-P1). */
export function rollbackRollout(
  id: string,
  d: FlagDecision,
): FeatureFlag | null {
  const flags = readRaw();
  const flag = flags.find((f) => f.id === id);
  if (!flag?.rollout) return null;
  const idx = ROLLOUT_STAGES.indexOf(flag.rollout.stage);
  const backTo: RolloutStage = ROLLOUT_STAGES[Math.max(0, idx - 1)];
  const updated = touch(flag, d.actor, {
    enabled: backTo > 0,
    rollout: {
      ...flag.rollout,
      stage: backTo,
      history: [...flag.rollout.history, { pct: backTo, at: new Date().toISOString(), by: d.actor }],
    },
  });
  persistFlags(flags.map((f) => (f.id === id ? updated : f)));

  recordAudit({
    actor: d.actor,
    action: "feature-flag.rollout_rollback",
    target: updated.name,
    severity: "warning",
    detail: `Rolled back ${flag.rollout.stage}% → ${backTo}%.${d.reason ? ` Reason: ${d.reason}` : ""} Criterion: ${flag.rollout.criterion}.`,
  });

  emitLifecycle({
    entity: { kind: "flag", id: updated.id },
    name: "feature-flag.rollout-rollback",
    actor: "platform-admin",
    key: `rollback:${flag.rollout.stage}:${Date.now()}`,
    payload: {
      flagId: updated.id,
      name: updated.name,
      from: flag.rollout.stage,
      to: backTo,
      criterion: flag.rollout.criterion,
      reason: d.reason ?? "",
    },
  });
  return updated;
}

/** Record (or change) the auto-rollback criterion without a flip. */
export function setRolloutCriterion(
  id: string,
  criterion: string,
  d: FlagDecision,
): FeatureFlag | null {
  const flags = readRaw();
  const flag = flags.find((f) => f.id === id);
  if (!flag) return null;
  const previous = flag.rollout?.criterion ?? "";
  const updated = touch(flag, d.actor, {
    rollout: {
      stage: flag.rollout?.stage ?? 100,
      criterion: criterion.trim() || "No rollback criterion recorded (Demo)",
      history: flag.rollout?.history ?? [],
    },
  });
  persistFlags(flags.map((f) => (f.id === id ? updated : f)));

  recordAudit({
    actor: d.actor,
    action: "feature-flag.rollback_criterion",
    target: updated.name,
    severity: "info",
    detail: `Rollback criterion updated${previous ? ` (was "${previous}")` : ""}: "${updated.rollout!.criterion}".`,
  });
  emitLifecycle({
    entity: { kind: "flag", id: updated.id },
    name: "feature-flag.toggled",
    actor: "platform-admin",
    key: `criterion:${Date.now()}`,
    payload: {
      flagId: updated.id,
      name: updated.name,
      change: "criterion",
      criterion: updated.rollout!.criterion,
      previous,
    },
  });
  return updated;
}
