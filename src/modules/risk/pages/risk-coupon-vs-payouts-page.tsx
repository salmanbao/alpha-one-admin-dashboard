"use client";

/**
 * Risk — Coupon vs Payouts Page
 *
 * Revenue and payouts attributed by coupon code. Reveals which discount
 * codes are profitable and which are net-negative when factoring in
 * subsequent trader payouts.
 *
 * Includes:
 *   - KPI row: Total Coupons, Total Revenue from Coupons, Total Payouts,
 *     Avg Discount %
 *   - Search + date range + Export CSV
 *   - Empty state when no coupon redemptions exist
 *
 * Terra palette — emerald/amber/rose, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantPayouts,
  getTenantTraders,
  type Trader,
} from "@/lib/platform/mock-data";
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
import { cn } from "@/lib/utils";
import {
  Ticket,
  Wallet,
  TrendingUp,
  Download,
  Search,
  Calendar,
  Percent,
  Users,
} from "lucide-react";

type DateRange = "7d" | "30d" | "90d" | "ytd";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
];

/** A representative coupon catalogue. */
const COUPONS = [
  { code: "EXPO2026", discountPct: 40, basePrice: 220 },
  { code: "SUMMER20", discountPct: 20, basePrice: 180 },
  { code: "WELCOME10", discountPct: 10, basePrice: 150 },
  { code: "BF50", discountPct: 50, basePrice: 240 },
  { code: "VIP25", discountPct: 25, basePrice: 200 },
  { code: "NEWYEAR15", discountPct: 15, basePrice: 170 },
];

interface CouponRow {
  code: string;
  orders: number;
  revenue: number;
  fundedAccounts: number;
  totalPayouts: number;
  profitMargin: number;
  discountPct: number;
}

/** Deterministic coupon assignment — stable across renders. */
function couponForTrader(t: Trader): { code: string; discountPct: number; basePrice: number } {
  const n = parseInt(t.id.replace(/[^0-9]/g, "").slice(-3) || "0", 10);
  // ~60% of traders use a coupon.
  if (n % 5 === 0) return { code: "—", discountPct: 0, basePrice: 180 };
  return COUPONS[n % COUPONS.length];
}

export function RiskCouponVsPayoutsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);
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

  // Build coupon rows
  const rows = useMemo<CouponRow[]>(() => {
    const map = new Map<string, CouponRow>();
    map.set("—", {
      code: "—",
      orders: 0,
      revenue: 0,
      fundedAccounts: 0,
      totalPayouts: 0,
      profitMargin: 0,
      discountPct: 0,
    });
    for (const c of COUPONS) {
      map.set(c.code, {
        code: c.code,
        orders: 0,
        revenue: 0,
        fundedAccounts: 0,
        totalPayouts: 0,
        profitMargin: 0,
        discountPct: c.discountPct,
      });
    }

    // Payouts per trader
    const payoutsByTrader = new Map<string, number>();
    const inRangePayouts = payouts.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
    for (const p of inRangePayouts) {
      payoutsByTrader.set(p.traderId, (payoutsByTrader.get(p.traderId) ?? 0) + p.amount);
    }

    for (const t of traders) {
      const coupon = couponForTrader(t);
      const row = map.get(coupon.code)!;
      const discountedPrice = Math.round(coupon.basePrice * (1 - coupon.discountPct / 100));
      row.orders += 1;
      row.revenue += discountedPrice;
      row.totalPayouts += payoutsByTrader.get(t.id) ?? 0;
      if (t.challengePhase === "funded") row.fundedAccounts += 1;
    }

    // Remove the "no coupon" placeholder for display purposes
    map.delete("—");

    for (const r of map.values()) {
      r.profitMargin = r.revenue > 0
        ? Math.round(((r.revenue - r.totalPayouts) / r.revenue) * 1000) / 10
        : 0;
    }

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [traders, payouts, cutoff]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.code.toLowerCase().includes(q));
  }, [rows, search]);

  // KPI totals
  const totalCoupons = rows.length;
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalPayoutsSum = rows.reduce((s, r) => s + r.totalPayouts, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const avgDiscount = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.discountPct, 0) / rows.length * 10) / 10
    : 0;
  const overallMargin = totalRevenue > 0
    ? Math.round(((totalRevenue - totalPayoutsSum) / totalRevenue) * 1000) / 10
    : 0;

  const exportCsv = () => {
    toast({
      title: "Export started",
      description: `Exporting ${filtered.length} coupon rows as CSV.`,
    });
  };

  const columns: Column<CouponRow>[] = [
    {
      key: "code",
      header: "Coupon Code",
      cell: (r) => (
        <span className="font-mono text-xs font-medium">{r.code}</span>
      ),
      sortValue: (r) => r.code,
    },
    {
      key: "orders",
      header: "Orders",
      cell: (r) => formatCompact(r.orders),
      sortValue: (r) => r.orders,
      numeric: true,
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (r) => <span className="font-medium">{formatCurrency(r.revenue, currency)}</span>,
      sortValue: (r) => r.revenue,
      numeric: true,
    },
    {
      key: "funded",
      header: "Funded Accounts",
      cell: (r) => (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
          {r.fundedAccounts}
        </Badge>
      ),
      sortValue: (r) => r.fundedAccounts,
      numeric: true,
    },
    {
      key: "payouts",
      header: "Total Payouts",
      cell: (r) => formatCurrency(r.totalPayouts, currency),
      sortValue: (r) => r.totalPayouts,
      numeric: true,
    },
    {
      key: "margin",
      header: "Profit Margin",
      cell: (r) => (
        <Badge
          variant="outline"
          className={cn(
            r.profitMargin >= 50
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : r.profitMargin >= 20
              ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
              : "border-rose-500/40 text-rose-700 dark:text-rose-400",
          )}
        >
          {r.profitMargin}%
        </Badge>
      ),
      sortValue: (r) => r.profitMargin,
      numeric: true,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Coupon vs Payouts"
        description="Revenue and payouts by coupon code — reveals which discount codes are profitable after trader payouts."
        icon={Ticket}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Coupons" value={totalCoupons} icon={Ticket} tone="default" />
          <MetricCard
            label="Coupon Revenue"
            value={formatCurrency(totalRevenue, currency)}
            icon={Wallet}
            tone="positive"
          />
          <MetricCard
            label="Total Payouts"
            value={formatCurrency(totalPayoutsSum, currency)}
            icon={Wallet}
            tone="warning"
          />
          <MetricCard
            label="Avg Discount"
            value={`${avgDiscount}%`}
            icon={Percent}
            tone="default"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search coupon codes…"
              className="pl-8"
              aria-label="Search coupon codes"
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
          >
            {showEmptyState ? "Show data" : "Preview empty state"}
          </Button>
        </div>

        {/* Table or empty state */}
        {showEmptyState ? (
          <EmptyState
            title="No coupon data available"
            description="Coupons will appear here when traders use discount codes during checkout."
            icon={Ticket}
            hint="Create offers and coupon codes in Marketing → Offers to populate this view."
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.code}
            searchableText={(r) => r.code}
            searchPlaceholder="Search coupon codes…"
            emptyTitle="No coupons match your search"
            emptyDescription="Adjust your filters or date range to see coupon performance."
            toolbar={
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {rows.length} coupons · {totalOrders} orders · overall margin {overallMargin}%
              </span>
            }
          />
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>
            Coupons are attributed deterministically per trader for the demo. Revenue reflects the
            discounted purchase price; payouts reflect actual withdrawals grouped by trader coupon.
          </span>
        </div>
      </PageContent>
    </Page>
  );
}
