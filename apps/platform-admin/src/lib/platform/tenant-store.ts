import { useSyncExternalStore } from "react";
import type { TenantContext } from "./types";
import { tenants as SEED_TENANTS } from "./mock-data";
import { UNPINNED_DEFAULT_EU_REGION, UNPINNED_DEFAULT_REGION } from "./regions";

/* ------------------------------------------------------------------ */
/* Store — single source of truth for the tenant roster                 */
/* ------------------------------------------------------------------ */
/*
 * Every surface (tenants list, tenant detail, switcher, breadcrumbs,
 * global search) reads from this store. `mock-data.tenants` is the ONE
 * seed definition; localStorage-persisted custom tenants are merged in
 * at boot by `hydrateTenants` (custom wins by id).
 */

let tenantState: TenantContext[] = SEED_TENANTS;
const listeners = new Set<() => void>();

const CUSTOM_KEY = "pfaas:customTenants";
const OVERRIDE_KEY = "pfaas:tenantOverrides";
const SEED_IDS = new Set(SEED_TENANTS.map((t) => t.id));

type Overrides = Record<string, Partial<TenantContext>>;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

/** Runtime-created tenants (Create Tenant wizard / clone) — persisted. */
export function readPersistedCustomTenants(): TenantContext[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<unknown>(window.localStorage.getItem(CUSTOM_KEY));
  return Array.isArray(parsed)
    ? parsed.filter((x): x is TenantContext => !!x && typeof (x as TenantContext).id === "string")
    : [];
}

function persistCustom(list: TenantContext[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota errors */
  }
}

/** Field-level edits made to seed tenants, so a rename survives reload. */
function readOverrides(): Overrides {
  if (typeof window === "undefined") return {};
  const parsed = safeParse<Overrides>(window.localStorage.getItem(OVERRIDE_KEY));
  return parsed && typeof parsed === "object" ? parsed : {};
}

function writeOverrides(next: Overrides) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

function applyOverrides(t: TenantContext, ov: Overrides): TenantContext {
  const o = ov[t.id];
  return o ? { ...t, ...o } : t;
}

function notify() {
  for (const l of listeners) l();
}

function subscribeTenants(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Boot-time hydration: merge the canonical seed with the operator's
 * persisted custom tenants (custom wins by id), then re-apply any
 * field-level edits made to seed tenants in a previous session. Call
 * this ONCE on app mount — re-hydrating later would wipe in-memory
 * `updateTenant` mutations that have not been re-persisted.
 */
export function hydrateTenants(seed: TenantContext[], custom: TenantContext[]) {
  const ov = readOverrides();
  const byId = new Map<string, TenantContext>();
  for (const t of seed) byId.set(t.id, applyOverrides(t, ov));
  for (const t of custom) byId.set(t.id, applyOverrides(t, ov));
  tenantState = [...byId.values()];
  notify();
}

/* ------------------------------------------------------------------ */
/* Public API                                                            */
/* ------------------------------------------------------------------ */

export function readTenants(): TenantContext[] {
  return tenantState;
}

/** Add a tenant to the roster (create-tenant wizard, clone, etc.). */
export function addTenant(tenant: TenantContext) {
  if (tenantState.some((t) => t.id === tenant.id)) return;
  tenantState = [...tenantState, tenant];
  if (!SEED_IDS.has(tenant.id)) {
    const custom = readPersistedCustomTenants();
    if (!custom.some((x) => x.id === tenant.id)) persistCustom([...custom, tenant]);
  }
  notify();
}

export function updateTenant(id: string, partial: Partial<TenantContext>) {
  const idx = tenantState.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const next = [...tenantState];
  next[idx] = { ...next[idx], ...partial };
  tenantState = next;
  if (SEED_IDS.has(id)) {
    const ov = readOverrides();
    ov[id] = { ...(ov[id] ?? {}), ...compact(partial as Record<string, unknown>) } as Partial<TenantContext>;
    writeOverrides(ov);
  } else {
    const custom = readPersistedCustomTenants();
    const ci = custom.findIndex((x) => x.id === id);
    if (ci >= 0) {
      const nc = [...custom];
      nc[ci] = { ...nc[ci], ...partial };
      persistCustom(nc);
    }
  }
  notify();
}

export function removeTenant(id: string) {
  const next = tenantState.filter((t) => t.id !== id);
  if (next.length === tenantState.length) return;
  tenantState = next;
  if (SEED_IDS.has(id)) {
    // Seed tenants are canonical demo data — a removal is in-memory only
    // and the seed row returns on the next boot.
    const ov = readOverrides();
    if (id in ov) {
      delete ov[id];
      writeOverrides(ov);
    }
  } else {
    persistCustom(readPersistedCustomTenants().filter((x) => x.id !== id));
  }
  notify();
}

/** Reactive roster hook (useSyncExternalStore — re-renders on mutation). */
export function useTenants(): TenantContext[] {
  return useSyncExternalStore(subscribeTenants, readTenants, readTenants);
}

export function applyDueScheduledPlans(): TenantContext[] {
  const now = new Date();
  let changed = false;
  const next = tenantState.map((t) => {
    if (t.scheduledPlan && new Date(t.scheduledPlan.scheduledFor) <= now) {
      changed = true;
      return { ...t, plan: t.scheduledPlan.plan, scheduledPlan: undefined };
    }
    return t;
  });
  if (changed) {
    tenantState = next;
    notify();
  }
  return tenantState;
}

/** P1-e: Sweep expired trials → invited (mirrors applyDueScheduledPlans pattern).
 * Audits tenant.trial_expired_auto and returns updated tenants. */
export function applyDueTrials(): TenantContext[] {
  const now = new Date();
  let changed = false;
  const next: TenantContext[] = tenantState.map((t): TenantContext => {
    if (t.status === "trial" && t.trialEndsAt && new Date(t.trialEndsAt) <= now) {
      changed = true;
      return {
        ...t,
        status: "invited" as const,
        trialEndsAt: t.trialEndsAt,
        statusHistory: [
          ...(t.statusHistory ?? []),
          { status: "invited" as const, at: now.toISOString(), by: "system", reason: "Trial expired automatically" },
        ],
      };
    }
    return t;
  });
  if (changed) {
    tenantState = next;
    notify();
  }
  return tenantState;
}

/* ------------------------------------------------------------------ */
/* Data residency types (from residency report)                          */
/* ------------------------------------------------------------------ */

export type DataClass =
  | "core"
  | "billing"
  | "kyc"
  | "payouts"
  | "analytics"
  | "audit"
  | "backups";

export const DATA_CLASSES: DataClass[] = [
  "core",
  "billing",
  "kyc",
  "payouts",
  "analytics",
  "audit",
  "backups",
];

export const DATA_CLASS_MAP: Record<DataClass, { label: string; description: string }> = {
  core: { label: "Core tenant data", description: "Identity, branding, settings, plan" },
  billing: { label: "Billing & invoices", description: "Subscription records, payment methods" },
  kyc: { label: "KYC documents", description: "Identity verification, compliance docs" },
  payouts: { label: "Payout records", description: "Funded trader payouts, settlements" },
  analytics: { label: "Analytics events", description: "Usage, performance, conversion data" },
  audit: { label: "Audit log", description: "Operator actions, consent records" },
  backups: { label: "Backups & DR", description: "Point-in-time snapshots, recovery points" },
};

export function dataLocationFor(tenant: TenantContext, cls: DataClass): { location: string; pinned: boolean } {
  const pin = tenant.region?.toLowerCase();
  // Canonical vocabulary (lib/platform/regions.ts) — an unpinned default
  // must be spelled exactly like a pin so grouping never splits one
  // physical region into two buckets.
  const defaults: Record<DataClass, string> = {
    core: UNPINNED_DEFAULT_REGION,
    billing: UNPINNED_DEFAULT_REGION,
    kyc: UNPINNED_DEFAULT_EU_REGION,
    payouts: UNPINNED_DEFAULT_REGION,
    analytics: UNPINNED_DEFAULT_REGION,
    audit: UNPINNED_DEFAULT_REGION,
    backups: UNPINNED_DEFAULT_EU_REGION,
  };
  return { location: pin || defaults[cls] || UNPINNED_DEFAULT_REGION, pinned: !!pin };
}
