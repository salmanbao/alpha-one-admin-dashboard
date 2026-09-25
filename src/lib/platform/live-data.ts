"use client";

/**
 * PFaaS Platform — Live Data Simulation
 *
 * Spec section 35 (loading states), 51 (server state). Simulates
 * real-time data updates by periodically mutating a shared "live"
 * state that widgets can subscribe to. In production this would be
 * replaced by WebSocket subscriptions or TanStack Query polling.
 */

import { useEffect, useState, useRef } from "react";

export interface LiveDataState {
  /** Timestamp of last update */
  lastUpdate: number;
  /** Tick counter (increments each update) */
  tick: number;
  /** Live equity curve point (simulated) */
  equityPulse: number;
  /** Live P&L flash (random walk) */
  pnlFlash: number;
  /** Live trader count (slowly drifts) */
  activeTraders: number;
  /** Live open positions count */
  openPositions: number;
  /** Live pending payouts */
  pendingPayouts: number;
  /** Live breach count */
  openBreaches: number;
  /** Recent activity feed items */
  activityFeed: ActivityItem[];
  /** Whether live updates are active */
  isLive: boolean;
}

export interface ActivityItem {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  module: string;
  tone: "info" | "success" | "warning" | "critical";
}

// Role-based actor labels (no personal names) so the same global ticker
// doesn't leak staff identities across tenants. Round 4 fix: previously
// hardcoded "Sarah Chen", "Marcus Webb", "Priya Nair", "Daniel Cooper",
// "Elena Rossi" — the same names appeared on every tenant, implying
// cross-tenant staff. Roles are tenant-agnostic and conveys the same
// "real human activity" intent without PII leakage.
const ACTORS = [
  "Compliance Officer",
  "Risk Manager",
  "Payouts Bot",
  "Support Lead",
  "System",
  "AI Engine",
  "Onboarding Team",
];
const ACTIONS = [
  { action: "approved a withdrawal", module: "payouts", tone: "success" as const },
  { action: "resolved a breach", module: "risk", tone: "success" as const },
  { action: "flagged a high-risk account", module: "risk", tone: "warning" as const },
  { action: "approved KYC for a participant", module: "kyc", tone: "success" as const },
  { action: "enabled the Analytics module", module: "settings", tone: "info" as const },
  { action: "generated an AI insight", module: "ai", tone: "info" as const },
  { action: "detected a withdrawal spike", module: "ai", tone: "warning" as const },
  { action: "created a new evaluation", module: "challenges", tone: "info" as const },
  { action: "updated risk configuration", module: "risk", tone: "info" as const },
  { action: "exported the revenue report", module: "analytics", tone: "info" as const },
];

const INITIAL: LiveDataState = {
  lastUpdate: Date.now(),
  tick: 0,
  equityPulse: 0,
  pnlFlash: 0,
  // These will be synced to the actual tenant's values when the
  // OverviewPage mounts, so the live sidebar matches the KPI row.
  activeTraders: 0,
  openPositions: 0,
  pendingPayouts: 0,
  openBreaches: 0,
  activityFeed: [],
  isLive: true,
};

// Singleton live state shared across the app
let liveState: LiveDataState = { ...INITIAL };
const listeners = new Set<(s: LiveDataState) => void>();

function emit() {
  for (const l of listeners) l(liveState);
}

function tick() {
  if (!liveState.isLive) return;
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  // Generate a new activity item occasionally
  let newFeed = liveState.activityFeed;
  if (Math.random() > 0.4) {
    const a = pick(ACTIONS);
    const item: ActivityItem = {
      id: `live-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      actor: pick(ACTORS),
      action: a.action,
      module: a.module,
      tone: a.tone,
    };
    newFeed = [item, ...liveState.activityFeed].slice(0, 20);
  }

  liveState = {
    ...liveState,
    lastUpdate: Date.now(),
    tick: liveState.tick + 1,
    equityPulse: liveState.equityPulse + rand(-1, 1.5),
    pnlFlash: rand(-250, 320),
    // Slow drift around the synced base values — small changes only
    activeTraders: Math.max(1, liveState.activeTraders + (Math.random() > 0.6 ? Math.round(rand(-1, 1)) : 0)),
    openPositions: Math.max(0, liveState.openPositions + (Math.random() > 0.7 ? Math.round(rand(-1, 1)) : 0)),
    pendingPayouts: Math.max(0, liveState.pendingPayouts + (Math.random() > 0.8 ? 1 : 0) - (Math.random() > 0.6 ? 1 : 0)),
    openBreaches: Math.max(0, liveState.openBreaches + (Math.random() > 0.8 ? 1 : 0) - (Math.random() > 0.6 ? 1 : 0)),
    activityFeed: newFeed,
  };
  emit();
}

// Start the simulation loop
let interval: ReturnType<typeof setInterval> | null = null;
function ensureRunning() {
  if (interval || typeof window === "undefined") return;
  interval = setInterval(tick, 3500);
}

export function useLiveData(): LiveDataState {
  const [state, setState] = useState<LiveDataState>(liveState);
  useEffect(() => {
    ensureRunning();
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);
  return state;
}

export function setLivePaused(paused: boolean) {
  liveState = { ...liveState, isLive: !paused };
  emit();
}

export function clearActivityFeed() {
  liveState = { ...liveState, activityFeed: [] };
  emit();
}

/**
 * Sync the live stats to actual tenant values so the live sidebar
 * matches the KPI row. Called once when the OverviewPage mounts.
 */
export function syncLiveStats(stats: {
  activeTraders: number;
  openPositions: number;
  pendingPayouts: number;
  openBreaches: number;
}) {
  liveState = {
    ...liveState,
    activeTraders: stats.activeTraders,
    openPositions: stats.openPositions,
    pendingPayouts: stats.pendingPayouts,
    openBreaches: stats.openBreaches,
  };
  emit();
}
