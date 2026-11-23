"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { useOverviewData } from "@/lib/platform/overview-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { MetricCard } from "@/components/platform/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AreaSeries, DonutSeries, Sparkline, ChartEmpty } from "@/components/platform/charts";
import { StatusBadge } from "@/components/platform/status";
import { healthOf, tenantHealthScore, tenantForecast } from "@/lib/platform/tenant-health";
import { readIncidents, effectiveSeverity, correlationsFor } from "@/lib/platform/incident-center-store";
import { listOpenTasks } from "@/lib/platform/pending-tasks-store";
import { listAnnouncements } from "@/lib/platform/announcements-store";
import { readJobOverrides, useJobOverrides } from "@/lib/platform/jobs-store";
import { usePlans } from "@/lib/platform/plan-catalog-store";
import { useAsyncMock } from "@/lib/platform/async-mock";
import { useState, useMemo } from "react";
import { ArrowRightIcon } from "lucide-react";
import { Sun, Moon, Settings } from "lucide-react";
import { Building2, Users, DollarSign, Package, TrendingDown, BarChart3, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { traderStatusTone } from "@/components/platform/status";

/* Helper function to get tenant status tone */
function tenantStatusTone(status: string): string {
  // Simplified mapping - in reality this would use traderStatusTone or similar
  if (status === "active") return "positive";
  if (status === "suspended" || status === "terminated") return "negative";
  if (status === "trial" || status === "onboarding" || status === "invited") return "warning";
  return "default";
}

export function SuperAdminOverviewPage() {
  const { navigate } = usePlatform();
  const data = useOverviewData();
  const plans = usePlans(); // Must be called unconditionally at top level

  // --- Z0-Z1: Header & Alert Strip ---
  const incidentState = data.incidentState || { overrides: {}, acks: {} };
  const openIncidents = (data.incidents || []).filter((i: any) => 
    !["resolved"].includes(effectiveSeverity(i, incidentState.overrides))
  );
  const criticalHigh = openIncidents.filter((i: any) => 
    effectiveSeverity(i, incidentState.overrides) === "critical" || 
    effectiveSeverity(i, incidentState.overrides) === "high"
  );
  const hasActiveIncidents = criticalHigh.length > 0;
  const statusLabel = hasActiveIncidents 
    ? `${criticalHigh.length} active incidents` 
    : "All systems operational";
  const statusTone: "default" | "success" | "warning" | "info" = hasActiveIncidents ? "warning" : "success";

  // --- Z2: KPI Band ---
  const tenants = data.tenants || [];
  const mrrValue = data.mrrValue || 
    tenants.reduce((sum: number, t: any) => {
      const plan = plans.find((p: any) => p.id === t.plan);
      return sum + (plan ? plan.priceMonthly : 0);
    }, 0);
  const activeCount = tenants.filter((t: any) => t.status === "active").length;

  const totalTraders = useMemo(() => {
    return tenants.reduce((s: number, t: any) => s + (t.traderCount || 0), 0);
  }, [tenants]);

  const pendingApprovals = 0;
  const failedJobs24h = (data.jobs || []).length;

  // --- Z3: Work Queues and Pending Tasks ---
  const openTasks = listOpenTasks();
  const topTasks = openTasks.slice(0, 5);

  // --- Z4: Trends ---
  const mrrSeries = useMemo(() => {
    return [
      { month: "JUN 24", value: 210000, color: "var(--brand-primary)" },
      { month: "AUG 24", value: 245000, color: "var(--brand-primary)" },
      { month: "OCT 24", value: 288000, color: "var(--brand-primary)" },
      { month: "DEC 24", value: 325000, color: "var(--brand-primary)" },
      { month: "FEB 25", value: 365000, color: "var(--brand-primary)" },
      { month: "APR 25", value: 410000, color: "var(--brand-primary)" },
      { month: "MAY 25", value: 482500, color: "var(--brand-primary)" },
    ];
  }, []);

  const tenantHealth = useMemo(() => {
    const counts: Record<string, number> = { healthy: 0, watch: 0, critical: 0 };
    for (const t of tenants) {
      const h = healthOf(t);
      counts[h] = (counts[h] || 0) + 1;
    }
    return counts;
  }, [tenants]);

  const churnRisk = useMemo(() => {
    let high = 0, medium = 0;
    for (const t of tenants) {
      const forecast = tenantForecast(t);
      if (forecast.churnRisk === "high") high++;
      else if (forecast.churnRisk === "medium") medium++;
    }
    return { high, medium };
  }, [tenants]);

  // --- Z5: Tenant Watchlist sorted by health band + score ---
  const sortedTenants = useMemo(() => {
    const bandOrder: Record<string, number> = { critical: 0, watch: 1, healthy: 2 };
    return [...tenants].sort((a: any, b: any) => {
      const ha = healthOf(a);
      const hb = healthOf(b);
      if (bandOrder[ha] !== bandOrder[hb]) return bandOrder[ha] - bandOrder[hb];
      return tenantHealthScore(a).score - tenantHealthScore(b).score;
    }).slice(0, 6);
  }, [tenants]);

  // --- Z6: Governance --
  const correlations = correlationsFor(
    data.incidents || [],
    data.incidentState || { overrides: {}, acks: {} }
  );
  const auditRows = correlations.slice(0, 8).map((c: any) => ({
    provider: c.providerName,
    action: `Correlation: ${c.providerName}`,
    tenantsAffected: c.tenantIds.length,
    time: new Date().toISOString(),
  }));

  const visibleAnnouncements = (data.announcements || listAnnouncements())
    .filter((a: any) => a.status === "visible")
    .slice(0, 5);

  return (
    <Page>
      <PageHeader
        title="Platform Overview"
        description="PFaaS platform health and operational dashboard. Global command center for all tenants and resources."
        icon={BarChart3}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate("create-tenant")}>
              <Building2 className="mr-1 h-4 w-4" /> Create Tenant
            </Button>
            <Button size="sm" variant="outline">
              <Package className="mr-1 h-4 w-4" /> Export Platform Report
            </Button>
            <Button size="sm" variant="outline">
              <AlertTriangle className="mr-1 h-4 w-4" /> Subscribe to Alerts
            </Button>
          </>
        }
      />
      <PageContent>
        {/* Z0: Header freshness strip */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm text-muted-foreground">
            Updated {new Date().toLocaleTimeString()} · Range: 30 days
          </span>
          <StatusBadge tone={statusTone}>
            {statusLabel}
          </StatusBadge>
        </div>

        {/* Z1: Operations Alert Strip */}
        <div className="rounded-lg border {statusTone === 'success' ? 'bg-green-100' : 'bg-amber-50'} {statusTone === 'success' ? 'text-green-800' : 'text-amber-800'} p-4 mb-4">
          {criticalHigh.length > 0 ? (
            <div className="space-y-2 text-sm">
              {criticalHigh.slice(0, 2).map((inc: any, i: number) => (
                <div key={inc.id} className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <div className="flex-1">
                    <p className="font-medium">{inc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {inc.started} · Owner: {inc.owner}
                    </p>
                  </div>
                  <a
                    href="#"
                    className="text-amber-600 underline hover:text-primary"
                    onClick={() => navigate("incident-center")}
                  >
                    View
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-emerald-600">No active platform incidents</span>
            </div>
          )}
        </div>

        {/* Z2: KPI Band */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Active Tenants"
            value={activeCount}
            icon={Building2}
            tone="positive"
          />
          <MetricCard
            label="Fleet Traders"
            value={formatCompact(totalTraders)}
            icon={Users}
            tone="positive"
          />
          <MetricCard
            label="Platform MRR"
            value={formatCurrency(mrrValue)}
            icon={DollarSign}
            tone="positive"
          />
          <MetricCard
            label="Open Queues"
            value={(data.pendingTasks?.length || 0) + criticalHigh.length}
            icon={AlertTriangle}
            tone="warning"
          />
          <MetricCard
            label="Pending Approvals"
            value={pendingApprovals}
            icon={Package}
            tone="warning"
          />
          <MetricCard
            label="Failed Jobs 24h"
            value={failedJobs24h}
            icon={TrendingDown}
            tone="negative"
          />
        </div>

        {/* Z3: Work Queues and Pending Tasks */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: Cross-Tenant Operations */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-semibold">Cross-Tenant Operations</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button size="icon" variant="outline" className="w-10 h-10 rounded-lg flex items-center justify-center" onClick={() => navigate("cross-tenant-queues", { type: "kyc" })}>
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-xs">KYC</span>
                </Button>
                <Button size="icon" variant="outline" className="w-10 h-10 rounded-lg flex items-center justify-center" onClick={() => navigate("cross-tenant-queues", { type: "risk" })}>
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-xs">Risk</span>
                </Button>
                <Button size="icon" variant="outline" className="w-10 h-10 rounded-lg flex items-center justify-center" onClick={() => navigate("cross-tenant-queues", { type: "payouts" })}>
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-xs">Payouts</span>
                </Button>
                <Button size="icon" variant="outline" className="w-10 h-10 rounded-lg flex items-center justify-center" onClick={() => navigate("cross-tenant-queues", { type: "tickets" })}>
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-xs">Tickets</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Unified queue roll-up across every tenant — triage systemic issues from one place.
              </p>
            </CardContent>
          </Card>

          {/* Right: Pending Tasks */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-semibold">Pending Tasks</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {topTasks.length > 0 ? (
                <div className="space-y-2">
                  {topTasks.map((task: any) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded bg-muted hover:bg-primary/5 transition">
                      <span className={`badge ${traderStatusTone(task.priority)} mr-1`}>
                        {task.priority}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.description}</p>
                      </div>
                      <a
                        href="#"
                        className="underline hover:text-primary block mt-2"
                        onClick={() => navigate("pending-tasks")}
                      >
                        Take action
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pending tasks. All clear.
                </p>
              )}
              <a
                href="#"
                className="text-sm underline hover:text-primary block mt-2"
                onClick={() => navigate("pending-tasks")}
              >
                View all {openTasks.length} tasks
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Z4: Trends: Revenue and Fleet Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MRR Trajectory */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">MRR Trajectory</span>
            </CardHeader>
            <CardContent>
              <AreaSeries
                data={mrrSeries}
                xKey="month"
                yKey="value"
                aria-label="MRR trajectory (demo)"
              />
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>JUN 24</span>
                <span>MAY 25</span>
              </div>
            </CardContent>
          </Card>

          {/* Tenant Health Mix */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Tenant Health Mix</span>
            </CardHeader>
            <CardContent>
              {tenantHealth && (
                <DonutSeries
                  data={[
                    { label: "Healthy", value: tenantHealth.healthy, color: "var(--brand-primary)" },
                    { label: "Watch", value: tenantHealth.watch, color: "var(--brand-primary)" },
                    { label: "Critical", value: tenantHealth.critical, color: "var(--brand-primary)" },
                  ]}
                  aria-label="Tenant health distribution"
                />
              )}
              <p className="mt-2 text-sm">
                High churn risk: {churnRisk.high} · Near plan limit: {churnRisk.medium}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Z5: Tenant Watchlist and Module Adoption */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tenant Watchlist */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Tenant Watchlist</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {sortedTenants.length > 0 ? (
                <div className="space-y-2">
                  {sortedTenants.map((t: any, i: number) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2 rounded bg-muted hover:bg-primary/5 transition"
                      onClick={() => navigate("tenant-detail", { tenantId: t.id })}
                    >
                      <div className="h-8 w-8 rounded-sm" style={{ background: t.branding.primaryColor }} />
                      <div className="flex-1">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs">
                          <StatusBadge tone={traderStatusTone(t.status)}>
                            {t.status}
                          </StatusBadge> · {tenantHealthScore(t).score}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tenantHealthScore(t).recommendations?.[0] || "No recommendation"}
                        </p>
                      </div>
                    </div>
                  ))}
                  <a
                    href="#"
                    className="text-sm underline hover:text-primary block mt-2"
                    onClick={() => navigate("tenants")}
                  >
                    View all {tenants.length} tenants
                  </a>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tenants in this band
                </p>
              )}
            </CardContent>
          </Card>

          {/* Module Adoption */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Module Adoption</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Top modules by adoption percentage (demo data labeled)
              </p>
              <a
                href="#"
                className="text-sm underline hover:text-primary block mt-2"
                onClick={() => navigate("module-catalog")}
              >
                Open Service Catalog
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Z6: Governance Feed and Announcements */}
        <div className="grid grid-cols-1 gap-6">
          {/* Audit Feed */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Platform Audit</span>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {auditRows.length > 0 ? (
                <div className="space-y-2">
                  {auditRows.map((row: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-1 rounded bg-muted hover:bg-primary/5 transition">
                      <span className="text-[10px] font-medium">{row.provider}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {row.action} · {row.tenantsAffected} tenants affected
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No audit entries</p>
              )}
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Announcements</span>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {visibleAnnouncements.length > 0 ? (
                <div className="space-y-2">
                  {visibleAnnouncements.map((ann: any) => (
                    <div key={ann.id} className="flex items-start gap-2 p-1 rounded bg-muted hover:bg-primary/5 transition">
                      <AlertTriangle className="mt-0.5 h-3 w-3"  />
                      <div className="flex-1">
                        <p className="font-medium truncate">{ann.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ann.start} — {ann.scope}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No announcements</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Z7: Footer Quick Links */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground mb-3">Quick Links</p>
          <div className="inline-flex gap-4">
            <Button size="sm" variant="outline">Getting Started</Button>
            <Button size="sm" variant="outline">Platform Architecture</Button>
            <Button size="sm" variant="outline">Support Assist</Button>
            <Button size="sm" variant="outline">Knowledge Base</Button>
            <Button size="sm" variant="outline">What's New</Button>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export default SuperAdminOverviewPage;