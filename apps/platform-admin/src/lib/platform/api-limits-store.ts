"use client";

/**
 * R13 P1-1 — Tenant API custom limits store.
 *
 * The tenant-api-usage screen let operators apply a custom per-tenant
 * rate limit, but the value lived in component `useState` and reset on
 * reload while the toast claimed the limit was applied. Limits now
 * persist and every change writes an audit row.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:tenant-api-limits";

function load(): Record<string, number | null> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number | null>) : {};
  } catch {
    return {};
  }
}

function persist(next: Record<string, number | null>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let limits: Record<string, number | null> = load();

/** Custom limit for a tenant (null = plan cap applies). */
export function getCustomLimit(tenantId: string): number | null | undefined {
  return limits[tenantId];
}

/** Current persisted limit map (tenantId → custom limit or null). */
export function readCustomLimits(): Record<string, number | null> {
  return limits;
}

/**
 * Set (or clear with `null`) a tenant's custom daily API limit.
 * Persists + audits. Returns the new value.
 */
export function setCustomLimit(
  tenantId: string,
  tenantName: string,
  limit: number | null,
  planCap: number | null = null,
  actor = "operator",
): number | null {
  limits = { ...limits, [tenantId]: limit };
  persist(limits);
  recordAudit({
    actor,
    action: limit === null ? "api.limit_reset" : "api.limit_change",
    target: tenantId,
    detail:
      limit === null
        ? `Custom limit cleared for ${tenantName} — plan cap (${planCap ?? "n/a"}/day) applies`
        : `Custom daily API limit for ${tenantName} set to ${limit.toLocaleString()}/day (plan cap ${planCap ?? "n/a"}/day)`,
    severity: "warning",
  });
  emit();
  return limit;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to limit mutations. */
export function useApiLimitsVersion(): number {
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
