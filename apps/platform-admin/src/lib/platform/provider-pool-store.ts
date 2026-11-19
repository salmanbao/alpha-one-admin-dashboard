"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Provider Pool store — P0-4: wire fake write-path to store + audit.
 * Quarantine / Reallocate / Release / Add Provider persist under
 * pfaas:platform-admin:provider-pool.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:provider-pool";

export type ProviderKind = "Email" | "SMS" | "WhatsApp";
export type QuarantineReason = "complaint rate" | "spam traps" | "abuse report";

export interface Provider {
  id: string;
  name: string;
  kind: ProviderKind;
  masterStatus: "connected" | "pending" | "error";
  quotaUsed: number;
  quotaTotal: number;
  health: number;
}

export interface Allocation {
  id: string;
  tenant: string;
  plan: string;
  status: "active" | "quarantined";
  quarantineReason?: QuarantineReason;
  providerId: string;
  subaccount: string;
  quotaUsed: number;
  quotaAssigned: number;
  ipPool: string;
  reputation: number;
  costCenter: string;
}

const SEED_PROVIDERS: Provider[] = [
  { id: "prv-shared-us", name: "SendGrid — shared (US)", kind: "Email", masterStatus: "connected", quotaUsed: 12400, quotaTotal: 50000, health: 98 },
  { id: "prv-shared-eu", name: "SendGrid — shared (EU)", kind: "Email", masterStatus: "connected", quotaUsed: 8200, quotaTotal: 40000, health: 97 },
  { id: "prv-twilio", name: "Twilio — shared (US)", kind: "SMS", masterStatus: "connected", quotaUsed: 3400, quotaTotal: 10000, health: 96 },
];

const SEED_ALLOCATIONS: Allocation[] = [
  { id: "alloc-alpha", tenant: "Alpha Capital", plan: "Enterprise", status: "active", providerId: "prv-shared-us", subaccount: "us-alpha", quotaUsed: 8200, quotaAssigned: 25000, ipPool: "shared-us-east", reputation: 96, costCenter: "fraud-watch" },
  { id: "alloc-beta", tenant: "Beta Trading", plan: "Pro", status: "active", providerId: "prv-shared-us", subaccount: "us-beta", quotaUsed: 4200, quotaAssigned: 15000, ipPool: "shared-us-east", reputation: 92, costCenter: "growth" },
  { id: "alloc-gamma", tenant: "Gamma Futures", plan: "Enterprise", status: "quarantined", quarantineReason: "abuse report", providerId: "prv-shared-eu", subaccount: "eu-gamma", quotaUsed: 9100, quotaAssigned: 25000, ipPool: "isolated-quarantine", reputation: 71, costCenter: "fraud-watch" },
];

function readRaw(): { providers: Provider[]; allocations: Allocation[] } {
  if (typeof window === "undefined") return { providers: SEED_PROVIDERS, allocations: SEED_ALLOCATIONS };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { providers: SEED_PROVIDERS, allocations: SEED_ALLOCATIONS };
    const parsed = JSON.parse(stored);
    if (parsed && Array.isArray(parsed.providers) && Array.isArray(parsed.allocations)) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return { providers: SEED_PROVIDERS, allocations: SEED_ALLOCATIONS };
}

function writeRaw(next: { providers: Provider[]; allocations: Allocation[] }): void {
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

export function readProviderPool() {
  return readRaw();
}

export function useProviderPool() {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify({ providers: SEED_PROVIDERS, allocations: SEED_ALLOCATIONS }),
  );
  return useMemo(() => {
    try {
      return JSON.parse(snapshot) as { providers: Provider[]; allocations: Allocation[] };
    } catch {
      return { providers: SEED_PROVIDERS, allocations: SEED_ALLOCATIONS };
    }
  }, [snapshot]);
}

// Mutations
export function quarantineAllocation(tenant: string, reason: QuarantineReason, actor: string): void {
  const state = readRaw();
  const updatedAllocations = state.allocations.map((a) =>
    a.tenant === tenant
      ? { ...a, status: "quarantined" as const, quarantineReason: reason, ipPool: "isolated-quarantine" }
      : a,
  );
  writeRaw({ providers: state.providers, allocations: updatedAllocations });
  recordAudit({
    actor,
    action: "provider_pool.quarantined",
    target: tenant,
    severity: "critical",
    detail: `Quarantined ${tenant} — reason: ${reason}. Traffic re-routed to isolated quarantine pool.`,
  });
}

export function releaseAllocation(tenant: string, actor: string): void {
  const state = readRaw();
  const updatedAllocations = state.allocations.map((a) =>
    a.tenant === tenant
      ? { ...a, status: "active" as const, quarantineReason: undefined, ipPool: "shared-us-east" }
      : a,
  );
  writeRaw({ providers: state.providers, allocations: updatedAllocations });
  recordAudit({
    actor,
    action: "provider_pool.released",
    target: tenant,
    severity: "info",
    detail: `Released ${tenant} from quarantine — returned to shared pool after clean period.`,
  });
}

export function reallocateAllocation(targetId: string, providerId: string, subaccountLabel: string, actor: string): void {
  const state = readRaw();
  const updatedAllocations = state.allocations.map((a) =>
    a.id === targetId
      ? { ...a, providerId, subaccount: subaccountLabel, status: "active" as const, quarantineReason: undefined }
      : a,
  );
  writeRaw({ providers: state.providers, allocations: updatedAllocations });
  recordAudit({
    actor,
    action: "provider_pool.reallocated",
    target: targetId,
    severity: "info",
    detail: `${targetId} reallocated to ${providerId} as ${subaccountLabel} — takes effect at next batch boundary.`,
  });
}

export function addProvider(name: string, kind: ProviderKind, actor: string): Provider {
  const state = readRaw();
  const provider: Provider = {
    id: `prv-${Date.now().toString(36)}`,
    name,
    kind,
    masterStatus: "connected",
    quotaUsed: 0,
    quotaTotal: 100000,
    health: 100,
  };
  writeRaw({ providers: [...state.providers, provider], allocations: state.allocations });
  recordAudit({
    actor,
    action: "provider_pool.provider_added",
    target: provider.id,
    severity: "warning",
    detail: `${name} (${kind}) added at platform level — subaccounts can now be allocated.`,
  });
  return provider;
}
