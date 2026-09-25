"use client";

/**
 * Weekend Trades Page — list of trades opened or closed during weekend /
 * market-closed hours. These trades may violate challenge rules.
 *
 * Layout: informational banner → KPI row (total / long / short / profit /
 * loss / closed) → filter bar (search, symbol, direction, state, date
 * range) → dense DataTable (Account, Direction, Symbol, Volume, Profit,
 * Open Time, Close Volume, Close Time, State, RR Ratio, Hold Time) →
 * Export CSV. Row click opens an inline detail panel showing full trade
 * metadata (open / close prices, order IDs, commission, swap, SL / TP,
 * close-reason dropdown) plus Delete (AlertDialog w/ consequence) and
 * Save Changes (toast).
 *
 * Mock data: deterministic positions with weekend open/close timestamps
 * derived from getTenantPositions — every record is force-shifted to fall
 * on a Saturday or Sunday so the page is always populated. No Math.random.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantPositions,
  type Position,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { formatCurrency } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Activity,
  Filter,
  X,
  Search,
  Download,
  Save,
  Trash2,
  Info,
  ArrowLeft,
  ArrowRight,
  Trophy,
  AlertTriangle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type CloseReason = "TP" | "SL" | "Manual" | "System";

interface WeekendTrade {
  id: string;
  uid: string;
  tenantId: string;
  accountId: string;
  accountLogin: string;
  traderId: string;
  traderName: string;
  direction: "buy" | "sell";
  symbol: string;
  volume: number;
  openTime: string;
  openPrice: number;
  closeTime: string;
  closePrice: number;
  closeVolume: number;
  profit: number;
  commission: number;
  swap: number;
  sl: number; // stop-loss price
  tp: number; // take-profit price
  rrRatio: number; // risk-reward ratio
  closeReason: CloseReason;
  state: "CLOSED" | "OPEN";
  holdMs: number;
  openOrderId: string;
  closeOrderId: string;
}

const DATE_RANGES: Record<string, number> = {
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
};

const CLOSE_REASONS: CloseReason[] = ["TP", "SL", "Manual", "System"];

const BASE_SYMBOLS: Array<[string, number, number]> = [
  // symbol, base price, contract multiplier
  ["EURUSD", 1.085, 10000],
  ["GBPUSD", 1.271, 10000],
  ["USDJPY", 151.4, 1000],
  ["XAUUSD", 2348.5, 100],
  ["BTCUSD", 67250, 1],
  ["ETHUSD", 3480, 1],
  ["SP500", 5230, 1],
  ["NAS100", 18420, 1],
];

/** Deterministic pseudo-random from a seed. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999.1) * 10000;
  return x - Math.floor(x);
}

/** Return the most recent Saturday at noon UTC, offset by weeks ago. */
function saturdayAtNoon(weeksAgo: number): Date {
  const now = new Date();
  // Day-of-week: Sun=0, Sat=6
  const dayOfWeek = now.getUTCDay();
  const daysSinceSaturday = (dayOfWeek + 1) % 7; // days since last Saturday
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysSinceSaturday - weeksAgo * 7);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

/** Build a deterministic list of weekend trades from open positions. */
function buildWeekendTrades(tenantId: string): WeekendTrade[] {
  const positions = getTenantPositions(tenantId);
  const accounts = getTenantAccounts(tenantId);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  return positions.map((p: Position, idx) => {
    const [sym, basePrice, mult] = BASE_SYMBOLS[idx % BASE_SYMBOLS.length];
    const seed = idx + 1;
    const r1 = seededRandom(seed);
    const r2 = seededRandom(seed + 0.5);
    const r3 = seededRandom(seed + 1.7);
    const r4 = seededRandom(seed + 3.3);

    // Open on a Saturday morning, close on Saturday afternoon / Sunday.
    const openWeeksAgo = idx % 8;
    const openTime = saturdayAtNoon(openWeeksAgo);
    openTime.setUTCHours(11 + (idx % 4), (idx * 7) % 60, 0, 0); // Sat 11:00-14:00
    const holdHours = Math.floor(2 + r2 * 22); // 2-24 hours
    const closeTime = new Date(openTime.getTime() + holdHours * 60 * 60 * 1000);
    // If close spills past Sunday midnight, that's fine — still weekend.

    // Entry/close prices
    const entry = p.entryPrice;
    const movePct = (r1 - 0.5) * 0.03; // ±1.5%
    const close = entry * (1 + movePct);
    const pnlPerUnit = p.side === "buy" ? close - entry : entry - close;
    const volume = p.volume;
    const grossPnl = pnlPerUnit * mult * volume;
    const commission = Math.round((volume * basePrice * 0.0004) * 100) / 100;
    const swap = Math.round(Math.sin(seed) * 5 * 100) / 100;
    const profit = Math.round((grossPnl - commission - swap) * 100) / 100;

    // SL / TP prices — symmetrical ±0.5% / ±1% around entry.
    const sl = p.side === "buy" ? entry * 0.995 : entry * 1.005;
    const tp = p.side === "buy" ? entry * 1.01 : entry * 0.99;
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    const rrRatio = risk > 0 ? Math.round((reward / risk) * 100) / 100 : 0;

    // Close reason from P&L direction
    let closeReason: CloseReason;
    if (profit >= Math.abs(grossPnl) * 0.5 && profit > 0) closeReason = "TP";
    else if (profit <= -Math.abs(grossPnl) * 0.3 && profit < 0) closeReason = "SL";
    else if (r3 > 0.7) closeReason = "System";
    else closeReason = "Manual";

    const acct = accountById.get(p.accountId);
    void r4;

    return {
      id: `wt-${tenantId}-${idx + 1}`,
      uid: `wt-${tenantId}-${idx + 1}`,
      tenantId,
      accountId: p.accountId,
      accountLogin: acct?.login ?? p.accountId,
      traderId: p.traderId,
      traderName: acct?.traderName ?? "Unknown",
      direction: p.side,
      symbol: sym,
      volume,
      openTime: openTime.toISOString(),
      openPrice: Math.round(entry * 100) / 100,
      closeTime: closeTime.toISOString(),
      closePrice: Math.round(close * 100) / 100,
      closeVolume: volume, // closed-out fully
      profit,
      commission,
      swap,
      sl: Math.round(sl * 100) / 100,
      tp: Math.round(tp * 100) / 100,
      rrRatio,
      closeReason,
      state: "CLOSED" as const,
      holdMs: closeTime.getTime() - openTime.getTime(),
      openOrderId: `o-${100000 + idx * 7}`,
      closeOrderId: `c-${200000 + idx * 11}`,
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
    return `${d}d ${h % 24}h`;
  }
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatWeekday(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${weekday} ${d.toLocaleString()}`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function WeekendTradesPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const allTrades = useMemo(() => buildWeekendTrades(tid), [tid]);

  // Track in-session deletions so the "Delete" button actually removes
  // the row from the visible table (previously toast-only — the row
  // stayed in the table after the toast said "permanently removed").
  // Round 4 fix.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const liveTrades = useMemo(
    () => allTrades.filter((t) => !deletedIds.has(t.id)),
    [allTrades, deletedIds],
  );

  // Filters
  const [search, setSearch] = useState("");
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");

  // Inline detail panel — edited working copy
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [working, setWorking] = useState<Record<string, { closeReason: CloseReason }>>({});

  const symbolsAvailable = useMemo(
    () => Array.from(new Set(allTrades.map((t) => t.symbol))).sort(),
    [allTrades],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === "all" ? 0 : Date.now() - (DATE_RANGES[dateRange] ?? 0);
    return liveTrades.filter((t) => {
      if (cutoff > 0 && new Date(t.closeTime).getTime() < cutoff) return false;
      if (symbolFilter !== "all" && t.symbol !== symbolFilter) return false;
      if (directionFilter !== "all" && t.direction !== directionFilter) return false;
      if (stateFilter !== "all" && t.state !== stateFilter) return false;
      if (
        q &&
        !`${t.symbol} ${t.accountLogin} ${t.traderName} ${t.id}`.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [liveTrades, search, symbolFilter, directionFilter, stateFilter, dateRange]);

  // KPI roll-ups from the unfiltered set (use liveTrades so deleted rows
  // stop counting toward totals)
  const totalTrades = liveTrades.length;
  const longTrades = liveTrades.filter((t) => t.direction === "buy").length;
  const shortTrades = liveTrades.filter((t) => t.direction === "sell").length;
  const totalProfit = liveTrades.filter((t) => t.profit > 0).reduce((s, t) => s + t.profit, 0);
  const totalLoss = liveTrades.filter((t) => t.profit < 0).reduce((s, t) => s + t.profit, 0);
  const closedTrades = liveTrades.filter((t) => t.state === "CLOSED").length;

  const activeFilters =
    (search ? 1 : 0) +
    (symbolFilter !== "all" ? 1 : 0) +
    (directionFilter !== "all" ? 1 : 0) +
    (stateFilter !== "all" ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setSymbolFilter("all");
    setDirectionFilter("all");
    setStateFilter("all");
    setDateRange("all");
  };

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "uid", header: "UID", value: (t) => t.uid },
        { key: "login", header: "Account Login", value: (t) => t.accountLogin },
        { key: "trader", header: "Trader", value: (t) => t.traderName },
        { key: "direction", header: "Direction", value: (t) => (t.direction === "buy" ? "LONG" : "SHORT") },
        { key: "symbol", header: "Symbol", value: (t) => t.symbol },
        { key: "volume", header: "Volume", value: (t) => t.volume },
        { key: "profit", header: "Profit", value: (t) => t.profit },
        { key: "openTime", header: "Open Time", value: (t) => t.openTime },
        { key: "closeVolume", header: "Close Volume", value: (t) => t.closeVolume },
        { key: "closeTime", header: "Close Time", value: (t) => t.closeTime },
        { key: "state", header: "State", value: (t) => t.state },
        { key: "rrRatio", header: "RR Ratio", value: (t) => t.rrRatio },
        { key: "holdMs", header: "Hold Time (ms)", value: (t) => t.holdMs },
        { key: "closeReason", header: "Close Reason", value: (t) => t.closeReason },
        { key: "openOrderId", header: "Open Order ID", value: (t) => t.openOrderId },
        { key: "closeOrderId", header: "Close Order ID", value: (t) => t.closeOrderId },
      ],
      `weekend-trades-${tid}.csv`,
    );
  };

  const selectedTrade =
    selectedId != null ? filtered.find((t) => t.id === selectedId) ?? null : null;
  const workingReason =
    (selectedId && working[selectedId]?.closeReason) || selectedTrade?.closeReason || "Manual";

  const onRowClick = (t: WeekendTrade) => {
    setSelectedId((cur) => (cur === t.id ? null : t.id));
    if (selectedId !== t.id) {
      setWorking((w) => ({
        ...w,
        [t.id]: w[t.id] ?? { closeReason: t.closeReason },
      }));
      toast({
        title: "Viewing weekend trade detail",
        description: `${t.symbol} ${t.direction === "buy" ? "LONG" : "SHORT"} ${t.volume} · ${t.id}`,
      });
    }
  };

  const onChangeReason = (id: string, closeReason: CloseReason) => {
    setWorking((w) => ({ ...w, [id]: { closeReason } }));
  };

  const onSaveChanges = (t: WeekendTrade) => {
    toast({
      title: "Changes saved",
      description: `Weekend trade ${t.id} close reason updated to ${workingReason}.`,
    });
  };

  const onDelete = (t: WeekendTrade) => {
    setDeletedIds((prev) => new Set(prev).add(t.id));
    setSelectedId(null);
    toast({
      title: "Weekend trade deleted",
      description: `${t.id} (${t.symbol}) was permanently removed from the monitoring system.`,
      variant: "destructive",
    });
  };

  const columns: Column<WeekendTrade>[] = [
    {
      key: "accountLogin",
      header: "Account",
      cell: (t) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate("trader-detail", { id: t.traderId });
          }}
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {t.accountLogin}
        </button>
      ),
      sortValue: (t) => t.accountLogin,
    },
    {
      key: "direction",
      header: "Direction",
      cell: (t) => (
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold",
            t.direction === "buy"
              ? "border-emerald-500/50 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              : "border-rose-500/50 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
          )}
        >
          {t.direction === "buy" ? "LONG" : "SHORT"}
        </Badge>
      ),
      sortValue: (t) => t.direction,
      width: "80px",
    },
    {
      key: "symbol",
      header: "Symbol",
      cell: (t) => <span className="font-mono text-xs font-medium">{t.symbol}</span>,
      sortValue: (t) => t.symbol,
    },
    {
      key: "volume",
      header: "Volume",
      cell: (t) => <span className="tabular-nums text-xs">{t.volume}</span>,
      sortValue: (t) => t.volume,
      numeric: true,
      width: "70px",
    },
    {
      key: "profit",
      header: "Profit",
      cell: (t) => (
        <span
          className={cn(
            "tabular-nums text-xs font-medium",
            t.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
          )}
        >
          {t.profit >= 0 ? "+" : ""}
          {formatCurrency(t.profit, currency)}
        </span>
      ),
      sortValue: (t) => t.profit,
      numeric: true,
    },
    {
      key: "openTime",
      header: "Open Time",
      cell: (t) => (
        <span className="text-[11px] text-muted-foreground">
          {formatWeekday(t.openTime)}
        </span>
      ),
      sortValue: (t) => t.openTime,
    },
    {
      key: "closeVolume",
      header: "Close Vol",
      cell: (t) => <span className="tabular-nums text-xs">{t.closeVolume}</span>,
      sortValue: (t) => t.closeVolume,
      numeric: true,
      width: "70px",
    },
    {
      key: "closeTime",
      header: "Close Time",
      cell: (t) => (
        <span className="text-[11px] text-muted-foreground">
          {formatWeekday(t.closeTime)}
        </span>
      ),
      sortValue: (t) => t.closeTime,
    },
    {
      key: "state",
      header: "State",
      cell: (t) => (
        <Badge variant="outline" className="text-[10px] font-semibold">
          {t.state}
        </Badge>
      ),
      sortValue: (t) => t.state,
      width: "80px",
    },
    {
      key: "rrRatio",
      header: "RR Ratio",
      cell: (t) => (
        <span className="tabular-nums text-[11px] text-muted-foreground">
          1:{t.rrRatio}
        </span>
      ),
      sortValue: (t) => t.rrRatio,
      numeric: true,
      width: "70px",
    },
    {
      key: "holdMs",
      header: "Hold Time",
      cell: (t) => (
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {formatDuration(t.holdMs)}
        </span>
      ),
      sortValue: (t) => t.holdMs,
      numeric: true,
      width: "90px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Weekend Trades"
        description="Trades opened or closed during weekend / market-closed hours."
        icon={CalendarClock}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      {/* Informational banner */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This view shows trades opened or closed during weekend/market-closed hours.
            These trades may violate challenge rules. Investigate each row and remove
            legitimate exceptions only.
          </span>
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total Trades" value={totalTrades} icon={CalendarClock} />
        <MetricCard
          label="Long Trades"
          value={longTrades}
          tone="positive"
          icon={TrendingUp}
        />
        <MetricCard
          label="Short Trades"
          value={shortTrades}
          tone="negative"
          icon={TrendingDown}
        />
        <MetricCard
          label="Total Profit"
          value={formatCurrency(totalProfit, currency)}
          tone="positive"
          icon={Trophy}
        />
        <MetricCard
          label="Total Loss"
          value={formatCurrency(Math.abs(totalLoss), currency)}
          tone="negative"
          icon={AlertTriangle}
        />
        <MetricCard
          label="Closed Trades"
          value={closedTrades}
          tone="default"
          icon={Activity}
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
        <div className="relative w-full md:w-56">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol, trader, account…"
            className="h-8 pl-8 text-xs"
            aria-label="Search weekend trades"
          />
        </div>
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
        <select
          value={directionFilter}
          onChange={(e) => setDirectionFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by direction"
        >
          <option value="all">All directions</option>
          <option value="buy">Long</option>
          <option value="sell">Short</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by state"
        >
          <option value="all">All states</option>
          <option value="CLOSED">Closed</option>
          <option value="OPEN">Open</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          aria-label="Filter by date range"
        >
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="1y">Last year</option>
        </select>
        {activeFilters > 0 ? (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {allTrades.length} trades
        </span>
      </div>

      <PageContent>
        {allTrades.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No weekend trades detected"
            description="Trades opened or closed during weekend hours will appear here for review."
            hint="Weekend monitoring runs against the challenge calendar configured in Trading Events."
          />
        ) : (
          <div className="rounded-lg border bg-card">
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(t) => t.id}
              onRowClick={onRowClick}
              searchableText={(t) =>
                `${t.symbol} ${t.accountLogin} ${t.traderName} ${t.id}`
              }
              searchPlaceholder="Search trades…"
              pageSize={10}
              emptyTitle="No trades match your filters"
              emptyDescription="Adjust search, symbol, direction, or state."
            />
          </div>
        )}

        {/* Inline detail panel */}
        {selectedTrade ? (
          <WeekendTradeDetail
            trade={selectedTrade}
            currency={currency}
            closeReason={workingReason}
            onChangeReason={(r) => onChangeReason(selectedTrade.id, r)}
            onSave={() => onSaveChanges(selectedTrade)}
            onDelete={() => onDelete(selectedTrade)}
            onClose={() => setSelectedId(null)}
            onSelectTrader={(traderId) => navigate("trader-detail", { id: traderId })}
            onSelectNext={() => {
              // Pick the next visible trade after the current selection.
              const idx = filtered.findIndex((t) => t.id === selectedTrade.id);
              const next = filtered[idx + 1];
              if (next) setSelectedId(next.id);
            }}
          />
        ) : null}
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Inline detail panel                                                */
/* ------------------------------------------------------------------ */

function WeekendTradeDetail({
  trade,
  currency,
  closeReason,
  onChangeReason,
  onSave,
  onDelete,
  onClose,
  onSelectTrader,
  onSelectNext,
}: {
  trade: WeekendTrade;
  currency: string;
  closeReason: CloseReason;
  onChangeReason: (r: CloseReason) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  onSelectTrader: (traderId: string) => void;
  onSelectNext: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Weekend Trade — {trade.uid}
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={onClose}
          aria-label="Close detail"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Separator className="mb-4" />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Account</dt>
          <dd>
            <button
              type="button"
              onClick={() => onSelectTrader(trade.traderId)}
              aria-label={`Open account ${trade.accountLogin} trader detail`}
              className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {trade.accountLogin}
            </button>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">UID</dt>
          <dd className="font-mono">{trade.uid}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Direction</dt>
          <dd>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-bold",
                trade.direction === "buy"
                  ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  : "border-rose-500/40 text-rose-700 dark:text-rose-400",
              )}
            >
              {trade.direction === "buy" ? "LONG" : "SHORT"}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">State</dt>
          <dd>
            <Badge variant="outline" className="text-[10px] font-semibold">
              {trade.state}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Symbol</dt>
          <dd className="font-mono font-medium">{trade.symbol}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Volume</dt>
          <dd className="tabular-nums">{trade.volume}</dd>
        </div>

        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Open Time</dt>
          <dd className="text-muted-foreground">{formatWeekday(trade.openTime)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Open Price</dt>
          <dd className="tabular-nums">{trade.openPrice}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Close Time</dt>
          <dd className="text-muted-foreground">{formatWeekday(trade.closeTime)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Close Price</dt>
          <dd className="tabular-nums">{trade.closePrice}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Open Order</dt>
          <dd className="font-mono">{trade.openOrderId}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Close Order</dt>
          <dd className="font-mono">{trade.closeOrderId}</dd>
        </div>

        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Commission</dt>
          <dd className="tabular-nums">{formatCurrency(trade.commission, currency)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Swap</dt>
          <dd className="tabular-nums">{formatCurrency(trade.swap, currency)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">SL (Stop Loss)</dt>
          <dd className="tabular-nums">{trade.sl}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">TP (Take Profit)</dt>
          <dd className="tabular-nums">{trade.tp}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">RR Ratio</dt>
          <dd className="tabular-nums">1:{trade.rrRatio}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Hold Time</dt>
          <dd className="tabular-nums">{formatDuration(trade.holdMs)}</dd>
        </div>
      </dl>

      <Separator className="my-4" />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wt-closeReason">Close Reason</Label>
          <Select value={closeReason} onValueChange={(v) => onChangeReason(v as CloseReason)}>
            <SelectTrigger id="wt-closeReason" className="w-full">
              <SelectValue placeholder="Select close reason…" />
            </SelectTrigger>
            <SelectContent>
              {CLOSE_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r === "TP"
                    ? "Take Profit"
                    : r === "SL"
                      ? "Stop Loss"
                      : r === "Manual"
                        ? "Manual"
                        : "System"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Profit</Label>
          <div
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium tabular-nums",
              trade.profit >= 0
                ? "border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "border-rose-500/40 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
            )}
          >
            {trade.profit >= 0 ? "+" : ""}
            {formatCurrency(trade.profit, currency)}
          </div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Delete Weekend Trade
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete weekend trade?</AlertDialogTitle>
              <AlertDialogDescription>
                This trade record will be permanently deleted from the weekend monitoring
                system. The underlying broker record is not affected — only the local
                weekend-monitoring entry. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <Button size="sm" onClick={onSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Save Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onSelectNext}
            className="gap-1"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}


