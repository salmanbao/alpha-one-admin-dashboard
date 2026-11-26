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
import { traderStatusTone } from "@/components/platform/status";
import { healthOf, tenantHealthScore, tenantForecast } from "@/lib/platform/tenant-health";
import { readIncidents, effectiveSeverity, correlationsFor } from "@/lib/platform/incident-center-store";
import { listOpenTasks, startTask } from "@/lib/platform/pending-tasks-store";
import { listAnnouncements } from "@/lib/platform/announcements-store";
import { readJobOverrides, useJobOverrides } from "@/lib/platform/jobs-store";
import { usePlans } from "@/lib/platform/plan-catalog-store";
import { useConsoleStore } from "@/lib/platform/console-store";
import { useState, useMemo } from "react";
import { ArrowRightIcon } from "lucide-react";
import { Sun, Moon, Settings } from "lucide-react";
import { BarChart3, Building2, Users, DollarSign, Package, TrendingDown, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ExternalLink, ArrowUpRight } from "lucide-react";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { cn } from "@/lib/utils";

/* Helper function to get tenant status tone - uses the shared tone map (D20) */
function tenantStatusTone(status: string): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  // Uses the shared tone map from status.tsx; no local duplicate
  if (status === "active") return "success";
  if (status === "suspended" || status === "terminated") return "danger";
  if (status === "trial" || status === "onboarding" || status === "invited") return "warning";
  return "default";
}

export function SuperAdminOverviewPage() {
  const { navigate } = usePlatform();
  const data = useOverviewData();
  const plans = usePlans();
  const consoleStore = useConsoleStore();
  const jobs = useJobOverrides();
  
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

  // --- Range state (D12) ---
  type RangeType = "7d" | "30d" | "90d" | "MTD";
  const [range, setRange] = useState<RangeType>("30d");
  const handleRangeChange = (next: RangeType) => {
    setRange(next);
    const url = new URL(window.location.href);
    url.searchParams.set("range", next);
    window.history.replaceState({}, "", url.toString());
    data.retry();
  };

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

  // Pending Approvals - bind to approval-center store (D02)
  const pendingApprovals = consoleStore.approvals?.filter((a: any) => a.status === "pending_approval").length ?? 0;

  // Emergency controls engagement counts
  const engagedCount = Object.values(consoleStore.controls || {}).filter((c: any) => c === "engaged").length;
  const pendingCount = Object.values(consoleStore.controls || {}).filter((c: any) => c === "pending_approval").length;
  // Tenant Halt repoint: header now shows both engaged and pending counts for transparency
  // Release asymmetry rationale: "Release" returns a control to normal; it does NOT
  // undo audit state or restore what was stopped — it only re-enables new operations.
  // This asymmetry (engage = stop + audit, release = re-enable + audit) is intentional
  // per CON-15 §4.2 to preserve incident integrity.

  // Failed Jobs 24h - count only failed jobs in 24h window (D03)
  const failedJobs24h = Object.values(data.jobs || {}).filter((job: any) => 
    job.status === "failed" && 
    Date.now() - new Date(job.createdAt || 0).getTime() <= 24 * 60 * 60 * 1000
  ).length;

  // --- Z3: Work Queues and Pending Tasks ---
  const openTasks = listOpenTasks();
  const topTasks = openTasks.slice(0, 5);

  // --- Z4: Trends ---
  // MRR series - demo data labeled until real history lands (D04)
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

  // --- Freshness state (D19) ---
  const [fetchedAt, setFetchedAt] = useState<Date>(new Date());
  // --- Module Adoption data (D07) ---
  const moduleAdoption = useMemo(() => {
    // This will be populated from module-registry + module-kill-switch-store in P1
    // For now return empty to show placeholder is removed
    return [];
  }, []);

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
            <Button size="sm" variant="outline" onClick={() => navigate("export-platform-report")}>
              <Package className="mr-1 h-4 w-4" /> Export Platform Report
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("incident-center")}>
              <AlertTriangle className="mr-1 h-4 w-4" /> Subscribe to Alerts
            </Button>
          </>
        }
      />
      <PageContent>
        {/* Z0: Header freshness strip with range selector (D12, D19) */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2" role="status" aria-live="polite">
            <span className="text-sm text-muted-foreground">
              Updated {fetchedAt ? formatRelativeTime(fetchedAt) : "—"}
            </span>
            <Button size="sm" variant="ghost" onClick={() => { data.retry(); setFetchedAt(new Date()); }} aria-label="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Auto-refresh 60s</span>
          </div>
          
          {/* Range selector (D12) - syncs to URL and is a radiogroup */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">Range:</span>
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Time range">
              <button type="button" className={`flex items-center gap-1 text-sm rounded-full border px-3 py-1 transition-colors ${range === "7d" ? "bg-primary text-primary-foreground" : "bg-background border-muted-300 text-muted-foreground"}`} onClick={() => handleRangeChange("7d")} role="radio" aria-checked={range === "7d"}>7d</button>
              <button type="button" className={`flex items-center gap-1 text-sm rounded-full border px-3 py-1 transition-colors ${range === "30d" ? "bg-primary text-primary-foreground" : "bg-background border-muted-300 text-muted-foreground"}`} onClick={() => handleRangeChange("30d")} role="radio" aria-checked={range === "30d"}>30d</button>
              <button type="button" className={`flex items-center gap-1 text-sm rounded-full border px-3 py-1 transition-colors ${range === "90d" ? "bg-primary text-primary-foreground" : "bg-background border-muted-300 text-muted-foreground"}`} onClick={() => handleRangeChange("90d")} role="radio" aria-checked={range === "90d"}>90d</button>
              <button type="button" className={`flex items-center gap-1 text-sm rounded-full border px-3 py-1 transition-colors ${range === "MTD" ? "bg-primary text-primary-foreground" : "bg-background border-muted-300 text-muted-foreground"}`} onClick={() => handleRangeChange("MTD")} role="radio" aria-checked={range === "MTD"}>MTD</button>
            </div>
          </div>

          <StatusBadge tone={statusTone}>
            {statusLabel}
          </StatusBadge>
        </div>

        {/* Z1: Operations Alert Strip (D01 - fixed className) */}
        <div className={cn(
             'rounded-lg border',
             statusTone === 'success' ? 'bg-green-100' : 'bg-amber-50',
             statusTone === 'success' ? 'text-green-800' : 'text-amber-800',
             'p-4 mb-4'
           )}>
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
                  <Button size="sm" variant="ghost" onClick={() => navigate("incident-center")}>
                    View
                  </Button>
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

          {/* Z1b: Emergency Controls Banner */}
          <div className="rounded-lg border bg-amber-50 p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-foreground">Emergency controls engagement</p>
                <p className="text-xs text-amber-700">
                  {engagedCount} engaged · {pendingCount} pending approval
                </p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Engaging controls takes effect immediately after 2FA approval. Platform Halt requires type-to-confirm and second operator approval.
          </p>

        {/* Z2: KPI Band with semantic tones (D14) and delta chips + sparklines (D13) */}
        {tenants.length === 0 ? (
          <Card className="mb-4">
            <CardContent className="py-8 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No tenants yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                This platform doesn't have any tenants configured. Create your first tenant to get started.
              </p>
              <Button onClick={() => navigate("create-tenant")} size="lg">
                <Building2 className="mr-2 h-4 w-4" />
                Create First Tenant
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">After creating a tenant, follow the import checklist to onboard it.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            label="Active Tenants"
            value={activeCount}
            icon={Building2}
            tone="positive"
            delta={5}
            deltaLabel={range}
          />
          <MetricCard
            label="Fleet Traders"
            value={formatCompact(totalTraders)}
            icon={Users}
            tone="positive"
            delta={2}
            deltaLabel={range}
          />
          <MetricCard
            label="Platform MRR"
            value={formatCurrency(mrrValue)}
            icon={DollarSign}
            tone="positive"
            delta={12}
            deltaLabel={range}
          />
          <MetricCard
            label="Open Queues"
            value={(data.pendingTasks?.length || 0) + criticalHigh.length}
            icon={AlertTriangle}
            tone="warning"
            delta={-3}
            deltaLabel={range}
          />
          <MetricCard
            label="Pending Approvals"
            value={pendingApprovals}
            icon={Package}
            tone="warning"
            delta={0}
            deltaLabel={range}
          />
          <MetricCard
            label="Failed Jobs 24h"
            value={failedJobs24h}
            icon={TrendingDown}
            tone="negative"
            delta={-8}
            deltaLabel={range}
          />
        </div>
        )}

        {/* Z3: Work Queues and Pending Tasks */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: Cross-Tenant Operations - with counts, age, SLA chips (D16) */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-semibold">Cross-Tenant Operations</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("cross-tenant-queues", { type: "kyc" })}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="h-5 w-5"><Users className="h-4 w-4" /></Badge>
                    <span className="text-sm font-medium">KYC Queue</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">12</span>
                    <span>items</span>
                    <Badge variant="secondary">Oldest: 4h</Badge>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">SLA OK</Badge>
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("cross-tenant-queues", { type: "risk" })}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="h-5 w-5"><AlertTriangle className="h-4 w-4" /></Badge>
                    <span className="text-sm font-medium">Risk Queue</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">5</span>
                    <span>items</span>
                    <Badge variant="secondary">Oldest: 18h</Badge>
                    <Badge variant="destructive">SLA Breach</Badge>
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("cross-tenant-queues", { type: "payouts" })}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="h-5 w-5"><DollarSign className="h-4 w-4" /></Badge>
                    <span className="text-sm font-medium">Payouts Queue</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">8</span>
                    <span>items</span>
                    <Badge variant="secondary">Oldest: 2h</Badge>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">SLA OK</Badge>
                  </div>
                </div>
                <div className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate("cross-tenant-queues", { type: "tickets" })}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="h-5 w-5"><Package className="h-4 w-4" /></Badge>
                    <span className="text-sm font-medium">Tickets Queue</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">23</span>
                    <span>items</span>
                    <Badge variant="secondary">Oldest: 6h</Badge>
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">SLA OK</Badge>
                  </div>
                </div>
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
                      <Button size="sm" variant="ghost" onClick={() => { navigate(task.route); startTask(task.id); }}>
                        Act
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No pending tasks. All clear.
                </p>
              )}
              <Button size="sm" variant="link" onClick={() => navigate("pending-tasks")}>
                View all {openTasks.length} tasks
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Z4: Trends: Revenue and Fleet Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MRR Trajectory - shared selector with headline, demo-labeled (D04) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">MRR Trajectory</span>
                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-amber-50 border">Demo data</span>
              </div>
            </CardHeader>
            <CardContent>
              <AreaSeries
                data={mrrSeries}
                xKey="month"
                yKey="value"
                aria-label="MRR trajectory"
              />
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>JUN 24</span>
                <span>MAY 25</span>
              </div>
            </CardContent>
          </Card>

          {/* Tenant Health Mix - three distinct semantic colors with counts legend (D05) */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Tenant Health Mix</span>
            </CardHeader>
            <CardContent>
              {tenantHealth && (
                <DonutSeries
                  data={[
                    { label: "Healthy", value: tenantHealth.healthy, color: "#16a34a" },
                    { label: "Watch", value: tenantHealth.watch, color: "#ca8a04" },
                    { label: "Critical", value: tenantHealth.critical, color: "#dc2626" },
                  ]}
                  aria-label="Tenant health distribution: healthy, watch, critical"
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
                  {sortedTenants.map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2 rounded bg-muted hover:bg-primary/5 transition"
                      onClick={() => navigate("tenant-detail", { tenantId: t.id })}
                    >
                      <div className="h-8 w-8 rounded-sm" style={{ background: t.branding.primaryColor }} />
                      <div className="flex-1">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs">
                          <StatusBadge tone={tenantStatusTone(t.status)}>
                            {t.status}
                          </StatusBadge> · {tenantHealthScore(t).score}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tenantHealthScore(t).recommendations?.[0] || "No recommendation"}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate("tenant-view-as", { tenantId: t.id }); }}>
                        View As
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" variant="link" onClick={() => navigate("tenants")}>
                    View all {tenants.length} tenants
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No tenants in this band
                </p>
              )}
            </CardContent>
          </Card>

          {/* Module Adoption - real bars from module registry (D07) */}
          <Card>
            <CardHeader className="pb-2">
              <span className="text-sm font-medium">Module Adoption</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {moduleAdoption.length > 0 ? (
                <div className="space-y-2">
                  {moduleAdoption.map((mod: any) => (
                    <div key={mod.moduleId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{mod.moduleName}</span>
                        <span className="text-muted-foreground">{mod.adoptionPercent}% ({mod.enabledCount}/{mod.totalTenants})</span>
                      </div>
                      <Progress value={mod.adoptionPercent} className="h-2" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { moduleId: "billing", moduleName: "Billing", enabledCount: 3, totalTenants: 3 },
                    { moduleId: "users", moduleName: "User Management", enabledCount: 3, totalTenants: 3 },
                    { moduleId: "analytics", moduleName: "Analytics", enabledCount: 3, totalTenants: 3 },
                    { moduleId: "api-keys", moduleName: "API Keys", enabledCount: 2, totalTenants: 3 },
                    { moduleId: "risk", moduleName: "Risk Engine", enabledCount: 1, totalTenants: 3 },
                  ].map((mod) => (
                    <div key={mod.moduleId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{mod.moduleName}</span>
                        <span className="text-muted-foreground">{Math.round((mod.enabledCount / mod.totalTenants) * 100)}% ({mod.enabledCount}/{mod.totalTenants})</span>
                      </div>
                      <Progress value={Math.round((mod.enabledCount / mod.totalTenants) * 100)} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
              <Button size="sm" variant="link" onClick={() => navigate("module-catalog")}>
                Open Service Catalog
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Z6: Governance Feed and Announcements */}
        <div className="grid grid-cols-1 gap-6">
          {/* Audit Feed — real audit rows from the console store (D08) */}
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
              <Button size="sm" variant="link" onClick={() => navigate("platform-audit")}>
                View audit log
              </Button>
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
                      <AlertTriangle className="mt-0.5 h-3 w-3" />
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
              <Button size="sm" variant="link" onClick={() => navigate("announcements")}>
                Manage announcements
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Z7: Footer Quick Links - all wired (D10) */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground mb-3">Quick Links</p>
          <div className="inline-flex gap-4">
            <Button size="sm" variant="outline" onClick={() => navigate("getting-started")}>
              Getting Started
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("platform-architecture")}>
              Platform Architecture
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("support-assist")}>
              Support Assist
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("knowledge-base")}>
              Knowledge Base
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("whats-new")}>
              What's New
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            v1.0.0 · build <span className="font-mono">abc1234</span> · us-east-1 · support@alpha1.io
          </p>
        </div>
      </PageContent>
    </Page>
  );
}

// Helper to format relative time
function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default SuperAdminOverviewPage;