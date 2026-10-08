"use client";

/**
 * Trade History — converted from stitch_screens/trade_history
 * Closed trades table with P&L stats and export.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades } from "@/lib/fixtures/terra-fixtures";

const filters = ["All", "Wins", "Losses"] as const;

export function TradeHistoryPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const trades = useMemo(
    () =>
      terraTrades.filter((t) =>
        filter === "All" ? true : filter === "Wins" ? t.pnl > 0 : t.pnl < 0,
      ),
    [filter],
  );

  const wins = terraTrades.filter((t) => t.pnl > 0);
  const totalPnl = terraTrades.reduce((s, t) => s + t.pnl, 0);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trade History"
        description="Closed trades across all your accounts"
        actions={
          <button
            type="button"
            className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Closed Trades" value={terraTrades.length} sub="last 30 days" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Net P&L" value={formatSignedMoney(totalPnl)} tone={totalPnl >= 0 ? "positive" : "negative"} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Wins" value={wins.length} sub={`of ${terraTrades.length}`} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Best Trade"
            value={formatSignedMoney(Math.max(...terraTrades.map((t) => t.pnl)))}
            tone="positive"
          />
        </TerraCard>
      </div>

      <div className="flex items-center gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
              filter === f
                ? "bg-primary font-bold text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <TerraCard>
        <TerraTable
          head={["Ticket", "Symbol", "Side", "Lots", "Entry", "Exit", "Pips", "P&L", "Closed"]}
          rows={trades.map((t) => [
            <Link key="t" href={`/trade-detail?id=${t.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
              {t.ticket}
            </Link>,
            <span key="s" className="font-semibold">{t.symbol}</span>,
            <TerraBadge key="sd" tone={t.side === "long" ? "primary" : "error"}>
              {t.side === "long" ? "Long" : "Short"}
            </TerraBadge>,
            t.lots.toFixed(2),
            t.entry,
            t.exit,
            <span key="p" className={t.pips >= 0 ? "text-primary" : "text-error"}>
              {t.pips >= 0 ? "+" : ""}
              {t.pips}
            </span>,
            <span key="pl" className={`font-bold tabular-nums ${t.pnl >= 0 ? "text-primary" : "text-error"}`}>
              {formatSignedMoney(t.pnl)}
            </span>,
            new Date(t.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          ])}
        />
      </TerraCard>
    </div>
  );
}
