"use client";

/**
 * Trade History — converted from stitch_screens/trade_history
 * Closed trades table with P&L stats, export, plus PRD §3.8 power
 * tools: free-text search, column sorting and pagination (20/page).
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
const PAGE_SIZE = 20;

type SortKey = "ticket" | "symbol" | "pips" | "pnl" | "closedAt";

const selectClass =
  "rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface focus:border-primary focus:outline-none";

export function TradeHistoryPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [symbol, setSymbol] = useState("All");
  const [side, setSide] = useState<"All" | "long" | "short">("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "closedAt",
    dir: "desc",
  });
  const [page, setPage] = useState(0);

  const symbols = useMemo(
    () => ["All", ...Array.from(new Set(terraTrades.map((t) => t.symbol)))],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return terraTrades.filter((t) => {
      const outcomeOk =
        filter === "All" ? true : filter === "Wins" ? t.pnl > 0 : t.pnl < 0;
      const symbolOk = symbol === "All" ? true : t.symbol === symbol;
      const sideOk = side === "All" ? true : t.side === side;
      const queryOk =
        !q ||
        t.ticket.includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        (t.comment?.toLowerCase().includes(q) ?? false);
      return outcomeOk && symbolOk && sideOk && queryOk;
    });
  }, [filter, symbol, side, query]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "ticket":
          return (Number(a.ticket) - Number(b.ticket)) * dir;
        case "symbol":
          return a.symbol.localeCompare(b.symbol) * dir;
        case "pips":
          return (a.pips - b.pips) * dir;
        case "pnl":
          return (a.pnl - b.pnl) * dir;
        case "closedAt":
          return (Date.parse(a.closedAt) - Date.parse(b.closedAt)) * dir;
      }
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const rangeStart = sorted.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const rangeEnd = Math.min(sorted.length, (safePage + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "ticket" || key === "symbol" ? "asc" : "desc" },
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
    const rows = sorted.map((t) => [t.ticket, t.symbol, t.side, t.lots.toFixed(2), t.entry, t.exit, t.pips, t.pnl, t.closedAt]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`Exported ${sorted.length} trades to CSV successfully!`);
  };

  const headCell = (label: string, key?: SortKey) =>
    key ? (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 uppercase transition-colors hover:text-on-surface"
        aria-label={`Sort by ${label}`}
      >
        {label}
        <span
          aria-hidden="true"
          className={sort.key === key ? "text-primary" : "text-on-surface-variant/50"}
        >
          {sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    ) : (
      label
    );

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

      {/* Free-text search + filters: outcome chips + symbol/side selects */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder="Search ticket, symbol, comment…"
          aria-label="Search trades"
          className="w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none sm:w-64"
        />
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
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
            onChange={(e) => {
              setSymbol(e.target.value);
              setPage(0);
            }}
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
            onChange={(e) => {
              setSide(e.target.value as "All" | "long" | "short");
              setPage(0);
            }}
            className={selectClass}
            aria-label="Filter by side"
          >
            <option value="All">All sides</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        {(symbol !== "All" || side !== "All" || filter !== "All" || query !== "") && (
          <button
            type="button"
            onClick={() => {
              setSymbol("All");
              setSide("All");
              setFilter("All");
              setQuery("");
              setPage(0);
            }}
            className="text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs font-semibold text-on-surface-variant">
          {sorted.length} of {terraTrades.length} trades
        </span>
      </div>

      {sorted.length === 0 ? (
        <TerraEmpty
          title="No trades match these filters"
          description="Try widening the outcome, symbol or side filters."
        />
      ) : (
        <TerraCard>
          <TerraTable
            head={[
              headCell("Ticket", "ticket"),
              headCell("Symbol", "symbol"),
              "Side",
              "Lots",
              "Entry",
              "Exit",
              headCell("Pips", "pips"),
              headCell("P&L", "pnl"),
              headCell("Closed", "closedAt"),
            ]}
            rows={pageRows.map((t) => [
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
          {/* Pagination (PRD §3.8) */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-on-surface-variant">
              Showing {rangeStart}–{rangeEnd} of {sorted.length} trades
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="rounded-lg bg-surface-container px-3.5 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="px-2 text-xs font-bold tabular-nums text-on-surface">
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                className="rounded-lg bg-surface-container px-3.5 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </TerraCard>
      )}
    </div>
  );
}
