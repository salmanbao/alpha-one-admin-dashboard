"use client";

/**
 * Platform Payout Policy Store — PF-07 / PS-05
 *
 * Cross-tenant payout policy engine with global defaults + per-tenant overrides.
 * Persists to localStorage (namespace: pfaas:platform-admin:payout-policy).
 * Seed data is merged on first load (persisted state wins).
 *
 * When a backend lands, swap the storage layer — the mutation API
 * (updateGlobalDefaults, setTenantOverride, removeTenantOverride) stays the same.
 */

import { useSyncExternalStore } from "react";
import { recordAudit } from "./console-store";
import { tenants } from "./mock-data";

/** Global default payout policy (applies to all tenants unless overridden). */
export interface GlobalPayoutPolicy {
  /** On-time SLA target in days (default: 7). */
  onTimeSlaDays: number;
  /** Default minimum payout request amount in base currency units (default: 100). */
  defaultMinRequest: number;
  /** Default maximum payout request amount in base currency units (default: 25000). */
  defaultMaxRequest: number;
  /** Default processing fee in basis points (default: 200 = 2%). */
  defaultProcessingFeeBps: number;
  /** Default cadence in days (default: 14). */
  defaultCadenceDays: number;
  /** Global velocity limit: max payouts per trader per cadence window (default: 4). */
  defaultVelocityLimit: number;
  /** Large-amount review threshold in base currency units (default: 10000). */
  largeAmountThreshold: number;
  /** Whether payout method is globally enabled (default: true). */
  defaultMethodEnabled: boolean;
  /** Methods available globally (default: all four rails). */
  availableMethods: ("bank-transfer" | "crypto" | "paypal" | "skrill")[];
}

/** Per-tenant override — any field undefined falls back to global default. */
export interface TenantPayoutPolicyOverride {
  tenantId: string;
  onTimeSlaDays?: number;
  minRequest?: number;
  maxRequest?: number;
  processingFeeBps?: number;
  cadenceDays?: number;
  velocityLimit?: number;
  largeAmountThreshold?: number;
  methodEnabled?: boolean;
  availableMethods?: ("bank-transfer" | "crypto" | "paypal" | "skrill")[];
}

const DEFAULT_GLOBAL_POLICY: GlobalPayoutPolicy = {
  onTimeSlaDays: 7,
  defaultMinRequest: 100,
  defaultMaxRequest: 25_000,
  defaultProcessingFeeBps: 200,
  defaultCadenceDays: 14,
  defaultVelocityLimit: 4,
  largeAmountThreshold: 10_000,
  defaultMethodEnabled: true,
  availableMethods: ["bank-transfer", "crypto", "paypal", "skrill"],
};

const STORAGE_KEY = "pfaas:platform-admin:payout-policy";

/** Seed: per-tenant overrides (demo — some tenants have custom values). */
const SEED_OVERRIDES: TenantPayoutPolicyOverride[] = [
  {
    tenantId: "tenant-alpha",
    onTimeSlaDays: 5,
    maxRequest: 50_000,
    velocityLimit: 3,
  },
  {
    tenantId: "tenant-beta",
    minRequest: 50,
    largeAmountThreshold: 5_000,
  },
  // tenant-gamma uses all global defaults
];

type PayoutPolicyStore = {
  global: GlobalPayoutPolicy;
  overrides: TenantPayoutPolicyOverride[];
  /** Merged policy for a tenant (global + override). */
  getEffectivePolicy: (tenantId: string) => GlobalPayoutPolicy;
  /** Update global defaults. */
  updateGlobalDefaults: (patch: Partial<GlobalPayoutPolicy>, actor?: string) => void;
  /** Set or update a tenant override. */
  setTenantOverride: (override: TenantPayoutPolicyOverride, actor?: string) => void;
  /** Remove a tenant override (reverts to global). */
  removeTenantOverride: (tenantId: string, actor?: string) => void;
};

/** Merge global + tenant override into a concrete policy. */
function mergePolicy(
  global: GlobalPayoutPolicy,
  override: TenantPayoutPolicyOverride | undefined,
): GlobalPayoutPolicy {
  if (!override) return global;
  return {
    onTimeSlaDays: override.onTimeSlaDays ?? global.onTimeSlaDays,
    defaultMinRequest: override.minRequest ?? global.defaultMinRequest,
    defaultMaxRequest: override.maxRequest ?? global.defaultMaxRequest,
    defaultProcessingFeeBps: override.processingFeeBps ?? global.defaultProcessingFeeBps,
    defaultCadenceDays: override.cadenceDays ?? global.defaultCadenceDays,
    defaultVelocityLimit: override.velocityLimit ?? global.defaultVelocityLimit,
    largeAmountThreshold: override.largeAmountThreshold ?? global.largeAmountThreshold,
    defaultMethodEnabled: override.methodEnabled ?? global.defaultMethodEnabled,
    availableMethods: override.availableMethods ?? global.availableMethods,
  };
}

/** Reads raw state from localStorage (persisted wins over seed). */
function readSnapshot(): { global: GlobalPayoutPolicy; overrides: TenantPayoutPolicyOverride[] } {
  if (typeof window === "undefined") {
    return { global: DEFAULT_GLOBAL_POLICY, overrides: SEED_OVERRIDES };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        global: { ...DEFAULT_GLOBAL_POLICY, ...parsed.global },
        overrides: Array.isArray(parsed.overrides)
          ? parsed.overrides
          : SEED_OVERRIDES,
      };
    } catch {
      // Fall back to seed if corrupted
    }
  }
  return { global: DEFAULT_GLOBAL_POLICY, overrides: SEED_OVERRIDES };
}

/** Write state to localStorage. */
function writeSnapshot(state: { global: GlobalPayoutPolicy; overrides: TenantPayoutPolicyOverride[] }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Subscribe/unsubscribe pattern for useSyncExternalStore. */
const subscribers: Set<() => void> = new Set();
let state: { global: GlobalPayoutPolicy; overrides: TenantPayoutPolicyOverride[] } = readSnapshot();

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function notify() {
  subscribers.forEach((cb) => cb());
}

export function usePayoutPolicyStore(): PayoutPolicyStore {
  const snapshot = useSyncExternalStore(subscribe, () => state, () =>
    readSnapshot(),
  );

  return {
    global: snapshot.global,
    overrides: snapshot.overrides,

    getEffectivePolicy: (tenantId: string) => {
      const override = snapshot.overrides.find((o) => o.tenantId === tenantId);
      return mergePolicy(snapshot.global, override);
    },

    updateGlobalDefaults: (patch, actor = "operator") => {
      const previous = snapshot.global;
      const next = { ...previous, ...patch };
      state = { ...state, global: next };
      writeSnapshot(state);
      notify();
      recordAudit({
        action: "payout.policy.global.update",
        target: "payout-policy:global",
        severity: "info",
        detail: JSON.stringify({ previous, next }),
        actor,
      });
    },

    setTenantOverride: (override, actor = "operator") => {
      const existing = snapshot.overrides.find((o) => o.tenantId === override.tenantId);
      const nextOverrides = existing
        ? snapshot.overrides.map((o) => (o.tenantId === override.tenantId ? override : o))
        : [...snapshot.overrides, override];
      state = { ...state, overrides: nextOverrides };
      writeSnapshot(state);
      notify();
      recordAudit({
        action: existing ? "payout.policy.tenant.update" : "payout.policy.tenant.create",
        target: `payout-policy:tenant:${override.tenantId}`,
        severity: "info",
        detail: JSON.stringify({ previous: existing ?? null, next: override }),
        actor,
      });
    },

    removeTenantOverride: (tenantId, actor = "operator") => {
      const existing = snapshot.overrides.find((o) => o.tenantId === tenantId);
      if (!existing) return;
      const nextOverrides = snapshot.overrides.filter((o) => o.tenantId !== tenantId);
      state = { ...state, overrides: nextOverrides };
      writeSnapshot(state);
      notify();
      recordAudit({
        action: "payout.policy.tenant.delete",
        target: `payout-policy:tenant:${tenantId}`,
        severity: "warning",
        detail: JSON.stringify({ removed: existing }),
        actor,
      });
    },
  };
}

/** Hook for global defaults. */
export function useGlobalPayoutPolicy(): GlobalPayoutPolicy {
  const store = usePayoutPolicyStore();
  return store.global;
}

/** Hook for all overrides. */
export function usePayoutPolicyOverrides(): TenantPayoutPolicyOverride[] {
  const store = usePayoutPolicyStore();
  return store.overrides;
}

/** Get the effective policy for a tenant (global + override merged). */
export function useTenantPayoutPolicy(tenantId: string): GlobalPayoutPolicy {
  const store = usePayoutPolicyStore();
  return store.getEffectivePolicy(tenantId);
}

/** Get the tenant name for display. */
export function getTenantName(tenantId: string): string {
  const tenant = tenants.find((t) => t.id === tenantId);
  return tenant ? tenant.name : tenantId;
}