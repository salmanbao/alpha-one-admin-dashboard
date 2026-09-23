"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { revenueSeries, traderGrowthSeries, riskDistribution, breachTrend, getTenantTraders } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { AreaSeries, DonutSeries, BarSeries } from "@/components/platform/charts";
import { BarChart3, TrendingUp, Users, DollarSign, Activity, Brain, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGuard, FeatureGuard } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { convertCurrency, formatConverted, getRateLabel, CURRENCIES } from "@/lib/platform/currency";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Coins } from "lucide-react";

export function AnalyticsOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const tenantCurrency = runtime.tenant?.currency ?? "USD";
  const [displayCurrency, setDisplayCurrency] = useState(tenantCurrency);
  const rev = revenueSeries(tid);
  const totalRev = rev.reduce((s, r) => s + r.value, 0);
  // Convert to display currency
  const convertedRev = convertCurrency(totalRev, tenantCurrency, displayCurrency);
  const convertedAvg = convertCurrency(totalRev / 30, tenantCurrency, displayCurrency);
  const fmt = (v: number) => formatConverted(v, tenantCurrency, displayCurrency);

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description={`Business intelligence across this ${term("trader").toLowerCase()} tenant.`}
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2">
            {/* Multi-currency selector */}
            <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none"
                aria-label="Display currency"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
                ))}
              </select>
            </div>
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
          </div>
        }
      />
      <PageContent>
        {/* Exchange rate banner */}
        {displayCurrency !== tenantCurrency ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Converting from</span>
            <Badge variant="outline" className="text-[10px]">{tenantCurrency}</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="text-[10px]">{displayCurrency}</Badge>
            <span className="ml-auto font-medium text-foreground">{getRateLabel(tenantCurrency, displayCurrency)}</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Revenue (30d)" value={fmt(totalRev)} delta={8} icon={DollarSign} tone="positive" />
          <MetricCard label="Avg Daily Rev" value={fmt(totalRev / 30)} delta={4} icon={TrendingUp} tone="positive" />
          <MetricCard label={`${term("trader")} Growth`} value="+18%" delta={18} icon={Users} tone="positive" />
          <MetricCard label="Breaches (30d)" value={breachTrend(tid).reduce((s, b) => s + b.value, 0)} delta={-12} icon={Activity} tone="positive" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Revenue (30d) — {displayCurrency}</p>
            <AreaSeries data={rev} xKey="date" yKey="value" formatValue={(v) => fmt(v)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">{`${term("trader")} growth`}</p>
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
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid);
  const currency = runtime.tenant?.currency ?? "USD";
  return (
    <Page>
      <PageHeader title={`${term("trader")} Analytics`} description={`Cohort and performance analysis for this ${term("trader").toLowerCase()} tenant.`} icon={Users} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label={`Total ${plural(term("trader"))}`} value={traders.length} icon={Users} />
          <MetricCard label="Active" value={traders.filter((t) => t.status === "active").length} icon={Users} tone="positive" />
          <MetricCard label="Funded" value={traders.filter((t) => t.challengePhase === "funded").length} icon={TrendingUp} tone="positive" />
          <MetricCard label="Avg Win Rate" value={`${Math.round(traders.reduce((s, t) => s + t.winRate, 0) / traders.length)}%`} icon={Activity} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">{`${term("trader")} growth (30d)`}</p>
          <AreaSeries data={traderGrowthSeries(tid)} xKey="date" yKey="value" color="#0ea5e9" />
        </div>
      </PageContent>
    </Page>
  );
}

export function PerformanceAnalyticsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  return (
    <Page>
      <PageHeader title="Performance Analytics" description={`Trading performance metrics across all ${plural(term("trader")).toLowerCase()}.`} icon={TrendingUp} />
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
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  return (
    <Page>
      <PageHeader title="Risk Analytics" description={`Risk distribution and breach trends across all ${plural(term("trader")).toLowerCase()}.`} icon={Activity} />
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
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  return (
    <FeatureGuard feature="analytics.advanced" fallback={<div className="p-6 text-center text-muted-foreground">Advanced analytics requires the <Badge variant="secondary">analytics.advanced</Badge> feature flag.</div>}>
      <Page>
        <PageHeader title="Advanced Analytics" description={`Cohort retention and predictive insights across ${plural(term("trader")).toLowerCase()} and ${plural(term("challenge")).toLowerCase()}.`} icon={Brain} actions={<Badge variant="secondary">Pro feature</Badge>} />
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
