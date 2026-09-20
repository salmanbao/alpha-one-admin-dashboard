"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { revenueSeries, traderGrowthSeries, riskDistribution, breachTrend, getTenantTraders } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { AreaSeries, DonutSeries, BarSeries } from "@/components/platform/charts";
import { BarChart3, TrendingUp, Users, DollarSign, Activity, Brain, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGuard, FeatureGuard } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Badge } from "@/components/ui/badge";

export function AnalyticsOverviewPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const rev = revenueSeries(tid);
  const totalRev = rev.reduce((s, r) => s + r.value, 0);
  return (
    <Page>
      <PageHeader
        title="Analytics"
        description="Business intelligence across the tenant."
        icon={BarChart3}
        actions={
          <PermissionGuard permission="analytics.export">
            <Button size="sm" variant="outline" onClick={() => {
              const rev = revenueSeries(tid);
              exportToCsv(
                rev,
                [
                  { key: "date", header: "Date", value: (r) => r.date },
                  { key: "value", header: "Revenue", value: (r) => r.value },
                ],
                `analytics-revenue-${new Date().toISOString().slice(0, 10)}.csv`,
              );
            }}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </PermissionGuard>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Revenue (30d)" value={formatCurrency(totalRev, currency)} delta={8} icon={DollarSign} tone="positive" />
          <MetricCard label="Avg Daily Rev" value={formatCurrency(totalRev / 30, currency)} delta={4} icon={TrendingUp} tone="positive" />
          <MetricCard label="Trader Growth" value="+18%" delta={18} icon={Users} tone="positive" />
          <MetricCard label="Breaches (30d)" value={breachTrend(tid).reduce((s, b) => s + b.value, 0)} delta={-12} icon={Activity} tone="positive" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Revenue (30d)</p>
            <AreaSeries data={rev} xKey="date" yKey="value" formatValue={(v) => formatCurrency(v, currency)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Trader growth</p>
            <AreaSeries data={traderGrowthSeries(tid)} xKey="date" yKey="value" color="#0ea5e9" />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Risk distribution</p>
            <DonutSeries data={riskDistribution(tid)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Breach trend (30d)</p>
            <BarSeries data={breachTrend(tid)} xKey="date" yKey="value" color="#dc2626" />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function TraderAnalyticsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid);
  const currency = runtime.tenant?.currency ?? "USD";
  return (
    <Page>
      <PageHeader title="Trader Analytics" description="Cohort and performance analysis." icon={Users} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Traders" value={traders.length} icon={Users} />
          <MetricCard label="Active" value={traders.filter((t) => t.status === "active").length} icon={Users} tone="positive" />
          <MetricCard label="Funded" value={traders.filter((t) => t.challengePhase === "funded").length} icon={TrendingUp} tone="positive" />
          <MetricCard label="Avg Win Rate" value={`${Math.round(traders.reduce((s, t) => s + t.winRate, 0) / traders.length)}%`} icon={Activity} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Trader growth (30d)</p>
          <AreaSeries data={traderGrowthSeries(tid)} xKey="date" yKey="value" color="#0ea5e9" />
        </div>
      </PageContent>
    </Page>
  );
}

export function PerformanceAnalyticsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  return (
    <Page>
      <PageHeader title="Performance Analytics" description="Trading performance metrics." icon={TrendingUp} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Revenue trend</p>
            <AreaSeries data={revenueSeries(tid)} xKey="date" yKey="value" formatValue={(v) => formatCurrency(v, runtime.tenant?.currency)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Risk distribution</p>
            <DonutSeries data={riskDistribution(tid)} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function RiskAnalyticsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  return (
    <Page>
      <PageHeader title="Risk Analytics" description="Risk distribution and breach trends." icon={Activity} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Breach trend (30d)</p>
            <BarSeries data={breachTrend(tid)} xKey="date" yKey="value" color="#dc2626" />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Risk distribution</p>
            <DonutSeries data={riskDistribution(tid)} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function AdvancedAnalyticsPage() {
  return (
    <FeatureGuard feature="analytics.advanced" fallback={<div className="p-6 text-center text-muted-foreground">Advanced analytics requires the <Badge variant="secondary">analytics.advanced</Badge> feature flag.</div>}>
      <Page>
        <PageHeader title="Advanced Analytics" description="Cohort retention and predictive insights." icon={Brain} actions={<Badge variant="secondary">Pro feature</Badge>} />
        <PageContent>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Cohort retention</p>
            <BarSeries
              data={[
                { date: "Cohort A", value: 24 },
                { date: "Cohort B", value: 31 },
                { date: "Cohort C", value: 18 },
                { date: "Cohort D", value: 27 },
                { date: "Cohort E", value: 22 },
              ]}
              xKey="date"
              yKey="value"
              color="#7c3aed"
              height={220}
            />
          </div>
        </PageContent>
      </Page>
    </FeatureGuard>
  );
}
