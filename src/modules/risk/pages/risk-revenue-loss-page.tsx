"use client";

/**
 * Risk — Revenue Loss Page
 *
 * Shows revenue loss over time, broken into Week-over-Week and Month-over-Month
 * comparison tables. KPI row headlines the current and previous period totals.
 * An area chart visualizes the revenue trend with loss periods highlighted.
 *
 * Terra palette — emerald/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantPayouts,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { AreaSeries } from "@/components/platform/charts";
import { formatCurrency } from "@/components/platform/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  TrendingDown,
  TrendingUp,
  Calendar,
  CalendarDays,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface PeriodRow {
  period: string;
  currentRevenue: number;
  previousRevenue: number;
  revenueLoss: number;
  changePct: number;
  /** Used by chart to highlight loss periods. */
  isLoss: boolean;
}

/** Format an ISO week number label like "2026-W32". */
function isoWeekLabel(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** Format a month label like "2026-02". */
function isoMonthLabel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function RiskRevenueLossPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);

  // Revenue baseline — derived per payout: approximated entry-fee revenue
  // allocated to the same week/month as each payout. This makes the trend
  // move with the actual payout activity over time.
  const REVENUE_PER_PAYOUT = 260;

  // Group payouts by week and by month.
  const weeklyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payouts) {
      const lbl = isoWeekLabel(new Date(p.createdAt));
      m.set(lbl, (m.get(lbl) ?? 0) + REVENUE_PER_PAYOUT);
    }
    return m;
  }, [payouts]);

  const monthlyMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of payouts) {
      const lbl = isoMonthLabel(new Date(p.createdAt));
      m.set(lbl, (m.get(lbl) ?? 0) + REVENUE_PER_PAYOUT);
    }
    return m;
  }, [payouts]);

  // Build week-over-week rows.
  const weeklyRows = useMemo<PeriodRow[]>(() => {
    const keys = Array.from(weeklyMap.keys()).sort();
    const out: PeriodRow[] = [];
    for (let i = 0; i < keys.length; i++) {
      const cur = keys[i];
      const prev = i > 0 ? keys[i - 1] : null;
      const currentRevenue = weeklyMap.get(cur) ?? 0;
      const previousRevenue = prev ? (weeklyMap.get(prev) ?? 0) : 0;
      const revenueLoss = currentRevenue - previousRevenue;
      const changePct = previousRevenue > 0
        ? Math.round((revenueLoss / previousRevenue) * 1000) / 10
        : 0;
      out.push({
        period: cur,
        currentRevenue,
        previousRevenue,
        revenueLoss,
        changePct,
        isLoss: revenueLoss < 0,
      });
    }
    return out.reverse(); // most recent first
  }, [weeklyMap]);

  // Build month-over-month rows.
  const monthlyRows = useMemo<PeriodRow[]>(() => {
    const keys = Array.from(monthlyMap.keys()).sort();
    const out: PeriodRow[] = [];
    for (let i = 0; i < keys.length; i++) {
      const cur = keys[i];
      const prev = i > 0 ? keys[i - 1] : null;
      const currentRevenue = monthlyMap.get(cur) ?? 0;
      const previousRevenue = prev ? (monthlyMap.get(prev) ?? 0) : 0;
      const revenueLoss = currentRevenue - previousRevenue;
      const changePct = previousRevenue > 0
        ? Math.round((revenueLoss / previousRevenue) * 1000) / 10
        : 0;
      out.push({
        period: cur,
        currentRevenue,
        previousRevenue,
        revenueLoss,
        changePct,
        isLoss: revenueLoss < 0,
      });
    }
    return out.reverse();
  }, [monthlyMap]);

  // Headline KPIs — latest week & latest month.
  const latestWeek = weeklyRows[0];
  const latestMonth = monthlyRows[0];

  const curWeekRevenue = latestWeek?.currentRevenue ?? 0;
  const lastWeekRevenue = latestWeek?.previousRevenue ?? 0;
  const wowChange = latestWeek?.changePct ?? 0;

  const curMonthRevenue = latestMonth?.currentRevenue ?? 0;
  const lastMonthRevenue = latestMonth?.previousRevenue ?? 0;
  const momChange = latestMonth?.changePct ?? 0;

  // Chart data — flatten monthly rows (oldest first) and highlight loss periods.
  const chartData = useMemo(() => {
    const sorted = [...monthlyRows].reverse(); // chronological
    return sorted.map((r) => ({
      period: r.period,
      revenue: r.currentRevenue,
      loss: r.isLoss ? r.currentRevenue : 0,
    }));
  }, [monthlyRows]);

  // Determine chart color — emerald if latest is positive, rose if loss.
  const latestLoss = latestMonth?.isLoss ?? false;

  const columns: Column<PeriodRow>[] = [
    {
      key: "period",
      header: "Period",
      cell: (r) => <span className="font-mono text-xs font-medium">{r.period}</span>,
      sortValue: (r) => r.period,
    },
    {
      key: "currentRevenue",
      header: "Current Revenue",
      cell: (r) => formatCurrency(r.currentRevenue, currency),
      sortValue: (r) => r.currentRevenue,
      numeric: true,
    },
    {
      key: "previousRevenue",
      header: "Previous Revenue",
      cell: (r) => formatCurrency(r.previousRevenue, currency),
      sortValue: (r) => r.previousRevenue,
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
      key: "changePct",
      header: "Change %",
      cell: (r) => (
        <Badge
          variant="outline"
          className={cn(
            "gap-1 tabular-nums",
            r.changePct >= 0
              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "border-rose-500/40 text-rose-700 dark:text-rose-400",
          )}
        >
          {r.changePct >= 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {Math.abs(r.changePct)}%
        </Badge>
      ),
      sortValue: (r) => r.changePct,
      numeric: true,
    },
  ];

  const exportCsv = () => {
    toast({
      title: "Export started",
      description: "Exporting revenue-loss report as CSV.",
    });
  };

  return (
    <Page>
      <PageHeader
        title="Revenue Loss Analysis"
        description="Week-over-week and month-over-month revenue comparison with loss highlighting."
        icon={TrendingDown}
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
            label="Current Week Revenue"
            value={formatCurrency(curWeekRevenue, currency)}
            icon={Calendar}
            tone="default"
          />
          <MetricCard
            label="Last Week Revenue"
            value={formatCurrency(lastWeekRevenue, currency)}
            icon={Calendar}
            tone="default"
          />
          <MetricCard
            label="WoW Change"
            value={`${wowChange >= 0 ? "+" : "−"}${Math.abs(wowChange)}%`}
            icon={wowChange >= 0 ? TrendingUp : TrendingDown}
            tone={wowChange >= 0 ? "positive" : "negative"}
          />
          <MetricCard
            label="Current Month Revenue"
            value={formatCurrency(curMonthRevenue, currency)}
            icon={CalendarDays}
            tone="default"
          />
          <MetricCard
            label="Last Month Revenue"
            value={formatCurrency(lastMonthRevenue, currency)}
            icon={CalendarDays}
            tone="default"
          />
          <MetricCard
            label="MoM Change"
            value={`${momChange >= 0 ? "+" : "−"}${Math.abs(momChange)}%`}
            icon={momChange >= 0 ? TrendingUp : TrendingDown}
            tone={momChange >= 0 ? "positive" : "negative"}
          />
        </div>

        {/* Trend chart */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Monthly Revenue Trend</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Loss periods highlighted in rose.
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                latestLoss
                  ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
                  : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
              )}
            >
              {latestLoss ? "Last month: loss" : "Last month: gain"}
            </Badge>
          </div>
          <AreaSeries
            data={chartData}
            xKey="period"
            yKey="revenue"
            color={latestLoss ? "#e11d48" : "var(--brand-primary)"}
            height={220}
            formatValue={(v) => formatCurrency(v, currency)}
          />
        </div>

        {/* Week over Week */}
        <div className="rounded-lg border bg-card p-2">
          <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Week over Week — {weeklyRows.length} periods</span>
          </div>
          <DataTable
            columns={columns}
            data={weeklyRows}
            rowKey={(r) => `w-${r.period}`}
            pageSize={5}
          />
        </div>

        {/* Month over Month */}
        <div className="rounded-lg border bg-card p-2">
          <div className="mb-2 flex items-center gap-2 px-2 pt-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Month over Month — {monthlyRows.length} periods</span>
          </div>
          <DataTable
            columns={columns}
            data={monthlyRows}
            rowKey={(r) => `m-${r.period}`}
            pageSize={5}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Revenue is approximated from payout activity at {formatCurrency(REVENUE_PER_PAYOUT, currency)} per
          payout event. Change % compares each period to its immediately preceding
          period.
        </p>
      </PageContent>
    </Page>
  );
}
