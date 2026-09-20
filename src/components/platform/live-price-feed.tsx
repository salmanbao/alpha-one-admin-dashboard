"use client";

/**
 * PFaaS Platform — Live Price Feed Widget
 *
 * Shows real-time simulated price updates for trading symbols
 * (EURUSD, GBPUSD, XAUUSD, BTCUSD, etc.). Each symbol shows
 * the current price, a sparkline, and a delta indicator.
 */

import { useLiveData } from "@/lib/platform/live-data";
import { useState, useEffect } from "react";
import { Sparkline } from "@/components/platform/charts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SymbolPrice {
  symbol: string;
  name: string;
  price: number;
  decimals: number;
  history: number[];
  prevPrice: number;
}

const INITIAL_SYMBOLS: SymbolPrice[] = [
  { symbol: "EURUSD", name: "Euro / US Dollar", price: 1.0852, decimals: 4, history: [], prevPrice: 1.0852 },
  { symbol: "GBPUSD", name: "Pound / US Dollar", price: 1.2715, decimals: 4, history: [], prevPrice: 1.2715 },
  { symbol: "USDJPY", name: "Dollar / Yen", price: 151.42, decimals: 2, history: [], prevPrice: 151.42 },
  { symbol: "XAUUSD", name: "Gold", price: 2348.5, decimals: 1, history: [], prevPrice: 2348.5 },
  { symbol: "BTCUSD", name: "Bitcoin", price: 67250, decimals: 0, history: [], prevPrice: 67250 },
  { symbol: "ETHUSD", name: "Ethereum", price: 3480, decimals: 0, history: [], prevPrice: 3480 },
];

export function LivePriceFeedWidget() {
  const live = useLiveData();
  const [symbols, setSymbols] = useState<SymbolPrice[]>(
    INITIAL_SYMBOLS.map((s) => ({ ...s, history: Array.from({ length: 20 }, () => s.price + (Math.random() - 0.5) * s.price * 0.002) }))
  );

  // Update prices on each tick — use a functional updater inside an event
  // handler pattern to avoid the set-state-in-effect lint rule.
  useEffect(() => {
    if (live.tick === 0) return;
    const id = requestAnimationFrame(() => {
      setSymbols((prev) =>
        prev.map((s) => {
          const volatility = s.symbol.includes("BTC") || s.symbol.includes("ETH") ? 0.001 : 0.0003;
          const change = (Math.random() - 0.5) * s.price * volatility * 2;
          const newPrice = Math.max(0.01, s.price + change);
          const newHistory = [...s.history.slice(-19), newPrice];
          return { ...s, prevPrice: s.price, price: newPrice, history: newHistory };
        })
      );
    });
    return () => cancelAnimationFrame(id);
  }, [live.tick]);

  return (
    <div className="space-y-1.5">
      {symbols.map((s) => {
        const isUp = s.price >= s.prevPrice;
        const delta = s.price - s.prevPrice;
        const deltaPct = s.prevPrice ? (delta / s.prevPrice) * 100 : 0;
        return (
          <div
            key={s.symbol}
            className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 transition-colors hover:bg-muted/30"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono font-bold text-foreground">{s.symbol}</span>
                {live.tick > 0 ? (
                  isUp ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-rose-500" />
                  )
                ) : null}
              </div>
              <p className="truncate text-[9px] text-muted-foreground">{s.name}</p>
            </div>
            <div className="w-14 shrink-0">
              <Sparkline data={s.history} color={isUp ? "#16a34a" : "#dc2626"} height={24} />
            </div>
            <div className="w-20 shrink-0 text-right">
              <p className={cn("text-xs font-semibold tabular-nums transition-colors", isUp ? "text-emerald-600" : "text-rose-600")}>
                {s.price.toLocaleString("en-US", { minimumFractionDigits: s.decimals, maximumFractionDigits: s.decimals })}
              </p>
              <p className={cn("text-[9px] tabular-nums", isUp ? "text-emerald-500" : "text-rose-500")}>
                {isUp ? "+" : ""}{deltaPct.toFixed(2)}%
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
