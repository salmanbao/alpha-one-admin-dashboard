"use client";

/**
 * Inverse Trading Events Page — list detected inverse / hedging trade
 * pairs across accounts with create/edit inline form.
 *
 * An inverse trading event links a BUY position on one account with a SELL
 * position on another (often with matched volume) — strong evidence of
 * hedge-trading or A-book / B-book exploitation across linked accounts.
 *
 * Layout: KPI row → filter bar (search, symbol, date range, export) →
 * DataTable (selection checkbox + Buy/Sell position columns + time
 * deltas + accounts + Expired switch). "Add Inverse Trading Event"
 * reveals an inline form (Buy Position dropdown filtered to longs,
 * Sell Position dropdown filtered to shorts, Save / Cancel).
 *
 * Mock data: deterministic Buy/Sell pairs derived from getTenantPositions.
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { cn } from "@/lib/utils";
import {
  Repeat,
  Plus,
  Download,
  Filter,
  X,
  Save,
  Search,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

interface InverseEvent {
  id: string;
  tenantId: string;
  buyPositionId: string;
  sellPositionId: string;
  symbol: string;
  accountLogin1: string;
  accountLogin2: string;
  accountId1: string;
  accountId2: string;
  traderId1: string;
  traderId2: string;
  openTimeDeltaSec: number;
  closeTimeDeltaSec: number;
  expired: boolean;
  createdAt: string;
}

const DATE_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

function deltaFromIndex(i: number): number {
  const cycle = [3, 7, 13, 19, 29, 41, 53, 67];
  return cycle[i % cycle.length];
}

/**
 * Build a deterministic list of inverse trading events by pairing the
 * first available BUY position with the next SELL position. Falls back
 * to a synthetic short if needed so the demo always has data.
 */
function buildInverseEvents(tenantId: string): InverseEvent[] {
  const positions = getTenantPositions(tenantId);
  const accounts = getTenantAccounts(tenantId);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const longs = positions.filter((p) => p.side === "buy");
  const shorts = positions.filter((p) => p.side === "sell");

  // Pair longs and shorts index-by-index; if shorts run out, synthesize
  // a mirrored short position from the same long.
  const pairs: Array<[Position, Position]> = [];
  const maxPairs = Math.max(longs.length, shorts.length, 1);
  for (let i = 0; i < maxPairs; i++) {
    const long = longs[i % longs.length];
    const short = shorts[i % Math.max(shorts.length, 1)] ?? {
      ...long,
      id: `${long.id}-mirror`,
      side: "sell" as const,
    };
    if (longs.length === 0) continue;
    pairs.push([long, short]);
  }

  const now = Date.now();
  return pairs.slice(0, 12).map(([buyPos, sellPos], idx) => {
    const acct1 = accountById.get(buyPos.accountId);
    const acct2 = accountById.get(sellPos.accountId);
    const openDelta = deltaFromIndex(idx);
    const closeDelta = deltaFromIndex(idx + 4);
    const createdAtMs =
      now - ((idx % 12) + 1) * 24 * 60 * 60 * 1000 - (idx % 9) * 60 * 60 * 1000;
    return {
      id: `ite-${tenantId}-${idx + 1}`,
      tenantId,
      buyPositionId: buyPos.id,
      sellPositionId: sellPos.id,
      symbol: buyPos.symbol,
      accountLogin1: acct1?.login ?? buyPos.accountId,
      accountLogin2: acct2?.login ?? sellPos.accountId,
      accountId1: buyPos.accountId,
      accountId2: sellPos.accountId,
      traderId1: buyPos.traderId,
      traderId2: sellPos.traderId,
      openTimeDeltaSec: openDelta,
      closeTimeDeltaSec: closeDelta,
      // About 1 in 5 expired.
      expired: idx % 5 === 4,
      createdAt: new Date(createdAtMs).toISOString(),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDelta(seconds: number): string {
  if (seconds < 60) return `+${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `+${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `+${h}h ${m % 60}m`;
}

function PositionBadge({
  side,
  symbol,
  login,
}: {
  side: "buy" | "sell";
  symbol: string;
  login: string;
}) {
  const isLong = side === "buy";
  return (
    <div className="flex items-center">
      <Badge
        variant="outline"
        className={cn(
          "mr-1.5 text-[10px] font-semibold",
          isLong
            ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
            : "border-rose-500/40 text-rose-700 dark:text-rose-400",
        )}
      >
        {isLong ? "Long" : "Short"}
      </Badge>
      <div className="min-w-0 leading-tight">
        <p className="truncate font-mono text-xs font-medium">{symbol}</p>
        <p className="truncate text-[10px] text-muted-foreground">#{login}</p>
      </div>
    </div>
  );
}

function formatPositionLabel(p: Position, accountById: Map<string, { login: string }>): string {
  const login = accountById.get(p.accountId)?.login ?? p.accountId;
  return `${p.side === "buy" ? "Long" : "Short"} ${p.symbol} #${login}`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function InverseTradingEventsPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const allEvents = useMemo(() => buildInverseEvents(tid), [tid]);
  const positions = useMemo(() => getTenantPositions(tid), [tid]);
  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  // Filters
  const [search, setSearch] = useState("");
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Track in-session Expired overrides so the Switch visually flips when
  // toggled (previously bounced back to the seed value on next render).
  // The effective state is `e.expired XOR toggled.has(e.id)`.
  const [expiredToggles, setExpiredToggles] = useState<Set<string>>(new Set());
  const isExpired = (e: InverseEvent) => e.expired !== expiredToggles.has(e.id);
  const toggleExpired = (e: InverseEvent) => {
    setExpiredToggles((prev) => {
      const next = new Set(prev);
      if (next.has(e.id)) next.delete(e.id);
      else next.add(e.id);
      return next;
    });
    toast({
      title: isExpired(e) ? "Event expired" : "Event re-activated",
      description: `Inverse trading event ${e.id} marked as ${isExpired(e) ? "expired" : "active"} (demo).`,
    });
  };

  // Add-event form state
  const [showForm, setShowForm] = useState(false);
  const [formBuyId, setFormBuyId] = useState<string>("");
  const [formSellId, setFormSellId] = useState<string>("");

  const longPositions = useMemo(
    () => positions.filter((p) => p.side === "buy"),
    [positions],
  );
  const shortPositions = useMemo(
    () => positions.filter((p) => p.side === "sell"),
    [positions],
  );

  const symbolsAvailable = useMemo(
    () => Array.from(new Set(allEvents.map((e) => e.symbol))).sort(),
    [allEvents],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoff = dateRange === "all" ? 0 : Date.now() - (DATE_RANGES[dateRange] ?? 0);
    return allEvents.filter((e) => {
      if (cutoff > 0 && new Date(e.createdAt).getTime() < cutoff) return false;
      if (symbolFilter !== "all" && e.symbol !== symbolFilter) return false;
      if (
        q &&
        !`${e.symbol} ${e.accountLogin1} ${e.accountLogin2} ${e.id}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  }, [allEvents, search, symbolFilter, dateRange]);

  // KPI roll-ups from unfiltered set
  const totalEvents = allEvents.length;
  const activeEvents = allEvents.filter((e) => !e.expired).length;
  const expiredEvents = allEvents.filter((e) => e.expired).length;
  const accountsFlagged = new Set(
    allEvents.flatMap((e) => [e.accountId1, e.accountId2]),
  ).size;

  const activeFilters =
    (search ? 1 : 0) +
    (symbolFilter !== "all" ? 1 : 0) +
    (dateRange !== "all" ? 1 : 0);
  const clearFilters = () => {
    setSearch("");
    setSymbolFilter("all");
    setDateRange("all");
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map((e) => e.id)));
    else setSelected(new Set());
  };
  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const allChecked =
    filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const someChecked = filtered.some((e) => selected.has(e.id)) && !allChecked;

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "Event ID", value: (e) => e.id },
        { key: "symbol", header: "Symbol", value: (e) => e.symbol },
        { key: "login1", header: "Buy Account Login", value: (e) => e.accountLogin1 },
        { key: "login2", header: "Sell Account Login", value: (e) => e.accountLogin2 },
        { key: "openDelta", header: "Open Time Delta (s)", value: (e) => e.openTimeDeltaSec },
        { key: "closeDelta", header: "Close Time Delta (s)", value: (e) => e.closeTimeDeltaSec },
        { key: "expired", header: "Expired", value: (e) => (e.expired ? "Yes" : "No") },
        { key: "createdAt", header: "Created", value: (e) => e.createdAt },
      ],
      `inverse-trading-events-${tid}.csv`,
    );
  };

  const resetForm = () => {
    setFormBuyId("");
    setFormSellId("");
  };

  const onSave = () => {
    if (!formBuyId || !formSellId) {
      toast({
        title: "Both positions required",
        description: "Select both a buy position and a sell position before saving.",
        variant: "destructive",
      });
      return;
    }
    if (formBuyId === formSellId) {
      toast({
        title: "Positions must differ",
        description: "Pick distinct positions for the inverse trading event.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Event saved",
      description: "Inverse trading event created and added to the list.",
    });
    setShowForm(false);
    resetForm();
  };

  const columns: Column<InverseEvent>[] = [
    {
      key: "select",
      header: "",
      cell: (e) => (
        <Checkbox
          checked={selected.has(e.id)}
          onCheckedChange={(checked) => toggleSelectOne(e.id, checked === true)}
          onClick={(ev) => ev.stopPropagation()}
          aria-label={`Select event ${e.id}`}
        />
      ),
      width: "36px",
    },
    {
      key: "buy",
      header: "Buy Position",
      cell: (e) => (
        <PositionBadge side="buy" symbol={e.symbol} login={e.accountLogin1} />
      ),
      sortValue: (e) => `${e.symbol}-${e.accountLogin1}`,
    },
    {
      key: "sell",
      header: "Sell Position",
      cell: (e) => (
        <PositionBadge side="sell" symbol={e.symbol} login={e.accountLogin2} />
      ),
      sortValue: (e) => `${e.symbol}-${e.accountLogin2}`,
    },
    {
      key: "openDelta",
      header: "Open Δ",
      cell: (e) => (
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {formatDelta(e.openTimeDeltaSec)}
        </span>
      ),
      sortValue: (e) => e.openTimeDeltaSec,
      numeric: true,
      width: "90px",
    },
    {
      key: "closeDelta",
      header: "Close Δ",
      cell: (e) => (
        <span className="tabular-nums text-[11px] text-muted-foreground">
          {formatDelta(e.closeTimeDeltaSec)}
        </span>
      ),
      sortValue: (e) => e.closeTimeDeltaSec,
      numeric: true,
      width: "90px",
    },
    {
      key: "account1",
      header: "Account 1",
      cell: (e) => (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            navigate("trader-detail", { id: e.traderId1 });
          }}
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {e.accountLogin1}
        </button>
      ),
      sortValue: (e) => e.accountLogin1,
    },
    {
      key: "account2",
      header: "Account 2",
      cell: (e) => (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            navigate("trader-detail", { id: e.traderId2 });
          }}
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          {e.accountLogin2}
        </button>
      ),
      sortValue: (e) => e.accountLogin2,
    },
    {
      key: "expired",
      header: "Expired",
      cell: (e) => (
        <Switch
          checked={isExpired(e)}
          onCheckedChange={() => toggleExpired(e)}
          onClick={(ev) => ev.stopPropagation()}
          aria-label={`Toggle expired for ${e.id}`}
        />
      ),
      width: "80px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Inverse Trading Events"
        description="Detected hedging / inverse position patterns across accounts."
        icon={Repeat}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowForm((v) => !v);
                if (!showForm) resetForm();
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add Inverse Trading Event
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total Events" value={totalEvents} icon={Repeat} />
        <MetricCard
          label="Active"
          value={activeEvents}
          tone="positive"
          icon={CheckCircle2}
        />
        <MetricCard
          label="Expired"
          value={expiredEvents}
          tone={expiredEvents > 0 ? "warning" : "default"}
          icon={Clock}
        />
        <MetricCard
          label="Accounts Flagged"
          value={accountsFlagged}
          tone={accountsFlagged > 0 ? "negative" : "default"}
          icon={Users}
        />
      </div>

      {/* Inline add form (progressive disclosure §12) */}
      {showForm ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Plus className="h-4 w-4 text-muted-foreground" />
              Add Inverse Trading Event
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setShowForm(false)}
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Separator className="mb-4" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ite-buy">Buy Position</Label>
              <Select value={formBuyId} onValueChange={setFormBuyId}>
                <SelectTrigger id="ite-buy" className="w-full">
                  <SelectValue placeholder="Select open long position…" />
                </SelectTrigger>
                <SelectContent>
                  {longPositions.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No long positions available
                    </SelectItem>
                  ) : (
                    longPositions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatPositionLabel(p, accountById)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ite-sell">Sell Position</Label>
              <Select value={formSellId} onValueChange={setFormSellId}>
                <SelectTrigger id="ite-sell" className="w-full">
                  <SelectValue placeholder="Select open short position…" />
                </SelectTrigger>
                <SelectContent>
                  {shortPositions.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No short positions available
                    </SelectItem>
                  ) : (
                    shortPositions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatPositionLabel(p, accountById)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                resetForm();
                toast({ title: "Cancelled", description: "Add-event form closed." });
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={onSave}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      ) : null}

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
            placeholder="Search symbol or account…"
            className="h-8 pl-8 text-xs"
            aria-label="Search events"
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
        {activeFilters > 0 ? (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {allEvents.length} events
        </span>
      </div>

      <PageContent>
        {selected.size > 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs dark:bg-emerald-950/30">
            <ShieldAlert className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <span className="font-medium text-emerald-800 dark:text-emerald-300">
              {selected.size} selected
            </span>
            <span className="text-muted-foreground">·</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              onClick={() => {
                toast({
                  title: "Bulk action queued",
                  description: `Marking ${selected.size} events as expired.`,
                });
                setSelected(new Set());
              }}
            >
              Expire selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-[11px]"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        ) : null}

        {allEvents.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No inverse trading events detected"
            description="When a buy position on one account is matched by a sell position on another, the pair appears here."
            hint="Open positions need both long and short entries to form an event."
          />
        ) : (
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
              <Checkbox
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={(v) => toggleSelectAll(v === true)}
                aria-label="Select all events"
              />
              <span>
                {selected.size > 0
                  ? `${selected.size} of ${filtered.length} selected`
                  : `Select all (${filtered.length})`}
              </span>
            </div>
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(e) => e.id}
              onRowClick={(e) =>
                toast({
                  title: "Viewing inverse trading event detail",
                  description: `${e.symbol} · Buy ${e.accountLogin1} ↔ Sell ${e.accountLogin2} · open Δ ${formatDelta(e.openTimeDeltaSec)}`,
                })
              }
              searchableText={(e) => `${e.symbol} ${e.accountLogin1} ${e.accountLogin2} ${e.id}`}
              searchPlaceholder="Search events…"
              pageSize={10}
              emptyTitle="No events match your filters"
              emptyDescription="Adjust search, symbol, or date range."
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          An inverse trading event pairs a Long position with a Short position across two accounts —
          a common indicator of hedge trading or coordinated A/B-book exploitation.
        </p>
      </PageContent>
    </Page>
  );
}
