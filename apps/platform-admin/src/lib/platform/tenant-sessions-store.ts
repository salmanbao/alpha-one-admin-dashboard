"use client";

/**
 * Tenant Sessions Store — persistent session state per tenant.
 *
 * Gap TM-05: Suspend and terminate have no downstream cascade —
 * user sessions stay alive after a tenant is suspended or terminated.
 * This store provides a single source of truth for tenant sessions
 * so lifecycle actions can revoke them.
 *
 * Pattern mirrors console-store: singleton state + listener set +
 * useSyncExternalStore.
 */

import { useSyncExternalStore } from "react";

export interface TenantUserSession {
  id: string;
  userId: string;
  tenantId: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  /** True when the session's location differs from the user's usual one. */
  unusualLocation?: boolean;
  createdAt: number;
  lastSeenAt: number;
}

interface TenantSessionsState {
  sessions: TenantUserSession[];
}

const STORAGE_KEY = "pfaas:platform-admin:tenant-sessions";

function seedSessions(): TenantUserSession[] {
  const t = Date.now();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;

  const raw: Array<
    Omit<TenantUserSession, "createdAt" | "lastSeenAt"> & { age: number; online: number }
  > = [
    // Alpha Capital
    { id: "ts-alpha-1", userId: "user-alpha-admin", tenantId: "tenant-alpha", device: "MacBook Pro", browser: "Chrome 141 · macOS", ip: "203.0.113.51", location: "New York, US", age: 90 * day, online: 2 * min },
    { id: "ts-alpha-2", userId: "user-alpha-admin", tenantId: "tenant-alpha", device: "iPhone 16", browser: "Safari · iOS 19", ip: "203.0.113.88", location: "New York, US", age: 12 * day, online: 48 * min },
    { id: "ts-alpha-3", userId: "user-alpha-risk", tenantId: "tenant-alpha", device: "ThinkPad X1", browser: "Firefox 132 · Windows", ip: "198.51.100.7", location: "New York, US", age: 40 * day, online: 3 * hour },
    { id: "ts-alpha-4", userId: "user-alpha-finance", tenantId: "tenant-alpha", device: "Dell Latitude", browser: "Edge 140 · Windows", ip: "192.0.2.190", location: "Bucharest, RO", unusualLocation: true, age: 6 * day, online: 2 * day },
    // Beta Trading
    { id: "ts-beta-1", userId: "user-beta-admin", tenantId: "tenant-beta", device: "MacBook Air", browser: "Safari 18 · macOS", ip: "198.51.100.44", location: "London, UK", age: 120 * day, online: 5 * min },
    { id: "ts-beta-2", userId: "user-beta-marketing", tenantId: "tenant-beta", device: "Pixel 10", browser: "Chrome · Android 16", ip: "192.0.2.61", location: "London, UK", age: 20 * day, online: 40 * min },
    { id: "ts-beta-3", userId: "user-trader-1", tenantId: "tenant-beta", device: "Windows Desktop", browser: "Chrome 141 · Windows", ip: "192.0.2.144", location: "Manchester, UK", age: 3 * day, online: 12 * min },
    // Gamma Futures
    { id: "ts-gamma-1", userId: "user-gamma-admin", tenantId: "tenant-gamma", device: "MacBook Pro", browser: "Chrome 141 · macOS", ip: "203.0.113.12", location: "Singapore, SG", age: 200 * day, online: 14 * min },
    { id: "ts-gamma-2", userId: "user-gamma-admin", tenantId: "tenant-gamma", device: "iPad Pro", browser: "Safari · iPadOS 19", ip: "45.33.32.156", location: "Jakarta, ID", unusualLocation: true, age: 15 * day, online: 3 * day },
  ];

  return raw.map(({ age, online, ...s }) => ({
    ...s,
    createdAt: t - age,
    lastSeenAt: t - online,
  }));
}

function loadState(): TenantSessionsState {
  if (typeof window === "undefined") return { sessions: seedSessions() };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sessions: seedSessions() };
    const parsed = JSON.parse(raw) as TenantSessionsState;
    if (!parsed || !Array.isArray(parsed.sessions)) return { sessions: seedSessions() };
    return parsed;
  } catch {
    return { sessions: seedSessions() };
  }
}

let state: TenantSessionsState = loadState();
const SERVER_STATE: TenantSessionsState = { sessions: [] };
const listeners = new Set<() => void>();

function emit(next: TenantSessionsState) {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TenantSessionsState {
  return state;
}

function getServerSnapshot(): TenantSessionsState {
  return SERVER_STATE;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** Revoke a single session. */
export function revokeSession(id: string) {
  emit({
    ...state,
    sessions: state.sessions.filter((s) => s.id !== id),
  });
}

/**
 * Revoke all sessions for a tenant. Returns the count of revoked sessions.
 * Called by the lifecycle cascade when a tenant is suspended or terminated.
 */
export function revokeTenantSessions(tenantId: string): number {
  const count = state.sessions.filter((s) => s.tenantId === tenantId).length;
  if (count === 0) return 0;
  emit({
    ...state,
    sessions: state.sessions.filter((s) => s.tenantId !== tenantId),
  });
  return count;
}

/** Test/demo helper — restore the seeded state. */
export function resetTenantSessionsStore() {
  emit({ sessions: seedSessions() });
}

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

export function useTenantSessions(): TenantSessionsState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
