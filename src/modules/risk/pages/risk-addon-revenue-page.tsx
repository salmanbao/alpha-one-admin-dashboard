"use client";

/**
 * Risk — Add-on Revenue Page
 *
 * Revenue from add-on purchases (extra services that traders buy during
 * checkout, e.g. retry credits, express KYC, profit boost, account reset).
 *
 * Includes:
 *   - KPI row: Total Add-ons, Total Orders, Total Units, Total Revenue
 *   - Search + date range + Export CSV
 *   - Empty state with helpful hint when no add-ons have been sold
 *
 * Terra palette — emerald/amber/rose, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTraders } from "@/lib/platform/mock-data";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
} from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import {
  PackagePlus,
  ShoppingCart,
  Boxes,
  Wallet,
  Download,
  Search,
  Calendar,
  Zap,
  ShieldCheck,
  TrendingUp,
  RotateCcw,
  Gift,
} from "lucide-react";

type DateRange = "7d" | "30d" | "90d" | "ytd";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
];

/** Catalogue of purchasable add-ons. */
interface AddonDef {
  id: string;
  name: string;
  unitPrice: number;
  icon: React.ComponentType<{ className?: string }>;
}

const ADDONS: AddonDef[] = [
  { id: "addon-1", name: "Challenge Retry Credit", unitPrice: 25, icon: RotateCcw },
  { id: "addon-2", name: "Express KYC Verification", unitPrice: 15, icon: ShieldCheck },
  { id: "addon-3", name: "Profit Boost (90/10 Split)", unitPrice: 45, icon: TrendingUp },
  { id: "addon-4", name: "Account Reset Token", unitPrice: 35, icon: Zap },
  { id: "addon-5", name: "Priority Payout Processing", unitPrice: 20, icon: Wallet },
  { id: "addon-6", name: "Welcome Bonus Pack", unitPrice: 10, icon: Gift },
];

interface AddonRow {
  id: string;
  name: string;
  orders: number;
  unitsSold: number;
  unitPrice: number;
  estimatedRevenue: number;
  icon: React.ComponentType<{ className?: string }>;
}

export function RiskAddonRevenuePage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const traders = useMemo(() => getTenantTraders(tid), [tid]);

  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [showEmptyState, setShowEmptyState] = useState(false);

  // Date cutoff
  const cutoff = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    switch (dateRange) {
      case "7d": return now - 7 * dayMs;
      case "30d": return now - 30 * dayMs;
      case "90d": return now - 90 * dayMs;
      case "ytd": return new Date(new Date().getFullYear(), 0, 1).getTime();
    }
  }, [dateRange]);

  // Build add-on rows — distribute purchases deterministically across traders.
  const rows = useMemo<AddonRow[]>(() => {
    // Only traders created after cutoff are eligible to "buy" add-ons in this window.
    // For demo, use the trader id hash to pick add-ons for ~60% of traders.
    // Round 7 fix: removed `|| true` no-op — the filter now actually
    // scopes to traders created after the cutoff (deterministic ~60%
    // purchase rate is applied further below via hashStr).
    const inRangeTraders = traders.filter((t) => new Date(t.joinedAt).getTime() >= cutoff);
    const counts = new Map<string, { orders: number; units: number }>();
    for (const a of ADDONS) counts.set(a.id, { orders: 0, units: 0 });

    for (const t of inRangeTraders) {
      const n = parseInt(t.id.replace(/[^0-9]/g, "").slice(-3) || "0", 10);
      // ~60% of traders bought at least one add-on.
      if (n % 5 === 0) continue;
      // Each buyer took 1-2 distinct add-ons.
      const picks = [n % ADDONS.length, (n + 3) % ADDONS.length];
      const units = 1 + (n % 3);
      for (const idx of picks) {
        const addon = ADDONS[idx];
        const c = counts.get(addon.id)!;
        c.orders += 1;
        c.units += units;
      }
    }

    return ADDONS.map((a) => {
      const c = counts.get(a.id)!;
      return {
        id: a.id,
        name: a.name,
        orders: c.orders,
        unitsSold: c.units,
        unitPrice: a.unitPrice,
        estimatedRevenue: c.units * a.unitPrice,
        icon: a.icon,
      };
    }).sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);
  }, [traders, cutoff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  // KPI totals
  const totalAddons = rows.length;
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const totalUnits = rows.reduce((s, r) => s + r.unitsSold, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.estimatedRevenue, 0);

  const exportCsv = () => {
    exportToCsv(
      filtered,
      [
        { key: "name", header: "Add-on", value: (r: AddonRow) => r.name },
        { key: "orders", header: "Orders", value: (r) => r.orders },
        { key: "unitsSold", header: "Units Sold", value: (r) => r.unitsSold },
        { key: "unitPrice", header: "Unit Price", value: (r) => r.unitPrice },
        { key: "estimatedRevenue", header: "Estimated Revenue", value: (r) => r.estimatedRevenue },
      ],
      `risk-addon-revenue-${Date.now()}.csv`,
    );
    toast({
      title: "Export complete",
      description: `Exported ${filtered.length} add-on rows to CSV.`,
    });
  };

  const columns: Column<AddonRow>[] = [
    {
      key: "name",
      header: "Add-on Name",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-muted/60 p-1.5">
            <r.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="font-medium text-foreground">{r.name}</span>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    {
      key: "orders",
      header: "Orders",
      cell: (r) => formatCompact(r.orders),
      sortValue: (r) => r.orders,
      numeric: true,
    },
    {
      key: "units",
      header: "Units Sold",
      cell: (r) => formatCompact(r.unitsSold),
      sortValue: (r) => r.unitsSold,
      numeric: true,
    },
    {
      key: "unitPrice",
      header: "Unit Price",
      cell: (r) => formatCurrency(r.unitPrice, currency),
      sortValue: (r) => r.unitPrice,
      numeric: true,
    },
    {
      key: "revenue",
      header: "Estimated Revenue",
      cell: (r) => (
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
          {formatCurrency(r.estimatedRevenue, currency)}
        </span>
      ),
      sortValue: (r) => r.estimatedRevenue,
      numeric: true,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Add-on Revenue"
        description="Revenue from extra services purchased during checkout — retry credits, express KYC, profit boosts, and more."
        icon={PackagePlus}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Add-ons" value={totalAddons} icon={PackagePlus} tone="default" />
          <MetricCard label="Total Orders" value={totalOrders} icon={ShoppingCart} tone="default" />
          <MetricCard label="Total Units" value={totalUnits} icon={Boxes} tone="default" />
          <MetricCard
            label="Total Revenue"
            value={formatCurrency(totalRevenue, currency)}
            icon={Wallet}
            tone="positive"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search add-ons…"
              className="pl-8"
              aria-label="Search add-ons"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowEmptyState((v) => !v)}
            className="ml-auto text-xs"
            aria-label="Toggle empty state preview"
            title="Developer preview toggle — show what the empty state looks like when no add-on sales are recorded"
          >
            {showEmptyState ? "Show data" : "Preview empty state"}
          </Button>
        </div>

        {/* Table or empty state */}
        {showEmptyState ? (
          <EmptyState
            title="No add-on revenue yet"
            description="Add-on purchases will appear here when traders buy additional services during checkout."
            icon={PackagePlus}
            hint="Configure add-on services in Settings → Storefront to offer them during challenge checkout."
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.id}
            searchableText={(r) => r.name}
            searchPlaceholder="Search add-ons…"
            emptyTitle="No add-ons match your search"
            emptyDescription="Adjust your filters or date range to see add-on performance."
            toolbar={
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {rows.length} add-ons · {totalOrders} orders · {totalUnits} units
              </span>
            }
          />
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PackagePlus className="h-3.5 w-3.5" />
          <span>
            Add-on purchases are simulated per trader for the demo. Estimated revenue = units sold × unit price.
            Real purchase events will be aggregated from the checkout system.
          </span>
        </div>
      </PageContent>
    </Page>
  );
}
