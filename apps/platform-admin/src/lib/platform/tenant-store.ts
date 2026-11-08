"use client";

import { useSyncExternalStore } from "react";
import { tenants as seedTenants } from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";

const STORAGE_KEY = "pfaas:platform-admin:tenants";

function readRaw(): TenantContext[] {
  if (typeof window === "undefined") return seedTenants.map((t) => ({ ...t }));
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedTenants.map((t) => ({ ...t }));
    const parsed = JSON.parse(raw) as TenantContext[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedTenants.map((t) => ({ ...t }));
    // merge onto seed by id to keep new fields
    const byId = new Map(parsed.map((t) => [t.id, t]));
    return seedTenants.map((t) => ({ ...t, ...(byId.get(t.id) ?? {}) }));
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

let state = readRaw();

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

export function useTenants(): TenantContext[] {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as TenantContext[];
}

export function useTenant(id: string): TenantContext | undefined {
  return useTenants().find((t) => t.id === id);
}
