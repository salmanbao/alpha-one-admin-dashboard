"use client";

/**
 * Trader App — compliance & payout-readiness store (R7 I2).
 *
 * One object, one write path (house rule R10): per-account rule
 * configuration (drawdown model + the percentages the challenge sets)
 * and the computed violation list live under `pfaas:trader:compliance`,
 * so a reload keeps every rule break the trader has hit and all
 * compliance surfaces read the same truth.
 *
 * Grounding rules:
 *   • Config is SEEDED per challenge on first run from the program
 *     fixtures (terraRiskLimits / profit target / min days) — the
 *     derived dollar limits match the existing meters by construction.
 *   • Violations are COMPUTED from the trading store (lib/trading) +
 *     the account record via `objectivesFor` — never invented. Each new
 *     break is appended once (stable id) and emitted as
 *     `compliance.violation`; the near-breach state emits
 *     `compliance.buffer-warning`. The named consumer for both is the
 *     trader inbox bridge (lib/inbox/inbox-lifecycle-bridge), which turns
 *     them into receipts — no orphans.
 *   • Widgets read `complianceSnapshotFor`, which derives every figure
 *     from the same `objectivesFor` standing the Objectives page shows,
 *     so the two pages can never disagree.
 *
 * Drawdown model (the `drawdownType` setting):
 *   • static                  — floor does not move with equity
 *   • trailing-eod            — floor rises with the daily-close high
 *                               (steps at 00:00 UTC)
 *   • trailing-intraday       — floor rises with every new equity high
 *   • trailing-to-static      — trails until the profit target is met,
 *                               then locks (floor goes flat)
 * On the daily chart eod and intraday share the same granularity (the
 * difference only shows between day boundaries — disclosed in the
 * settings card copy).
 */

import { useSyncExternalStore } from "react";
import { emitLifecycle } from "@pfaas/lifecycle";
import { toast } from "@/hooks/use-toast";
import {
  challengeForAccount,
  equityCurveFor,
  objectivesFor,
  payoutEntitlement,
  terraAccounts,
  terraRiskLimits,
  type TerraPosition,
  type TerraSeriesPoint,
  type TerraTrade,
} from "@/lib/fixtures/terra-fixtures";
import { buildPayoutCriteria } from "@/components/terra/payout-summary-strip";
import { useTrading } from "@/lib/trading/trading-context";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type DrawdownType =
  | "trailing-eod"
  | "trailing-intraday"
  | "static"
  | "trailing-to-static";

export const DRAWDOWN_TYPES: DrawdownType[] = [
  "trailing-eod",
  "trailing-intraday",
  "static",
  "trailing-to-static",
];

export const DRAWDOWN_TYPE_LABEL: Record<DrawdownType, string> = {
  "trailing-eod": "Trailing (end of day)",
  "trailing-intraday": "Trailing (intraday)",
  static: "Static",
  "trailing-to-static": "Trailing to static",
};

export const DRAWDOWN_TYPE_NOTE: Record<DrawdownType, string> = {
  "trailing-eod":
    "The floor rises after each trading day closes at a new equity high — intraday swings don't move it until 00:00 UTC.",
  "trailing-intraday":
    "The floor rises the moment equity sets a new high, day or night.",
  static: "The floor is fixed and never moves — gains earn no extra buffer.",
  "trailing-to-static":
    "The floor trails new highs until the profit target is reached, then locks in place.",
};

export interface ComplianceConfig {
  accountId: string;
  drawdownType: DrawdownType;
  /** Daily loss allowance as % of the starting balance. */
  maxDailyLossPct: number;
  /** Total drawdown allowance as % of the starting balance. */
  maxTotalDrawdownPct: number;
  /** Profit target as % of the starting balance (0 on scaling accounts). */
  profitTargetPct: number;
  minTradingDays: number;
  /** Cap on best-day share of total profit. */
  consistencyPct: number;
}

export type ViolationType = "daily-loss" | "max-drawdown" | "consistency";

export interface ComplianceViolation {
  /** Stable id: `${accountId}:${type}[:${day}]` — dedupes re-evaluation. */
  id: string;
  accountId: string;
  type: ViolationType;
  severity: "high" | "medium";
  /** Human sentence computed from the standing at detection time. */
  detail: string;
  /** ISO timestamp of detection (daysAgo/daysFromNow not applicable — detection is always "now"). */
  at: string;
}

export interface ComplianceState {
  accounts: Record<string, ComplianceConfig>;
  violations: ComplianceViolation[];
}

/** The trading-store slice compliance reads (lib/trading/trading-store). */
export interface ComplianceTrading {
  positions: TerraPosition[];
  closedTrades: TerraTrade[];
  realizedByAccount: Record<string, number>;
}

const STORAGE_KEY = "pfaas:trader:compliance";

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ */
/* Seed / migrate                                                      */
/* ------------------------------------------------------------------ */

/**
 * Rule set for one account, seeded from its challenge fixtures so the
 * compliance meters equal the existing drawdown meters by construction
 * (pct × startingBalance === terraRiskLimits dollars).
 */
function seedConfigFor(accountId: string): ComplianceConfig | null {
  const acc = terraAccounts.find((a) => a.id === accountId);
  if (!acc) return null;
  const limits = terraRiskLimits[acc.id] ?? { daily: 1000, maxDd: 5000 };
  const pctOfStart = (n: number) =>
    acc.startingBalance > 0
      ? Math.round((n / acc.startingBalance) * 10_000) / 100
      : 0;
  const challenge = challengeForAccount(acc.id);
  // Drawdown model seeded per challenge type (industry convention):
  // two-phase programs trail EOD, one-phase trails until static,
  // instant funding moves intraday.
  const drawdownType: DrawdownType =
    challenge?.tag === "instant"
      ? "trailing-intraday"
      : challenge?.tag === "one-phase"
        ? "trailing-to-static"
        : "trailing-eod";
  return {
    accountId: acc.id,
    drawdownType,
    maxDailyLossPct: pctOfStart(limits.daily),
    maxTotalDrawdownPct: pctOfStart(limits.maxDd),
    profitTargetPct: pctOfStart(acc.profitTarget),
    minTradingDays: challenge?.minDays ?? 4,
    // Program-wide consistency cap (matches objectivesFor + the FAQ).
    consistencyPct: 45,
  };
}

/** First run — every account gets its challenge's rule set; no violations. */
function seedState(): ComplianceState {
  const accounts: Record<string, ComplianceConfig> = {};
  for (const acc of terraAccounts) {
    const cfg = seedConfigFor(acc.id);
    if (cfg) accounts[acc.id] = cfg;
  }
  return { accounts, violations: [] };
}

const isViolation = (x: unknown): x is ComplianceViolation =>
  !!x &&
  typeof x === "object" &&
  typeof (x as { id?: unknown }).id === "string" &&
  typeof (x as { type?: unknown }).type === "string";

/** Validate a persisted payload; fill configs for accounts added since. */
function migrate(parsed: unknown): ComplianceState {
  const base = seedState();
  if (!parsed || typeof parsed !== "object") return base;
  const raw = parsed as Partial<ComplianceState>;
  const accounts: Record<string, ComplianceConfig> = { ...base.accounts };
  if (raw.accounts && typeof raw.accounts === "object") {
    for (const [id, cfg] of Object.entries(raw.accounts)) {
      if (cfg && typeof cfg === "object" && typeof cfg.drawdownType === "string") {
        accounts[id] = cfg as ComplianceConfig;
      }
    }
  }
  const violations = Array.isArray(raw.violations)
    ? raw.violations.filter(isViolation)
    : [];
  return { accounts, violations };
}

let state: ComplianceState = (() => {
  if (typeof window === "undefined") return seedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    return migrate(JSON.parse(raw));
  } catch {
    return seedState();
  }
})();

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
}

/** Single write path: assign, persist (R10), notify subscribers. */
function commit(next: ComplianceState) {
  state = next;
  persist();
  emit();
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
  return JSON.stringify(state);
}

function getServerSnapshot(): string {
  return JSON.stringify(seedState());
}

/** Reactive compliance state (config + violations). */
export function useComplianceStore(): ComplianceState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as ComplianceState;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/**
 * Change the drawdown model for an account — persisted (R10), so the
 * floor chart and buffer gauge re-render from the same stored setting
 * after a reload. Honest demo confirmation.
 */
export function setDrawdownType(accountId: string, type: DrawdownType): void {
  const acc = terraAccounts.find((a) => a.id === accountId);
  const cfg = state.accounts[accountId] ?? seedConfigFor(accountId);
  if (!cfg || cfg.drawdownType === type) return;
  commit({
    ...state,
    accounts: {
      ...state.accounts,
      [accountId]: { ...cfg, drawdownType: type },
    },
  });
  toast({
    title: "Drawdown model updated",
    description: `${DRAWDOWN_TYPE_LABEL[type]}${acc ? ` on #${acc.login}` : ""} — saved in this browser (Demo).`,
  });
}

/* ------------------------------------------------------------------ */
/* Derivations — everything below reads stores, never fixture arrays   */
/* ------------------------------------------------------------------ */

export function configFor(
  accountId: string,
  s: ComplianceState = state,
): ComplianceConfig | null {
  return s.accounts[accountId] ?? seedConfigFor(accountId);
}

/** Dollar limits derived from the stored percentages (== terraRiskLimits at seed). */
export function limitsFor(
  accountId: string,
  cfg: ComplianceConfig | null = configFor(accountId),
): { daily: number; maxDd: number } {
  const acc = terraAccounts.find((a) => a.id === accountId);
  const start = acc?.startingBalance ?? 0;
  if (!cfg) {
    const l = terraRiskLimits[accountId] ?? { daily: 1000, maxDd: 5000 };
    return l;
  }
  return {
    daily: Math.round(start * (cfg.maxDailyLossPct / 100)),
    maxDd: Math.round(start * (cfg.maxTotalDrawdownPct / 100)),
  };
}

export interface ComplianceSnapshot {
  accountId: string;
  config: ComplianceConfig;
  limits: { daily: number; maxDd: number };
  /** Live equity: fixture equity + this session's realized P&L. */
  equityToday: number;
  daily: {
    used: number;
    limit: number;
    usedPct: number;
    remaining: number;
    resetNote: string;
  };
  total: {
    used: number;
    limit: number;
    usedPct: number;
    /** Distance to the drawdown floor (limit − used). */
    buffer: number;
    bufferPct: number;
    /** The floor level itself: equity − buffer. */
    floor: number;
  };
  profit: { name: string; current: number; target: number; pct: number };
  days: { current: number; target: number; met: boolean } | null;
  consistency: { bestDayPct: number; capPct: number; headroomPct: number; ok: boolean };
  payout: {
    funded: boolean;
    ready: boolean;
    outstanding: number;
    unmet: string[];
    withdrawable: number;
  };
  violations: ComplianceViolation[];
}

/**
 * One account's full compliance standing — the single source every
 * widget reads. Profit / daily / drawdown / days / consistency come from
 * `objectivesFor` (the exact numbers the Objectives page gauges show);
 * payout readiness from the shared payout criteria chain.
 */
export function complianceSnapshotFor(
  accountId: string,
  s: ComplianceState,
  trading: ComplianceTrading,
): ComplianceSnapshot | null {
  const acc = terraAccounts.find((a) => a.id === accountId);
  if (!acc) return null;
  const config = configFor(accountId, s);
  if (!config) return null;
  const limits = limitsFor(accountId, config);
  const realized = trading.realizedByAccount[accountId] ?? 0;
  const objectives = objectivesFor(accountId, trading.closedTrades, realized);

  const objDaily = objectives.find((o) => o.id === "obj-daily-dd");
  const objDd = objectives.find((o) => o.id === "obj-max-dd");
  const objProfit =
    objectives.find((o) => o.id === "obj-profit") ??
    objectives.find((o) => o.id === "obj-scaling-gain");
  const objDays = objectives.find((o) => o.id === "obj-min-days");
  const objCons = objectives.find((o) => o.id === "obj-consistency");

  const dailyUsed = objDaily?.current ?? 0;
  const ddUsed = objDd?.current ?? 0;
  const dailyLimit = objDaily?.target ?? limits.daily;
  const ddLimit = objDd?.target ?? limits.maxDd;
  const equityToday = acc.equity + realized;

  const buffer = Math.max(0, ddLimit - ddUsed);
  const bestDayPct = objCons?.current ?? 0;
  const capPct = config.consistencyPct;

  const entitlement = payoutEntitlement(accountId);
  const criteria = buildPayoutCriteria(
    accountId,
    entitlement.withdrawable,
    trading.closedTrades,
  );
  const unmet = criteria.filter((c) => !c.ok);

  return {
    accountId,
    config,
    limits: { daily: dailyLimit, maxDd: ddLimit },
    equityToday,
    daily: {
      used: dailyUsed,
      limit: dailyLimit,
      usedPct: dailyLimit > 0 ? round1((dailyUsed / dailyLimit) * 100) : 0,
      remaining: Math.max(0, dailyLimit - dailyUsed),
      resetNote: "resets at 00:00 UTC",
    },
    total: {
      used: ddUsed,
      limit: ddLimit,
      usedPct: ddLimit > 0 ? round1((ddUsed / ddLimit) * 100) : 0,
      buffer,
      bufferPct: ddLimit > 0 ? round1((buffer / ddLimit) * 100) : 0,
      floor: Math.round((equityToday - buffer) * 100) / 100,
    },
    profit: {
      name: objProfit?.name ?? "Profit Target",
      current: objProfit?.current ?? acc.pnl + realized,
      target: objProfit?.target ?? acc.profitTarget,
      pct: objProfit && objProfit.target > 0
        ? Math.min(100, round1((objProfit.current / objProfit.target) * 100))
        : 100,
    },
    days: objDays
      ? {
          current: objDays.current,
          target: objDays.target,
          met: objDays.current >= objDays.target,
        }
      : null,
    consistency: {
      bestDayPct,
      capPct,
      headroomPct: round1(((capPct - bestDayPct) / Math.max(1, capPct)) * 100),
      ok: bestDayPct <= capPct,
    },
    payout: {
      funded: entitlement.isFunded,
      ready: entitlement.isFunded && unmet.length === 0,
      outstanding: unmet.length,
      unmet: unmet.map((c) => c.label),
      withdrawable: entitlement.withdrawable,
    },
    violations: s.violations.filter((v) => v.accountId === accountId),
  };
}

/**
 * Equity series with its drawdown FLOOR series, shaped by the stored
 * drawdown model. Today's floor anchors to the live meter (equity −
 * remaining buffer); history trails below it for trailing models and
 * stays flat for static — changing the type re-renders this line.
 */
export function equityFloorSeries(
  snapshot: ComplianceSnapshot,
  days: number,
  trading: ComplianceTrading,
): { equity: TerraSeriesPoint[]; floor: TerraSeriesPoint[] } {
  const accountId = snapshot.accountId;
  const acc = terraAccounts.find((a) => a.id === accountId);
  const equity = equityCurveFor(
    accountId,
    days,
    trading.closedTrades,
    trading.positions,
    trading.realizedByAccount[accountId] ?? 0,
  );
  if (!acc || equity.length === 0) return { equity, floor: [] };

  const floorToday = snapshot.total.floor;
  const hwm: number[] = [];
  for (let i = 0; i < equity.length; i++) {
    hwm.push(i === 0 ? equity[i].y : Math.max(hwm[i - 1], equity[i].y));
  }
  const last = equity.length - 1;
  const hwmLast = hwm[last];
  const type = snapshot.config.drawdownType;

  // Base offset of each point's floor relative to today's floor (≤ 0 for
  // trailing models — the floor has risen over time).
  const base: number[] = equity.map((_, i) => {
    if (type === "static") return 0;
    if (type === "trailing-to-static") {
      const target$ = acc.startingBalance * (snapshot.config.profitTargetPct / 100);
      // Lock the floor at the first close that reaches the target.
      const lockIdx = target$ > 0
        ? equity.findIndex((p) => p.y - acc.startingBalance >= target$)
        : 0;
      if (lockIdx === -1) return hwm[i] - hwmLast;
      return i <= lockIdx ? hwm[i] - hwm[lockIdx] : 0;
    }
    // trailing-eod + trailing-intraday: the series points are daily
    // closes, so both step at day boundaries (disclosed in the copy).
    return hwm[i] - hwmLast;
  });

  const floor = equity.map((p, i) => ({
    x: p.x,
    y: Math.round((floorToday + base[i]) * 100) / 100,
  }));
  return { equity, floor };
}

/* ------------------------------------------------------------------ */
/* Evaluation — violations computed from stores, emitted once          */
/* ------------------------------------------------------------------ */

const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Evaluate every account's rules against the trading store. New breaks
 * are appended to the store (persisted, deduped by stable id) and
 * emitted as `compliance.violation`; a buffer in its final 20% emits
 * `compliance.buffer-warning` (deduped per account/day via the event
 * key). Both map to inbox receipts in the app-shell bridge.
 */
export function runComplianceEvaluation(trading: ComplianceTrading): void {
  if (typeof window === "undefined") return;
  const current = readComplianceState();
  const day = todayKey();
  const newViolations: ComplianceViolation[] = [];
  const existing = new Set(current.violations.map((v) => v.id));
  const breaching = new Set<string>(); // `${accountId}:${metric}` already violating this run

  for (const acc of terraAccounts) {
    const snap = complianceSnapshotFor(acc.id, current, trading);
    if (!snap) continue;

    if (snap.daily.used >= snap.daily.limit) {
      const id = `${acc.id}:daily-loss:${day}`;
      breaching.add(`${acc.id}:daily`);
      if (!existing.has(id)) {
        newViolations.push({
          id,
          accountId: acc.id,
          type: "daily-loss",
          severity: "high",
          detail: `Daily loss limit hit: ${money(snap.daily.used)} of ${money(snap.daily.limit)} consumed (${acc.login}) — the account would be breached at 00:00 UTC.`,
          at: new Date().toISOString(),
        });
      }
    }
    if (snap.total.used >= snap.total.limit) {
      const id = `${acc.id}:max-drawdown`;
      breaching.add(`${acc.id}:total`);
      if (!existing.has(id)) {
        newViolations.push({
          id,
          accountId: acc.id,
          type: "max-drawdown",
          severity: "high",
          detail: `Maximum drawdown hit: ${money(snap.total.used)} of ${money(snap.total.limit)} used (${acc.login}) — the drawdown floor is touched.`,
          at: new Date().toISOString(),
        });
      }
    }
    if (!snap.consistency.ok) {
      const id = `${acc.id}:consistency:${day}`;
      if (!existing.has(id)) {
        newViolations.push({
          id,
          accountId: acc.id,
          type: "consistency",
          severity: "medium",
          detail: `Consistency cap exceeded: best day is ${Math.round(snap.consistency.bestDayPct)}% of total profit against the ${snap.consistency.capPct}% cap (${acc.login}).`,
          at: new Date().toISOString(),
        });
      }
    }
  }

  if (newViolations.length > 0) {
    commit({
      ...current,
      violations: [...current.violations, ...newViolations],
    });
  }

  // Emit after the commit so consumers read the final store state.
  for (const v of newViolations) {
    emitLifecycle({
      entity: { kind: "compliance", id: v.id },
      name: "compliance.violation",
      actor: "trader",
      key: v.id,
      payload: {
        accountId: v.accountId,
        violationType: v.type,
        severity: v.severity,
        detail: v.detail,
      },
    });
  }

  // Final-20% buffer warnings (80–99% used) — one per account/day/metric,
  // skipped when the metric is already breaching (that fired above).
  const fresh = readComplianceState();
  for (const acc of terraAccounts) {
    const snap = complianceSnapshotFor(acc.id, fresh, trading);
    if (!snap) continue;
    const metrics: Array<{
      key: "daily" | "total";
      metric: string;
      pct: number;
      remaining: number;
      limit: number;
    }> = [
      {
        key: "daily",
        metric: "daily loss",
        pct: snap.daily.usedPct,
        remaining: snap.daily.remaining,
        limit: snap.daily.limit,
      },
      {
        key: "total",
        metric: "drawdown",
        pct: snap.total.usedPct,
        remaining: snap.total.buffer,
        limit: snap.total.limit,
      },
    ];
    for (const m of metrics) {
      if (m.pct < 80 || m.pct >= 100) continue;
      if (breaching.has(`${acc.id}:${m.key}`)) continue;
      emitLifecycle({
        entity: { kind: "compliance", id: acc.id },
        name: "compliance.buffer-warning",
        actor: "trader",
        key: `${day}:${m.key}`,
        payload: {
          accountId: acc.id,
          login: acc.login,
          metric: m.metric,
          usedPct: m.pct,
          remaining: Math.round(m.remaining * 100) / 100,
          limit: m.limit,
        },
      });
    }
  }
}

/** Non-reactive read (evaluation, tests). */
export function readComplianceState(): ComplianceState {
  return state;
}

/* ------------------------------------------------------------------ */
/* Reactive helpers                                                    */
/* ------------------------------------------------------------------ */

/** Compliance standing for one account, re-rendering on store changes. */
export function useComplianceSnapshot(accountId: string): ComplianceSnapshot | null {
  const s = useComplianceStore();
  const trading = useTrading();
  return complianceSnapshotFor(accountId, s, {
    positions: trading.positions,
    closedTrades: trading.closedTrades,
    realizedByAccount: trading.realizedByAccount,
  });
}
