"use client";

/**
 * API Analytics Page — API usage analytics (M21 API Gateway).
 *
 * Stitch screen: (new)
 * Tier 1 — Calls, error rates, latency, top consumers per key/tenant.
 *
 * P1-5: Range filter (7d/30d/90d) now slices the persisted 90-day history
 * from the api-analytics store. Export/Refresh persist + audit.
 */

import { useState, useMemo } from "react";
import { Page, PageHeader, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  readApiAnalytics,
  refreshApiAnalytics,
  exportApiAnalytics,
  useApiAnalyticsVersion,
} from "@/lib/platform/api-analytics-store";
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  Clock,
  Key,
  Download,
  RefreshCw,
  User,
} from "lucide-react";
import type { ApiUsageDay } from "@/lib/platform/api-analytics-store";

export function ApiAnalyticsPage() {
  useApiAnalyticsVersion();
  const analytics = readApiAnalytics();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  // Always show the most recent `rangeDays` entries from the persisted 90-day history.
  const rangeDays = { "7d": 7, "30d": 30, "90d": 90 }[timeRange];
  const filteredUsage = useMemo(() => {
    const allUsage = analytics.usage;
    if (allUsage.length === 0) return [];
    const start = Math.max(0, allUsage.length - rangeDays);
    return allUsage.slice(start);
  }, [analytics.usage.length, timeRange]);

  const allUsage = analytics.usage;
  const latest = allUsage.length > 0 ? allUsage[allUsage.length - 1] : { totalCalls: 0, successfulCalls: 0, errorCalls: 0, p95Latency: 130, p99Latency: 250, uniqueKeys: 38, uniqueTenants: 10 } as ApiUsageDay;
  const prev = allUsage.length > 1 ? allUsage[allUsage.length - 2] : latest as ApiUsageDay;

  const stats = useMemo(() => ({
    totalCalls: latest?.totalCalls ?? 0,
    errorRate: latest ? ((latest.errorCalls / latest.totalCalls) * 100).toFixed(2) : "0.00",
    p95Latency: latest?.p95Latency ?? 0,
    p99Latency: latest?.p99Latency ?? 0,
    uniqueKeys: latest?.uniqueKeys ?? 0,
    uniqueTenants: latest?.uniqueTenants ?? 0,
    callsDelta: latest && prev ? (((latest.totalCalls - prev.totalCalls) / prev.totalCalls) * 100).toFixed(1) : "0.0",
  }), [latest, prev]);

  const handleExport = () => {
    const { csv, filename } = exportApiAnalytics(timeRange);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export complete", description: `Downloaded ${filename}` });
  };

  const handleRefresh = () => {
    refreshApiAnalytics("operator");
    toast({ title: "Refreshed", description: "API analytics regenerated from persisted history" });
  };

  return (
    <Page>
      <PageHeader
        title="API Analytics"
        description="API usage, performance, and error analytics."
        icon={Activity}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />
      <div className="mt-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Time Range:</span>
          <Button size="sm" variant={timeRange === "7d" ? "default" : "outline"} onClick={() => setTimeRange("7d")} className="text-[10px]">7 days</Button>
          <Button size="sm" variant={timeRange === "30d" ? "default" : "outline"} onClick={() => setTimeRange("30d")} className="text-[10px]">30 days</Button>
          <Button size="sm" variant={timeRange === "90d" ? "default" : "outline"} onClick={() => setTimeRange("90d")} className="text-[10px]">90 days</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
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
          <MetricCard label="Unique Tenants" value={stats.uniqueTenants} icon={User} />
        </div>

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

        <div className="grid gap-4 lg:grid-cols-2 mt-4">
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
      </div>
    </Page>
  );
}
