"use client";

import { useSyncExternalStore } from "react";
import { tenants as seedTenants } from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";

const STORAGE_KEY = "pfaas:platform-admin:tenants";

function readSeedList(list: unknown): TenantContext[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (t): t is TenantContext =>
      !!t && typeof t === "object" && typeof (t as TenantContext).id === "string",
  );
}

/**
 * Seed roster + tenants registered at runtime.
 *
 * `registerTenant` (platform-context) persists runtime-created tenants
 * under `pfaas:customTenants`; the store used to drop them, so any
 * store-backed page (overview, plans, detail, go-live wizard) rendered a
 * roster missing every operator-created firm. Merge order: seed →
 * custom → stored-by-id, stored wins — an updated copy of a seed tenant
 * beats the seed, an update of a custom tenant beats its creation.
 */
function readRaw(): TenantContext[] {
  if (typeof window === "undefined") return seedTenants.map((t) => ({ ...t }));
  try {
    const stored = readSeedList(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"),
    );
    const custom = readSeedList(
      JSON.parse(window.localStorage.getItem("pfaas:customTenants") ?? "null"),
    );
    const byId = new Map<string, TenantContext>();
    for (const t of seedTenants) byId.set(t.id, { ...t });
    for (const t of custom) byId.set(t.id, { ...t });
    for (const t of stored) byId.set(t.id, { ...(byId.get(t.id) ?? {}), ...t });
    return [...byId.values()];
  } catch {
    return seedTenants.map((t) => ({ ...t }));
  }
}

function writeRaw(next: TenantContext[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
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
  return JSON.stringify(seedTenants);
}

export function readTenants(): TenantContext[] {
  return readRaw().map((t) => ({ ...t }));
}

export function getTenant(id: string): TenantContext | undefined {
  return readRaw().find((t) => t.id === id);
}

export function updateTenant(id: string, patch: Partial<TenantContext>): void {
  const next = readRaw().map((t) => (t.id === id ? { ...t, ...patch } : t));
  writeRaw(next);
}

/**
 * R3-04 — apply scheduled plan transitions whose effective time has
 * passed. `scheduledPlan` is written by the PlanMigrationDialog and the
 * Plan Transition workflow when the operator picks "next billing cycle";
 * the workflow pages run this on mount, so a due record moves into
 * `plan`, the schedule clears, and subscribers re-render. Returns the
 * tenants that were applied (empty when nothing was due).
 */
export function applyDueScheduledPlans(now: number = Date.now()): TenantContext[] {
  const list = readRaw();
  const applied: TenantContext[] = [];
  const next = list.map((t) => {
    const s = t.scheduledPlan;
    if (!s) return t;
    const dueAt = Date.parse(s.scheduledFor);
    if (Number.isNaN(dueAt) || dueAt > now) return t;
    const updated: TenantContext = { ...t, plan: s.plan };
    delete updated.scheduledPlan;
    applied.push(updated);
    return updated;
  });
  if (applied.length > 0) writeRaw(next);
  return applied;
}

export function useTenants(): TenantContext[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as TenantContext[];
}

export function useTenant(id: string): TenantContext | undefined {
  return useTenants().find((t) => t.id === id);
}
