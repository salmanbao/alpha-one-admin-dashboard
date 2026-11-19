"use client";

/**
 * R10-B2 — Pre-trade restriction enforcement (P0).
 *
 * The R7 rule engine only DETECTS news/weekend violations after the
 * close. This store is the enforcement side: a restriction set an
 * operator configures once, and `validateTrade()` — the trade-time gate —
 * consults it before a position can be opened:
 *
 *   • news windows (economic events) per symbol,
 *   • weekend / holiday market-halt handling,
 *   • symbol allow/deny lists per program,
 *   • leverage tiers per phase,
 *   • trading-hours/session config per instrument class.
 *
 * Honest demo scope: prop-admin has no broker plugin, so the evaluator
 * replays each `trade.opened` from the shared log through `validateTrade`
 * and records the outcome into the enforcement log (`trade.blocked`) —
 * in production the same function runs inside the execution path before
 * the fill. The UI ships a request simulator for testing restrictions.
 *
 * Reuses existing patterns:
 * - demo-persistence for zod-validated persistence
 * - lifecycle events for blocked-trade outcomes
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

export interface NewsWindow {
  id: string;
  name: string;
  symbol: string; // instrument or "*"
  startTime: string; // ISO
  endTime: string; // ISO
  severity: "high" | "medium" | "low";
  description: string;
  enabled: boolean;
}

export interface TradingHours {
  id: string;
  name: string;
  /** 0=Sunday … 6=Saturday */
  days: number[];
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timezone: string;
  enabled: boolean;
}

export interface SymbolRestriction {
  id: string;
  name: string;
  /** Comma-separated instruments or "*". */
  symbols: string;
  action: "allow" | "deny";
  /** Program ids; empty = all programs. */
  appliesToPrograms: string[];
  reason: string;
  enabled: boolean;
}

export interface LeverageTier {
  id: string;
  name: string;
  maxLeverage: number; // 50 → 1:50
  appliesToPhases: string[]; // phase-1 | phase-2 | funded
  appliesToPrograms: string[]; // empty = all
  enabled: boolean;
}

export interface HolidayCalendar {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  description: string;
  region: string;
  enabled: boolean;
}

export interface BlockedTrade {
  id: string;
  timestamp: string;
  accountId: string;
  accountLogin?: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  reason: string;
  restrictionType: "news" | "weekend" | "symbol" | "leverage" | "hours" | "holiday";
  restrictionId: string;
}

export interface PreTradeState {
  newsWindows: NewsWindow[];
  tradingHours: TradingHours[];
  symbolRestrictions: SymbolRestriction[];
  leverageTiers: LeverageTier[];
  holidayCalendar: HolidayCalendar[];
  /** Enforcement log (last 500). */
  blockedTrades: BlockedTrade[];
  /** Watermark into the shared lifecycle log (exactly-once processing). */
  lastProcessedSeq: number;
}

/* ------------------------------------------------------------------ */
/* Zod schema for persistence                                          */
/* ------------------------------------------------------------------ */

const newsWindowSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  description: z.string(),
  enabled: z.boolean(),
});

const tradingHoursSchema = z.object({
  id: z.string(),
  name: z.string(),
  days: z.array(z.number().min(0).max(6)),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  timezone: z.string(),
  enabled: z.boolean(),
});

const symbolRestrictionSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbols: z.string(),
  action: z.enum(["allow", "deny"]),
  appliesToPrograms: z.array(z.string()),
  reason: z.string(),
  enabled: z.boolean(),
});

const leverageTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  maxLeverage: z.number().min(1).max(1000),
  appliesToPhases: z.array(z.string()),
  appliesToPrograms: z.array(z.string()),
  enabled: z.boolean(),
});

const holidayCalendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string(),
  region: z.string(),
  enabled: z.boolean(),
});

const blockedTradeSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  accountId: z.string(),
  accountLogin: z.string().optional(),
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  volume: z.number(),
  reason: z.string(),
  restrictionType: z.enum(["news", "weekend", "symbol", "leverage", "hours", "holiday"]),
  restrictionId: z.string(),
});

const preTradeStateSchema = z.object({
  newsWindows: z.array(newsWindowSchema),
  tradingHours: z.array(tradingHoursSchema),
  symbolRestrictions: z.array(symbolRestrictionSchema),
  leverageTiers: z.array(leverageTierSchema),
  holidayCalendar: z.array(holidayCalendarSchema),
  blockedTrades: z.array(blockedTradeSchema),
  lastProcessedSeq: z.number(),
});

type PreTradeStateType = z.infer<typeof preTradeStateSchema>;

/* ------------------------------------------------------------------ */
/* Default restrictions                                                */
/* ------------------------------------------------------------------ */

function inHours(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

const DEFAULT_NEWS_WINDOWS: NewsWindow[] = [
  {
    id: "news-fomc",
    name: "FOMC Rate Decision",
    symbol: "EURUSD",
    startTime: inHours(24),
    endTime: inHours(26),
    severity: "high",
    description: "Federal Open Market Committee rate decision — extreme volatility expected",
    enabled: true,
  },
  {
    id: "news-nfp",
    name: "Non-Farm Payrolls",
    symbol: "EURUSD",
    startTime: inHours(48),
    endTime: inHours(49),
    severity: "high",
    description: "US Non-Farm Payrolls — high impact event",
    enabled: true,
  },
  {
    id: "news-cpi",
    name: "US CPI Release",
    symbol: "USDJPY",
    startTime: inHours(72),
    endTime: inHours(72.5),
    severity: "medium",
    description: "Consumer Price Index — moderate volatility expected",
    enabled: true,
  },
];

const DEFAULT_TRADING_HOURS: TradingHours[] = [
  {
    id: "hours-forex",
    name: "Forex market hours",
    days: [1, 2, 3, 4, 5],
    startTime: "00:00",
    endTime: "23:59",
    timezone: "UTC",
    enabled: true,
  },
  {
    id: "hours-crypto",
    name: "Crypto market hours (24/7)",
    days: [0, 1, 2, 3, 4, 5, 6],
    startTime: "00:00",
    endTime: "23:59",
    timezone: "UTC",
    enabled: true,
  },
];

const DEFAULT_SYMBOL_RESTRICTIONS: SymbolRestriction[] = [
  {
    id: "symbol-deny-exotics",
    name: "Exotic currency pairs",
    symbols: "USDTRY,USDMXN,USDZAR,USDPLN,USDCNH",
    action: "deny",
    appliesToPrograms: [],
    reason: "Exotic pairs with wide spreads and gap risk are restricted",
    enabled: true,
  },
  {
    id: "symbol-deny-news-sensitive",
    name: "News-sensitive metals (aggressive program)",
    symbols: "XAUUSD,XAGUSD",
    action: "deny",
    appliesToPrograms: ["program-aggressive"],
    reason: "Gold/silver restricted for the aggressive program during news events",
    enabled: false,
  },
];

const DEFAULT_LEVERAGE_TIERS: LeverageTier[] = [
  {
    id: "leverage-phase1",
    name: "Phase 1 leverage",
    maxLeverage: 50,
    appliesToPhases: ["phase-1"],
    appliesToPrograms: [],
    enabled: true,
  },
  {
    id: "leverage-phase2",
    name: "Phase 2 leverage",
    maxLeverage: 100,
    appliesToPhases: ["phase-2"],
    appliesToPrograms: [],
    enabled: true,
  },
  {
    id: "leverage-funded",
    name: "Funded account leverage",
    maxLeverage: 200,
    appliesToPhases: ["funded"],
    appliesToPrograms: [],
    enabled: true,
  },
];

const DEFAULT_HOLIDAYS: HolidayCalendar[] = [
  {
    id: "holiday-new-year",
    name: "New Year's Day",
    date: "2027-01-01",
    description: "Global market holiday",
    region: "global",
    enabled: true,
  },
  {
    id: "holiday-christmas",
    name: "Christmas Day",
    date: "2026-12-25",
    description: "Global market holiday",
    region: "global",
    enabled: true,
  },
  {
    id: "holiday-good-friday",
    name: "Good Friday",
    date: "2026-04-03",
    description: "Christian holiday — markets closed",
    region: "global",
    enabled: true,
  },
];

/* ------------------------------------------------------------------ */
/* Store implementation                                                */
/* ------------------------------------------------------------------ */

const SLOT = "pre-trade-restrictions";
let state: PreTradeStateType = loadDemoState(SLOT, preTradeStateSchema, {
  newsWindows: DEFAULT_NEWS_WINDOWS,
  tradingHours: DEFAULT_TRADING_HOURS,
  symbolRestrictions: DEFAULT_SYMBOL_RESTRICTIONS,
  leverageTiers: DEFAULT_LEVERAGE_TIERS,
  holidayCalendar: DEFAULT_HOLIDAYS,
  blockedTrades: [],
  lastProcessedSeq: 0,
});
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version += 1;
  saveDemoState(SLOT, state);
  listeners.forEach((l) => l());
}

export function usePreTradeVersion(): number {
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
/* News window management                                              */
/* ------------------------------------------------------------------ */

export function getNewsWindows(): NewsWindow[] {
  return state.newsWindows;
}

export function addNewsWindow(window: Omit<NewsWindow, "id">, actor: string): NewsWindow {
  const id = `news-${Date.now()}`;
  const newWindow: NewsWindow = { id, ...window };
  state.newsWindows = [...state.newsWindows, newWindow];
  notify();

  recordAudit({
    action: "Added news window restriction",
    entity: "pre-trade-restriction",
    entityId: id,
    summary: `News window "${newWindow.name}" (${newWindow.symbol}, ${newWindow.severity}) added by ${actor}`,
    severity: "info",
  });
  return newWindow;
}

export function updateNewsWindow(
  windowId: string,
  updates: Partial<NewsWindow>,
  actor: string,
): void {
  const existing = state.newsWindows.find((w) => w.id === windowId);
  if (!existing) return;
  state.newsWindows = state.newsWindows.map((w) =>
    w.id === windowId ? { ...w, ...updates } : w,
  );
  notify();
  recordAudit({
    action: "Updated news window restriction",
    entity: "pre-trade-restriction",
    entityId: windowId,
    summary: `News window "${existing.name}" updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

export function removeNewsWindow(windowId: string, actor: string): void {
  const existing = state.newsWindows.find((w) => w.id === windowId);
  if (!existing) return;
  state.newsWindows = state.newsWindows.filter((w) => w.id !== windowId);
  notify();
  recordAudit({
    action: "Removed news window restriction",
    entity: "pre-trade-restriction",
    entityId: windowId,
    summary: `News window "${existing.name}" removed by ${actor}`,
    severity: "warning",
  });
}

/* ------------------------------------------------------------------ */
/* Trading hours management                                            */
/* ------------------------------------------------------------------ */

export function getTradingHours(): TradingHours[] {
  return state.tradingHours;
}

export function upsertTradingHours(
  hours: Omit<TradingHours, "id"> & { id?: string },
  actor: string,
): TradingHours {
  const id = hours.id ?? `hours-${Date.now()}`;
  const existing = state.tradingHours.find((h) => h.id === id);
  const next: TradingHours = { id, ...hours };
  state.tradingHours = existing
    ? state.tradingHours.map((h) => (h.id === id ? next : h))
    : [...state.tradingHours, next];
  notify();
  recordAudit({
    action: existing ? "Updated trading hours" : "Added trading hours",
    entity: "pre-trade-restriction",
    entityId: id,
    summary: `Trading hours "${next.name}" (${next.startTime}-${next.endTime} ${next.timezone}) saved by ${actor}`,
    severity: "info",
  });
  return next;
}

/* ------------------------------------------------------------------ */
/* Symbol restriction management                                       */
/* ------------------------------------------------------------------ */

export function getSymbolRestrictions(): SymbolRestriction[] {
  return state.symbolRestrictions;
}

export function addSymbolRestriction(
  restriction: Omit<SymbolRestriction, "id">,
  actor: string,
): SymbolRestriction {
  const id = `symbol-${Date.now()}`;
  const newRestriction: SymbolRestriction = { id, ...restriction };
  state.symbolRestrictions = [...state.symbolRestrictions, newRestriction];
  notify();
  recordAudit({
    action: "Added symbol restriction",
    entity: "pre-trade-restriction",
    entityId: id,
    summary: `Symbol restriction "${newRestriction.name}" (${newRestriction.action}: ${newRestriction.symbols}) added by ${actor}`,
    severity: "info",
  });
  return newRestriction;
}

export function updateSymbolRestriction(
  restrictionId: string,
  updates: Partial<SymbolRestriction>,
  actor: string,
): void {
  const existing = state.symbolRestrictions.find((r) => r.id === restrictionId);
  if (!existing) return;
  state.symbolRestrictions = state.symbolRestrictions.map((r) =>
    r.id === restrictionId ? { ...r, ...updates } : r,
  );
  notify();
  recordAudit({
    action: "Updated symbol restriction",
    entity: "pre-trade-restriction",
    entityId: restrictionId,
    summary: `Symbol restriction "${existing.name}" updated by ${actor}: ${Object.keys(updates).join(", ")}`,
    severity: "info",
  });
}

export function removeSymbolRestriction(restrictionId: string, actor: string): void {
  const existing = state.symbolRestrictions.find((r) => r.id === restrictionId);
  if (!existing) return;
  state.symbolRestrictions = state.symbolRestrictions.filter((r) => r.id !== restrictionId);
  notify();
  recordAudit({
    action: "Removed symbol restriction",
    entity: "pre-trade-restriction",
    entityId: restrictionId,
    summary: `Symbol restriction "${existing.name}" removed by ${actor}`,
    severity: "warning",
  });
}

/* ------------------------------------------------------------------ */
/* Leverage tier management                                            */
/* ------------------------------------------------------------------ */

export function getLeverageTiers(): LeverageTier[] {
  return state.leverageTiers;
}

export function upsertLeverageTier(
  tier: Omit<LeverageTier, "id"> & { id?: string },
  actor: string,
): LeverageTier {
  const id = tier.id ?? `leverage-${Date.now()}`;
  const existing = state.leverageTiers.find((t) => t.id === id);
  const next: LeverageTier = { id, ...tier };
  state.leverageTiers = existing
    ? state.leverageTiers.map((t) => (t.id === id ? next : t))
    : [...state.leverageTiers, next];
  notify();
  recordAudit({
    action: existing ? "Updated leverage tier" : "Added leverage tier",
    entity: "pre-trade-restriction",
    entityId: id,
    summary: `Leverage tier "${next.name}" (1:${next.maxLeverage}, phases ${next.appliesToPhases.join("/") || "all"}) saved by ${actor}`,
    severity: "info",
  });
  return next;
}

/* ------------------------------------------------------------------ */
/* Holiday calendar management                                         */
/* ------------------------------------------------------------------ */

export function getHolidayCalendar(): HolidayCalendar[] {
  return state.holidayCalendar;
}

export function addHoliday(
  holiday: Omit<HolidayCalendar, "id">,
  actor: string,
): HolidayCalendar {
  const id = `holiday-${Date.now()}`;
  const newHoliday: HolidayCalendar = { id, ...holiday };
  state.holidayCalendar = [...state.holidayCalendar, newHoliday];
  notify();
  recordAudit({
    action: "Added holiday to calendar",
    entity: "pre-trade-restriction",
    entityId: id,
    summary: `Holiday "${newHoliday.name}" on ${newHoliday.date} (${newHoliday.region}) added by ${actor}`,
    severity: "info",
  });
  return newHoliday;
}

export function removeHoliday(holidayId: string, actor: string): void {
  const existing = state.holidayCalendar.find((h) => h.id === holidayId);
  if (!existing) return;
  state.holidayCalendar = state.holidayCalendar.filter((h) => h.id !== holidayId);
  notify();
  recordAudit({
    action: "Removed holiday",
    entity: "pre-trade-restriction",
    entityId: holidayId,
    summary: `Holiday "${existing.name}" removed by ${actor}`,
    severity: "warning",
  });
}

/* ------------------------------------------------------------------ */
/* Trade validation engine (the trade-time gate)                       */
/* ------------------------------------------------------------------ */

export interface TradeRequest {
  accountId: string;
  accountLogin?: string;
  symbol: string;
  side: "buy" | "sell";
  volume: number;
  /** 1:50 → 50. Omitted → the leverage check is skipped (unknown). */
  leverage?: number;
  programId?: string;
  phase?: string;
  /** Override "now" (simulator / backdated checks). */
  at?: Date;
}

export type RestrictionType = BlockedTrade["restrictionType"];

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  restrictionType?: RestrictionType;
  restrictionId?: string;
}

function isCrypto(symbol: string): boolean {
  return /BTC|ETH|XRP|LTC|DOGE/i.test(symbol);
}

export function validateTrade(request: TradeRequest): ValidationResult {
  const now = request.at ?? new Date();

  // 1. Holiday / market halt.
  const today = now.toISOString().slice(0, 10);
  const holiday = state.holidayCalendar.find((h) => h.date === today && h.enabled);
  if (holiday) {
    return {
      allowed: false,
      reason: `Market halted: ${holiday.name} (${holiday.description})`,
      restrictionType: "holiday",
      restrictionId: holiday.id,
    };
  }

  // 2. Weekend rule (crypto trades 24/7; forex/CFD does not).
  const dayOfWeek = now.getDay();
  if ((dayOfWeek === 0 || dayOfWeek === 6) && !isCrypto(request.symbol)) {
    const forexHours = state.tradingHours.find((h) => h.id === "hours-forex" && h.enabled);
    if (forexHours && !forexHours.days.includes(dayOfWeek)) {
      return {
        allowed: false,
        reason: "Weekend trading is not allowed for forex/CFD instruments",
        restrictionType: "weekend",
        restrictionId: forexHours.id,
      };
    }
  }

  // 3. News windows.
  for (const news of state.newsWindows) {
    if (!news.enabled) continue;
    if (news.symbol !== request.symbol && news.symbol !== "*") continue;
    if (now >= new Date(news.startTime) && now <= new Date(news.endTime)) {
      return {
        allowed: false,
        reason: `Trading blocked during ${news.name}: ${news.description}`,
        restrictionType: "news",
        restrictionId: news.id,
      };
    }
  }

  // 4. Symbol allow/deny lists.
  const symbolCheck = checkSymbolAllowed(request.symbol, request.programId);
  if (!symbolCheck.allowed) {
    return {
      allowed: false,
      reason: symbolCheck.reason,
      restrictionType: "symbol",
      restrictionId: symbolCheck.restrictionId,
    };
  }

  // 5. Leverage tiers (skipped when the request doesn't carry leverage).
  if (typeof request.leverage === "number") {
    const leverageCheck = checkLeverageLimit(
      request.leverage,
      request.phase,
      request.programId,
    );
    if (!leverageCheck.allowed) {
      return {
        allowed: false,
        reason: leverageCheck.reason,
        restrictionType: "leverage",
        restrictionId: leverageCheck.restrictionId,
      };
    }
  }

  // 6. Trading hours for the instrument class.
  const hoursCheck = checkTradingHours(request.symbol, now);
  if (!hoursCheck.allowed) {
    return {
      allowed: false,
      reason: hoursCheck.reason,
      restrictionType: "hours",
      restrictionId: hoursCheck.restrictionId,
    };
  }

  return { allowed: true };
}

function checkSymbolAllowed(
  symbol: string,
  programId?: string,
): { allowed: boolean; reason?: string; restrictionId?: string } {
  for (const r of state.symbolRestrictions) {
    if (!r.enabled || r.action !== "deny") continue;
    if (programId && r.appliesToPrograms.length > 0 && !r.appliesToPrograms.includes(programId))
      continue;
    const symbols = r.symbols.split(",").map((s) => s.trim().toUpperCase());
    if (symbols.includes("*") || symbols.includes(symbol.toUpperCase())) {
      return { allowed: false, reason: r.reason, restrictionId: r.id };
    }
  }

  // If any allow-list is active for this program, the symbol must be on it.
  const allowLists = state.symbolRestrictions.filter(
    (r) =>
      r.enabled &&
      r.action === "allow" &&
      (!programId || r.appliesToPrograms.length === 0 || r.appliesToPrograms.includes(programId)),
  );
  if (allowLists.length > 0) {
    const ok = allowLists.some((r) => {
      const symbols = r.symbols.split(",").map((s) => s.trim().toUpperCase());
      return symbols.includes("*") || symbols.includes(symbol.toUpperCase());
    });
    if (!ok) {
      return {
        allowed: false,
        reason: `Symbol ${symbol} is not on the allow list`,
        restrictionId: "symbol-allow-list",
      };
    }
  }
  return { allowed: true };
}

function checkLeverageLimit(
  leverage: number,
  phase?: string,
  programId?: string,
): { allowed: boolean; reason?: string; restrictionId?: string } {
  for (const tier of state.leverageTiers) {
    if (!tier.enabled) continue;
    if (tier.appliesToPrograms.length > 0 && programId && !tier.appliesToPrograms.includes(programId))
      continue;
    if (phase && tier.appliesToPhases.length > 0 && !tier.appliesToPhases.includes(phase))
      continue;
    if (leverage > tier.maxLeverage) {
      return {
        allowed: false,
        reason: `Leverage 1:${leverage} exceeds the 1:${tier.maxLeverage} cap (${tier.name})`,
        restrictionId: tier.id,
      };
    }
  }
  return { allowed: true };
}

function checkTradingHours(
  symbol: string,
  now: Date,
): { allowed: boolean; reason?: string; restrictionId?: string } {
  const applicable = state.tradingHours.filter((h) => {
    if (!h.enabled) return false;
    return isCrypto(symbol) ? h.id === "hours-crypto" : h.id === "hours-forex";
  });
  if (applicable.length === 0) return { allowed: true };

  const dayOfWeek = now.getDay();
  // Compare wall-clock in the rule's timezone via Intl (same helper
  // contract as drawdown-model-store — keep the two consistent).
  const ok = applicable.some((h) => {
    if (!h.days.includes(dayOfWeek)) return false;
    try {
      const hm = new Intl.DateTimeFormat("en-GB", {
        timeZone: h.timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(now);
      return hm >= h.startTime && hm <= h.endTime;
    } catch {
      const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      return hm >= h.startTime && hm <= h.endTime;
    }
  });

  if (!ok) {
    const h = applicable[0];
    return {
      allowed: false,
      reason: `Outside ${h.name} (${h.startTime}–${h.endTime} ${h.timezone})`,
      restrictionId: h.id,
    };
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------ */
/* Enforcement log                                                     */
/* ------------------------------------------------------------------ */

export function recordBlockedTrade(
  request: TradeRequest,
  validation: ValidationResult,
): BlockedTrade {
  const blocked: BlockedTrade = {
    id: `blocked-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    accountId: request.accountId,
    accountLogin: request.accountLogin,
    symbol: request.symbol,
    side: request.side,
    volume: request.volume,
    reason: validation.reason ?? "Trade blocked by pre-trade restriction",
    restrictionType: validation.restrictionType ?? "hours",
    restrictionId: validation.restrictionId ?? "unknown",
  };

  state.blockedTrades = [blocked, ...state.blockedTrades].slice(0, 500);
  notify();

  recordAudit({
    action: "Trade blocked by pre-trade restriction",
    entity: "pre-trade-restriction",
    entityId: blocked.id,
    summary: `${blocked.symbol} ${blocked.side} ${blocked.volume} (account ${blocked.accountId}) blocked: ${blocked.reason}`,
    severity: "warning",
  });

  emitLifecycle({
    entity: { kind: "trade", id: blocked.id },
    name: "trade.blocked",
    actor: "system",
    key: `blocked:${blocked.id}`,
    payload: { ...blocked },
  });

  return blocked;
}

export function getBlockedTrades(
  filters?: {
    accountId?: string;
    symbol?: string;
    restrictionType?: RestrictionType;
    startDate?: string;
  },
): BlockedTrade[] {
  let trades = [...state.blockedTrades];
  if (filters?.accountId) trades = trades.filter((t) => t.accountId === filters.accountId);
  if (filters?.symbol) trades = trades.filter((t) => t.symbol === filters.symbol);
  if (filters?.restrictionType)
    trades = trades.filter((t) => t.restrictionType === filters.restrictionType);
  if (filters?.startDate) trades = trades.filter((t) => t.timestamp >= filters.startDate!);
  return trades;
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

export function usePreTradeEvaluator(_tenantId: string): void {
  const log = useLifecycleLog();

  useEffect(() => {
    for (const e of freshEvents(log)) {
      if (e.name !== "trade.opened") continue;
      const accountId = typeof e.payload?.accountId === "string" ? e.payload.accountId : "";
      if (!accountId) continue;
      const symbol = typeof e.payload?.symbol === "string" ? e.payload.symbol : "";
      if (!symbol) continue;

      const request: TradeRequest = {
        accountId,
        accountLogin:
          typeof e.payload?.accountLogin === "string" ? e.payload.accountLogin : undefined,
        symbol,
        side: e.payload?.side === "sell" ? "sell" : "buy",
        volume:
          typeof e.payload?.lots === "number"
            ? e.payload.lots
            : typeof e.payload?.volume === "number"
              ? e.payload.volume
              : 0,
        // trade.opened carries no leverage — the leverage tier check runs
        // in the UI simulator and the production execution path instead.
        at: e.at ? new Date(e.at) : undefined,
      };
      const validation = validateTrade(request);
      if (!validation.allowed) recordBlockedTrade(request, validation);
    }
  }, [log]);
}

/* ------------------------------------------------------------------ */
/* Read helpers                                                        */
/* ------------------------------------------------------------------ */

export function getPreTradeStats(): {
  activeNewsWindows: number;
  activeSymbolRestrictions: number;
  activeLeverageTiers: number;
  holidays: number;
  totalBlockedTrades: number;
  blockedByType: Record<string, number>;
} {
  const blockedByType: Record<string, number> = {};
  for (const t of state.blockedTrades) {
    blockedByType[t.restrictionType] = (blockedByType[t.restrictionType] ?? 0) + 1;
  }
  return {
    activeNewsWindows: state.newsWindows.filter((n) => n.enabled).length,
    activeSymbolRestrictions: state.symbolRestrictions.filter((s) => s.enabled).length,
    activeLeverageTiers: state.leverageTiers.filter((l) => l.enabled).length,
    holidays: state.holidayCalendar.filter((h) => h.enabled).length,
    totalBlockedTrades: state.blockedTrades.length,
    blockedByType,
  };
}
