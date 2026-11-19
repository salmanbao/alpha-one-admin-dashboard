"use client";
import { useMemo, useSyncExternalStore } from "react";

/**
 * Rate Limits store — P0-4: wire fake write-path to store + audit.
 * Tier edits / Create Tier / Change Policy persist under pfaas:platform-admin:rate-limits.
 * Acceptance test: action → reload → state + audit row + toast agree.
 */

import { recordAudit } from "@/lib/platform/console-store";

const STORAGE_KEY = "pfaas:platform-admin:rate-limits";

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

export interface RateLimitTier {
  id: string;
  name: string;
  description: string;
  requestsPerMin: number;
  burstLimit: number;
  concurrentConns: number;
  monthlyQuota: number;
  overagePolicy: "throttle" | "bill" | "hard_stop";
  status: "active" | "deprecated" | "disabled";
  createdAt: string;
  updatedAt: string;
}

const SEED_TIERS: RateLimitTier[] = [
  {
    id: "tier-001",
    name: "Development",
    description: "Sandbox/testing tier",
    requestsPerMin: 60,
    burstLimit: 10,
    concurrentConns: 5,
    monthlyQuota: 10000,
    overagePolicy: "throttle",
    status: "active",
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
  },
  {
    id: "tier-002",
    name: "Standard",
    description: "Default production tier",
    requestsPerMin: 600,
    burstLimit: 100,
    concurrentConns: 25,
    monthlyQuota: 100000,
    overagePolicy: "throttle",
    status: "active",
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
  },
  {
    id: "tier-003",
    name: "Enterprise",
    description: "High-volume customers",
    requestsPerMin: 3000,
    burstLimit: 500,
    concurrentConns: 100,
    monthlyQuota: 1000000,
    overagePolicy: "bill",
    status: "active",
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
  },
  {
    id: "tier-004",
    name: "Premium (Legacy)",
    description: "Deprecated — new customers use Enterprise",
    requestsPerMin: 1500,
    burstLimit: 300,
    concurrentConns: 50,
    monthlyQuota: 500000,
    overagePolicy: "throttle",
    status: "deprecated",
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
  },
];

function readRaw(): RateLimitTier[] {
  if (typeof window === "undefined") return SEED_TIERS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return SEED_TIERS;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return SEED_TIERS;
}

function writeRaw(next: RateLimitTier[]): void {
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

export function readRateLimitTiers(): RateLimitTier[] {
  return readRaw().map((t) => ({ ...t }));
}

export function useRateLimitTiers(): RateLimitTier[] {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(readRaw()),
    () => JSON.stringify(SEED_TIERS),
  );
  return useMemo(() => {
    try {
      return (JSON.parse(snapshot) as RateLimitTier[]).map((t) => ({ ...t }));
    } catch {
      return SEED_TIERS.map((t) => ({ ...t }));
    }
  }, [snapshot]);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export function updateTier(tier: RateLimitTier): void {
  const tiers = readRaw();
  const idx = tiers.findIndex((t) => t.id === tier.id);
  if (idx >= 0) {
    const updated = { ...tier, updatedAt: new Date().toISOString() };
    writeRaw([...tiers.slice(0, idx), updated, ...tiers.slice(idx + 1)]);
    recordAudit({
      actor: "Console operator",
      action: "rate_limits.tier_updated",
      target: tier.id,
      severity: "info",
      detail: `${tier.name}: ${tier.requestsPerMin} req/min, ${tier.burstLimit} burst, ${tier.concurrentConns} concurrent, ${tier.monthlyQuota} monthly, overage: ${tier.overagePolicy}`,
    });
  }
}

export function createTier(tier: Omit<RateLimitTier, "id" | "createdAt" | "updatedAt">): RateLimitTier {
  const tiers = readRaw();
  const nowIso = new Date().toISOString();
  const created: RateLimitTier = {
    ...tier,
    id: `tier-${Date.now().toString(36)}`,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  writeRaw([created, ...tiers]);
  recordAudit({
    actor: "Console operator",
    action: "rate_limits.tier_created",
    target: created.id,
    severity: "warning",
    detail: `Created tier "${created.name}" (${created.requestsPerMin} req/min, ${created.overagePolicy} overage)`,
  });
  return created;
}

export function changeTierPolicy(tierId: string, overagePolicy: "throttle" | "bill" | "hard_stop"): void {
  const tiers = readRaw();
  const idx = tiers.findIndex((t) => t.id === tierId);
  if (idx >= 0) {
    const updated = { ...tiers[idx], overagePolicy, updatedAt: new Date().toISOString() };
    writeRaw([...tiers.slice(0, idx), updated, ...tiers.slice(idx + 1)]);
    recordAudit({
      actor: "Console operator",
      action: "rate_limits.policy_changed",
      target: tierId,
      severity: "info",
      detail: `${updated.name}: overage policy → ${overagePolicy}`,
    });
  }
}