"use client";

/**
 * Order Ticket — converted from stitch_screens/order_ticket + trade_ticket
 * Order placement form with symbol selector, lots, SL/TP.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import {
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { marketWatch } from "@/lib/fixtures/terra-fixtures";

export function OrderTicketPage() {
  const [symbol, setSymbol] = useState(marketWatch[0].symbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lots, setLots] = useState("0.50");
  const selected = marketWatch.find((m) => m.symbol === symbol) ?? marketWatch[0];

  return (
    <div className="space-y-6">
      <TerraPageHeader title="Order Ticket" description="Place a new order on your active account" />

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
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-on-surface outline-none focus:border-primary"
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

              {/* Lots + price */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Volume (lots)
                  </span>
                  <input
                    value={lots}
                    onChange={(e) => setLots(e.target.value)}
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm tabular-nums outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Order type
                  </span>
                  <select className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary">
                    <option>Market Execution</option>
                    <option>Buy Limit</option>
                    <option>Sell Stop</option>
                  </select>
                </label>
              </div>

              {/* SL/TP */}
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Stop Loss
                  </span>
                  <input
                    placeholder="Optional"
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm tabular-nums outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Take Profit
                  </span>
                  <input
                    placeholder="Optional"
                    className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm tabular-nums outline-none focus:border-primary"
                  />
                </label>
              </div>

              <button
                type="button"
                className={cn(
                  "w-full rounded-xl py-3 text-sm font-bold uppercase tracking-wide shadow-sm transition-all active:scale-[0.99]",
                  side === "buy"
                    ? "bg-primary text-on-primary hover:bg-primary/90"
                    : "bg-error text-on-error hover:bg-error/90",
                )}
              >
                {side === "buy" ? "Buy" : "Sell"} {lots || "0.00"} {symbol} @{" "}
                {side === "buy" ? selected.ask : selected.bid}
              </button>
            </div>
          </TerraCard>
        </div>

        {/* Quote panel */}
        <TerraCard className="flex flex-col gap-3">
          <TerraSectionTitle title="Live quote" />
          <Link
            href="/order-detail?id=ord-55011"
            className="flex items-center justify-between rounded-xl bg-surface-container-low px-3.5 py-2.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
          >
            <span>2 pending orders</span>
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
      </div>
    </div>
  );
}
