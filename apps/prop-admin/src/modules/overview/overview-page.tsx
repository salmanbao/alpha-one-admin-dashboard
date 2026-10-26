"use client";

/** 
 * PFaaS Platform — Prop Firm Admin Overview Page
 * Dashboard view with KPI metrics, trader stats, and quick actions
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { useTenant } from "@/lib/platform/platform-context";
import { useRuntime } from "@/lib/platform/platform-context";
import { useQueries } from "@tanstack/react-query";
import { AiInsight } from "@/lib/platform/mock-data";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/lib/platform/currency";
import { formatCompact } from "@/lib/platform/currency";
import { breachSeverityTone } from "@/components/platform/status";
import { useMemo } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CardGrid } from "@/components/platform/card-grid";

const KPI_CARDS = [
  {
    id: "traders",
    title: "Total Traders",
    description: "Active trading participants",
    icon: "Users",
    color: "primary",
    value: 76,
    trend: +12,
    trendDirection: "up",
    subtitle: "across 3 tenants",
  },
  {
    id: "active-challenges",
    title: "Active Challenges",
    description: "Current evaluation phases",
    icon: "Target",
    color: "success",
    value: 23,
    trend: +5,
    trendDirection: "up",
    subtitle: "in progress",
  },
  {
    id: "payouts-pending",
    title: "Pending Payouts",
    description: "Withdrawal requests awaiting approval",
    icon: "Banknote",
    color: "warning",
    value: 14,
    trend: -2,
    trendDirection: "down",
    subtitle: "total amount: $18,500",
  },
  {
    id: "ai-insights",
    title: "AI Insights",
    description: "Anomalies & recommendations",
    icon: "Brain",
    color: "info",
    value: 3,
    trend: +1,
    trendDirection: "up",
    subtitle: "active this week",
  },
];

export function OverviewPage() {
  const { runtime, user, tenant } = usePlatform();
  const { enabledModules } = runtime;

  // Fetch AI insights for the tenant
  const { data: aiInsights = [], isLoading } = useQueries({
    queries: [
      {
        queryKey: ["ai-insights", tenant.id],
        queryFn: async () => {
          // Filter AI insights for this tenant
          const allInsights = []; // Will use seeded data below
          return allInsights.filter((i: any) => i.tenantId === tenant.id);
        },
        refetchInterval: 30000,
      },
    ],
  });

  // Use seeded AI insights if no data fetched yet
  const tenantAiInsights: AiInsight[] = useMemo(() => {
    // Get insights for this tenant from mock data
    const all = []; // Would import from mock-data
    return all.filter((i: any) => i.tenantId === tenant.id);
  }, [tenant.id]);

  // Use seeded data directly
  const insights = useMemo(() => {
    // Seed based on tenant
    const seeds: AiInsight[] = [
      {
        id: "ai-1",
        tenantId: tenant.id,
        module: "ai",
        title: "Payout spike detected",
        summary: "Payout requests up 38% week-over-week, concentrated in funded traders.",
        detail: "Model confidence 87%. Recommend reviewing payout reserves.",
        severity: "warning",
        confidence: 0.87,
        generatedAt: new Date(Date.now() - 2 * 60000).toISOString(),
      },
      {
        id: "ai-2",
        tenantId: tenant.id,
        module: "ai",
        title: "Affiliate conversion opportunity",
        summary: "Affiliates in 'gold' tier convert 2.4x better. Consider tier upgrade for 3 partners.",
        detail: "Expected revenue uplift: $18.4k over 30 days.",
        severity: "opportunity",
        confidence: 0.78,
        generatedAt: new Date(Date.now() - 6 * 60000).toISOString(),
      },
    ];
    // Filter for current tenant
    return seeds.filter((s) => s.tenantId === tenant.id || s.tenantId === "platform");
  }, [tenant.id]);

  const isTenantBeta = tenant.id === "tenant-beta";

  return (
    <Card className="p-6">
      <CardHeader className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-foreground">
          {tenant.name} — Overview
        </h2>
        <p className="text-muted-foreground">
          {tenant.currency} · {tenant.plan.toUpperCase()} plan · {tenant.enabledModules.length} modules enabled
        </p>
      </CardHeader>

      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* KPI Cards */}
        <CardGrid cards={KPI_CARDS} />

        {/* Quick Stats Section */}
        {enabledModules.includes("trading") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="text-sm font-medium text-foreground">Top Performing Traders</h3>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {["Tom Allen", "Marcus Webb", "James Park"].map((name, i) => (
                    <div key={i} className="flex items-center gap-3 px-2 py-1.5 rounded-md border bg-muted/50 text-sm">
                      <div className="h-3 w-3 rounded-full bg-primary-600" />
                      <span className="flex-1 truncate font-medium text-foreground">{name}</span>
                      <span className="text-primary">+8.2% P/L</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="text-sm font-medium text-foreground">Recent Breaches</h3>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {["Daily drawdown", "Max drawdown"].map((type, i) => (
                    <div key={i} className="flex items-center gap-3 px-2 py-1.5 rounded-md border bg-muted/50 text-sm">
                      <StatusBadge tone={breachSeverityTone("critical")} className="h-2 w-2">
                        •
                      </StatusBadge>
                      <span className="flex-1 truncate font-medium text-foreground">{type}</span>
                      <span className="text-amber-500">2 open</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Insights Section */}
        {enabledModules.includes("ai") && insights.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">AI Insights</h3>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    "flex items-start gap-3 rounded-md p-3",
                    "bg-white dark:bg-muted border border-border",
                    insight.severity === "critical" ? "border-destructive/20" : "",
                    insight.severity === "warning" ? "border-warning/20" : "",
                    insight.severity === "success" ? "border-success/20" : "",
                    insight.severity === "info" ? "border-info/20" : ""
                  )}
                >
                  <StatusBadge
                    tone={insight.severity as any}
                    className="h-3 w-3 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{insight.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {insight.summary}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Trader Growth Chart - placeholder */}
        {!enabledModules.includes("analytics") && (
          <Card>
            <CardHeader>
              <h3 className="text-sm font-medium text-foreground">Trader Growth</h3>
            </CardHeader>
            <CardContent className="p-4 text-muted-foreground text-center">
              <p className="text-sm">
                Enable the <span className="font-medium text-primary">Analytics</span> module
                to view trader growth charts and performance analytics.
              </p>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}