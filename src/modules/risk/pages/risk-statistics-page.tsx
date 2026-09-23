"use client";

/**
 * Risk Statistics Page — challenge payout statistics per challenge type,
 * country, and account-size band (spec section 28 — Risk Analysis view).
 *
 * Three tabs:
 *   1. Challenge Stats — per-challenge-type revenue, payouts, profit margin,
 *      payout count, and funded accounts (derived from challenges + payouts).
 *   2. Country-Wise   — traders grouped by country.
 *   3. Account Size   — traders grouped by account balance ranges.
 *
 * Each tab has its own date range selector and CSV export button. The KPI
 * row at the top aggregates across all three lenses so operators always
 * see the headline numbers first.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantChallenges,
  getTenantPayouts,
  getTenantTraders,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  DollarSign,
  Wallet,
  TrendingUp,
  Users,
  Globe,
  Ruler,
  Download,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DATE_RANGES: Record<string, number> = {
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
  "1y": 365 * 24 * 60 * 60 * 1000,
  all: 0,
};

interface ChallengeRow {
  challengeType: string;
  revenue: number;
  totalPayouts: number;
  profitMargin: number;
  payoutCount: number;
  fundedAccounts: number;
}

interface CountryRow {
  country: string;
  traders: number;
  funded: number;
  breached: number;
  revenue: number;
}

interface SizeRow {
  range: string;
  accounts: number;
  funded: number;
  breached: number;
  revenue: number;
}

/** Account balance ranges (in account currency). */
const SIZE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "< $10k", min: 0, max: 10_000 },
  { label: "$10k–$25k", min: 10_000, max: 25_000 },
  { label: "$25k–$50k", min: 25_000, max: 50_000 },
  { label: "$50k–$100k", min: 50_000, max: 100_000 },
  { label: "$100k+", min: 100_000, max: Infinity },
];

export function RiskStatisticsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const [tab, setTab] = useState("challenge");
  const [range, setRange] = useState<string>("all");

  // All tenant datasets — memoised once.
  const challenges = useMemo(() => getTenantChallenges(tid), [tid]);
  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);
  const traders = useMemo(() => getTenantTraders(tid), [tid]);

  // Filter by date range — payouts carry timestamps.
  const cutoff = useMemo(() => Date.now() - (DATE_RANGES[range] ?? 0), [range]);
  const rangedPayouts = useMemo(
    () => payouts.filter((p) => new Date(p.createdAt).getTime() >= cutoff),
    [payouts, cutoff],
  );

  // ---- Challenge Stats (group by challenge name) ----
  const challengeRows = useMemo<ChallengeRow[]>(() => {
    const groups = new Map<string, ChallengeRow>();
    for (const c of challenges) {
      const key = c.name || "Unknown";
      if (!groups.has(key)) {
        groups.set(key, {
          challengeType: key,
          revenue: 0,
          totalPayouts: 0,
          profitMargin: 0,
          payoutCount: 0,
          fundedAccounts: 0,
        });
      }
      const row = groups.get(key)!;
      // Revenue = accountSize * 0.02 (entry fee approximation)
      row.revenue += Math.round(c.accountSize * 0.02);
      if (c.phase === "funded" || c.status === "funded") row.fundedAccounts += 1;
    }
    // Aggregate payouts per challenge name (by trader).
    for (const p of rangedPayouts) {
      // Find a challenge that matches this trader.
      const chal = challenges.find((c) => c.traderId === p.traderId);
      if (!chal) continue;
      const row = groups.get(chal.name);
      if (!row) continue;
      row.totalPayouts += p.amount;
      row.payoutCount += 1;
    }
    for (const row of groups.values()) {
      row.profitMargin = row.revenue > 0 ? Math.round(((row.revenue - row.totalPayouts) / row.revenue) * 1000) / 10 : 0;
    }
    return Array.from(groups.values());
  }, [challenges, rangedPayouts]);

  // ---- Country-Wise ----
  const countryRows = useMemo<CountryRow[]>(() => {
    const groups = new Map<string, CountryRow>();
    for (const t of traders) {
      if (!groups.has(t.country)) {
        groups.set(t.country, { country: t.country, traders: 0, funded: 0, breached: 0, revenue: 0 });
      }
      const row = groups.get(t.country)!;
      row.traders += 1;
      if (t.challengePhase === "funded") row.funded += 1;
      if (t.status === "breached") row.breached += 1;
    }
    // Revenue per trader = ~$200 baseline (entry-fee approximation).
    for (const row of groups.values()) {
      row.revenue = row.traders * 200;
    }
    return Array.from(groups.values()).sort((a, b) => b.traders - a.traders);
  }, [traders]);

  // ---- Account Size ----
  const sizeRows = useMemo<SizeRow[]>(() => {
    const rows: SizeRow[] = SIZE_BANDS.map((b) => ({
      range: b.label,
      accounts: 0,
      funded: 0,
      breached: 0,
      revenue: 0,
    }));
    for (const t of traders) {
      const bandIdx = SIZE_BANDS.findIndex((b) => t.accountBalance >= b.min && t.accountBalance < b.max);
      if (bandIdx < 0) continue;
      const row = rows[bandIdx];
      row.accounts += 1;
      if (t.challengePhase === "funded") row.funded += 1;
      if (t.status === "breached") row.breached += 1;
      row.revenue += Math.round(t.accountBalance * 0.02);
    }
    return rows;
  }, [traders]);

  // Headline KPIs — aggregated across all tabs. Revenue uses the
  // per-challenge revenue baseline so the totals match the table.
  const totalRevenue = challengeRows.reduce((s, r) => s + r.revenue, 0);
  const totalPayouts = challengeRows.reduce((s, r) => s + r.totalPayouts, 0);
  const overallMargin = totalRevenue > 0
    ? Math.round(((totalRevenue - totalPayouts) / totalRevenue) * 1000) / 10
    : 0;
  const totalFunded = traders.filter((t) => t.challengePhase === "funded").length;

  // ---- Column definitions ----
  const challengeColumns: Column<ChallengeRow>[] = [
    { key: "challengeType", header: "Challenge Type", cell: (r) => <span className="font-medium">{r.challengeType}</span>, sortValue: (r) => r.challengeType },
    { key: "revenue", header: "Revenue", cell: (r) => formatCurrency(r.revenue, currency), sortValue: (r) => r.revenue, numeric: true },
    { key: "totalPayouts", header: "Total Payouts", cell: (r) => formatCurrency(r.totalPayouts, currency), sortValue: (r) => r.totalPayouts, numeric: true },
    {
      key: "profitMargin",
      header: "Profit Margin",
      cell: (r) => (
        <Badge
          variant="outline"
          className={r.profitMargin >= 50 ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : r.profitMargin >= 20 ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : "border-rose-500/40 text-rose-700 dark:text-rose-400"}
        >
          {r.profitMargin}%
        </Badge>
      ),
      sortValue: (r) => r.profitMargin,
      numeric: true,
    },
    { key: "payoutCount", header: "Payout Count", cell: (r) => r.payoutCount, sortValue: (r) => r.payoutCount, numeric: true },
    { key: "fundedAccounts", header: "Funded Accounts", cell: (r) => r.fundedAccounts, sortValue: (r) => r.fundedAccounts, numeric: true },
  ];

  const countryColumns: Column<CountryRow>[] = [
    { key: "country", header: "Country", cell: (r) => <span className="font-medium">{r.country}</span>, sortValue: (r) => r.country },
    { key: "traders", header: "Traders", cell: (r) => r.traders, sortValue: (r) => r.traders, numeric: true },
    { key: "funded", header: "Funded", cell: (r) => <span className="text-emerald-600 dark:text-emerald-400">{r.funded}</span>, sortValue: (r) => r.funded, numeric: true },
    { key: "breached", header: "Breached", cell: (r) => <span className={r.breached > 0 ? "text-rose-600 dark:text-rose-400" : ""}>{r.breached}</span>, sortValue: (r) => r.breached, numeric: true },
    { key: "revenue", header: "Revenue", cell: (r) => formatCurrency(r.revenue, currency), sortValue: (r) => r.revenue, numeric: true },
  ];

  const sizeColumns: Column<SizeRow>[] = [
    { key: "range", header: "Size Range", cell: (r) => <span className="font-medium">{r.range}</span>, sortValue: (r) => r.range },
    { key: "accounts", header: "Accounts", cell: (r) => r.accounts, sortValue: (r) => r.accounts, numeric: true },
    { key: "funded", header: "Funded", cell: (r) => <span className="text-emerald-600 dark:text-emerald-400">{r.funded}</span>, sortValue: (r) => r.funded, numeric: true },
    { key: "breached", header: "Breached", cell: (r) => <span className={r.breached > 0 ? "text-rose-600 dark:text-rose-400" : ""}>{r.breached}</span>, sortValue: (r) => r.breached, numeric: true },
    { key: "revenue", header: "Revenue", cell: (r) => formatCurrency(r.revenue, currency), sortValue: (r) => r.revenue, numeric: true },
  ];

  const exportCsv = () => {
    if (tab === "challenge") {
      exportToCsv(
        challengeRows,
        [
          { key: "challengeType", header: "Challenge Type", value: (r) => r.challengeType },
          { key: "revenue", header: "Revenue", value: (r) => r.revenue },
          { key: "totalPayouts", header: "Total Payouts", value: (r) => r.totalPayouts },
          { key: "profitMargin", header: "Profit Margin %", value: (r) => r.profitMargin },
          { key: "payoutCount", header: "Payout Count", value: (r) => r.payoutCount },
          { key: "fundedAccounts", header: "Funded Accounts", value: (r) => r.fundedAccounts },
        ],
        `risk-challenge-stats-${Date.now()}.csv`,
      );
    } else if (tab === "country") {
      exportToCsv(
        countryRows,
        [
          { key: "country", header: "Country", value: (r) => r.country },
          { key: "traders", header: "Traders", value: (r) => r.traders },
          { key: "funded", header: "Funded", value: (r) => r.funded },
          { key: "breached", header: "Breached", value: (r) => r.breached },
          { key: "revenue", header: "Revenue", value: (r) => r.revenue },
        ],
        `risk-country-stats-${Date.now()}.csv`,
      );
    } else {
      exportToCsv(
        sizeRows,
        [
          { key: "range", header: "Size Range", value: (r) => r.range },
          { key: "accounts", header: "Accounts", value: (r) => r.accounts },
          { key: "funded", header: "Funded", value: (r) => r.funded },
          { key: "breached", header: "Breached", value: (r) => r.breached },
          { key: "revenue", header: "Revenue", value: (r) => r.revenue },
        ],
        `risk-account-size-stats-${Date.now()}.csv`,
      );
    }
  };

  return (
    <Page>
      <PageHeader
        title="Risk Analysis"
        description="Challenge payout statistics, country breakdown, and account-size distribution."
        icon={ShieldCheck}
        actions={
          <div className="flex items-center gap-2">
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
            <Button
              size="sm"
              variant="outline"
              onClick={exportCsv}
            >
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Revenue" value={formatCurrency(totalRevenue, currency)} icon={DollarSign} tone="positive" />
          <MetricCard label="Total Payouts" value={formatCurrency(totalPayouts, currency)} icon={Wallet} tone="warning" />
          <MetricCard label="Profit Margin" value={`${overallMargin}%`} icon={TrendingUp} tone={overallMargin >= 30 ? "positive" : "warning"} />
          <MetricCard label="Funded Accounts" value={totalFunded} icon={Users} tone="positive" />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="challenge">Challenge Stats</TabsTrigger>
            <TabsTrigger value="country">Country-Wise</TabsTrigger>
            <TabsTrigger value="size">Account Size</TabsTrigger>
          </TabsList>

          <TabsContent value="challenge">
            <div className="rounded-lg border bg-card p-2">
              <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Grouped by challenge type — {challengeRows.length} types</span>
              </div>
              <DataTable
                columns={challengeColumns}
                data={challengeRows}
                rowKey={(r) => r.challengeType}
                pageSize={10}
              />
            </div>
          </TabsContent>

          <TabsContent value="country">
            <div className="rounded-lg border bg-card p-2">
              <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                <span>{countryRows.length} countries — sorted by trader count</span>
              </div>
              <DataTable
                columns={countryColumns}
                data={countryRows}
                rowKey={(r) => r.country}
                pageSize={10}
              />
            </div>
          </TabsContent>

          <TabsContent value="size">
            <div className="rounded-lg border bg-card p-2">
              <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground">
                <Ruler className="h-3.5 w-3.5" />
                <span>Account balance ranges (5 bands)</span>
              </div>
              <DataTable
                columns={sizeColumns}
                data={sizeRows}
                rowKey={(r) => r.range}
                pageSize={10}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Footnote with derived totals */}
        <p className="text-xs text-muted-foreground">
          Showing {formatCompact(challengeRows.length + countryRows.length + sizeRows.length)} aggregated rows ·
          Revenue figures are derived from challenge entry fees ({formatCurrency(0.02 * 100, currency)} per $1 of account size).
        </p>
      </PageContent>
    </Page>
  );
}
