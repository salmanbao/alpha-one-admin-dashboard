"use client";

/**
 * API Analytics Page — API usage analytics (M21 API Gateway).
 *
 * Stitch screen: (new)
 * Tier 1 — Calls, error rates, latency, top consumers per key/tenant.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Gauge,
  Users,
  Key,
  Lock,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Server,
} from "lucide-react";

const demoApiUsage = [
  { date: "2026-10-08", totalCalls: 2450000, successfulCalls: 2432000, errorCalls: 18000, p95Latency: 142, p99Latency: 285, uniqueKeys: 42, uniqueTenants: 12 },
  { date: "2026-10-07", totalCalls: 2380000, successfulCalls: 2365000, errorCalls: 15000, p95Latency: 138, p99Latency: 272, uniqueKeys: 41, uniqueTenants: 12 },
  { date: "2026-10-06", totalCalls: 2520000, successfulCalls: 2501000, errorCalls: 19000, p95Latency: 145, p99Latency: 290, uniqueKeys: 43, uniqueTenants: 12 },
  { date: "2026-10-05", totalCalls: 2100000, successfulCalls: 2088000, errorCalls: 12000, p95Latency: 135, p99Latency: 265, uniqueKeys: 40, uniqueTenants: 11 },
  { date: "2026-10-04", totalCalls: 1950000, successfulCalls: 1938000, errorCalls: 12000, p95Latency: 132, p99Latency: 258, uniqueKeys: 39, uniqueTenants: 11 },
];

const demoTopConsumers = [
  { tenant: "Alpha Capital", keyName: "Production", calls: 850000, share: 34.7, avgLatency: 128, errorRate: 0.4 },
  { tenant: "Beta Trading", keyName: "Integration", calls: 620000, share: 25.3, avgLatency: 135, errorRate: 0.7 },
  { tenant: "Gamma Futures", keyName: "Mobile App", calls: 480000, share: 19.6, avgLatency: 148, errorRate: 1.2 },
  { tenant: "Alpha Capital", keyName: "Reporting", calls: 320000, share: 13.1, avgLatency: 142, errorRate: 0.5 },
  { tenant: "Beta Trading", keyName: "Analytics Export", calls: 180000, share: 7.3, avgLatency: 155, errorRate: 0.9 },
];

const demoErrorBreakdown = [
  { code: "429", name: "Rate Limited", count: 8200, percentage: 45.6, color: "#b83230" },
  { code: "500", name: "Server Error", count: 4500, percentage: 25.0, color: "#705c30" },
  { code: "401", name: "Unauthorized", count: 2800, percentage: 15.6, color: "#6b6358" },
  { code: "400", name: "Bad Request", count: 1500, percentage: 8.3, color: "#4a7c59" },
  { code: "503", name: "Service Unavailable", count: 1000, percentage: 5.6, color: "#74796e" },
];

export function ApiAnalyticsPage() {
  const { navigate } = usePlatform();
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => ({ usage: demoApiUsage, consumers: demoTopConsumers, errors: demoErrorBreakdown }), { delayMs: 500 }), []);
  const analytics = loadedData ?? { usage: [], consumers: [], errors: [] };
  const [timeRange, setTimeRange] = useState<string>("7d");

  const filteredUsage = useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    return analytics.usage.slice(0, days);
  }, [analytics.usage, timeRange]);

  const latest = analytics.usage[0];
  const prev = analytics.usage[1];

  const stats = useMemo(() => ({
    totalCalls: latest?.totalCalls ?? 0,
    errorRate: latest ? ((latest.errorCalls / latest.totalCalls) * 100).toFixed(2) : "0.00",
    p95Latency: latest?.p95Latency ?? 0,
    p99Latency: latest?.p99Latency ?? 0,
    uniqueKeys: latest?.uniqueKeys ?? 0,
    uniqueTenants: latest?.uniqueTenants ?? 0,
    callsDelta: latest && prev ? (((latest.totalCalls - prev.totalCalls) / prev.totalCalls) * 100).toFixed(1) : "0.0",
  }), [latest, prev]);

  return (
    <Page>
      <PageHeader
        title="API Analytics"
        description="API usage, performance, and error analytics."
        icon={Activity}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("api-keys")}>
              <Key className="mr-1 h-4 w-4" /> API Keys
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("rate-limits")}>
              <Lock className="mr-1 h-4 w-4" /> Rate Limits
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={loadedData !== undefined}
          loadingLabel="Loading API analytics…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Calls (24h)"
            value={stats.totalCalls.toLocaleString()}
            delta={parseFloat(stats.callsDelta)}
            icon={TrendingUp}
            tone={parseFloat(stats.callsDelta) >= 0 ? "positive" : "negative"}
          />
          <MetricCard label="Error Rate" value={`${stats.errorRate}%`} icon={AlertTriangle} tone={parseFloat(stats.errorRate) > 1 ? "negative" : "positive"} />
          <MetricCard label="P95 Latency" value={`${stats.p95Latency}ms`} icon={Clock} tone={stats.p95Latency > 150 ? "warning" : "positive"} />
          <MetricCard label="Unique API Keys" value={stats.uniqueKeys} icon={Key} />
        </div>

        {/* Time range selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Time Range:</span>
          <Button size="sm" variant={timeRange === "7d" ? "default" : "outline"} onClick={() => setTimeRange("7d")} className="text-[10px]">7 days</Button>
          <Button size="sm" variant={timeRange === "30d" ? "default" : "outline"} onClick={() => setTimeRange("30d")} className="text-[10px]">30 days</Button>
          <Button size="sm" variant={timeRange === "90d" ? "default" : "outline"} onClick={() => setTimeRange("90d")} className="text-[10px]">90 days</Button>
        </div>

        {/* Usage trend (table-based) */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Usage Trend</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Calls</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Successful</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Errors</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Error Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">P95</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">P99</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsage.map((day) => (
                    <tr key={day.date} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm">{new Date(day.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{day.totalCalls.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600">{day.successfulCalls.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-rose-600">{day.errorCalls.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: (day.errorCalls / day.totalCalls) > 0.01 ? "#b83230" : "#4a7c59", color: (day.errorCalls / day.totalCalls) > 0.01 ? "#b83230" : "#4a7c59" }}>
                          {((day.errorCalls / day.totalCalls) * 100).toFixed(2)}%
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">{day.p95Latency}ms</td>
                      <td className="px-4 py-3 text-sm">{day.p99Latency}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Top consumers */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Top Consumers</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calls</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Share</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Latency</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Error Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analytics.consumers.map((c, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{c.tenant}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{c.keyName}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{c.calls.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${c.share}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{c.share}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{c.avgLatency}ms</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]" style={{ borderColor: c.errorRate > 1 ? "#b83230" : c.errorRate > 0.5 ? "#705c30" : "#4a7c59", color: c.errorRate > 1 ? "#b83230" : c.errorRate > 0.5 ? "#705c30" : "#4a7c59" }}>
                            {c.errorRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Error breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Error Breakdown</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Error</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Count</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {analytics.errors.map((err) => (
                      <tr key={err.code} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="font-mono text-[10px]" style={{ borderColor: err.color, color: err.color }}>
                            {err.code}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">{err.name}</td>
                        <td className="px-4 py-3 text-sm font-semibold">{err.count.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full" style={{ width: `${err.percentage}%`, background: err.color }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{err.percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
