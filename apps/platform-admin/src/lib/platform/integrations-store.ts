"use client";

/**
 * Integrations store (R2-W3-04).
 *
 * Persisted overrides on top of the seeded `demoIntegrations` catalog on
 * the Integrations page: connection status, edited configuration values
 * and tenant assignments used to be toast-only — a "Connect" click
 * reverted on F5 and claimed an audit entry that never existed. Every
 * mutation on that page and the go-live wizard's "Connectors" step now
 * writes this store (try/catch JSON; platform-admin has no zod).
 *
 * The seed list stays code; this map only holds what an operator
 * changed, so a newer seed stays visible until overridden.
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pfaas:platform-admin:integrations";

export interface IntegrationOverride {
  status?: "connected" | "disconnected" | "error";
  config?: Record<string, string>;
  /** Tenant ids this integration is assigned/entitled to. */
  assignedTenants?: string[];
  updatedAt?: string;
}

type IntegrationOverrides = Record<string, IntegrationOverride>;

function readRaw(): IntegrationOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as IntegrationOverrides;
  } catch {
    return {};
  }
}

function writeRaw(next: IntegrationOverrides): void {
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
  return "{}";
}

export function readIntegrationOverrides(): IntegrationOverrides {
  return readRaw();
}

/** Shallow-merge a patch onto one integration's override (config deep-merged). */
export function setIntegrationOverride(
  id: string,
  patch: IntegrationOverride,
): void {
  const prev = readRaw()[id];
  const next: IntegrationOverride = {
    ...prev,
    ...patch,
    config: { ...(prev?.config ?? {}), ...(patch.config ?? {}) },
  };
  // `assignedTenants` is replaced, not unioned: callers pass the full
  // desired list (the assign dialog and the go-live wizard prefill it
  // from the store), so unchecking a tenant can actually unassign it.
  next.updatedAt = new Date().toISOString();
  writeRaw({ ...readRaw(), [id]: next });
}

export function useIntegrationOverrides(): IntegrationOverrides {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as IntegrationOverrides;
}
