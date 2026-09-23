"use client";

/**
 * Closed Positions Page — historical trading positions that have been
 * closed, with rich filters, KPI roll-ups and CSV export.
 *
 * Mock data is generated inline using `Array.from` with deterministic
 * seeding — closed prices, close times and close reasons are derived
 * from the existing positions seed (symbol list + base price), so the
 * demo is stable across reloads.
 *
 * Filters: search by symbol / trader / account, date range, symbol,
 * direction, close reason. Row click expands inline to reveal extra
 * detail fields (commission, swap, open/close timestamps).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantTraders,
  getTenantPositions,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  Trophy,
  AlertTriangle,
  Download,
  Filter,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type CloseReason = "TP" | "SL" | "Manual";
type ClosedSide = "buy" | "sell";

interface ClosedPosition {
  id: string;
  tenantId: string;
  accountLogin: string;
  traderName: string;
  symbol: string;
  side: ClosedSide;
  volume: number;
  entryPrice: number;
  closePrice: number;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  closedAt: string;
  durationMs: number;
  closeReason: CloseReason;
  commission: number;
  swap: number;
}

const DATE_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

const CLOSE_REASONS: CloseReason[] = ["TP", "SL", "Manual"];

/**
 * Deterministic pseudo-random generator from a numeric seed. Returns a
 * float in [0, 1).
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 10000;
  return x - Math.floor(x);
}

const BASE_SYMBOLS: Array<[string, number, number]> = [
  // symbol, base price, contract multiplier used by pnl formula
  ["EURUSD", 1.085, 10000],
  ["GBPUSD", 1.271, 10000],
  ["USDJPY", 151.4, 1000],
  ["XAUUSD", 2348.5, 100],
  ["BTCUSD", 67250, 1],
  ["ETHUSD", 3480, 1],
  ["SP500", 5230, 1],
  ["NAS100", 18420, 1],
];

/**
 * Generate a deterministic set of closed positions per tenant by taking
 * the existing open positions seed as a base. Each closed position adds
 * a close price, close time, close reason, commission, and duration.
 */
function generateClosedPositions(tenantId: string): ClosedPosition[] {
  const accounts = getTenantAccounts(tenantId);
  const traders = getTenantTraders(tenantId);
  const openPositions = getTenantPositions(tenantId);
  const traderById = new Map(traders.map((t) => [t.id, t]));

  return Array.from({ length: openPositions.length }, (_, idx) => {
    const base = openPositions[idx];
    const [sym, basePrice, mult] = BASE_SYMBOLS[idx % BASE_SYMBOLS.length];
    // Use deterministic seeding so the same input always produces the
    // same closed position.
    const seed = idx + 1;
    const r1 = seededRandom(seed);
    const r2 = seededRandom(seed + 0.5);
    const r3 = seededRandom(seed + 1.7);
    const r4 = seededRandom(seed + 3.3);

    // Direction & entry
    const side: ClosedSide = base.side;
    const entry = base.entryPrice;
    // Close price moves a deterministic % away from entry
    const movePct = (r1 - 0.5) * 0.04; // ±2%
    let close = entry * (1 + movePct);
    // For sell positions, "up" in price = loss; align sign with side
    const pnlPerUnit = side === "buy" ? close - entry : entry - close;
    const volume = base.volume;
    const grossPnl = pnlPerUnit * mult * volume;
    const commission = Math.round((volume * basePrice * 0.0004) * 100) / 100; // 4 bps
    const swap = Math.round(Math.sin(seed) * 5 * 100) / 100;
    const pnl = Math.round((grossPnl - commission - swap) * 100) / 100;
    const pnlPct = Math.round((pnl / (entry * volume)) * 10000) / 100;

    // Determine close reason from P&L direction
    let closeReason: CloseReason;
    if (pnl >= Math.abs(grossPnl) * 0.5 && pnl > 0) closeReason = "TP";
    else if (pnl <= -Math.abs(grossPnl) * 0.3 && pnl < 0) closeReason = "SL";
    else closeReason = "Manual";

    // Open / close timestamps — pick a deterministic window from the
    // past 90 days. Use r2 (0..1) for the offset.
    const now = Date.now();
    const openedMsAgo = Math.floor((1 + r2 * 90 * 24 * 60)) * 60 * 1000; // 1min..90d
    const durationMs = Math.floor((r3 * 48 * 60 + 5) * 60 * 1000); // 5min..48h
    const closedMsAgo = Math.max(openedMsAgo - durationMs, 60 * 1000);
    const openedAt = new Date(now - openedMsAgo).toISOString();
    const closedAt = new Date(now - closedMsAgo).toISOString();
    void r4;

    const trader = traderById.get(base.traderId);
    return {
      id: `cpos-${tenantId}-${idx + 1}`,
      tenantId,
      accountLogin: accounts.find((a) => a.id === base.accountId)?.login ?? base.accountId,
      traderName: trader?.name ?? "Unknown",
      symbol: sym,
      side,
      volume,
      entryPrice: Math.round(entry * 100) / 100,
      closePrice: Math.round(close * 100) / 100,
      pnl,
      pnlPct,
      openedAt,
      closedAt,
      durationMs,
      closeReason,
      commission,
      swap,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h`;
  }
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ClosedPositionsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const allClosed = useMemo(() => generateClosedPositions(tid), [tid]);

  // Filters
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<string>("all");
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const symbolsAvailable = useMemo(
    () => Array.from(new Set(allClosed.map((p) => p.symbol))).sort(),
    [allClosed],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === "all" ? 0 : Date.now() - (DATE_RANGES[dateRange] ?? 0);
    return allClosed.filter((p) => {
      if (cutoff > 0 && new Date(p.closedAt).getTime() < cutoff) return false;
      if (symbolFilter !== "all" && p.symbol !== symbolFilter) return false;
      if (directionFilter !== "all" && p.side !== directionFilter) return false;
      if (reasonFilter !== "all" && p.closeReason !== reasonFilter) return false;
      if (
        q &&
        !`${p.symbol} ${p.traderName} ${p.accountLogin}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [allClosed, search, dateRange, symbolFilter, directionFilter, reasonFilter]);

  // KPI roll-ups — derived from the *filtered* set so they match what the
  // operator currently sees. (We use the unfiltered set only for win-rate
  // denominators when filters are cleared.)
  const totalClosed = filtered.length;
  const totalProfit = filtered.filter((p) => p.pnl > 0).reduce((s, p) => s + p.pnl, 0);
  const totalLoss = filtered.filter((p) => p.pnl < 0).reduce((s, p) => s + p.pnl, 0);
  const winners = filtered.filter((p) => p.pnl > 0).length;
  const winRate = totalClosed > 0 ? Math.round((winners / totalClosed) * 1000) / 10 : 0;
  const avgDurationMs =
    totalClosed > 0
      ? Math.round(filtered.reduce((s, p) => s + p.durationMs, 0) / totalClosed)
      : 0;
  const best = filtered.reduce<ClosedPosition | null>(
    (best, p) => (!best || p.pnl > best.pnl ? p : best),
    null,
  );
  const worst = filtered.reduce<ClosedPosition | null>(
    (worst, p) => (!worst || p.pnl < worst.pnl ? p : worst),
    null,
  );

  const activeFilters =
    (search ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0) +
    (symbolFilter !== "all" ? 1 : 0) +
    (directionFilter !== "all" ? 1 : 0) +
    (reasonFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setDateRange("all");
    setSymbolFilter("all");
    setDirectionFilter("all");
    setReasonFilter("all");
  };

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "Position ID", value: (p) => p.id },
        { key: "accountLogin", header: "Account Login", value: (p) => p.accountLogin },
        { key: "traderName", header: "Trader", value: (p) => p.traderName },
        { key: "symbol", header: "Symbol", value: (p) => p.symbol },
        { key: "side", header: "Direction", value: (p) => p.side },
        { key: "volume", header: "Volume", value: (p) => p.volume },
        { key: "entryPrice", header: "Entry Price", value: (p) => p.entryPrice },
        { key: "closePrice", header: "Close Price", value: (p) => p.closePrice },
        { key: "pnl", header: "P&L", value: (p) => p.pnl },
        { key: "pnlPct", header: "P&L %", value: (p) => p.pnlPct },
        { key: "openedAt", header: "Open Time", value: (p) => p.openedAt },
        { key: "closedAt", header: "Close Time", value: (p) => p.closedAt },
        { key: "durationMs", header: "Duration (ms)", value: (p) => p.durationMs },
        { key: "closeReason", header: "Close Reason", value: (p) => p.closeReason },
        { key: "commission", header: "Commission", value: (p) => p.commission },
        { key: "swap", header: "Swap", value: (p) => p.swap },
      ],
      `closed-positions-${tid}.csv`,
    );
  };

  const toggleExpand = (row: ClosedPosition) => {
    setExpandedId((cur) => (cur === row.id ? null : row.id));
    if (expandedId !== row.id) {
      toast({
        title: `Position ${row.id}`,
        description: `${row.symbol} ${row.side.toUpperCase()} ${row.volume} @ ${row.entryPrice} → ${row.closePrice} (${row.closeReason}).`,
      });
    }
  };

  const columns: Column<ClosedPosition>[] = [
    {
      key: "expand",
      header: "",
      cell: (row) => (
        <button
          type="button"
          aria-label={expandedId === row.id ? "Collapse position detail" : "Expand position detail"}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(row);
          }}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"
        >
          {expandedId === row.id ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      ),
      width: "32px",
    },
    {
      key: "accountLogin",
      header: "Login",
      cell: (row) => <span className="font-mono text-xs">{row.accountLogin}</span>,
      sortValue: (row) => row.accountLogin,
    },
    {
      key: "traderName",
      header: "Trader",
      cell: (row) => <span className="text-xs font-medium">{row.traderName}</span>,
      sortValue: (row) => row.traderName,
    },
    {
      key: "side",
      header: "Direction",
      cell: (row) => (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-semibold",
            row.side === "buy"
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "border-rose-500/40 text-rose-700 dark:text-rose-400",
          )}
        >
          {row.side === "buy" ? "Buy" : "Sell"}
        </Badge>
      ),
      sortValue: (row) => row.side,
    },
    {
      key: "symbol",
      header: "Symbol",
      cell: (row) => <span className="font-mono text-xs font-medium">{row.symbol}</span>,
      sortValue: (row) => row.symbol,
    },
    {
      key: "volume",
      header: "Volume",
      cell: (row) => <span className="tabular-nums text-xs">{row.volume}</span>,
      sortValue: (row) => row.volume,
      numeric: true,
    },
    {
      key: "entryPrice",
      header: "Entry",
      cell: (row) => <span className="tabular-nums text-xs">{row.entryPrice}</span>,
      sortValue: (row) => row.entryPrice,
      numeric: true,
    },
    {
      key: "closePrice",
      header: "Close",
      cell: (row) => <span className="tabular-nums text-xs">{row.closePrice}</span>,
      sortValue: (row) => row.closePrice,
      numeric: true,
    },
    {
      key: "pnl",
      header: "P&L",
      cell: (row) => (
        <span
          role="img"
          aria-label={`Profit and loss: ${row.pnl >= 0 ? "profit" : "loss"} of ${formatCurrency(Math.abs(row.pnl), currency)}`}
          className={cn(
            "tabular-nums text-xs font-medium",
            row.pnl >= 0 ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {row.pnl >= 0 ? "+" : ""}
          {formatCurrency(row.pnl, currency)}
        </span>
      ),
      sortValue: (row) => row.pnl,
      numeric: true,
    },
    {
      key: "openedAt",
      header: "Open Time",
      cell: (row) => (
        <span className="text-[11px] text-muted-foreground">
          {new Date(row.openedAt).toLocaleString()}
        </span>
      ),
      sortValue: (row) => row.openedAt,
    },
    {
      key: "closedAt",
      header: "Close Time",
      cell: (row) => (
        <span className="text-[11px] text-muted-foreground">
          {new Date(row.closedAt).toLocaleString()}
        </span>
      ),
      sortValue: (row) => row.closedAt,
    },
    {
      key: "durationMs",
      header: "Duration",
      cell: (row) => (
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {formatDuration(row.durationMs)}
        </span>
      ),
      sortValue: (row) => row.durationMs,
      numeric: true,
    },
    {
      key: "closeReason",
      header: "Reason",
      cell: (row) => (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-medium",
            row.closeReason === "TP"
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : row.closeReason === "SL"
              ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
              : "border-border text-muted-foreground",
          )}
        >
          {row.closeReason}
        </Badge>
      ),
      sortValue: (row) => row.closeReason,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Closed Positions"
        description="Historical trading positions that have been closed."
        icon={Activity}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <MetricCard label="Total Closed" value={totalClosed} icon={Activity} />
        <MetricCard
          label="Total Profit"
          value={formatCurrency(totalProfit, currency)}
          tone="positive"
          icon={TrendingUp}
        />
        <MetricCard
          label="Total Loss"
          value={formatCurrency(Math.abs(totalLoss), currency)}
          tone="negative"
          icon={TrendingDown}
        />
        <MetricCard
          label="Win Rate"
          value={`${winRate}%`}
          tone={winRate >= 50 ? "positive" : "warning"}
          icon={Target}
        />
        <MetricCard
          label="Avg Duration"
          value={avgDurationMs > 0 ? formatDuration(avgDurationMs) : "—"}
          icon={Clock}
        />
        <MetricCard
          label="Best Trade"
          value={best ? formatCurrency(best.pnl, currency) : "—"}
          tone="positive"
          icon={Trophy}
        />
        <MetricCard
          label="Worst Trade"
          value={worst ? formatCurrency(worst.pnl, currency) : "—"}
          tone="negative"
          icon={AlertTriangle}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeFilters > 0 ? (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
              {activeFilters}
            </Badge>
          ) : null}
        </div>
        {/* Search */}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search symbol, trader, account…"
          className="h-8 w-64 text-xs"
        />
        {/* Date range */}
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by date range"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
        {/* Symbol */}
        <select
          value={symbolFilter}
          onChange={(e) => setSymbolFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by symbol"
        >
          <option value="all">All symbols</option>
          {symbolsAvailable.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {/* Direction */}
        <select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by direction"
        >
          <option value="all">All directions</option>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        {/* Close reason */}
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by close reason"
        >
          <option value="all">All reasons</option>
          {CLOSE_REASONS.map((r) => (
            <option key={r} value={r}>
              {r === "TP" ? "Take Profit" : r === "SL" ? "Stop Loss" : "Manual"}
            </option>
          ))}
        </select>
        {activeFilters > 0 ? (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {allClosed.length} positions
        </span>
      </div>

      <PageContent>
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => toggleExpand(row)}
            pageSize={10}
            emptyTitle="No closed positions match your filters"
            emptyDescription="Try widening the date range or clearing some filters."
          />
        </div>

        {/* Inline expansion detail */}
        {expandedId ? (
          <ExpandedDetail
            position={filtered.find((p) => p.id === expandedId) ?? null}
            currency={currency}
          />
        ) : null}
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Inline expansion panel                                             */
/* ------------------------------------------------------------------ */

function ExpandedDetail({
  position,
  currency,
}: {
  position: ClosedPosition | null;
  currency: string;
}) {
  if (!position) return null;
  const fields: Array<{ label: string; value: string }> = [
    { label: "Position ID", value: position.id },
    { label: "Account Login", value: position.accountLogin },
    { label: "Trader", value: position.traderName },
    { label: "Symbol", value: position.symbol },
    { label: "Direction", value: position.side === "buy" ? "Buy" : "Sell" },
    { label: "Volume", value: String(position.volume) },
    { label: "Entry Price", value: String(position.entryPrice) },
    { label: "Close Price", value: String(position.closePrice) },
    {
      label: "P&L",
      value: `${position.pnl >= 0 ? "+" : ""}${formatCurrency(position.pnl, currency)}`,
    },
    { label: "P&L %", value: `${position.pnlPct}%` },
    { label: "Open Time", value: new Date(position.openedAt).toLocaleString() },
    { label: "Close Time", value: new Date(position.closedAt).toLocaleString() },
    { label: "Duration", value: formatDuration(position.durationMs) },
    { label: "Close Reason", value: position.closeReason },
    {
      label: "Commission",
      value: formatCurrency(position.commission, currency),
    },
    { label: "Swap", value: formatCurrency(position.swap, currency) },
  ];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Activity className="h-4 w-4 text-muted-foreground" />
        Position detail — {position.id}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {f.label}
            </dt>
            <dd className="text-xs font-medium text-foreground">{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
