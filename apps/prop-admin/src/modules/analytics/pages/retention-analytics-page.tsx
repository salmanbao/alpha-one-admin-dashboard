"use client";

/**
 * Retention Analytics Page — customer retention & behavior analytics.
 *
 * Surfaces the questions an operator cares about for retention:
 *   - How many customers stick around at 3 / 6 / 12 months?
 *   - How many challenges does each user run on average?
 *   - What share of customers are repeat vs new?
 *   - Where (geographically) are repeats coming from?
 *
 * Layout (UX Constitution §4 — KPIs first, then visualizations, then
 * tabular detail, then explainability summary):
 *   1. KPI row (5 retention metrics)
 *   2. Cohort retention matrix + Challenges-per-User bar + New vs Repeating donut
 *   3. Top Countries table
 *   4. Summary insights card with 3 bullet findings
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantTraders } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { BarSeries, DonutSeries } from "@/components/platform/charts";
import { formatCompact } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Repeat,
  TrendingUp,
  Globe,
  Sparkles,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Cohort retention matrix — one row per month, % retention at 30/60/90d. */
interface CohortRow {
  cohort: string;
  startCount: number;
  retention: { d30: number; d60: number; d90: number };
}

/** Static cohort data — monthly cohorts June / July / Aug 2026. */
const COHORTS: CohortRow[] = [
  { cohort: "Jun 2026", startCount: 240, retention: { d30: 100, d60: 78, d90: 64 } },
  { cohort: "Jul 2026", startCount: 312, retention: { d30: 100, d60: 82, d90: 0 } },
  { cohort: "Aug 2026", startCount: 286, retention: { d30: 100, d60: 0, d90: 0 } },
];

/** Tone for retention percentage — green ≥ 70, amber 50-69, rose < 50. */
function retentionTone(pct: number): string {
  if (pct === 0) return "text-muted-foreground/30";
  if (pct >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

interface CountryStat {
  country: string;
  totalUsers: number;
  repeatingUsers: number;
  retentionRate: number;
}

export function RetentionAnalyticsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const traders = useMemo(() => getTenantTraders(tid), [tid]);

  // Headline KPIs (per spec).
  const threeMonthRetention = 72;
  const sixMonthRetention = 58;
  const twelveMonthRetention = 44;
  const challengesPerUser = 1.8;
  const repeatingPct = 23;

  // Challenges-per-user distribution — mock derived from trader count.
  const challengesDistribution = useMemo(() => {
    return [
      { label: "1 challenge", value: Math.round(traders.length * 0.62), count: 1 },
      { label: "2 challenges", value: Math.round(traders.length * 0.21), count: 2 },
      { label: "3 challenges", value: Math.round(traders.length * 0.11), count: 3 },
      { label: "4+ challenges", value: Math.round(traders.length * 0.06), count: 4 },
    ];
  }, [traders.length]);

  // New vs repeating donut.
  const repeatingCount = Math.round(traders.length * (repeatingPct / 100));
  const newCount = traders.length - repeatingCount;
  const newVsRepeat = useMemo(
    () => [
      { label: "New customers", value: newCount, color: "#0d9488" /* teal-600 */ },
      { label: "Repeating customers", value: repeatingCount, color: "#d97706" /* amber-600 */ },
    ],
    [newCount, repeatingCount],
  );

  // Top countries — derived from trader data.
  const topCountries = useMemo<CountryStat[]>(() => {
    const map = new Map<string, CountryStat>();
    for (const t of traders) {
      if (!map.has(t.country)) {
        map.set(t.country, { country: t.country, totalUsers: 0, repeatingUsers: 0, retentionRate: 0 });
      }
      const row = map.get(t.country)!;
      row.totalUsers += 1;
      // Deterministic ~23% repeating per country.
      const repeats = Math.round(row.totalUsers * (repeatingPct / 100));
      row.repeatingUsers = repeats;
      row.retentionRate = Math.round((repeats / Math.max(1, row.totalUsers)) * 100);
    }
    return Array.from(map.values()).sort((a, b) => b.totalUsers - a.totalUsers).slice(0, 10);
  }, [traders]);

  const countryColumns: Column<CountryStat>[] = [
    { key: "country", header: "Country", cell: (r) => <span className="font-medium">{r.country}</span>, sortValue: (r) => r.country },
    { key: "totalUsers", header: `Total ${plural(term("trader"))}`, cell: (r) => r.totalUsers, sortValue: (r) => r.totalUsers, numeric: true },
    {
      key: "repeatingUsers",
      header: `Repeating ${plural(term("trader"))}`,
      cell: (r) => <span className="text-emerald-600 dark:text-emerald-400">{r.repeatingUsers}</span>,
      sortValue: (r) => r.repeatingUsers,
      numeric: true,
    },
    {
      key: "retentionRate",
      header: "Retention Rate",
      cell: (r) => (
        <Badge
          variant="outline"
          className={r.retentionRate >= 30 ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400"}
        >
          {r.retentionRate}%
        </Badge>
      ),
      sortValue: (r) => r.retentionRate,
      numeric: true,
    },
  ];

  const handleExport = () => {
    exportToCsv(
      topCountries,
      [
        { key: "country", header: "Country", value: (r) => r.country },
        { key: "totalUsers", header: `Total ${plural(term("trader"))}`, value: (r) => r.totalUsers },
        { key: "repeatingUsers", header: `Repeating ${plural(term("trader"))}`, value: (r) => r.repeatingUsers },
        { key: "retentionRate", header: "Retention Rate %", value: (r) => r.retentionRate },
      ],
      `retention-analytics-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title={`${term("trader")} Retention & Behavior`}
        description={`How ${plural(term("trader")).toLowerCase()} stick around, what they do, and where repeating ${plural(term("trader")).toLowerCase()} come from.`}
        icon={Repeat}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
          >
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row — headline retention metrics first */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="3-Month Retention" value={`${threeMonthRetention}%`} icon={TrendingUp} tone="positive" />
          <MetricCard label="6-Month Retention" value={`${sixMonthRetention}%`} icon={TrendingUp} tone="positive" />
          <MetricCard label="12-Month Retention" value={`${twelveMonthRetention}%`} icon={TrendingUp} tone="warning" />
          <MetricCard label={`${plural(term("challenge"))} / ${term("trader")}`} value={challengesPerUser} icon={Sparkles} tone="default" />
          <MetricCard label={`Repeating ${plural(term("trader"))}`} value={`${repeatingPct}%`} icon={Repeat} tone="positive" />
        </div>

        {/* Visualization row — cohort matrix + distribution + donut */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Cohort retention matrix */}
          <div className="rounded-lg border bg-card p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Retention cohort — monthly cohorts</p>
              <span className="text-[10px] text-muted-foreground">% of original cohort retained</span>
            </div>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Cohort</th>
                    <th className="px-3 py-2 text-right">Start</th>
                    <th className="px-3 py-2 text-right">+30d</th>
                    <th className="px-3 py-2 text-right">+60d</th>
                    <th className="px-3 py-2 text-right">+90d</th>
                  </tr>
                </thead>
                <tbody>
                  {COHORTS.map((row) => (
                    <tr key={row.cohort} className="border-t last:border-0">
                      <td className="px-3 py-2 font-medium">{row.cohort}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{row.startCount}</td>
                      <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", retentionTone(row.retention.d30))}>
                        {row.retention.d30}%
                      </td>
                      <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", retentionTone(row.retention.d60))}>
                        {row.retention.d60 === 0 ? "—" : `${row.retention.d60}%`}
                      </td>
                      <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", retentionTone(row.retention.d90))}>
                        {row.retention.d90 === 0 ? "—" : `${row.retention.d90}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Recent cohorts show stronger early retention (Jul +60d: 82% vs Jun: 78%). 90-day figures populate as cohorts mature.
            </p>
          </div>

          {/* New vs Repeating donut */}
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">New vs repeating customers</p>
            <DonutSeries
              data={newVsRepeat}
              height={180}
              formatValue={(v) => formatCompact(v)}
            />
          </div>
        </div>

        {/* Challenges per user bar */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Challenges per user — distribution</p>
          <BarSeries
            data={challengesDistribution}
            xKey="label"
            yKey="value"
            color="#0d9488"
            height={200}
            formatValue={(v) => formatCompact(Number(v))}
          />
        </div>

        {/* Top countries table */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Top countries by retention
          </p>
          <DataTable
            columns={countryColumns}
            data={topCountries}
            rowKey={(r) => r.country}
            pageSize={10}
          />
        </div>

        {/* Summary insights card (UX §4 — bottom-line summary) */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <p className="text-sm font-medium text-primary">Summary insights</p>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <span>
                <strong className="font-medium text-foreground">3-month retention is 72%</strong> — above industry benchmark (~65%). July cohort shows the strongest early retention at +60d (82%).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>
                <strong className="font-medium text-foreground">23% of customers are repeating</strong> — they account for 47% of total challenge revenue. Targeting this segment with bundle offers could lift LTV by ~18%.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
              <span>
                <strong className="font-medium text-foreground">12-month retention drops to 44%</strong> — investigate churn around the 9-month mark (likely tied to challenge reset cycles). Consider milestone rewards at month 9.
              </span>
            </li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}
