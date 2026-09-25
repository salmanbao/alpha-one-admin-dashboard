"use client";

/**
 * Firm Statistics Page (spec §14 / §4 — Analytics as Investigation workspace)
 *
 * Answers: "How is the firm performing overall?"
 * Layered:
 *   1. KPI strip (10 metrics) — at-a-glance firm health
 *   2. Trend charts (4 AreaSeries over 12 months) — why / where the curve bends
 *   3. Summary stats table — derived ratios (margin, payout ratio, avg order)
 *
 * Data: getFirmStatistics(tid) from @/lib/platform/mock-data (tenant-scoped).
 * UI is progressive: the 10 KPIs and 4 charts answer the most important
 * questions first; the summary table answers the "how exactly is this
 * computed" question at the bottom.
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { getFirmStatistics } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { AreaSeries } from "@/components/platform/charts";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Target,
  Copy,
  ArrowLeftRight,
  Newspaper,
  Users,
  CheckCircle2,
  Percent,
  BarChart3,
  Download,
} from "lucide-react";
import { exportToCsv } from "@/lib/platform/export-utils";

const RANGES = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

interface SummaryRow {
  metric: string;
  value: string;
  formula: string;
  context: string;
}

export function FirmStatisticsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const [range, setRange] = useState<RangeId>("30d");

  const stats = getFirmStatistics(tid);
  const fmt = (v: number) => formatCurrency(v, currency);

  const summaryRows: SummaryRow[] = [
    {
      metric: "Net Profit",
      value: fmt(stats.netProfit),
      formula: "Total Revenue − Total Payouts",
      context: `${fmt(stats.totalRevenue)} − ${fmt(stats.totalPayouts)}`,
    },
    {
      metric: "Profit Margin",
      value: `${stats.profitMargin}%`,
      formula: "(Net Profit ÷ Total Revenue) × 100",
      context: `Net of payouts relative to gross revenue.`,
    },
    {
      metric: "Average Challenge Value",
      value: fmt(stats.avgChallengeValue),
      formula: "Total Revenue ÷ Challenges Sold",
      context: `${fmt(stats.totalRevenue)} ÷ ${stats.challengesSold}`,
    },
    {
      metric: "Payout Ratio",
      value: `${stats.payoutRatio}%`,
      formula: "(Total Payouts ÷ Total Revenue) × 100",
      context: "Share of revenue returned to traders.",
    },
  ];

  const summaryColumns: Column<SummaryRow>[] = [
    { key: "metric", header: "Metric", cell: (r) => <span className="font-medium text-foreground">{r.metric}</span>, sortValue: (r) => r.metric },
    { key: "value", header: "Value", cell: (r) => <span className="font-medium tabular-nums text-foreground">{r.value}</span>, sortValue: (r) => r.value, numeric: true },
    { key: "formula", header: "Formula", cell: (r) => <span className="text-muted-foreground">{r.formula}</span> },
    { key: "context", header: "Context", cell: (r) => <span className="text-xs text-muted-foreground">{r.context}</span> },
  ];

  const exportCsv = () => {
    exportToCsv(
      stats.revenueSeries,
      [
        { key: "date", header: "Month", value: (r) => r.date },
        { key: "revenue", header: "Revenue", value: (r) => r.revenue },
        { key: "payouts", header: "Payouts", value: (r) => r.payouts },
        { key: "net", header: "Net Revenue", value: (r) => r.net },
        { key: "challenges", header: "Challenges Sold", value: (r) => r.challenges },
      ],
      `firm-statistics-${range}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Firm Statistics"
        description="Tenant-wide business performance — revenue, payouts, challenges, and risk events."
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <div className="inline-flex rounded-md border bg-card p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  className={cn(
                    "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                    range === r.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={range === r.id}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* 1. KPI strip — 10 cards in a 2 / 5 / 5 / 10 responsive grid */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Total Revenue" value={fmt(stats.totalRevenue)} delta={8} deltaLabel="vs prev period" icon={DollarSign} tone="positive" />
          <MetricCard label="Total Payouts" value={fmt(stats.totalPayouts)} delta={4} deltaLabel="vs prev period" icon={TrendingDown} tone="warning" />
          <MetricCard label="Net Profit" value={fmt(stats.netProfit)} delta={11} deltaLabel="vs prev period" icon={TrendingUp} tone="positive" />
          <MetricCard label="Challenges Sold" value={stats.challengesSold} delta={6} deltaLabel="vs prev period" icon={Target} tone="positive" />
          <MetricCard label="Profit Margin" value={`${stats.profitMargin}%`} delta={2} deltaLabel="pts" icon={Percent} tone="positive" />

          <MetricCard label="Copy Trading Events" value={formatCompact(stats.copyTradingEvents)} icon={Copy} tone="warning" />
          <MetricCard label="Inverse Trading Events" value={formatCompact(stats.inverseTradingEvents)} icon={ArrowLeftRight} tone="warning" />
          <MetricCard label="News Trading Events" value={formatCompact(stats.newsTradingEvents)} icon={Newspaper} tone="negative" />
          <MetricCard label="Total Accounts" value={stats.totalAccounts} delta={5} deltaLabel="vs prev period" icon={Users} />
          <MetricCard label="Funded Accounts" value={stats.fundedAccounts} delta={9} deltaLabel="vs prev period" icon={CheckCircle2} tone="positive" />
        </div>

        {/* 2. Trend charts — 4 AreaSeries (12-month series from revenueSeries) */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Revenue (12 months)"
            subtitle={`Monthly gross revenue — ${currency}`}
          >
            <AreaSeries
              data={stats.revenueSeries}
              xKey="date"
              yKey="revenue"
              color="#059669"
              formatValue={(v) => fmt(v)}
            />
          </ChartCard>
          <ChartCard
            title="Payouts (12 months)"
            subtitle={`Monthly trader payouts — ${currency}`}
          >
            <AreaSeries
              data={stats.revenueSeries}
              xKey="date"
              yKey="payouts"
              color="#d97706"
              formatValue={(v) => fmt(v)}
            />
          </ChartCard>
          <ChartCard
            title="Net Revenue (12 months)"
            subtitle={`Revenue minus payouts — ${currency}`}
          >
            <AreaSeries
              data={stats.revenueSeries}
              xKey="date"
              yKey="net"
              color="#0d9488"
              formatValue={(v) => fmt(v)}
            />
          </ChartCard>
          <ChartCard
            title="Challenges Sold (12 months)"
            subtitle="New challenge purchases per month"
          >
            <AreaSeries
              data={stats.revenueSeries}
              xKey="date"
              yKey="challenges"
              color="#e11d48"
              formatValue={(v) => String(v)}
            />
          </ChartCard>
        </div>

        <Separator />

        {/* 3. Summary stats table — derived ratios with formulas */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Summary Statistics</h2>
            <span className="text-xs text-muted-foreground">
              Derived ratios — what they mean and how they're computed.
            </span>
          </div>
          <DataTable
            columns={summaryColumns}
            data={summaryRows}
            rowKey={(r) => r.metric}
            searchableText={(r) => `${r.metric} ${r.formula}`}
            searchPlaceholder="Search metrics…"
            pageSize={10}
          />
        </div>
      </PageContent>
    </Page>
  );
}

/* ---------- Local helpers ---------- */

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
