"use client";

/**
 * Risk — Unprofitable Countries Page
 *
 * Shows countries where total payouts exceed total revenue (i.e. the firm is
 * losing money on traders from those regions). Used by risk operators to
 * tighten payout rules, raise KYC thresholds, or block specific regions.
 *
 * Layout: KPI row → filter bar (date range, search, export) → sortable
 * DataTable with revenue-loss highlighted in rose.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantPayouts,
  getTenantTraders,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { cn } from "@/lib/utils";
import {
  Globe,
  TrendingDown,
  AlertTriangle,
  Download,
  Search,
  X,
  Filter,
} from "lucide-react";

const DATE_RANGES: Record<string, number> = {
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
  all: 0,
};

interface CountryRow {
  countryCode: string;
  traders: number;
  totalPayouts: number;
  totalRevenue: number;
  revenueLoss: number;
  lossPct: number;
}

/** Approximate revenue per trader (challenge entry-fee baseline). */
const REVENUE_PER_TRADER = 220;

export function RiskUnprofitableCountriesPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const traders = useMemo(() => getTenantTraders(tid), [tid]);
  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);

  const [range, setRange] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Filter payouts by selected date range.
  const cutoff = useMemo(() => Date.now() - (DATE_RANGES[range] ?? 0), [range]);
  const rangedPayouts = useMemo(
    () => payouts.filter((p) => new Date(p.createdAt).getTime() >= cutoff),
    [payouts, cutoff],
  );

  // Aggregate per-country totals.
  const allRows = useMemo<CountryRow[]>(() => {
    const map = new Map<string, CountryRow>();
    for (const t of traders) {
      if (!map.has(t.country)) {
        map.set(t.country, {
          countryCode: t.country,
          traders: 0,
          totalPayouts: 0,
          totalRevenue: 0,
          revenueLoss: 0,
          lossPct: 0,
        });
      }
      const row = map.get(t.country)!;
      row.traders += 1;
      row.totalRevenue += REVENUE_PER_TRADER;
    }
    for (const p of rangedPayouts) {
      const tr = traders.find((t) => t.id === p.traderId);
      const cc = tr?.country ?? "??";
      if (!map.has(cc)) {
        map.set(cc, {
          countryCode: cc,
          traders: 0,
          totalPayouts: 0,
          totalRevenue: 0,
          revenueLoss: 0,
          lossPct: 0,
        });
      }
      map.get(cc)!.totalPayouts += p.amount;
    }
    for (const row of map.values()) {
      row.revenueLoss = row.totalRevenue - row.totalPayouts;
      row.lossPct =
        row.totalRevenue > 0
          ? Math.round((row.revenueLoss / row.totalRevenue) * 1000) / 10
          : 0;
    }
    // Sort by revenue loss ascending — worst (most negative) first.
    return Array.from(map.values()).sort((a, b) => a.revenueLoss - b.revenueLoss);
  }, [traders, rangedPayouts]);

  // Only show countries that are actually unprofitable (loss > 0 payout ratio).
  const unprofitable = useMemo(
    () => allRows.filter((r) => r.revenueLoss < 0),
    [allRows],
  );

  // Apply search on top of the unprofitable set.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return unprofitable;
    return unprofitable.filter((r) => r.countryCode.toLowerCase().includes(q));
  }, [unprofitable, search]);

  // KPI totals — computed from the unprofitable set (post-search excluded so
  // that headline numbers stay stable regardless of search).
  const totalUnprofitable = unprofitable.length;
  const totalRevenueLoss = unprofitable.reduce((s, r) => s + r.revenueLoss, 0);
  const worstCountry = unprofitable[0]?.countryCode ?? "—";

  const columns: Column<CountryRow>[] = [
    {
      key: "countryCode",
      header: "Country",
      cell: (r) => (
        <span className="inline-flex items-center gap-2 font-medium">
          <Badge variant="outline" className="font-mono text-[10px]">
            {r.countryCode}
          </Badge>
        </span>
      ),
      sortValue: (r) => r.countryCode,
    },
    {
      key: "traders",
      header: "Total Traders",
      cell: (r) => r.traders,
      sortValue: (r) => r.traders,
      numeric: true,
    },
    {
      key: "totalPayouts",
      header: "Total Payouts",
      cell: (r) => formatCurrency(r.totalPayouts, currency),
      sortValue: (r) => r.totalPayouts,
      numeric: true,
    },
    {
      key: "totalRevenue",
      header: "Total Revenue",
      cell: (r) => formatCurrency(r.totalRevenue, currency),
      sortValue: (r) => r.totalRevenue,
      numeric: true,
    },
    {
      key: "revenueLoss",
      header: "Revenue Loss",
      cell: (r) => (
        <span
          className={cn(
            "font-medium tabular-nums",
            r.revenueLoss < 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {r.revenueLoss < 0 ? "−" : ""}
          {formatCurrency(Math.abs(r.revenueLoss), currency)}
        </span>
      ),
      sortValue: (r) => r.revenueLoss,
      numeric: true,
    },
    {
      key: "lossPct",
      header: "Loss %",
      cell: (r) => (
        <Badge
          variant="outline"
          className={cn(
            "tabular-nums",
            r.lossPct < 0
              ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
              : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
          )}
        >
          {r.lossPct}%
        </Badge>
      ),
      sortValue: (r) => r.lossPct,
      numeric: true,
    },
  ];

  const exportCsv = () => {
    exportToCsv(
      filtered,
      [
        { key: "countryCode", header: "Country", value: (r: CountryRow) => r.countryCode },
        { key: "traders", header: "Traders", value: (r) => r.traders },
        { key: "totalRevenue", header: "Total Revenue", value: (r) => r.totalRevenue },
        { key: "totalPayouts", header: "Total Payouts", value: (r) => r.totalPayouts },
        { key: "revenueLoss", header: "Revenue Loss", value: (r) => r.revenueLoss },
        { key: "lossPct", header: "Loss %", value: (r) => r.lossPct },
      ],
      `risk-unprofitable-countries-${Date.now()}.csv`,
    );
    toast({
      title: "Export complete",
      description: `Exported ${filtered.length} country rows to CSV.`,
    });
  };

  const activeFilters = (range !== "all" ? 1 : 0) + (search ? 1 : 0);
  const clearFilters = () => {
    setRange("all");
    setSearch("");
  };

  return (
    <Page>
      <PageHeader
        title="Unprofitable Countries"
        description="Regions where total payouts exceed total revenue."
        icon={Globe}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <MetricCard
            label="Unprofitable Countries"
            value={totalUnprofitable}
            icon={Globe}
            tone={totalUnprofitable > 0 ? "warning" : "positive"}
          />
          <MetricCard
            label="Total Revenue Loss"
            value={totalRevenueLoss < 0 ? `−${formatCurrency(Math.abs(totalRevenueLoss), currency)}` : formatCurrency(totalRevenueLoss, currency)}
            icon={TrendingDown}
            tone={totalRevenueLoss < 0 ? "negative" : "positive"}
          />
          <MetricCard
            label="Worst Performing"
            value={worstCountry}
            icon={AlertTriangle}
            tone={worstCountry !== "—" ? "negative" : "positive"}
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
              placeholder="Search country code…"
              className="h-8 pl-8 text-xs"
              aria-label="Search countries"
            />
          </div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Date range"
          >
            <option value="all">All time</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          {activeFilters > 0 ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 text-xs"
              onClick={clearFilters}
            >
              <X className="h-3 w-3" /> Clear
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {allRows.length} countries
          </span>
        </div>

        {/* Countries table */}
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.countryCode}
            pageSize={10}
            emptyTitle="No unprofitable countries found"
            emptyDescription="When payouts exceed revenue by region, the affected countries appear here."
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Revenue is approximated at {formatCurrency(REVENUE_PER_TRADER, currency)} per
          trader (challenge entry-fee baseline). Revenue loss = revenue − payouts.
        </p>
      </PageContent>
    </Page>
  );
}
