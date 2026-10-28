"use client";

/**
 * Trader App — Trading Context (mock trading engine)
 *
 * A single client-side state container for the trader's live trading
 * session: open positions and pending orders. It starts from the terra
 * fixtures and then evolves as the trader acts — placing orders,
 * closing (fully or partially), modifying SL/TP, moving stops to
 * breakeven, flattening everything, cancelling pending orders.
 *
 * Design notes (frontend-only, mock):
 *   • Positions/orders live in React state — no persistence needed;
 *     a reload resets the session to the fixtures (deterministic demo).
 *   • Realized P&L from closes is tracked per account so the risk
 *     dashboard / exposure cards stay coherent within a session.
 *   • Everything reports through `toast()` (never alert()).
 *
 * Consumers: open-positions (manage + Pending Orders tab), order-ticket
 * (place orders + calculator), position detail (modify/close/BE),
 * risk-dashboard (live margin from open lots).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "@/hooks/use-toast";
import {
  marketWatch,
  terraOrders,
  terraPositions,
  type TerraOrder,
  type TerraPosition,
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

interface TradingContextValue {
  positions: TerraPosition[];
  orders: TerraOrder[];
  /** Realized P&L from closes this session, keyed by accountId. */
  realizedByAccount: Record<string, number>;
  placeOrder: (accountId: string, input: PlaceOrderInput) => void;
  closePosition: (id: string, fraction?: number) => void;
  modifyPosition: (id: string, patch: { sl?: number | null; tp?: number | null }) => void;
  setBreakEven: (id: string) => void;
  closeAll: (accountId?: string) => void;
  cancelOrder: (id: string) => void;
}

const TradingContext = createContext<TradingContextValue | null>(null);

const money = (n: number) =>
  `${n >= 0 ? "+" : "−"}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function quote(symbol: string) {
  return marketWatch.find((m) => m.symbol === symbol) ?? marketWatch[0];
}

export function TradingProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<TerraPosition[]>(() => terraPositions);
  const [orders, setOrders] = useState<TerraOrder[]>(() => terraOrders);
  const [realizedByAccount, setRealized] = useState<Record<string, number>>({});

  // Session ticket counter — continues past the fixture orders (55011…).
  const ticketRef = useRef(55_012);
  const nextTicket = useCallback(() => String(ticketRef.current++), []);

  const placeOrder = useCallback((accountId: string, input: PlaceOrderInput) => {
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
      const ticket = nextTicket();
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
      setOrders((prev) => [order, ...prev]);
      toast({
        title: `${input.orderType} placed`,
        description: `${lots.toFixed(2)} ${input.symbol} @ ${input.price} · ticket #${ticket}`,
      });
      return;
    }

    // Market execution → open a position at the current quote.
    const entry = input.side === "buy" ? q.ask : q.bid;
    const ticket = nextTicket();
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
    setPositions((prev) => [pos, ...prev]);
    toast({
      title: `${input.side === "buy" ? "Bought" : "Sold"} ${input.symbol}`,
      description: `${lots.toFixed(2)} lots @ ${entry} · ticket #${ticket}`,
    });
  }, []);

  const closePosition = useCallback(
    (id: string, fraction = 1) => {
      const frac = Math.min(1, Math.max(0.01, fraction));
      const pos = positions.find((p) => p.id === id);
      if (!pos) return;
      const net = (pos.pnl + pos.swap + pos.commission) * frac;
      const label = frac >= 1 ? "Closed" : `Closed ${Math.round(frac * 100)}% of`;

      setRealized((r) => ({ ...r, [pos.accountId]: (r[pos.accountId] ?? 0) + net }));
      if (frac >= 1) {
        setPositions((prev) => prev.filter((p) => p.id !== id));
        toast({
          title: `${label} ${pos.symbol}`,
          description: `${pos.side === "long" ? "Long" : "Short"} ${pos.lots.toFixed(2)} lots · realized ${money(net)}`,
        });
        return;
      }

      // Partial close — scale down the remaining slice.
      setPositions((prev) =>
        prev.map((p) =>
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
      );
      toast({
        title: `${label} ${pos.symbol}`,
        description: `${(pos.lots * frac).toFixed(2)} lots closed · realized ${money(net)}`,
      });
    },
    [positions],
  );

  const modifyPosition = useCallback(
    (id: string, patch: { sl?: number | null; tp?: number | null }) => {
      const pos = positions.find((p) => p.id === id);
      if (!pos) return;
      setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      toast({
        title: `${pos.symbol} modified`,
        description: `SL ${patch.sl !== undefined ? (patch.sl ?? "removed") : pos.sl ?? "—"} • TP ${patch.tp !== undefined ? (patch.tp ?? "removed") : pos.tp ?? "—"}`,
      });
    },
    [positions],
  );

  const setBreakEven = useCallback(
    (id: string) => {
      const pos = positions.find((p) => p.id === id);
      if (!pos) return;
      setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, sl: p.entry } : p)));
      toast({
        title: `${pos.symbol} stop moved to breakeven`,
        description: `SL set to entry ${pos.entry} (swap ${money(pos.swap)} + commission ${money(pos.commission)} still apply).`,
      });
    },
    [positions],
  );

  const closeAll = useCallback(
    (accountId?: string) => {
      const targets = accountId ? positions.filter((p) => p.accountId === accountId) : positions;
      if (targets.length === 0) {
        toast({
          title: "Nothing to flatten",
          description: accountId ? "No open positions on this account." : "No open positions.",
        });
        return;
      }
      const byAccount: Record<string, number> = {};
      let net = 0;
      for (const p of targets) {
        const value = p.pnl + p.swap + p.commission;
        net += value;
        byAccount[p.accountId] = (byAccount[p.accountId] ?? 0) + value;
      }
      setRealized((r) => {
        const next = { ...r };
        for (const [acc, value] of Object.entries(byAccount)) {
          next[acc] = (next[acc] ?? 0) + value;
        }
        return next;
      });
      setPositions((prev) =>
        accountId ? prev.filter((p) => p.accountId !== accountId) : [],
      );
      toast({
        title: `Flattened ${targets.length} position${targets.length > 1 ? "s" : ""}`,
        description: `All open positions closed · realized ${money(net)}`,
      });
    },
    [positions],
  );

  const cancelOrder = useCallback((id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    setOrders((prev) => prev.filter((o) => o.id !== id));
    toast({
      title: "Order cancelled",
      description: `${order.type} ${order.lots.toFixed(2)} ${order.symbol} @ ${order.price} removed.`,
    });
  }, [orders]);

  const value = useMemo<TradingContextValue>(
    () => ({
      positions,
      orders,
      realizedByAccount,
      placeOrder,
      closePosition,
      modifyPosition,
      setBreakEven,
      closeAll,
      cancelOrder,
    }),
    [
      positions,
      orders,
      realizedByAccount,
      placeOrder,
      closePosition,
      modifyPosition,
      setBreakEven,
      closeAll,
      cancelOrder,
    ],
  );

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}

/**
 * Access the mock trading engine. Must be used under <TradingProvider>
 * (mounted inside <AccountProvider> in components/platform/providers.tsx).
 */
export function useTrading(): TradingContextValue {
  const ctx = useContext(TradingContext);
  if (!ctx) {
    throw new Error(
      "useTrading must be used within <TradingProvider> (see components/platform/providers.tsx)",
    );
  }
  return ctx;
}
