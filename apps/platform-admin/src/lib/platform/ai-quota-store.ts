"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * AI Usage Quota store — P0-4.
 * Quota overrides + counter resets persist under
 * pfaas:platform-admin:ai-quota.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:ai-quota";

export interface TenantQuota {
  tenant: string;
  model: string;
  monthlyQuota: number;
  used: number;
  remaining: number;
  rateLimit: number;
  requests: number;
  resetsAt: string;
  status: "normal" | "warning" | "exceeded";
  spend: number;
}

const INITIAL_QUOTAS: TenantQuota[] = [
  { tenant: "Alpha Capital", model: "ai-insights-v2", monthlyQuota: 50000, used: 38420, remaining: 11580, rateLimit: 100, requests: 2840, resetsAt: "in 3d", status: "warning", spend: 1240 },
  { tenant: "Beta Trading", model: "ai-insights-v2", monthlyQuota: 50000, used: 12400, remaining: 37600, rateLimit: 100, requests: 1120, resetsAt: "in 5d", status: "normal", spend: 380 },
  { tenant: "Gamma Futures", model: "predictive-analytics-v1", monthlyQuota: 30000, used: 28900, remaining: 1100, rateLimit: 50, requests: 1890, resetsAt: "in 1d", status: "exceeded", spend: 2100 },
  { tenant: "Alpha Capital", model: "ai-cost-tracker", monthlyQuota: 20000, used: 5600, remaining: 14400, rateLimit: 50, requests: 620, resetsAt: "in 6d", status: "normal", spend: 180 },
  { tenant: "Beta Trading", model: "fine-tune-job-v1", monthlyQuota: 10000, used: 9800, remaining: 200, rateLimit: 10, requests: 980, resetsAt: "in 12h", status: "exceeded", spend: 890 },
];

function readRaw(): TenantQuota[] {
  if (typeof window === "undefined") return INITIAL_QUOTAS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return INITIAL_QUOTAS;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as TenantQuota[];
  } catch {
    /* fall through */
  }
  return INITIAL_QUOTAS;
}

function writeRaw(next: TenantQuota[]): void {
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

export function readAiQuotas(): TenantQuota[] {
  return readRaw().map((q) => ({ ...q }));
}

export function useAiQuotas(): TenantQuota[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(INITIAL_QUOTAS),
  );
  return useMemo(() => {
    try {
      return (JSON.parse(snapshot) as TenantQuota[]).map((q) => ({ ...q }));
    } catch {
      return INITIAL_QUOTAS.map((q) => ({ ...q }));
    }
  }, [snapshot]);
}

// Mutations
export function applyQuotaOverride(
  tenant: string,
  model: string,
  monthlyQuota?: number,
  rateLimit?: number,
): { title: string; description: string } {
  const quotas = readRaw();
  const idx = quotas.findIndex((q) => q.tenant === tenant && q.model === model);
  if (idx < 0) {
    return { title: "(Demo)", description: "Tenant/model not found." };
  }
  const patched = {
    ...quotas[idx],
    monthlyQuota: monthlyQuota ?? quotas[idx].monthlyQuota,
    rateLimit: rateLimit ?? quotas[idx].rateLimit,
  };
  const next = [...quotas.slice(0, idx), patched, ...quotas.slice(idx + 1)];
  writeRaw(next);
  recordAudit({
    actor: "Console operator",
    action: "ai.quota_overridden",
    target: `${tenant}/${model}`,
    severity: "warning",
    detail: `monthlyQuota=${patched.monthlyQuota}, rateLimit=${patched.rateLimit} req/min`,
  });
  return {
    title: "Override saved",
    description: `Tenant ${tenant} · model ${model}: quota=${patched.monthlyQuota.toLocaleString()}, rate=${patched.rateLimit} req/min.`,
  };
}

export function resetCounters(): { title: string; description: string } {
  const quotas = readRaw().map((q) => ({
    ...q,
    used: 0,
    remaining: q.monthlyQuota,
    requests: 0,
    status: "normal" as const,
    resetsAt: "now",
  }));
  writeRaw(quotas);
  recordAudit({
    actor: "Console operator",
    action: "ai.counters_reset",
    target: "all tenants",
    severity: "warning",
    detail: "Monthly usage counters reset across all tenants and models.",
  });
  return {
    title: "Counters reset",
    description: "Monthly usage counters zeroed across all tenants and models.",
  };
}