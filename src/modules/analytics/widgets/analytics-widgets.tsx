"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { revenueSeries, traderGrowthSeries, riskDistribution, breachTrend, getTenantTraders, getTenantAccounts } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { AreaSeries, DonutSeries, BarSeries } from "@/components/platform/charts";
import { TrendingUp, Users, DollarSign, Activity, Brain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionGuard } from "@/components/platform/guards";

export function AnalyticsOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const rev = revenueSeries(tid);
  const totalRev = rev.reduce((s, r) => s + r.value, 0);
  const traders = getTenantTraders(tid);
  const accounts = getTenantAccounts(tid);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Revenue (30d)" value={formatCurrency(totalRev, currency)} delta={8} icon={DollarSign} tone="positive" />
      <MetricCard label="Active Traders" value={formatCompact(traders.filter((t) => t.status === "active").length)} delta={5} icon={Users} />
      <MetricCard label="Accounts" value={accounts.length} delta={3} icon={Activity} />
      <MetricCard label="Avg Trader Value" value={formatCurrency(traders.length ? totalRev / traders.length : 0, currency)} delta={2} icon={TrendingUp} />
    </div>
  );
}

export function RevenueWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const data = revenueSeries(tid);
  return <AreaSeries data={data} xKey="date" yKey="value" formatValue={(v) => formatCurrency(v, runtime.tenant?.currency)} height={200} />;
}

export function TraderGrowthWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const data = traderGrowthSeries(tid);
  return <AreaSeries data={data} xKey="date" yKey="value" color="#0ea5e9" height={200} />;
}

export function RiskDistributionWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  return <DonutSeries data={riskDistribution(tid)} />;
}

export function BreachTrendWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const data = breachTrend(tid);
  return <BarSeries data={data} xKey="date" yKey="value" color="#dc2626" height={200} />;
}

export function AdvancedAnalyticsWidget() {
  const cohorts = [
    { name: "Cohort A (Jan)", value: 24 },
    { name: "Cohort B (Feb)", value: 31 },
    { name: "Cohort C (Mar)", value: 18 },
    { name: "Cohort D (Apr)", value: 27 },
    { name: "Cohort E (May)", value: 22 },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-medium">Cohort retention analysis</span>
        <Badge variant="secondary" className="text-[10px]">Advanced</Badge>
      </div>
      <BarSeries data={cohorts.map((c) => ({ date: c.name, value: c.value }))} xKey="date" yKey="value" color="#7c3aed" height={160} />
    </div>
  );
}
