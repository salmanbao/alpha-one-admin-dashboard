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
  TerraEmpty,
  TerraPageHeader,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades } from "@/lib/fixtures/terra-fixtures";

const filters = ["All", "Wins", "Losses"] as const;

const selectClass =
  "rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface focus:border-primary focus:outline-none";

export function TradeHistoryPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [symbol, setSymbol] = useState("All");
  const [side, setSide] = useState<"All" | "long" | "short">("All");

  const symbols = useMemo(
    () => ["All", ...Array.from(new Set(terraTrades.map((t) => t.symbol)))],
    [],
  );

  const trades = useMemo(
    () =>
      terraTrades.filter((t) => {
        const outcomeOk =
          filter === "All" ? true : filter === "Wins" ? t.pnl > 0 : t.pnl < 0;
        const symbolOk = symbol === "All" ? true : t.symbol === symbol;
        const sideOk = side === "All" ? true : t.side === side;
        return outcomeOk && symbolOk && sideOk;
      }),
    [filter, symbol, side],
  );

  const wins = terraTrades.filter((t) => t.pnl > 0);
  const losses = terraTrades.filter((t) => t.pnl < 0);
  const totalPnl = terraTrades.reduce((s, t) => s + t.pnl, 0);
  const winRate = Math.round((wins.length / terraTrades.length) * 100);
  const avgWin = wins.length
    ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length
    : 0;
  const avgLoss = losses.length
    ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length
    : 0;

  const handleExportCsv = () => {
    const headers = ["Ticket", "Symbol", "Side", "Lots", "Entry", "Exit", "Pips", "P&L", "Closed"];
    const rows = trades.map((t) => [t.ticket, t.symbol, t.side, t.lots.toFixed(2), t.entry, t.exit, t.pips, t.pnl, t.closedAt]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`Exported ${trades.length} trades to CSV successfully!`);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trade History"
        description="Closed trades across all your accounts"
        actions={
          <button
            type="button"
            onClick={handleExportCsv}
            className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Export CSV
          </button>
        }
      />

      {/* Trade analytics (M12: win rate, avg win/loss) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <TerraCard className="p-5">
          <TerraStat label="Closed Trades" value={terraTrades.length} sub="last 30 days" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Net P&L" value={formatSignedMoney(totalPnl)} tone={totalPnl >= 0 ? "positive" : "negative"} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Win Rate"
            value={`${winRate}%`}
            sub={`${wins.length} of ${terraTrades.length}`}
            tone="positive"
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Avg Win"
            value={formatSignedMoney(avgWin)}
            sub={`${wins.length} winners`}
            tone="positive"
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Avg Loss"
            value={formatSignedMoney(avgLoss)}
            sub={`${losses.length} losers`}
            tone="negative"
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Best Trade"
            value={formatSignedMoney(Math.max(...terraTrades.map((t) => t.pnl)))}
            tone="positive"
          />
        </TerraCard>
      </div>

      {/* Filters: outcome chips + symbol/side selects */}
      <div className="flex flex-wrap items-center gap-3">
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
        <div className="h-5 w-px bg-outline-variant/60" aria-hidden="true" />
        <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
          Symbol
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className={selectClass}
            aria-label="Filter by symbol"
          >
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All symbols" : s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
          Side
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "All" | "long" | "short")}
            className={selectClass}
            aria-label="Filter by side"
          >
            <option value="All">All sides</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        {(symbol !== "All" || side !== "All" || filter !== "All") && (
          <button
            type="button"
            onClick={() => {
              setSymbol("All");
              setSide("All");
              setFilter("All");
            }}
            className="text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs font-semibold text-on-surface-variant">
          {trades.length} of {terraTrades.length} trades
        </span>
      </div>

      {trades.length === 0 ? (
        <TerraEmpty
          title="No trades match these filters"
          description="Try widening the outcome, symbol or side filters."
        />
      ) : (
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
      )}
    </div>
  );
}
