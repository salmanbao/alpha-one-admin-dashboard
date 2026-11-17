"use client";

/**
 * Trader App — persistent trading store (R7 I1).
 *
 * One object, one write path (house rule R10): open positions, pending
 * orders, closed trades, per-account realized P&L and the session ticket
 * counter all live under `pfaas:trader:trading`, so a reload keeps the
 * session and every history/analytics surface reads the same truth.
 *
 * First run seeds from the terra fixtures — the trade-history footer
 * discloses exactly that ("Demo trades seeded on first run"). Every
 * operator action that changes trading state persists here AND emits a
 * lifecycle event (`trade.opened` / `trade.closed` / `trade.modified`,
 * actor "trader"); the named consumer is the trader inbox bridge
 * (`lib/inbox/inbox-lifecycle-bridge.ts`), which turns each into a
 * receipt message, and prop-admin's cross-app intake can read the same
 * transitions from the shared log.
 *
 * The engine logic (quotes, partial closes, breakeven, flatten-all) is
 * unchanged from the session-only version — it just writes through this
 * store now. `useTrading()` in trading-context.tsx stays the page-facing
 * API; this module owns persistence + emission.
 */

import { useSyncExternalStore } from "react";
import { emitLifecycle } from "@pfaas/lifecycle";
import { formatSignedCurrencyValue } from "@pfaas/platform-core";
import { toast } from "@/hooks/use-toast";
import {
  marketWatch,
  terraOrders,
  terraPositions,
  terraTrades,
  terraRiskLimits,
  terraAccounts,
  type TerraOrder,
  type TerraPosition,
  type TerraTrade,
} from "@/lib/fixtures/terra-fixtures";

export interface PlaceOrderInput {
  symbol: string;
  side: "buy" | "sell";
  lots: number;
  /** Market execution fills immediately; limit/stop becomes a pending order. */
  orderType: "Market Execution" | "Buy Limit" | "Sell Limit" | "Buy Stop" | "Sell Stop";
  /** Required for limit/stop orders — the trigger price. */
  price?: number;
  sl?: number | null;
  tp?: number | null;
  expiry?: string;
}

export interface TradingState {
  positions: TerraPosition[];
  orders: TerraOrder[];
  closedTrades: TerraTrade[];
  /** Realized P&L from closes, keyed by accountId. */
  realizedByAccount: Record<string, number>;
  /** Next session ticket — continues past the fixture orders (55011…). */
  nextTicket: number;
}

const STORAGE_KEY = "pfaas:trader:trading";
const SEED_TICKET = 55_012;

/** First run — fixtures become the persisted session ("Demo trades seeded on first run"). */
function seedState(): TradingState {
  return {
    positions: terraPositions,
    orders: terraOrders,
    closedTrades: terraTrades,
    realizedByAccount: {},
    nextTicket: SEED_TICKET,
  };
}

// SSR/first-paint renders the seeded history (fixtures are available on
// the server), so server HTML matches the hydration pass; the persisted
// client state takes over right after — same pattern, same trade detail
// fallbacks, no empty-array crash during render.
const SERVER_SNAPSHOT: TradingState = seedState();

const isRecord = (x: unknown): x is { id: string } =>
  !!x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string";

/** Validate a persisted payload; anything malformed falls back to the seed. */
function migrate(parsed: unknown): TradingState {
  if (!parsed || typeof parsed !== "object") return seedState();
  const raw = parsed as Partial<Record<keyof TradingState, unknown>>;
  if (
    !Array.isArray(raw.positions) ||
    !Array.isArray(raw.orders) ||
    !Array.isArray(raw.closedTrades)
  ) {
    return seedState();
  }
  const realized: Record<string, number> = {};
  if (raw.realizedByAccount && typeof raw.realizedByAccount === "object") {
    for (const [k, v] of Object.entries(raw.realizedByAccount as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) realized[k] = v;
    }
  }
  return {
    positions: raw.positions.filter(isRecord) as unknown as TerraPosition[],
    orders: raw.orders.filter(isRecord) as unknown as TerraOrder[],
    closedTrades: raw.closedTrades.filter(isRecord) as unknown as TerraTrade[],
    realizedByAccount: realized,
    nextTicket:
      typeof raw.nextTicket === "number" && raw.nextTicket > 0
        ? raw.nextTicket
        : SEED_TICKET,
  };
}

let state: TradingState = (() => {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
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
function commit(next: TradingState) {
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
  return JSON.stringify(SERVER_SNAPSHOT);
}

/** Reactive trading state — subscribe with this in components/pages. */
export function useTradingStore(): TradingState {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return JSON.parse(raw) as TradingState;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const money = (n: number) => formatSignedCurrencyValue(n, "USD");

function quote(symbol: string) {
  return marketWatch.find((m) => m.symbol === symbol) ?? marketWatch[0];
}

/** Pip size by symbol family (JPY quote → 0.01, gold → 0.1, else 0.0001). */
function pipSize(symbol: string): number {
  if (symbol.startsWith("XAU")) return 0.1;
  if (symbol.startsWith("XAG")) return 0.01;
  if (symbol.endsWith("JPY")) return 0.01;
  return 0.0001;
}

function pipsFor(symbol: string, entry: number, exit: number, side: "long" | "short"): number {
  const direction = side === "long" ? 1 : -1;
  return Math.round(((exit - entry) * direction) / pipSize(symbol));
}

/** Consume the next session ticket and bump the persisted counter. */
function takeTicket(): { ticket: string; nextTicket: number } {
  const ticket = String(state.nextTicket);
  return { ticket, nextTicket: state.nextTicket + 1 };
}

/* ------------------------------------------------------------------ */
/* Actions — each persists + emits its trade.* event (actor "trader")  */
/* ------------------------------------------------------------------ */

export function placeOrder(accountId: string, input: PlaceOrderInput): void {
  const q = quote(input.symbol);
  const lots = Math.max(0.01, input.lots);
  const isMarket = input.orderType === "Market Execution";

  if (!isMarket) {
    if (input.price === undefined || !Number.isFinite(input.price)) {
      toast({
        title: "Entry price required",
        description: `${input.orderType} orders need a trigger price.`,
        variant: "destructive",
      });
      return;
    }
    const { ticket, nextTicket } = takeTicket();
    const order: TerraOrder = {
      id: `ord-${ticket}`,
      ticket,
      symbol: input.symbol,
      type: input.orderType,
      lots,
      price: input.price,
      sl: input.sl ?? null,
      tp: input.tp ?? null,
      expiry: input.expiry ?? "GTC",
      placedAt: new Date().toISOString(),
      status: "pending",
      accountId,
    };
    commit({ ...state, orders: [order, ...state.orders], nextTicket });
    emitLifecycle({
      entity: { kind: "trade", id: order.id },
      name: "trade.opened",
      actor: "trader",
      payload: {
        mode: "pending-order",
        accountId,
        symbol: order.symbol,
        orderType: order.type,
        lots,
        price: order.price,
        ticket,
      },
    });
    toast({
      title: `${input.orderType} placed`,
      description: `${lots.toFixed(2)} ${input.symbol} @ ${input.price} · ticket #${ticket}`,
    });
    return;
  }

  // Market execution → open a position at the current quote.
  const entry = input.side === "buy" ? q.ask : q.bid;
  const { ticket, nextTicket } = takeTicket();
  const pos: TerraPosition = {
    id: `pos-live-${ticket}`,
    symbol: input.symbol,
    side: input.side === "buy" ? "long" : "short",
    lots,
    entry,
    current: entry,
    sl: input.sl ?? null,
    tp: input.tp ?? null,
    pnl: 0,
    swap: 0,
    commission: -3.5 * lots,
    openedAt: new Date().toISOString(),
    accountId,
  };
  commit({ ...state, positions: [pos, ...state.positions], nextTicket });
  emitLifecycle({
    entity: { kind: "trade", id: pos.id },
    name: "trade.opened",
    actor: "trader",
    payload: {
      mode: "position",
      accountId,
      symbol: pos.symbol,
      side: pos.side,
      lots,
      entry,
      ticket,
    },
  });
  toast({
    title: `${input.side === "buy" ? "Bought" : "Sold"} ${input.symbol}`,
    description: `${lots.toFixed(2)} lots @ ${entry} · ticket #${ticket}`,
  });
}

export function closePosition(id: string, fraction = 1): void {
  const frac = Math.min(1, Math.max(0.01, fraction));
  const pos = state.positions.find((p) => p.id === id);
  if (!pos) return;
  const net = (pos.pnl + pos.swap + pos.commission) * frac;
  const label = frac >= 1 ? "Closed" : `Closed ${Math.round(frac * 100)}% of`;
  const realizedByAccount = {
    ...state.realizedByAccount,
    [pos.accountId]: (state.realizedByAccount[pos.accountId] ?? 0) + net,
  };

  if (frac >= 1) {
    const { ticket, nextTicket } = takeTicket();
    const trade: TerraTrade = {
      id: `trd-live-${ticket}`,
      ticket,
      symbol: pos.symbol,
      side: pos.side,
      lots: pos.lots,
      entry: pos.entry,
      exit: pos.current,
      pnl: Math.round(net * 100) / 100,
      pips: pipsFor(pos.symbol, pos.entry, pos.current, pos.side),
      openedAt: pos.openedAt,
      closedAt: new Date().toISOString(),
      accountId: pos.accountId,
      comment: "Closed from open positions",
    };
    commit({
      ...state,
      positions: state.positions.filter((p) => p.id !== id),
      closedTrades: [trade, ...state.closedTrades],
      realizedByAccount,
      nextTicket,
    });
    emitLifecycle({
      entity: { kind: "trade", id: trade.id },
      name: "trade.closed",
      actor: "trader",
      payload: {
        accountId: pos.accountId,
        accountLogin: terraAccounts.find((a) => a.id === pos.accountId)?.login,
        accountName: terraAccounts.find((a) => a.id === pos.accountId)?.name,
        symbol: trade.symbol,
        side: trade.side,
        lots: trade.lots,
        entry: trade.entry,
        exit: trade.exit,
        pnl: trade.pnl,
        ticket,
        closedAt: trade.closedAt,
        accountLimits: terraRiskLimits[pos.accountId],
        accountBaseline: {
          dailyLossUsed: (terraRiskLimits[pos.accountId]?.daily ?? 0) - (terraAccounts.find((a) => a.id === pos.accountId)?.dailyLossRemaining ?? 0),
          maxDdUsed: (terraRiskLimits[pos.accountId]?.maxDd ?? 0) - (terraAccounts.find((a) => a.id === pos.accountId)?.maxDdRemaining ?? 0),
        },
      },
    });
    toast({
      title: `${label} ${pos.symbol}`,
      description: `${pos.side === "long" ? "Long" : "Short"} ${pos.lots.toFixed(2)} lots · realized ${money(net)}`,
    });
    return;
  }

  // Partial close — scale down the remaining slice.
  const closedLots = Math.round(pos.lots * frac * 100) / 100;
  commit({
    ...state,
    positions: state.positions.map((p) =>
      p.id === id
        ? {
            ...p,
            lots: Math.round(p.lots * (1 - frac) * 100) / 100,
            pnl: p.pnl * (1 - frac),
            swap: p.swap * (1 - frac),
            commission: p.commission * (1 - frac),
          }
        : p,
    ),
    realizedByAccount,
  });
  emitLifecycle({
    entity: { kind: "trade", id },
    name: "trade.modified",
    actor: "trader",
    payload: {
      action: "partial-close",
      accountId: pos.accountId,
      symbol: pos.symbol,
      closedLots,
      pnl: Math.round(net * 100) / 100,
    },
  });
  toast({
    title: `${label} ${pos.symbol}`,
    description: `${(pos.lots * frac).toFixed(2)} lots closed · realized ${money(net)}`,
  });
}

export function modifyPosition(
  id: string,
  patch: { sl?: number | null; tp?: number | null },
): void {
  const pos = state.positions.find((p) => p.id === id);
  if (!pos) return;
  commit({
    ...state,
    positions: state.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
  emitLifecycle({
    entity: { kind: "trade", id },
    name: "trade.modified",
    actor: "trader",
    payload: {
      action: "sl-tp",
      accountId: pos.accountId,
      symbol: pos.symbol,
      sl: patch.sl !== undefined ? patch.sl : pos.sl,
      tp: patch.tp !== undefined ? patch.tp : pos.tp,
    },
  });
  toast({
    title: `${pos.symbol} modified`,
    description: `SL ${patch.sl !== undefined ? (patch.sl ?? "removed") : pos.sl ?? "—"} • TP ${patch.tp !== undefined ? (patch.tp ?? "removed") : pos.tp ?? "—"}`,
  });
}

export function setBreakEven(id: string): void {
  const pos = state.positions.find((p) => p.id === id);
  if (!pos) return;
  commit({
    ...state,
    positions: state.positions.map((p) => (p.id === id ? { ...p, sl: p.entry } : p)),
  });
  emitLifecycle({
    entity: { kind: "trade", id },
    name: "trade.modified",
    actor: "trader",
    payload: {
      action: "breakeven",
      accountId: pos.accountId,
      symbol: pos.symbol,
      sl: pos.entry,
    },
  });
  toast({
    title: `${pos.symbol} stop moved to breakeven`,
    description: `SL set to entry ${pos.entry} (swap ${money(pos.swap)} + commission ${money(pos.commission)} still apply).`,
  });
}

export function closeAll(accountId?: string): void {
  const targets = accountId
    ? state.positions.filter((p) => p.accountId === accountId)
    : state.positions;
  if (targets.length === 0) {
    toast({
      title: "Nothing to flatten",
      description: accountId ? "No open positions on this account." : "No open positions.",
    });
    return;
  }

  const startTicket = state.nextTicket;
  const realizedByAccount = { ...state.realizedByAccount };
  let net = 0;
  const trades: TerraTrade[] = targets.map((p, i) => {
    const value = p.pnl + p.swap + p.commission;
    net += value;
    realizedByAccount[p.accountId] = (realizedByAccount[p.accountId] ?? 0) + value;
    const ticket = String(startTicket + i);
    return {
      id: `trd-live-${ticket}`,
      ticket,
      symbol: p.symbol,
      side: p.side,
      lots: p.lots,
      entry: p.entry,
      exit: p.current,
      pnl: Math.round(value * 100) / 100,
      pips: pipsFor(p.symbol, p.entry, p.current, p.side),
      openedAt: p.openedAt,
      closedAt: new Date().toISOString(),
      accountId: p.accountId,
      comment: "Closed by flatten all",
    };
  });

  commit({
    ...state,
    positions: accountId
      ? state.positions.filter((p) => p.accountId !== accountId)
      : [],
    closedTrades: [...trades, ...state.closedTrades],
    realizedByAccount,
    nextTicket: startTicket + targets.length,
  });
  for (const trade of trades) {
    emitLifecycle({
      entity: { kind: "trade", id: trade.id },
      name: "trade.closed",
      actor: "trader",
      payload: {
        accountId: trade.accountId,
        accountLogin: terraAccounts.find((a) => a.id === trade.accountId)?.login,
        accountName: terraAccounts.find((a) => a.id === trade.accountId)?.name,
        symbol: trade.symbol,
        side: trade.side,
        lots: trade.lots,
        entry: trade.entry,
        exit: trade.exit,
        pnl: trade.pnl,
        ticket: trade.ticket,
        closedAt: trade.closedAt,
        batch: trades.length > 1,
        accountLimits: terraRiskLimits[trade.accountId],
        accountBaseline: {
          dailyLossUsed: (terraRiskLimits[trade.accountId]?.daily ?? 0) - (terraAccounts.find((a) => a.id === trade.accountId)?.dailyLossRemaining ?? 0),
          maxDdUsed: (terraRiskLimits[trade.accountId]?.maxDd ?? 0) - (terraAccounts.find((a) => a.id === trade.accountId)?.maxDdRemaining ?? 0),
        },
      },
    });
  }
  toast({
    title: `Flattened ${targets.length} position${targets.length > 1 ? "s" : ""}`,
    description: `All open positions closed · realized ${money(net)}`,
  });
}

export function cancelOrder(id: string): void {
  const order = state.orders.find((o) => o.id === id);
  if (!order) return;
  commit({ ...state, orders: state.orders.filter((o) => o.id !== id) });
  emitLifecycle({
    entity: { kind: "trade", id: order.id },
    name: "trade.modified",
    actor: "trader",
    payload: {
      action: "order-cancelled",
      accountId: order.accountId,
      symbol: order.symbol,
      orderType: order.type,
      lots: order.lots,
      price: order.price,
    },
  });
  toast({
    title: "Order cancelled",
    description: `${order.type} ${order.lots.toFixed(2)} ${order.symbol} @ ${order.price} removed.`,
  });
}
