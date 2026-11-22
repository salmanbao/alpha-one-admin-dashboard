"use client";

/**
 * R13 P1-1 — Usage alert arming store.
 *
 * The usage-metering dashboard let operators arm 80%/95% usage alerts per
 * tenant, but the armed set lived in component `useState` and reset on
 * reload while the toast claimed the tenant "will be notified at 80% and
 * 95%". Armed state now persists and every arm/mute writes an audit row.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:usage-alerts";

function load(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persist(next: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let armed: Record<string, boolean> = load();

/** Whether 80%/95% usage alerts are armed for a tenant (by name). */
export function areUsageAlertsArmed(tenantName: string): boolean {
  return !!armed[tenantName];
}

/**
 * Toggle usage alerts for a tenant. Persists + audits. Returns the new
 * armed state.
 */
export function toggleUsageAlerts(
  tenantName: string,
  tenantId: string,
  actor = "operator",
): boolean {
  const next = !armed[tenantName];
  armed = { ...armed, [tenantName]: next };
  persist(armed);
  recordAudit({
    actor,
    action: next ? "usage.alerts_arm" : "usage.alerts_mute",
    target: tenantId,
    detail: next
      ? `Usage alerts armed for ${tenantName} — tenant notified at 80% and 95% of each plan limit`
      : `Usage alerts muted for ${tenantName} — no more limit notifications`,
    severity: next ? "info" : "warning",
  });
  emit();
  return next;
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to alert-arm mutations. */
export function useUsageAlertsVersion(): number {
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
