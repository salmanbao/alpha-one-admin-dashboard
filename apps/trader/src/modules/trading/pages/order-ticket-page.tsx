"use client";

/**
 * Order Ticket — converted from stitch_screens/order_ticket + trade_ticket
 * Order placement form with symbol selector, lots, SL/TP, pending-order
 * entry prices and a risk-based lot calculator.
 *
 * Wired to the TradingContext: market orders open a live position,
 * limit/stop orders rest in the Pending Orders tab until filled or
 * cancelled.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import {
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { marketWatch } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { useTrading } from "@/lib/trading/trading-context";

const orderTypes = [
  "Market Execution",
  "Buy Limit",
  "Sell Limit",
  "Buy Stop",
  "Sell Stop",
] as const;

/** Pip size per symbol (matches the trade-history generator). */
const pipSize = (symbol: string) =>
  symbol.includes("JPY") ? 0.01 : symbol === "XAUUSD" ? 0.1 : 0.0001;

/** $10 per pip per lot — the convention used across terra trade fixtures. */
const PIP_VALUE_PER_LOT = 10;

const inputCls =
  "rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm tabular-nums outline-none focus:border-primary";

export function OrderTicketPage() {
  // The ticket writes to the active trading account — show it explicitly so
  // the trader always knows which account an order will land on.
  const { activeAccount } = useActiveAccount();
  const { placeOrder, orders } = useTrading();
  const [symbol, setSymbol] = useState(marketWatch[0].symbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lots, setLots] = useState("0.50");
  const [orderType, setOrderType] = useState<(typeof orderTypes)[number]>("Market Execution");
  const [entryPrice, setEntryPrice] = useState("");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const selected = marketWatch.find((m) => m.symbol === symbol) ?? marketWatch[0];

  // Risk calculator state — risk a % of balance against the SL distance.
  const [riskPct, setRiskPct] = useState("1");
  const accOrders = orders.filter((o) => o.accountId === activeAccount.id);

  const slNumber = Number(sl);
  const slDistancePips =
    sl !== "" && Number.isFinite(slNumber) && slNumber > 0
      ? Math.abs((side === "buy" ? selected.ask : selected.bid) - slNumber) / pipSize(symbol)
      : 0;
  const riskAmount = (Number(riskPct) / 100) * activeAccount.balance;
  const suggestedLots =
    slDistancePips > 0 && Number.isFinite(riskAmount)
      ? Math.max(0.01, Math.round((riskAmount / (slDistancePips * PIP_VALUE_PER_LOT)) * 100) / 100)
      : null;

  const isPending = orderType !== "Market Execution";

  const handlePlaceOrder = () => {
    placeOrder(activeAccount.id, {
      symbol,
      side,
      lots: Number(lots) || 0.01,
      orderType,
      price: isPending ? Number(entryPrice) : undefined,
      sl: sl === "" ? null : Number(sl),
      tp: tp === "" ? null : Number(tp),
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="rounded-full bg-primary-fixed p-6">
          <span className="text-6xl">✓</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-on-surface">
            {isPending ? "Pending Order Placed" : "Order Placed Successfully"}
          </h2>
          <p className="mt-2 text-on-surface-variant">
            {orderType} {lots} {symbol} @{" "}
            {isPending ? entryPrice : side === "buy" ? selected.ask : selected.bid}
          </p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {isPending
              ? "The order rests until the price is hit or you cancel it."
              : "The position is now live under Open Positions."}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/trading-positions"
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            View Open Positions
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setSl("");
              setTp("");
              setEntryPrice("");
            }}
            className="rounded-xl border border-outline-variant px-6 py-3 text-sm font-bold text-on-surface hover:bg-surface-container-low"
          >
            Place Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Order Ticket"
        description={`Place a new order on #${activeAccount.login} • ${activeAccount.name} — switch accounts from the header`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Order details" />
            <div className="space-y-4">
              {/* Symbol selector */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Symbol
                </span>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className={cn(inputCls, "font-semibold")}
                >
                  {marketWatch.map((m) => (
                    <option key={m.symbol} value={m.symbol}>
                      {m.symbol} — {m.bid}
                    </option>
                  ))}
                </select>
              </label>

              {/* Buy / Sell */}
              <div className="grid grid-cols-2 gap-3">
                {(["buy", "sell"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSide(s)}
                    className={cn(
                      "rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-all",
                      side === s
                        ? s === "buy"
                          ? "bg-primary text-on-primary shadow-sm"
                          : "bg-error text-on-error shadow-sm"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
                    )}
                  >
                    {s === "buy" ? "Buy / Long" : "Sell / Short"}
                  </button>
                ))}
              </div>

              {/* Lots + order type */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Volume (lots)
                  </span>
                  <input
                    value={lots}
                    onChange={(e) => setLots(e.target.value.replace(/[^0-9.]/g, ""))}
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Order type
                  </span>
                  <select
                    value={orderType}
                    onChange={(e) =>
                      setOrderType(e.target.value as (typeof orderTypes)[number])
                    }
                    className={cn(inputCls, "font-semibold")}
                  >
                    {orderTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Entry price for limit/stop orders */}
              {isPending && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Entry price
                  </span>
                  <input
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder={`Trigger price — market ${side === "buy" ? "ask" : "bid"} ${side === "buy" ? selected.ask : selected.bid}`}
                    className={inputCls}
                  />
                  <span className="text-xs text-on-surface-variant">
                    {orderType.includes("Limit")
                      ? "Limit orders fill at or better than the entry price."
                      : "Stop orders fill once the market trades through the entry price."}
                  </span>
                </label>
              )}

              {/* SL/TP */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Stop Loss
                  </span>
                  <input
                    value={sl}
                    onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Take Profit
                  </span>
                  <input
                    value={tp}
                    onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Optional"
                    className={inputCls}
                  />
                </label>
              </div>

              <button
                type="button"
                onClick={handlePlaceOrder}
                className={cn(
                  "w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide shadow-sm transition-all active:scale-[0.99]",
                  side === "buy"
                    ? "bg-primary text-on-primary hover:bg-primary/90"
                    : "bg-error text-on-error hover:bg-error/90",
                )}
              >
                {side === "buy" ? "Buy" : "Sell"} {lots || "0.00"} {symbol} @{" "}
                {isPending ? entryPrice || "—" : side === "buy" ? selected.ask : selected.bid}
              </button>
            </div>
          </TerraCard>
        </div>

        {/* Quote + calculator panel */}
        <div className="space-y-6">
          <TerraCard className="flex flex-col gap-3">
            <TerraSectionTitle title="Live quote" />
            <Link
              href="/trading-positions"
              className="flex items-center justify-between rounded-xl bg-surface-container-low px-3.5 py-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
            >
              <span>
                {accOrders.length} pending order{accOrders.length === 1 ? "" : "s"}
              </span>
              <span className="text-primary">View →</span>
            </Link>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-primary-fixed/50 p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
                  Bid
                </span>
                <span className="font-headline text-lg font-bold tabular-nums text-on-surface">
                  {selected.bid}
                </span>
              </div>
              <div className="rounded-xl bg-error-container/60 p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-on-error-container">
                  Ask
                </span>
                <span className="font-headline text-lg font-bold tabular-nums text-on-surface">
                  {selected.ask}
                </span>
              </div>
            </div>
            <div className="space-y-2 rounded-xl bg-surface-container-low p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Spread</span>
                <strong className="text-on-surface">{selected.spread} pips</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Daily change</span>
                <strong className={selected.change >= 0 ? "text-primary" : "text-error"}>
                  {selected.change >= 0 ? "+" : ""}
                  {selected.change}%
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Commission</span>
                <strong className="text-on-surface">$3.50 / lot</strong>
              </div>
            </div>
          </TerraCard>

          {/* Risk-based lot calculator */}
          <TerraCard>
            <TerraSectionTitle
              title="Risk calculator"
              description="Size the position from your stop distance."
            />
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between gap-3">
                <span className="text-on-surface-variant">Risk per trade</span>
                <span className="flex items-center gap-1.5">
                  <input
                    value={riskPct}
                    onChange={(e) => setRiskPct(e.target.value.replace(/[^0-9.]/g, ""))}
                    className={cn(inputCls, "w-16 text-right")}
                  />
                  <span className="text-on-surface-variant">% =</span>
                  <strong className="tabular-nums text-on-surface">
                    {formatMoney(Number.isFinite(riskAmount) ? riskAmount : 0)}
                  </strong>
                </span>
              </label>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">SL distance</span>
                <strong className="tabular-nums text-on-surface">
                  {slDistancePips > 0 ? `${Math.round(slDistancePips * 10) / 10} pips` : "set a stop loss"}
                </strong>
              </div>
              <div className="flex justify-between border-t border-outline-variant/40 pt-2">
                <span className="font-semibold text-on-surface">Suggested size</span>
                <strong className="tabular-nums text-primary">
                  {suggestedLots !== null ? `${suggestedLots.toFixed(2)} lots` : "—"}
                </strong>
              </div>
              {suggestedLots !== null && (
                <button
                  type="button"
                  onClick={() => setLots(suggestedLots.toFixed(2))}
                  className="w-full rounded-xl bg-surface-container-low px-3 py-2 font-semibold text-on-surface hover:bg-surface-container"
                >
                  Apply {suggestedLots.toFixed(2)} lots to volume
                </button>
              )}
              <p className="text-[11px] text-on-surface-variant">
                Balance {formatMoney(activeAccount.balance)} • ${PIP_VALUE_PER_LOT} per pip per
                lot.
              </p>
            </div>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
