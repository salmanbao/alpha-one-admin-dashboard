"use client";

/**
 * Market Watch — converted from stitch_screens/market_watch
 * Live quotes grid with bid/ask, spread and daily change.
 */

import Link from "next/link";
import { TerraCard, TerraPageHeader } from "@/components/terra/terra-ui";
import { marketWatch } from "@/lib/fixtures/terra-fixtures";
import { activeEmbargoFor, embargosFor } from "@/lib/fixtures/embargo-windows";

export function MarketWatchPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Market Watch"
        description="Live quotes • Markets Open • 24/5"
      />
      {/* R9 W5 UC-T5 — honest labeling: the badges are a fixed editorial
          schedule (Demo), not a live news feed. */}
      <p className="text-[11px] text-on-surface-variant">
        Embargo badges follow the editorial schedule (Demo) — a fixed fixture of recurring UTC
        windows, not a live news feed.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {marketWatch.map((m) => {
          const rows = embargosFor(m.symbol);
          const active = activeEmbargoFor(m.symbol);
          const schedule = rows
            .map((r) => (r.kind === "news" ? `${r.windows[0].start} UTC` : "weekend"))
            .join(" · ");
          return (
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
            {/* R9 W5 UC-T5 — per-symbol embargo badge (amber while in a
                window, muted schedule otherwise). */}
            {rows.length > 0 && (
              <span
                className={
                  active
                    ? "w-fit rounded-md bg-warning-container/60 px-2 py-0.5 text-[10px] font-bold text-on-warning-container"
                    : "w-fit rounded-md bg-surface-container-high px-2 py-0.5 text-[10px] font-semibold text-on-surface-variant"
                }
                title={active ? active.note : rows.map((r) => r.note).join(" ")}
              >
                {active ? `⛔ Embargo now — ${active.kind === "news" ? "news blackout" : "weekend hold"}` : `🗓 Embargo ${schedule}`}
              </span>
            )}
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
          );
        })}
      </div>
    </div>
  );
}
