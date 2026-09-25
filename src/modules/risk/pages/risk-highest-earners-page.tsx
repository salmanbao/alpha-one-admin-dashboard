"use client";

/**
 * Risk — Highest Earners Page
 *
 * Ranks top traders by total revenue. The top 3 receive gold/silver/bronze
 * medal badges. KPI row totals the headline numbers. Search + country filter
 * + CSV export round out the controls.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantAccounts,
  getTenantChallenges,
  getTenantPayouts,
  getTenantTraders,
  type Trader,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Medal,
  Award,
  Search,
  Download,
  Crown,
  Users,
  Globe,
  TrendingUp,
} from "lucide-react";

interface EarnerRow {
  rank: number;
  trader: Trader;
  email: string;
  country: string;
  totalRevenue: number;
  activeAccounts: number;
  fundedAccounts: number;
  payoutAccounts: number;
  profitMargin: number;
}

/** Revenue per trader (entry-fee baseline). */
const REVENUE_PER_TRADER = 260;

export function RiskHighestEarnersPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const traders = useMemo(() => getTenantTraders(tid), [tid]);
  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);
  const challenges = useMemo(() => getTenantChallenges(tid), [tid]);
  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);

  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  // Build earner rows — only traders with at least one payout or funded account.
  const allRows = useMemo<EarnerRow[]>(() => {
    const rows: EarnerRow[] = [];
    for (const t of traders) {
      const traderAccounts = accounts.filter((a) => a.traderId === t.id);
      const traderPayouts = payouts.filter((p) => p.traderId === t.id);
      const totalPayoutsSum = traderPayouts.reduce((s, p) => s + p.amount, 0);
      // Revenue approximation: per trader + bonus per funded account.
      const totalRevenue =
        REVENUE_PER_TRADER +
        (traderAccounts.filter((a) => a.type === "funded").length * 280);

      // Skip traders with no earnings (no payouts, no funded accounts).
      if (traderPayouts.length === 0 && !traderAccounts.some((a) => a.type === "funded")) {
        continue;
      }

      const activeAccounts = traderAccounts.filter((a) => a.status === "active").length;
      const fundedAccounts = traderAccounts.filter((a) => a.type === "funded").length;
      const payoutAccounts = traderPayouts.length;
      const profitMargin =
        totalRevenue > 0
          ? Math.round(((totalRevenue - totalPayoutsSum) / totalRevenue) * 1000) / 10
          : 0;

      rows.push({
        rank: 0, // assigned after sort
        trader: t,
        email: t.email,
        country: t.country,
        totalRevenue,
        activeAccounts,
        fundedAccounts,
        payoutAccounts,
        profitMargin,
      });
    }
    // Sort by revenue descending then assign ranks.
    rows.sort((a, b) => b.totalRevenue - a.totalRevenue);
    rows.forEach((r, i) => {
      r.rank = i + 1;
    });
    return rows;
  }, [traders, accounts, payouts]);

  // Build country filter options.
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) set.add(r.country);
    return Array.from(set).sort();
  }, [allRows]);

  // Filter rows.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (countryFilter !== "all" && r.country !== countryFilter) return false;
      if (q && !`${r.email} ${r.trader.name} ${r.country}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allRows, search, countryFilter]);

  // KPIs — use the unfiltered set so headline numbers stay stable.
  const totalEarners = allRows.length;
  const topEarnerRevenue = allRows[0]?.totalRevenue ?? 0;
  const avgRevenue = totalEarners > 0
    ? Math.round(allRows.reduce((s, r) => s + r.totalRevenue, 0) / totalEarners)
    : 0;
  // Top country = country with most earners.
  const topCountry = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of allRows) {
      counts.set(r.country, (counts.get(r.country) ?? 0) + 1);
    }
    let top = "—";
    let max = 0;
    for (const [c, n] of counts) {
      if (n > max) {
        max = n;
        top = c;
      }
    }
    return top;
  }, [allRows]);

  // Render the rank cell with medal badges for the top 3.
  const renderRank = (rank: number) => {
    if (rank === 1) {
      return (
        <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-500/40">
          <Crown className="h-3 w-3" /> 1
        </Badge>
      );
    }
    if (rank === 2) {
      return (
        <Badge className="gap-1 bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-300 border border-stone-500/40">
          <Medal className="h-3 w-3" /> 2
        </Badge>
      );
    }
    if (rank === 3) {
      return (
        <Badge className="gap-1 bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border border-orange-500/40">
          <Award className="h-3 w-3" /> 3
        </Badge>
      );
    }
    return <span className="font-mono text-xs text-muted-foreground">{rank}</span>;
  };

  const columns: Column<EarnerRow>[] = [
    {
      key: "rank",
      header: "Rank",
      cell: (r) => renderRank(r.rank),
      sortValue: (r) => r.rank,
      numeric: true,
      width: "80px",
    },
    {
      key: "email",
      header: "Trader Email",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.email}</span>
          <span className="text-xs text-muted-foreground">{r.trader.name}</span>
        </div>
      ),
      sortValue: (r) => r.email,
    },
    {
      key: "country",
      header: "Country",
      cell: (r) => (
        <Badge variant="outline" className="font-mono text-[10px]">
          {r.country}
        </Badge>
      ),
      sortValue: (r) => r.country,
    },
    {
      key: "totalRevenue",
      header: "Total Revenue",
      cell: (r) => (
        <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatCurrency(r.totalRevenue, currency)}
        </span>
      ),
      sortValue: (r) => r.totalRevenue,
      numeric: true,
    },
    {
      key: "activeAccounts",
      header: "Active Accounts",
      cell: (r) => r.activeAccounts,
      sortValue: (r) => r.activeAccounts,
      numeric: true,
    },
    {
      key: "fundedAccounts",
      header: "Funded Accounts",
      cell: (r) => r.fundedAccounts,
      sortValue: (r) => r.fundedAccounts,
      numeric: true,
    },
    {
      key: "payoutAccounts",
      header: "Payout Accounts",
      cell: (r) => r.payoutAccounts,
      sortValue: (r) => r.payoutAccounts,
      numeric: true,
    },
    {
      key: "profitMargin",
      header: "Profit Margin",
      cell: (r) => (
        <Badge
          variant="outline"
          className={cn(
            "tabular-nums",
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

  const exportCsv = () => {
    // Demo-only — would call exportToCsv(filtered, [...], file) in
    // production. Honest copy prevents the operator thinking a file
    // was downloaded when nothing happened.
    toast({
      title: "Export started (demo)",
      description: `Would export ${filtered.length} earners as CSV in production.`,
    });
  };

  return (
    <Page>
      <PageHeader
        title="Highest Earners"
        description="Top traders ranked by total revenue. The top three earn gold, silver, and bronze medals."
        icon={Trophy}
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Earners"
            value={totalEarners}
            icon={Users}
            tone="default"
          />
          <MetricCard
            label="Top Earner Revenue"
            value={formatCurrency(topEarnerRevenue, currency)}
            icon={Trophy}
            tone="positive"
          />
          <MetricCard
            label="Avg Revenue / Earner"
            value={formatCurrency(avgRevenue, currency)}
            icon={TrendingUp}
            tone="default"
          />
          <MetricCard
            label="Top Country"
            value={topCountry}
            icon={Globe}
            tone="default"
          />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email or name…"
              className="h-8 pl-8 text-xs"
              aria-label="Search earners"
            />
          </div>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            aria-label="Filter by country"
          >
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {allRows.length} earners
          </span>
        </div>

        {/* Earners table */}
        <div className="rounded-lg border bg-card">
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.trader.id}
            pageSize={10}
            emptyTitle="No earners found"
            emptyDescription="Traders with at least one payout or a funded account appear here."
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Revenue is approximated at {formatCurrency(REVENUE_PER_TRADER, currency)} per trader plus a bonus per funded account.
          Total active challenges: {formatCompact(challenges.length)}.
        </p>
      </PageContent>
    </Page>
  );
}
