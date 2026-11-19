"use client";

/**
 * R10-B1 — Drawdown model configuration (P0).
 *
 * The health widget used to hard-code the strings "Trailing" and
 * "00:00 UTC", and the simulator assumed peak-based trailing drawdown.
 * This store makes the model configurable per program:
 *
 *   • static vs trailing drawdown (watermark = starting balance vs peak),
 *   • equity/balance watermark source + recalculation interval,
 *   • timezone-aware daily-loss reset (IANA zone + reset time — the
 *     tenant's timezone is finally consumed, not decorative).
 *
 * Watermarks are maintained from `trade.closed` payloads (pnl +
 * accountLimits/accountBaseline are the trader's source of truth, same
 * contract risk-rules-store uses) and a 60s interval drives the
 * recalculation job + daily reset check. Exactly-once event application
 * via the `lastProcessedSeq` watermark.
 *
 * Reuses existing patterns:
 * - demo-persistence for zod-validated persistence
 * - lifecycle events for watermark/reset transitions
 * - recordAudit for audit trails
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { useLifecycleLog, emitLifecycle, type LifecycleEvent } from "@pfaas/lifecycle";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type DrawdownType = "static" | "trailing";
export type ResetMethod = "utc" | "local" | "broker" | "custom";

export interface DrawdownConfig {
  id: string;
  name: string;
  description: string;
  drawdownType: DrawdownType;
  /** Maximum drawdown % from the watermark. */
  maxDrawdownPct: number;
  /** Daily loss limit %. */
  dailyDrawdownPct: number;
  /** Reset time for the daily loss bucket (HH:MM, 24h). */
  resetTime: string;
  /** IANA timezone the reset time is expressed in (e.g. "Europe/London"). */
  resetTimezone: string;
  resetMethod: ResetMethod;
  /** Trailing watermark source. */
  watermarkSource: "equity" | "balance";
  /** Trailing: recalculate the watermark every N hours (0 = on every trade). */
  recalculationIntervalHours?: number;
  enabled: boolean;
  /** Program ids this config applies to (empty = applies to all). */
  appliesToPrograms: string[];
}

export interface DrawdownWatermark {
  accountId: string;
  configId: string;
  peakEquity: number;
  peakBalance: number;
  /** Session pnl accrued since the last daily reset (current reset day). */
  sessionDailyPnl: number;
  /** Baseline daily usage reported by the trader (start-of-day usage). */
  baselineDailyUsed: number;
  dailyLimit: number;
  /** Timezone-local day key (YYYY-MM-DD) of the last daily reset. */
  lastResetDayKey: string;
  lastRecalculatedAt: string;
  currentDrawdownPct: number;
}

export interface DrawdownState {
  configs: DrawdownConfig[];
  /** Watermarks keyed by `${accountId}:${configId}`. */
  watermarks: Record<string, DrawdownWatermark>;
  /** Watermark into the shared lifecycle log (exactly-once processing). */
  lastProcessedSeq: number;
}

/* ------------------------------------------------------------------ */
/* Zod schema for persistence                                          */
/* ------------------------------------------------------------------ */

const drawdownConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  drawdownType: z.enum(["static", "trailing"]),
  maxDrawdownPct: z.number().min(1).max(100),
  dailyDrawdownPct: z.number().min(1).max(100),
  resetTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  resetTimezone: z.string(),
  resetMethod: z.enum(["utc", "local", "broker", "custom"]),
  watermarkSource: z.enum(["equity", "balance"]),
  recalculationIntervalHours: z.number().min(1).optional(),
  enabled: z.boolean(),
  appliesToPrograms: z.array(z.string()),
});

const drawdownWatermarkSchema = z.object({
  accountId: z.string(),
  configId: z.string(),
  peakEquity: z.number(),
  peakBalance: z.number(),
  sessionDailyPnl: z.number(),
  baselineDailyUsed: z.number(),
  dailyLimit: z.number(),
  lastResetDayKey: z.string(),
  lastRecalculatedAt: z.string(),
  currentDrawdownPct: z.number(),
});

const drawdownStateSchema = z.object({
  configs: z.array(drawdownConfigSchema),
  watermarks: z.record(z.string(), drawdownWatermarkSchema),
  lastProcessedSeq: z.number(),
});

type DrawdownStateType = z.infer<typeof drawdownStateSchema>;

/* ------------------------------------------------------------------ */
/* Default configurations                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_CONFIGS: DrawdownConfig[] = [
  {
    id: "dd-default-static",
    name: "Static Drawdown (Standard)",
    description: "Fixed drawdown from starting balance, daily bucket resets at 00:00 UTC",
    drawdownType: "static",
    maxDrawdownPct: 10,
    dailyDrawdownPct: 5,
    resetTime: "00:00",
    resetTimezone: "UTC",
    resetMethod: "utc",
    watermarkSource: "balance",
    enabled: true,
    appliesToPrograms: [],
  },
  {
    id: "dd-default-trailing",
    name: "Trailing Drawdown (Aggressive)",
    description: "Drawdown follows peak equity, recalculated every 4 hours",
    drawdownType: "trailing",
    maxDrawdownPct: 10,
    dailyDrawdownPct: 5,
    resetTime: "00:00",
    resetTimezone: "UTC",
    resetMethod: "utc",
    watermarkSource: "equity",
    recalculationIntervalHours: 4,
    enabled: false,
    appliesToPrograms: [],
  },
  {
    id: "dd-conservative",
    name: "Conservative (New York broker time)",
    description: "Lower limits with an America/New_York daily reset",
    drawdownType: "static",
    maxDrawdownPct: 8,
    dailyDrawdownPct: 4,
    resetTime: "00:00",
    resetTimezone: "America/New_York",
    resetMethod: "broker",
    watermarkSource: "balance",
    enabled: false,
    appliesToPrograms: [],
  },
];

/* ------------------------------------------------------------------ */
/* Store implementation                                                */
/* ------------------------------------------------------------------ */

const SLOT = "drawdown-model";
let state: DrawdownStateType = loadDemoState(SLOT, drawdownStateSchema, {
  configs: DEFAULT_CONFIGS,
  watermarks: {},
  lastProcessedSeq: 0,
});
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function useDrawdownVersion(): number {
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

/* ------------------------------------------------------------------ */
/* Configuration management                                            */
/* ------------------------------------------------------------------ */

export function getDrawdownConfigs(): DrawdownConfig[] {
  return state.configs;
}

export function getDrawdownConfig(configId: string): DrawdownConfig | null {
  return state.configs.find((c) => c.id === configId) ?? null;
}

/** Config for a program — falls back to the single enabled default. */
export function getDrawdownConfigForProgram(programId?: string): DrawdownConfig | null {
  if (programId) {
    const match = state.configs.find(
      (c) => c.enabled && c.appliesToPrograms.includes(programId),
    );
    if (match) return match;
  }
  return state.configs.find((c) => c.enabled) ?? null;
}

export function updateDrawdownConfig(
  configId: string,
  updates: Partial<DrawdownConfig>,
  actor: string,
): void {
  const existing = state.configs.find((c) => c.id === configId);
  if (!existing) return;

  state.configs = state.configs.map((c) => (c.id === configId ? { ...c, ...updates } : c));
  notify();

  recordAudit({
    action: "Updated drawdown configuration",
    entity: "drawdown-config",
    entityId: configId,
    summary: `Drawdown config "${existing.name}" updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

export function addDrawdownConfig(
  config: Omit<DrawdownConfig, "id">,
  actor: string,
): DrawdownConfig {
  const id = `dd-${Date.now()}`;
  const newConfig: DrawdownConfig = { id, ...config };
  state.configs = [...state.configs, newConfig];
  notify();

  recordAudit({
    action: "Added drawdown configuration",
    entity: "drawdown-config",
    entityId: id,
    summary: `Drawdown config "${newConfig.name}" (${newConfig.drawdownType}, ${newConfig.maxDrawdownPct}% max) added by ${actor}`,
    severity: "info",
  });

  return newConfig;
}

export function removeDrawdownConfig(configId: string, actor: string): void {
  const existing = state.configs.find((c) => c.id === configId);
  if (!existing) return;

  state.configs = state.configs.filter((c) => c.id !== configId);
  for (const key of Object.keys(state.watermarks)) {
    if (state.watermarks[key].configId === configId) delete state.watermarks[key];
  }
  notify();

  recordAudit({
    action: "Removed drawdown configuration",
    entity: "drawdown-config",
    entityId: configId,
    summary: `Drawdown config "${existing.name}" removed by ${actor}`,
    severity: "warning",
  });
}

/* ------------------------------------------------------------------ */
/* Timezone helpers                                                    */
/* ------------------------------------------------------------------ */

/** Current wall-clock in `timeZone` as { dayKey: YYYY-MM-DD, hm: HH:MM }. */
function zonedNow(date: Date, timeZone: string): { dayKey: string; hm: string } {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts: Record<string, string> = {};
    for (const p of fmt.formatToParts(date)) {
      if (p.type !== "literal") parts[p.type] = p.value;
    }
    return {
      dayKey: `${parts.year}-${parts.month}-${parts.day}`,
      hm: `${parts.hour}:${parts.minute}`,
    };
  } catch {
    // Invalid timezone — degrade to UTC rather than crashing the store.
    const iso = date.toISOString();
    return { dayKey: iso.slice(0, 10), hm: iso.slice(11, 16) };
  }
}

/* ------------------------------------------------------------------ */
/* Watermark management                                                */
/* ------------------------------------------------------------------ */

export function getWatermark(
  accountId: string,
  configId: string,
): DrawdownWatermark | null {
  return state.watermarks[`${accountId}:${configId}`] ?? null;
}

export function getAllWatermarks(): DrawdownWatermark[] {
  return Object.values(state.watermarks);
}

function ensureWatermark(
  accountId: string,
  config: DrawdownConfig,
  seed: { equity: number; balance: number; dailyLimit: number; baselineDailyUsed: number },
): DrawdownWatermark {
  const key = `${accountId}:${config.id}`;
  const existing = state.watermarks[key];
  if (existing) return existing;
  const now = new Date();
  const fresh: DrawdownWatermark = {
    accountId,
    configId: config.id,
    peakEquity: seed.equity,
    peakBalance: seed.balance,
    sessionDailyPnl: 0,
    baselineDailyUsed: seed.baselineDailyUsed,
    dailyLimit: seed.dailyLimit,
    lastResetDayKey: zonedNow(now, config.resetTimezone).dayKey,
    lastRecalculatedAt: now.toISOString(),
    currentDrawdownPct: 0,
  };
  state.watermarks[key] = fresh;
  saveDemoState(SLOT, state); // silent create
  return fresh;
}

/* ------------------------------------------------------------------ */
/* Drawdown calculation                                                */
/* ------------------------------------------------------------------ */

export function applyTradeToWatermark(
  accountId: string,
  pnl: number,
  opts: {
    accountSize?: number;
    dailyLimit?: number;
    baselineDailyUsed?: number;
  } = {},
): void {
  const config = getDrawdownConfigForProgram();
  if (!config) return;

  const starting = opts.accountSize ?? 10000;
  const wm = ensureWatermark(accountId, config, {
    equity: starting,
    balance: starting,
    dailyLimit: opts.dailyLimit ?? starting * (config.dailyDrawdownPct / 100),
    baselineDailyUsed: opts.baselineDailyUsed ?? 0,
  });
  if (opts.dailyLimit && opts.dailyLimit > 0) wm.dailyLimit = opts.dailyLimit;
  if (typeof opts.baselineDailyUsed === "number") {
    wm.baselineDailyUsed = opts.baselineDailyUsed;
  }

  wm.sessionDailyPnl += pnl;
  if (config.drawdownType === "trailing") {
    const equity = wm.peakEquity + pnl; // session-relative peak tracking
    if (config.watermarkSource === "equity") {
      wm.peakEquity = Math.max(wm.peakEquity, equity);
    } else {
      wm.peakBalance = Math.max(wm.peakBalance, wm.peakBalance + pnl);
    }
  }

  const peak =
    config.watermarkSource === "equity" ? wm.peakEquity : wm.peakBalance;
  // Drawdown = baseline usage + session losses (never below zero).
  const used = wm.baselineDailyUsed + Math.max(0, -wm.sessionDailyPnl);
  wm.currentDrawdownPct = peak > 0 ? (used / peak) * 100 : 0;
  wm.lastRecalculatedAt = new Date().toISOString();
  notify();
}

/* ------------------------------------------------------------------ */
/* Daily reset (timezone-aware)                                        */
/* ------------------------------------------------------------------ */

/**
 * Reset the daily loss bucket when the configured local time has rolled
 * over since the last reset. Returns true when a reset fired.
 */
export function checkDailyReset(accountId: string, configId: string): boolean {
  const config = getDrawdownConfig(configId);
  const wm = getWatermark(accountId, configId);
  if (!config || !wm) return false;

  const now = new Date();
  const local = zonedNow(now, config.resetTimezone);
  // The reset fires once the configured reset time has passed today.
  if (local.hm < config.resetTime) return false;
  if (local.dayKey === wm.lastResetDayKey) return false;

  state.watermarks[`${accountId}:${configId}`] = {
    ...wm,
    sessionDailyPnl: 0,
    lastResetDayKey: local.dayKey,
    lastRecalculatedAt: now.toISOString(),
  };
  notify();

  recordAudit({
    action: "Drawdown daily loss reset",
    entity: "drawdown-config",
    entityId: configId,
    summary: `Account ${accountId} daily loss bucket reset at ${config.resetTime} ${config.resetTimezone} (${config.drawdownType} model)`,
    severity: "info",
  });

  emitLifecycle({
    entity: { kind: "account", id: accountId },
    name: "drawdown.daily-reset",
    actor: "system",
    key: `dd-reset:${accountId}:${configId}:${local.dayKey}`,
    payload: {
      accountId,
      configId,
      resetTime: config.resetTime,
      timezone: config.resetTimezone,
      dayKey: local.dayKey,
    },
  });

  return true;
}

/* ------------------------------------------------------------------ */
/* Watermark recalculation job                                         */
/* ------------------------------------------------------------------ */

/** Recalculate watermarks whose interval has elapsed; emits one event. */
export function recalculateWatermarks(): void {
  const now = new Date();
  for (const wm of Object.values(state.watermarks)) {
    const config = getDrawdownConfig(wm.configId);
    if (!config?.recalculationIntervalHours) continue;
    const last = new Date(wm.lastRecalculatedAt);
    const hours = (now.getTime() - last.getTime()) / 3_600_000;
    if (hours < config.recalculationIntervalHours) continue;

    state.watermarks[`${wm.accountId}:${wm.configId}`] = {
      ...wm,
      lastRecalculatedAt: now.toISOString(),
    };
    emitLifecycle({
      entity: { kind: "account", id: wm.accountId },
      name: "drawdown.watermark-recalculated",
      actor: "system",
      key: `dd-wm:${wm.accountId}:${wm.configId}:${now.toISOString().slice(0, 13)}`,
      payload: {
        accountId: wm.accountId,
        configId: wm.configId,
        peakEquity: wm.peakEquity,
        peakBalance: wm.peakBalance,
        currentDrawdownPct: wm.currentDrawdownPct,
      },
    });
  }
  saveDemoState(SLOT, state);
}

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

function freshEvents(log: LifecycleEvent[]): LifecycleEvent[] {
  const fresh: LifecycleEvent[] = [];
  let max = state.lastProcessedSeq;
  for (const e of log) {
    const seq = Number(String(e.id).split(":")[0]);
    if (!Number.isFinite(seq)) continue;
    if (seq <= state.lastProcessedSeq) continue;
    fresh.push(e);
    if (seq > max) max = seq;
  }
  if (fresh.length) {
    state.lastProcessedSeq = max;
    saveDemoState(SLOT, state);
  }
  return fresh;
}

export function useDrawdownEvaluator(_tenantId: string): void {
  const log = useLifecycleLog();

  // Event-driven: keep watermarks in step with closed trades.
  useEffect(() => {
    for (const e of freshEvents(log)) {
      if (e.name !== "trade.closed") continue;
      const accountId = typeof e.payload?.accountId === "string" ? e.payload.accountId : "";
      if (!accountId) continue;
      const pnl = typeof e.payload?.pnl === "number" ? e.payload.pnl : 0;
      const limits = (e.payload?.accountLimits ?? {}) as { daily?: number };
      const baseline = (e.payload?.accountBaseline ?? {}) as { dailyLossUsed?: number };
      applyTradeToWatermark(accountId, pnl, {
        dailyLimit: typeof limits.daily === "number" ? limits.daily : undefined,
        baselineDailyUsed:
          typeof baseline.dailyLossUsed === "number" ? baseline.dailyLossUsed : undefined,
      });
    }
  }, [log]);

  // Job-driven: watermark recalculation interval + timezone-aware daily
  // reset check run on a 60s tick (the lifecycle log carries no clock
  // events, so a real timer is the honest way to schedule this).
  useEffect(() => {
    const tick = () => {
      recalculateWatermarks();
      for (const wm of Object.values(state.watermarks)) {
        checkDailyReset(wm.accountId, wm.configId);
      }
    };
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

export function getDrawdownStats(): {
  totalConfigs: number;
  enabledConfigs: number;
  trailingConfigs: number;
  staticConfigs: number;
  totalWatermarks: number;
  averageDrawdownPct: number;
} {
  const watermarks = Object.values(state.watermarks);
  return {
    totalConfigs: state.configs.length,
    enabledConfigs: state.configs.filter((c) => c.enabled).length,
    trailingConfigs: state.configs.filter((c) => c.drawdownType === "trailing").length,
    staticConfigs: state.configs.filter((c) => c.drawdownType === "static").length,
    totalWatermarks: watermarks.length,
    averageDrawdownPct:
      watermarks.length > 0
        ? watermarks.reduce((s, w) => s + w.currentDrawdownPct, 0) / watermarks.length
        : 0,
  };
}
