"use client";

/**
 * Copy Trading Events Page — list detected copy-trading event pairs with
 * create/edit inline form (UX Constitution §12, §25-27).
 *
 * Each event links two open positions whose open/close timestamps align
 * within a small delta — strong evidence of copy trading across accounts.
 *
 * Layout: KPI row → filter bar (search, symbol, date range, export) →
 * DataTable (selection checkbox + position pairs + time deltas + accounts
 * + Expired switch). "Add Copy Trading Event" reveals an inline form panel
 * (Position 1 dropdown, Position 2 dropdown, reasons textarea, Expired
 * toggle, Save / Save & continue editing / Cancel).
 *
 * Mock data: deterministic pairs derived from getTenantPositions so the
 * same tenant always shows the same events. No Math.random — index seeds.
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
import { Textarea } from "@/components/ui/textarea";
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
  Copy,
  Plus,
  Download,
  Filter,
  X,
  Save,
  Search,
  ShieldAlert,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

interface CopyEvent {
  id: string;
  tenantId: string;
  position1Id: string;
  position2Id: string;
  symbol: string;
  side1: "buy" | "sell";
  side2: "buy" | "sell";
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
  reasons: string;
}

const DATE_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

/** Deterministic time delta in seconds from a seed index. */
function deltaFromIndex(i: number): number {
  const cycle = [2, 5, 11, 23, 47, 91, 137, 213];
  return cycle[i % cycle.length];
}

/** Build a deterministic list of copy-trading event pairs from positions. */
function buildCopyEvents(tenantId: string): CopyEvent[] {
  const positions = getTenantPositions(tenantId);
  const accounts = getTenantAccounts(tenantId);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  if (positions.length < 2) return [];

  // Pair positions sequentially: (0,1), (2,3), (4,5), … when symbols match.
  const pairs: Array<[Position, Position]> = [];
  for (let i = 0; i + 1 < positions.length; i += 2) {
    const a = positions[i];
    const b = positions[i + 1];
    // Use the same symbol for both sides (typical copy pattern); pick from a.
    pairs.push([a, b]);
  }

  const now = Date.now();
  return pairs.map(([p1, p2], idx) => {
    const acct1 = accountById.get(p1.accountId);
    const acct2 = accountById.get(p2.accountId);
    const openDelta = deltaFromIndex(idx);
    const closeDelta = deltaFromIndex(idx + 3);
    const createdAtMs =
      now - ((idx % 14) + 1) * 24 * 60 * 60 * 1000 - (idx % 7) * 60 * 60 * 1000;
    return {
      id: `cte-${tenantId}-${idx + 1}`,
      tenantId,
      position1Id: p1.id,
      position2Id: p2.id,
      symbol: p1.symbol,
      side1: p1.side,
      side2: p2.side,
      accountLogin1: acct1?.login ?? p1.accountId,
      accountLogin2: acct2?.login ?? p2.accountId,
      accountId1: p1.accountId,
      accountId2: p2.accountId,
      traderId1: p1.traderId,
      traderId2: p2.traderId,
      openTimeDeltaSec: openDelta,
      closeTimeDeltaSec: closeDelta,
      // Alternate expired state deterministically — about 1 in 4 expired.
      expired: idx % 4 === 3,
      createdAt: new Date(createdAtMs).toISOString(),
      reasons: `Synchronized open/close timing on ${p1.symbol}; ${openDelta}s open delta; ${closeDelta}s close delta; both accounts share identical volume profile.`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function DirectionBadge({ side }: { side: "buy" | "sell" }) {
  const isLong = side === "buy";
  return (
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
  );
}

function formatDelta(seconds: number): string {
  if (seconds < 60) return `+${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `+${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `+${h}h ${m % 60}m`;
}

function PositionCell({
  side,
  symbol,
  login,
}: {
  side: "buy" | "sell";
  symbol: string;
  login: string;
}) {
  return (
    <div className="flex items-center">
      <DirectionBadge side={side} />
      <div className="min-w-0 leading-tight">
        <p className="truncate font-mono text-xs font-medium">{symbol}</p>
        <p className="truncate text-[10px] text-muted-foreground">#{login}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function CopyTradingEventsPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";

  const allEvents = useMemo(() => buildCopyEvents(tid), [tid]);
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

  // Add-event form state
  const [showForm, setShowForm] = useState(false);
  const [formPosition1, setFormPosition1] = useState<string>("");
  const [formPosition2, setFormPosition2] = useState<string>("");
  const [formReasons, setFormReasons] = useState("");
  const [formExpired, setFormExpired] = useState(false);
  // Track in-session Expired overrides so the Switch visually flips when
  // toggled. Previously the Switch read `e.expired` from static seed —
  // toggling fired a toast but the Switch visually bounced back. The
  // effective state is `e.expired XOR toggled.has(e.id)`.
  const [expiredToggles, setExpiredToggles] = useState<Set<string>>(new Set());
  const isExpired = (e: CopyEvent) => e.expired !== expiredToggles.has(e.id);
  const toggleExpired = (e: CopyEvent) => {
    setExpiredToggles((prev) => {
      const next = new Set(prev);
      if (next.has(e.id)) next.delete(e.id);
      else next.add(e.id);
      return next;
    });
    toast({
      title: isExpired(e) ? "Event expired" : "Event re-activated",
      description: `Copy trading event ${e.id} marked as ${isExpired(e) ? "expired" : "active"} (demo).`,
    });
  };

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

  // KPI roll-ups — computed from the unfiltered set so the headline numbers
  // stay stable when filters narrow the table.
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

  // Selection handlers
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
        { key: "side1", header: "Direction 1", value: (e) => (e.side1 === "buy" ? "Long" : "Short") },
        { key: "side2", header: "Direction 2", value: (e) => (e.side2 === "buy" ? "Long" : "Short") },
        { key: "login1", header: "Account 1 Login", value: (e) => e.accountLogin1 },
        { key: "login2", header: "Account 2 Login", value: (e) => e.accountLogin2 },
        { key: "openDelta", header: "Open Time Delta (s)", value: (e) => e.openTimeDeltaSec },
        { key: "closeDelta", header: "Close Time Delta (s)", value: (e) => e.closeTimeDeltaSec },
        { key: "expired", header: "Expired", value: (e) => (e.expired ? "Yes" : "No") },
        { key: "createdAt", header: "Created", value: (e) => e.createdAt },
      ],
      `copy-trading-events-${tid}.csv`,
    );
  };

  const resetForm = () => {
    setFormPosition1("");
    setFormPosition2("");
    setFormReasons("");
    setFormExpired(false);
  };

  const onSave = (continueEditing: boolean) => {
    if (!formPosition1 || !formPosition2) {
      toast({
        title: "Both positions required",
        description: "Select position 1 and position 2 before saving.",
        variant: "destructive",
      });
      return;
    }
    if (formPosition1 === formPosition2) {
      toast({
        title: "Positions must differ",
        description: "Pick two distinct positions for a copy trading event.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: continueEditing ? "Event saved" : "Event created",
      description: continueEditing
        ? "Saved. You can keep editing this event."
        : "Copy trading event created and added to the list.",
    });
    if (!continueEditing) {
      setShowForm(false);
      resetForm();
    }
  };

  const positionLabel = (p: Position): string => {
    const acct = accountById.get(p.accountId);
    const login = acct?.login ?? p.accountId;
    return `${p.side === "buy" ? "Long" : "Short"} ${p.symbol} #${login}`;
  };

  const columns: Column<CopyEvent>[] = [
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
      key: "position1",
      header: "Position 1",
      cell: (e) => (
        <PositionCell side={e.side1} symbol={e.symbol} login={e.accountLogin1} />
      ),
      sortValue: (e) => `${e.symbol}-${e.accountLogin1}`,
    },
    {
      key: "position2",
      header: "Position 2",
      cell: (e) => (
        <PositionCell side={e.side2} symbol={e.symbol} login={e.accountLogin2} />
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
        title="Copy Trading Events"
        description="Detected synchronized trading patterns between accounts."
        icon={Copy}
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
              <Plus className="h-4 w-4" /> Add Copy Trading Event
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total Events" value={totalEvents} icon={Copy} />
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
              Add Copy Trading Event
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
              <Label htmlFor="cte-pos1">Position 1</Label>
              <Select
                value={formPosition1}
                onValueChange={setFormPosition1}
              >
                <SelectTrigger id="cte-pos1" className="w-full">
                  <SelectValue placeholder="Select open position…" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {positionLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cte-pos2">Position 2</Label>
              <Select
                value={formPosition2}
                onValueChange={setFormPosition2}
              >
                <SelectTrigger id="cte-pos2" className="w-full">
                  <SelectValue placeholder="Select open position…" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {positionLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="cte-reasons">Reasons</Label>
            <Textarea
              id="cte-reasons"
              rows={3}
              value={formReasons}
              onChange={(e) => setFormReasons(e.target.value)}
              placeholder="Why is this flagged as a copy trading event? E.g. synchronized timing, identical volume, mirrored direction."
            />
          </div>
          <div className="mt-4 flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="cte-expired" className="cursor-pointer text-sm font-medium">
                Expired
              </Label>
              <span className="text-xs text-muted-foreground">
                Mark this event as expired so it stops contributing to active flags.
              </span>
            </div>
            <Switch
              id="cte-expired"
              checked={formExpired}
              onCheckedChange={setFormExpired}
            />
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
            <Button size="sm" variant="outline" onClick={() => onSave(true)}>
              <Save className="h-3.5 w-3.5" /> Save and continue editing
            </Button>
            <Button size="sm" onClick={() => onSave(false)}>
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
            title="No copy trading events detected"
            description="When synchronized positions are detected across two or more accounts, the event pairs appear here."
            hint="Open positions need at least 2 entries to form a pair."
          />
        ) : (
          <div className="rounded-lg border bg-card">
            {/* Header checkbox strip */}
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
                  title: "Viewing copy trading event detail",
                  description: `${e.symbol} · ${e.accountLogin1} ↔ ${e.accountLogin2} · open Δ ${formatDelta(e.openTimeDeltaSec)}`,
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
          Account links open the trader detail view. Switch the Expired toggle to retire
          an event without deleting it.
        </p>
      </PageContent>
    </Page>
  );
}
