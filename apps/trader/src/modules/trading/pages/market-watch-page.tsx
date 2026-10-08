"use client";

/**
 * Market Watch — converted from stitch_screens/market_watch
 * Live quotes grid with bid/ask, spread and daily change.
 */

import Link from "next/link";
import { TerraCard, TerraPageHeader } from "@/components/terra/terra-ui";
import { marketWatch } from "@/lib/fixtures/terra-fixtures";

export function MarketWatchPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Market Watch"
        description="Live quotes • Markets Open • 24/5"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {marketWatch.map((m) => (
          <TerraCard key={m.symbol} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-headline text-lg font-bold text-on-surface">
                {m.symbol}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  m.change >= 0
                    ? "bg-primary-fixed text-on-primary-fixed-variant"
                    : "bg-error-container text-on-error-container"
                }`}
              >
                {m.change >= 0 ? "▲" : "▼"} {Math.abs(m.change)}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-surface-container-low py-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Bid
                </span>
                <span className="font-headline text-base font-bold tabular-nums text-on-surface">
                  {m.bid}
                </span>
              </div>
              <div className="rounded-lg bg-surface-container-low py-2">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Ask
                </span>
                <span className="font-headline text-base font-bold tabular-nums text-on-surface">
                  {m.ask}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">
                Spread <strong className="text-on-surface">{m.spread}</strong>
              </span>
              <Link
                href="/order-ticket"
                className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-on-primary hover:bg-primary/90"
              >
                Trade
              </Link>
            </div>
          </TerraCard>
        ))}
      </div>
    </div>
  );
}
