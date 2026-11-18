"use client";

/**
 * R7 I5 — risk rule engine (P6): DXtrade-style "triggers alerts and
 * automated actions when predefined conditions are met".
 *
 *   • Rule model: { id, metric, operator, threshold, severity, action,
 *     enabled } — CRUD + enable toggles, persisted to
 *     `pfaas:demo:risk-rules` (R10).
 *   • Evaluator: `useRiskRulesEvaluator` runs in the app shell and
 *     reacts to every `trade.closed` on the shared lifecycle log. It
 *     accumulates per-account risk context from the log + the trade
 *     payload, evaluates the enabled rules, and on a hit creates an
 *     alert row (the risk-signal queue) + `recordAudit`s + emits
 *     `risk.alert.raised` (consumer: trader inbox bridge "Warning: you
 *     used N% of your daily loss limit (Demo)" + risk-dashboard
 *     operator-warnings panel + my-accounts flag + account-breach
 *     wiring). Severity routing: warn → notify trader; soft-breach →
 *     flag account; hard-breach → open a RiskCase in the existing
 *     breach flow with the rule cited.
 *   • Account state (limits/usage) is captured from the trade payload so
 *     the prop-admin side never invents limits; the trader is the source
 *     of truth for daily/maxDd limits.
 *
 * Every mutation persists + is audited (§5 rule 2); reads are zod-validated.
 */

import { useEffect, useState } from "react";
import { z } from "zod";
import { usePlatform } from "@/lib/platform/platform-context";
import { recordAudit } from "@/lib/audit";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { useLifecycleLog, emitLifecycle, type LifecycleEvent } from "@pfaas/lifecycle";
import { createRiskCase, dismissRiskCase, getRiskCases, type RiskCaseStatus } from "@/modules/risk/risk-case-store";
import { hasPermission } from "@/lib/platform/permission-engine";
// R9 W1 — accounts are evaluated against their PINNED rule version, not the
// live rule list (type-only import above keeps this module the owner of the
// RiskRule shape; rules-versions-store imports it back as a type only).
import { resolvePinnedRules } from "@/lib/rules-versions-store";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RiskMetric =
  | "daily-loss"
  | "total-drawdown"
  | "consistency"
  | "weekend-hold"
  | "news-trading";
export type RiskSeverity = "warn" | "soft-breach" | "hard-breach";
export type RiskAction = "notify-trader" | "flag-account" | "recommend-breach";
export type RiskOperator = ">=" | "<=" | ">" | "<";

export interface RiskRule {
  id: string;
  name: string;
  metric: RiskMetric;
  operator: RiskOperator;
  threshold: number;
  severity: RiskSeverity;
  action: RiskAction;
  enabled: boolean;
  notes?: string;
}

export type RiskAlertStatus = "open" | "acknowledged";

export interface RiskAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: RiskMetric;
  operator: RiskOperator;
  threshold: number;
  value: number;
  pct: number;
  severity: RiskSeverity;
  action: RiskAction;
  accountId: string;
  accountLogin?: string;
  accountName?: string;
  tradeId?: string;
  detail: string;
  at: string;
  status: RiskAlertStatus;
  /** R9 W1 — the rule version this evaluation was made against. */
  ruleVersionId?: string;
  ruleVersion?: number;
  /** R9 W1 — set when an accepted appeal reverses this breach. */
  reversedAt?: string;
  reversedBy?: string;
  reversedReason?: string;
  reversedByAppealId?: string;
}

export interface RiskAccountState {
  accountId: string;
  login?: string;
  name?: string;
  dailyLimit: number;
  maxDdLimit: number;
  baselineDailyUsed: number;
  baselineMaxDdUsed: number;
  // Accumulated from trade.closed events in the shared log:
  sessionTrades: string[]; // trade ids processed
  dailyPnl: number; // sum of pnl today
  cumulativePnl: number; // all-time
  peakCumulativePnl: number; // for drawdown
  weekendHolds: number;
  newsTrades: number;
  dailyPnlByDay: Record<string, number>;
  lastUpdated: string;
}

export interface RiskRulesState {
  rules: RiskRule[];
  alerts: RiskAlert[];
  accounts: Record<string, RiskAccountState>;
  stamps: Record<string, string>; // dedupe key -> alert id
}

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

const riskMetricSchema = z.enum(["daily-loss", "total-drawdown", "consistency", "weekend-hold", "news-trading"]);
const riskSeveritySchema = z.enum(["warn", "soft-breach", "hard-breach"]);
const riskActionSchema = z.enum(["notify-trader", "flag-account", "recommend-breach"]);
const riskOperatorSchema = z.enum([">=", "<=", ">", "<"]);

const riskRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  metric: riskMetricSchema,
  operator: riskOperatorSchema,
  threshold: z.number().finite(),
  severity: riskSeveritySchema,
  action: riskActionSchema,
  enabled: z.boolean(),
  notes: z.string().optional(),
});

const riskAlertSchema = z.object({
  id: z.string().min(1),
  ruleId: z.string().min(1),
  ruleName: z.string().min(1),
  metric: riskMetricSchema,
  operator: riskOperatorSchema,
  threshold: z.number().finite(),
  value: z.number().finite(),
  pct: z.number().finite(),
  severity: riskSeveritySchema,
  action: riskActionSchema,
  accountId: z.string().min(1),
  accountLogin: z.string().optional(),
  accountName: z.string().optional(),
  tradeId: z.string().optional(),
  detail: z.string(),
  at: z.string().min(1),
  status: z.enum(["open", "acknowledged"]),
  ruleVersionId: z.string().optional(),
  ruleVersion: z.number().int().optional(),
  reversedAt: z.string().optional(),
  reversedBy: z.string().optional(),
  reversedReason: z.string().optional(),
  reversedByAppealId: z.string().optional(),
});

const riskAccountStateSchema = z.object({
  accountId: z.string().min(1),
  login: z.string().optional(),
  name: z.string().optional(),
  dailyLimit: z.number().finite().positive(),
  maxDdLimit: z.number().finite().positive(),
  baselineDailyUsed: z.number().finite(),
  baselineMaxDdUsed: z.number().finite(),
  sessionTrades: z.array(z.string()),
  dailyPnl: z.number().finite(),
  cumulativePnl: z.number().finite(),
  peakCumulativePnl: z.number().finite(),
  weekendHolds: z.number().int().nonnegative(),
  newsTrades: z.number().int().nonnegative(),
  dailyPnlByDay: z.record(z.string(), z.number().finite()),
  lastUpdated: z.string().min(1),
});

const stateSchema = z.object({
  rules: z.array(riskRuleSchema),
  alerts: z.array(riskAlertSchema),
  accounts: z.record(z.string(), riskAccountStateSchema),
  stamps: z.record(z.string(), z.string()),
});

const SLOT = "risk-rules";

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const SEED_RULES: RiskRule[] = [
  {
    id: "rule-daily-loss-warn",
    name: "Daily loss early warning",
    metric: "daily-loss",
    operator: ">=",
    threshold: 80,
    severity: "warn",
    action: "notify-trader",
    enabled: true,
    notes: "(Demo) — fires when a trader has used ≥80% of the daily loss limit. Notifies the trader via the inbox.",
  },
  {
    id: "rule-total-dd-soft",
    name: "Max drawdown soft limit",
    metric: "total-drawdown",
    operator: ">=",
    threshold: 90,
    severity: "soft-breach",
    action: "flag-account",
    enabled: true,
    notes: "(Demo) — flags the account in the trader's account list when ≥90% of the max drawdown is consumed.",
  },
  {
    id: "rule-total-dd-hard",
    name: "Max drawdown hard stop",
    metric: "total-drawdown",
    operator: ">=",
    threshold: 100,
    severity: "hard-breach",
    action: "recommend-breach",
    enabled: true,
    notes: "(Demo) — opens a RiskCase (existing breach flow) when the max drawdown is fully consumed, citing this rule.",
  },
  {
    id: "rule-consistency",
    name: "Consistency drift (best-day share)",
    metric: "consistency",
    operator: "<",
    threshold: 50,
    severity: "warn",
    action: "notify-trader",
    enabled: false,
    notes: "(Demo) — fires when the consistency score (100 − best-day share of total profit) falls below 50; needs ≥2 trading days of session history.",
  },
  {
    id: "rule-weekend-hold",
    name: "Weekend hold",
    metric: "weekend-hold",
    operator: ">=",
    threshold: 1,
    severity: "warn",
    action: "notify-trader",
    enabled: false,
    notes: "(Demo) — fires when a position is closed on a weekend (Sat/Sun UTC).",
  },
  {
    id: "rule-news-trading",
    name: "News-window trading",
    metric: "news-trading",
    operator: ">=",
    threshold: 1,
    severity: "warn",
    action: "notify-trader",
    enabled: false,
    notes: "(Demo) — fires when a trade is closed inside a seeded high-impact news window (empty by default).",
  },
];

// Seeded high-impact news windows (UTC ISO ranges) for the news-trading
// metric. Empty by default — operators can extend via the store helper.
const SEED_NEWS_WINDOWS: { symbol: string; start: string; end: string }[] = [];

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let state: RiskRulesState = loadDemoState(SLOT, stateSchema, {
  rules: SEED_RULES,
  alerts: [],
  accounts: {},
  stamps: {},
});
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function persist() {
  saveDemoState(SLOT, state);
}

/* ------------------------------------------------------------------ */
/* CRUD (audited)                                                      */
/* ------------------------------------------------------------------ */

export function useRiskRules(): RiskRule[] {
  const [v, setV] = useState(state.rules);
  useEffect(() => {
    const l = () => setV([...state.rules]);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}

export function useRiskAlerts(): RiskAlert[] {
  const [v, setV] = useState(state.alerts);
  useEffect(() => {
    const l = () => setV([...state.alerts]);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}

export function getRiskRules(): RiskRule[] {
  return state.rules;
}

export function getRiskAlerts(): RiskAlert[] {
  return state.alerts;
}

export function saveRiskRule(rule: RiskRule): void {
  const idx = state.rules.findIndex((r) => r.id === rule.id);
  const isNew = idx === -1;
  if (isNew) state.rules = [...state.rules, rule];
  else state.rules = state.rules.map((r) => (r.id === rule.id ? rule : r));
  recordAudit({
    action: isNew ? "Created risk rule" : "Updated risk rule",
    entity: "risk-rule",
    entityId: rule.id,
    summary: `${rule.name} — ${rule.metric} ${rule.operator} ${rule.threshold} (${rule.severity})${rule.enabled ? "" : " [disabled]"}.`,
    severity: "info",
    module: "risk",
  });
  persist();
  notify();
}

export function deleteRiskRule(id: string): void {
  const r = state.rules.find((x) => x.id === id);
  state.rules = state.rules.filter((x) => x.id !== id);
  // Drop alerts tied to the rule? Keep them as historical trail.
  recordAudit({
    action: "Deleted risk rule",
    entity: "risk-rule",
    entityId: id,
    summary: r ? `${r.name} removed.` : `Rule ${id} removed.`,
    severity: "warning",
    module: "risk",
  });
  persist();
  notify();
}

export function setRiskRuleEnabled(id: string, enabled: boolean): void {
  state.rules = state.rules.map((r) => (r.id === id ? { ...r, enabled } : r));
  const r = state.rules.find((x) => x.id === id);
  recordAudit({
    action: enabled ? "Enabled risk rule" : "Disabled risk rule",
    entity: "risk-rule",
    entityId: id,
    summary: r ? `${r.name} ${enabled ? "enabled" : "disabled"}.` : `Rule ${id} ${enabled ? "enabled" : "disabled"}.`,
    severity: "info",
    module: "risk",
  });
  persist();
  notify();
}

export function acknowledgeAlert(id: string): void {
  state.alerts = state.alerts.map((a) => (a.id === id ? { ...a, status: "acknowledged" } : a));
  persist();
  notify();
}

/**
 * R9 W1 — reverse a breach after an accepted appeal (UC-O1).
 *
 * Marks the alert reversed (the reversal sticks in the detail: reason +
 * appeal id), dismisses the linked risk case (the `[alertId]` marker the
 * hard-breach routing embeds in `signalDetail`), `recordAudit`s both the
 * reversal and the case dismissal, and emits `breach.reversed`.
 *
 * Named consumers of `breach.reversed` (rule 7): trader inbox bridge
 * ("Breach reversed — appeal accepted (Demo)") + the appeals-queue
 * evidence panel (alert shows as reversed instead of open).
 *
 * Idempotent: reversing an already-reversed alert is a no-op.
 */
export function reverseBreach(tid: string, alertId: string, appealId: string, reason: string): boolean {
  const alert = state.alerts.find((a) => a.id === alertId);
  if (!alert || alert.reversedAt) return false;

  state.alerts = state.alerts.map((a) =>
    a.id === alertId
      ? {
          ...a,
          status: "acknowledged" as const,
          reversedAt: new Date().toISOString(),
          reversedBy: "Appeals review",
          reversedReason: reason,
          reversedByAppealId: appealId,
        }
      : a,
  );

  // The linked risk case the hard-breach routing opened for this alert.
  const marker = `[${alertId}]`;
  const kase = getRiskCases(tid).find(
    (c) => c.signalDetail.includes(marker) && c.status !== "dismissed" && c.status !== "resolved",
  );
  if (kase) dismissRiskCase(tid, kase.id);

  persist();
  notify();

  recordAudit({
    action: "Reversed breach",
    entity: "risk-alert",
    entityId: alertId,
    summary: `${alert.ruleName} — ${alert.accountLogin ?? alert.accountId}: breach reversed on appeal ${appealId}. Reason: ${reason}`,
    severity: "info",
    module: "risk",
  });
  if (kase) {
    recordAudit({
      action: "Dismissed risk case",
      entity: "risk-case",
      entityId: kase.id,
      summary: `${kase.id} dismissed after appeal ${appealId} reversed ${alertId}.`,
      severity: "info",
      module: "risk",
    });
  }

  emitLifecycle({
    entity: { kind: "breach", id: alertId },
    name: "breach.reversed",
    actor: "prop-admin",
    key: `reversed:${alertId}`,
    payload: {
      alertId,
      appealId,
      ruleId: alert.ruleId,
      ruleName: alert.ruleName,
      accountId: alert.accountId,
      accountLogin: alert.accountLogin,
      reason,
    },
  });
  return true;
}

export function clearRiskAlerts(): void {
  state.alerts = [];
  state.stamps = {};
  persist();
  notify();
}

/* ------------------------------------------------------------------ */
/* Evaluation helpers                                                  */
/* ------------------------------------------------------------------ */

function cmp(op: RiskOperator, value: number, threshold: number): boolean {
  switch (op) {
    case ">=":
      return value >= threshold;
    case "<=":
      return value <= threshold;
    case ">":
      return value > threshold;
    case "<":
      return value < threshold;
  }
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function isWeekend(iso: string): boolean {
  const d = new Date(iso);
  const wd = d.getUTCDay();
  return wd === 0 || wd === 6;
}

function inNewsWindow(symbol: string, iso: string): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return SEED_NEWS_WINDOWS.some((w) => w.symbol === symbol && t >= Date.parse(w.start) && t <= Date.parse(w.end));
}

function consistencyScore(acct: RiskAccountState): number {
  const days = Object.keys(acct.dailyPnlByDay);
  if (days.length < 2) return 100;
  const total = days.reduce((s, d) => s + Math.max(0, acct.dailyPnlByDay[d]), 0);
  if (total <= 0) return 100;
  const best = Math.max(...days.map((d) => Math.max(0, acct.dailyPnlByDay[d])));
  const bestShare = best / total;
  return Math.round((1 - bestShare) * 100);
}

function metricValue(metric: RiskMetric, acct: RiskAccountState): { value: number; pct: number; detail: string } {
  switch (metric) {
    case "daily-loss": {
      const limit = acct.dailyLimit;
      const used = acct.baselineDailyUsed + Math.max(0, -acct.dailyPnl);
      const pct = limit > 0 ? Math.round((used / limit) * 1000) / 10 : 0;
      return { value: pct, pct, detail: `Used ${used.toFixed(0)} of ${limit.toFixed(0)} daily loss limit (${acct.baselineDailyUsed.toFixed(0)} baseline + ${Math.max(0, -acct.dailyPnl).toFixed(0)} session).` };
    }
    case "total-drawdown": {
      const limit = acct.maxDdLimit;
      const sessionDd = Math.max(0, acct.peakCumulativePnl - acct.cumulativePnl) + Math.max(0, -acct.cumulativePnl);
      const used = acct.baselineMaxDdUsed + Math.max(0, sessionDd - acct.baselineMaxDdUsed * 0 ? 0 : 0);
      // Use the larger of baseline or baseline+session so it never regresses:
      const totalUsed = Math.max(acct.baselineMaxDdUsed, acct.baselineMaxDdUsed + Math.max(0, sessionDd));
      const pct = limit > 0 ? Math.round((totalUsed / limit) * 1000) / 10 : 0;
      return { value: pct, pct, detail: `Used ${totalUsed.toFixed(0)} of ${limit.toFixed(0)} max drawdown (${acct.baselineMaxDdUsed.toFixed(0)} baseline + ${Math.max(0, sessionDd).toFixed(0)} session).` };
    }
    case "consistency": {
      const score = consistencyScore(acct);
      return { value: score, pct: score, detail: `Consistency score ${score} (100 − best-day share of total profit; needs ≥2 trading days).` };
    }
    case "weekend-hold": {
      return { value: acct.weekendHolds, pct: acct.weekendHolds, detail: `${acct.weekendHolds} weekend-closed trade(s) this session.` };
    }
    case "news-trading": {
      return { value: acct.newsTrades, pct: acct.newsTrades, detail: `${acct.newsTrades} trade(s) closed inside a seeded news window this session.` };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Account state accumulation                                          */
/* ------------------------------------------------------------------ */

function ensureAccount(e: LifecycleEvent): RiskAccountState | null {
  const accountId = String(e.payload?.accountId ?? "");
  if (!accountId) return null;
  const limits = (e.payload?.accountLimits ?? {}) as { daily?: number; maxDd?: number };
  const baseline = (e.payload?.accountBaseline ?? {}) as { dailyLossUsed?: number; maxDdUsed?: number };
  const login = typeof e.payload?.accountLogin === "string" ? e.payload.accountLogin : undefined;
  const name = typeof e.payload?.accountName === "string" ? e.payload.accountName : undefined;
  const dailyLimit = typeof limits.daily === "number" && limits.daily > 0 ? limits.daily : state.accounts[accountId]?.dailyLimit ?? 0;
  if (!dailyLimit) return null; // no limits known yet — skip
  const maxDdLimit = typeof limits.maxDd === "number" && limits.maxDd > 0 ? limits.maxDd : state.accounts[accountId]?.maxDdLimit ?? 0;
  if (!maxDdLimit) return null;
  const existing = state.accounts[accountId];
  if (existing) {
    if (login) existing.login = login;
    if (name) existing.name = name;
    // Refresh baseline if provided (trader is source of truth).
    if (typeof baseline.dailyLossUsed === "number") existing.baselineDailyUsed = baseline.dailyLossUsed;
    if (typeof baseline.maxDdUsed === "number") existing.baselineMaxDdUsed = baseline.maxDdUsed;
    existing.dailyLimit = dailyLimit;
    existing.maxDdLimit = maxDdLimit;
    existing.lastUpdated = new Date().toISOString();
    return existing;
  }
  const acct: RiskAccountState = {
    accountId,
    login,
    name,
    dailyLimit,
    maxDdLimit,
    baselineDailyUsed: typeof baseline.dailyLossUsed === "number" ? baseline.dailyLossUsed : 0,
    baselineMaxDdUsed: typeof baseline.maxDdUsed === "number" ? baseline.maxDdUsed : 0,
    sessionTrades: [],
    dailyPnl: 0,
    cumulativePnl: 0,
    peakCumulativePnl: 0,
    weekendHolds: 0,
    newsTrades: 0,
    dailyPnlByDay: {},
    lastUpdated: new Date().toISOString(),
  };
  state.accounts[accountId] = acct;
  return acct;
}

function applyTrade(e: LifecycleEvent, acct: RiskAccountState): void {
  const tradeId = String(e.entity?.id ?? "");
  if (acct.sessionTrades.includes(tradeId)) return; // already processed
  const pnl = typeof e.payload?.pnl === "number" ? e.payload.pnl : 0;
  const symbol = typeof e.payload?.symbol === "string" ? e.payload.symbol : "";
  const closedAt = typeof e.payload?.closedAt === "string" ? e.payload.closedAt : e.at;
  acct.sessionTrades.push(tradeId);
  acct.dailyPnl += pnl;
  acct.cumulativePnl += pnl;
  if (acct.cumulativePnl > acct.peakCumulativePnl) acct.peakCumulativePnl = acct.cumulativePnl;
  const dk = dayKey(closedAt);
  acct.dailyPnlByDay[dk] = (acct.dailyPnlByDay[dk] ?? 0) + pnl;
  if (isWeekend(closedAt)) acct.weekendHolds += 1;
  if (inNewsWindow(symbol, closedAt)) acct.newsTrades += 1;
  acct.lastUpdated = new Date().toISOString();
}

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

export function useRiskRulesEvaluator(tid: string): void {
  const events = useLifecycleLog();
  const { user } = usePlatform();
  const canRun = hasPermission(user, "risk.read");
  useEffect(() => {
    if (!canRun) return;
    let changed = false;
    for (const e of events) {
      if (e.name !== "trade.closed" || e.entity?.kind !== "trade") continue;
      const acct = ensureAccount(e);
      if (!acct) continue;
      // Accumulate (idempotent per trade).
      applyTrade(e, acct);
      const tradeId = String(e.entity?.id ?? "");
      // R9 W1 — resolve the account's PINNED rule version before comparing
      // thresholds: a grandfathered account keeps evaluating against the
      // version it signed up under, so publishing v4 never changes v3's
      // numbers retroactively. First sight pins the account.
      const program =
        typeof e.payload?.accountProgram === "string" ? e.payload.accountProgram : undefined;
      const pinned = resolvePinnedRules(acct.accountId, program, acct.login);
      if (!pinned) continue;
      const accountRules = pinned.rules;
      const citedVersion = `Rules v${pinned.version.version}`;
      // Evaluate each enabled rule once per (rule, account, day).
      const dk = dayKey(typeof e.payload?.closedAt === "string" ? e.payload.closedAt : e.at);
      for (const rule of accountRules) {
        if (!rule.enabled) continue;
        const stampKey = `${rule.id}|${acct.accountId}|${dk}`;
        if (state.stamps[stampKey]) continue;
        const mv = metricValue(rule.metric, acct);
        if (!cmp(rule.operator, mv.value, rule.threshold)) continue;
        // Hit → create alert.
        const alertId = `risk-alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const alert: RiskAlert = {
          id: alertId,
          ruleId: rule.id,
          ruleName: rule.name,
          metric: rule.metric,
          operator: rule.operator,
          threshold: rule.threshold,
          value: mv.value,
          pct: mv.pct,
          severity: rule.severity,
          action: rule.action,
          accountId: acct.accountId,
          accountLogin: acct.login,
          accountName: acct.name,
          tradeId,
          detail: mv.detail,
          at: new Date().toISOString(),
          status: "open",
          ruleVersionId: pinned.version.id,
          ruleVersion: pinned.version.version,
        };
        state.alerts = [alert, ...state.alerts].slice(0, 100);
        state.stamps[stampKey] = alertId;
        changed = true;

        // Audit — every evaluation that cites a version records it (R9 W1).
        recordAudit({
          action: "Risk alert raised",
          entity: "risk-alert",
          entityId: alertId,
          summary: `${rule.name} — ${acct.login ?? acct.accountId}: ${mv.detail} [${citedVersion}]`,
          severity: rule.severity === "hard-breach" ? "critical" : rule.severity === "soft-breach" ? "warning" : "info",
          module: "risk",
        });

        // Emit lifecycle event (consumer: trader inbox bridge + panels).
        emitLifecycle({
          entity: { kind: "account", id: acct.accountId },
          name: "risk.alert.raised",
          actor: "prop-admin",
          key: `${alertId}:raised`,
          payload: {
            alertId,
            ruleId: rule.id,
            ruleName: rule.name,
            metric: rule.metric,
            operator: rule.operator,
            threshold: rule.threshold,
            value: mv.value,
            pct: mv.pct,
            severity: rule.severity,
            action: rule.action,
            accountId: acct.accountId,
            accountLogin: acct.login,
            accountName: acct.name,
            tradeId,
            detail: mv.detail,
            ruleVersionId: pinned.version.id,
            ruleVersion: pinned.version.version,
          },
        });

        // Severity routing.
        if (rule.severity === "hard-breach" && rule.action === "recommend-breach") {
          // Route into the existing breach flow (risk case) with the rule cited.
          const marker = `[${alertId}]`;
          const existing = getRiskCases(tid).find((c) => c.status === "escalated" && c.signalDetail.includes(marker));
          if (!existing) {
            createRiskCase(tid, {
              severity: "critical",
              traderId: acct.accountId,
              traderName: acct.name ?? acct.login ?? acct.accountId,
              signal: rule.metric,
              signalDetail: `${rule.name} — ${mv.detail} — breached account ${marker} (rule ${rule.id} · ${citedVersion})`,
            });
          }
        }
      }
    }
    if (changed) persist();
    notify();
  }, [events, tid, canRun]);
}

/* ------------------------------------------------------------------ */
/* Exports for news windows (operators)                                */
/* ------------------------------------------------------------------ */

export function addNewsWindow(symbol: string, start: string, end: string): void {
  SEED_NEWS_WINDOWS.push({ symbol, start, end });
}

export function getNewsWindows() {
  return [...SEED_NEWS_WINDOWS];
}