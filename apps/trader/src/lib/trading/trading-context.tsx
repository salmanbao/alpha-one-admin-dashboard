"use client";

/**
 * Trader App — Trading Context (persistent mock trading engine)
 *
 * A single state container for the trader's live trading session: open
 * positions, pending orders, closed trades and per-account realized P&L.
 * The state lives in `lib/trading/trading-store.ts` (persisted under
 * `pfaas:trader:trading` — R7 I1), so a reload keeps the session instead
 * of resetting to the fixtures; this provider is the React binding that
 * pages consume through `useTrading()`.
 *
 * Design notes (frontend-only, mock):
 *   • First run seeds from the terra fixtures ("Demo trades seeded on
 *     first run" — disclosed on the history pages).
 *   • Every state change persists through the store and emits its
 *     `trade.*` lifecycle event there; toasts report the result
 *     (never alert()).
 *
 * Consumers: open-positions (manage + Pending Orders tab), order-ticket
 * (place orders + calculator), position detail (modify/close/BE),
 * risk-dashboard (live margin from open lots), plus the history/analytics
 * screens that read `closedTrades`.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  cancelOrder,
  closeAll,
  closePosition,
  modifyPosition,
  placeOrder,
  setBreakEven,
  useTradingStore,
  type PlaceOrderInput,
} from "@/lib/trading/trading-store";
import type { TerraOrder, TerraPosition, TerraTrade } from "@/lib/fixtures/terra-fixtures";

export type { PlaceOrderInput };

interface TradingContextValue {
  positions: TerraPosition[];
  orders: TerraOrder[];
  /** Closed trades (fixture seed + everything closed in this browser). */
  closedTrades: TerraTrade[];
  /** Realized P&L from closes, keyed by accountId. */
  realizedByAccount: Record<string, number>;
  placeOrder: (accountId: string, input: PlaceOrderInput) => void;
  closePosition: (id: string, fraction?: number) => void;
  modifyPosition: (id: string, patch: { sl?: number | null; tp?: number | null }) => void;
  setBreakEven: (id: string) => void;
  closeAll: (accountId?: string) => void;
  cancelOrder: (id: string) => void;
}

const TradingContext = createContext<TradingContextValue | null>(null);

export function TradingProvider({ children }: { children: ReactNode }) {
  const { positions, orders, closedTrades, realizedByAccount } = useTradingStore();

  const value = useMemo<TradingContextValue>(
    () => ({
      positions,
      orders,
      closedTrades,
      realizedByAccount,
      placeOrder,
      closePosition,
      modifyPosition,
      setBreakEven,
      closeAll,
      cancelOrder,
    }),
    [positions, orders, closedTrades, realizedByAccount],
  );

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}

/**
 * Access the trading engine. Must be used under <TradingProvider>
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
