"use client";

/**
 * Adoption Funnel Page — drill-down for tenant module adoption.
 *
 * Stitch screen: (new)
 * Tier 2 — Per-tenant funnel from invited → trial → active → engaged,
 * with drop-off reasons, cohort retention, and module enablement velocity.
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants } from "@/lib/platform/tenant-store";
import type { TenantContext } from "@/lib/platform/types";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import {
  Users,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Filter,
  Funnel,
  BarChart2,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
} from "lucide-react";
import { useSavedViews } from "@/lib/platform/saved-views";
import { healthOf, tenantHealthScore } from "@/lib/platform/tenant-health";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";

interface AdoptionStage {
  id: string;
  label: string;
  description: string;
  count: number;
  percentage: number;
  dropOff?: number;
  dropOffReason?: string;
}

interface TenantAdoptionRow {
  id: string;
  tenant: string;
  tenantId: string;
  currentStage: string;
  daysInStage: number;
  modulesEnabled: number;
  targetModules: number;
  enablementVelocity: number; // modules/month
  healthScore: number;
  riskLevel: "low" | "medium" | "high";
  lastActivity: string;
}

const ADOPTION_STAGES: AdoptionStage[] = [
  { id: "invited", label: "Invited", description: "Invitation sent, pending first login", count: 0, percentage: 0 },
  { id: "trial", label: "Trial", description: "Active trial with limited features", count: 0, percentage: 0 },
  { id: "onboarding", label: "Onboarding", description: "Going through guided setup", count: 0, percentage: 0 },
  { id: "active", label: "Active", description: "Full access, normal billing", count: 0, percentage: 0 },
  { id: "engaged", label: "Engaged", description: "5+ modules enabled, daily activity", count: 0, percentage: 0 },
];

export function AdoptionFunnelPage() {
  const { user } = usePlatform();
  const tenants = useTenants();
  const { views, saveView, deleteView, renameView, applyView } = useSavedViews("adoption-funnel", user?.id ?? "anon");

  const tenantRoster = tenants.filter((t) => t.id !== "platform");

  // Async seam for data hydration
  const { data: hydrated, loading, error, retry } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);

  // Calculate adoption stages
  const stages = useMemo(() => {
    const stageCounts = tenantRoster.reduce((acc, t) => {
      let stage: string = t.status;
      if (t.status === "active" && t.enabledModules.length >= 5) stage = "engaged";
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = tenantRoster.length;
    return ADOPTION_STAGES.map((stage) => {
      const count = stageCounts[stage.id] || 0;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      const prevStageCount = stageCounts[ADOPTION_STAGES[ADOPTION_STAGES.findIndex(s => s.id === stage.id) - 1]?.id] || count;
      const dropOff = prevStageCount > count ? prevStageCount - count : 0;
      const dropOffReason = dropOff > 0 
        ? stage.id === "active" ? "Onboarding friction" 
        : stage.id === "engaged" ? "Module adoption ceiling" 
        : "Conversion failure"
        : undefined;

      return { ...stage, count, percentage, dropOff, dropOffReason };
    });
  }, [tenantRoster]);

  // Build tenant adoption rows for drill-down table
  const adoptionRows = useMemo((): TenantAdoptionRow[] => {
    return tenantRoster.map((t) => {
      const health = tenantHealthScore(t);
      let currentStage: string = t.status;
      if (t.status === "active" && t.enabledModules.length >= 5) currentStage = "engaged";
      else if (t.status === "active" && t.enabledModules.length >= 3) currentStage = "active";
      else if (t.status === "onboarding") currentStage = "onboarding";
      else if (t.status === "trial") currentStage = "trial";
      else currentStage = "invited";

      const created = new Date(t.createdAt).getTime();
      const now = Date.now();
      const daysInStage = Math.floor((now - created) / (1000 * 60 * 60 * 24));

      const enablementVelocity = t.enabledModules.length / Math.max(1, daysInStage / 30);

      return {
        id: `adopt-${t.id}`,
        tenant: t.name,
        tenantId: t.id,
        currentStage,
        daysInStage,
        modulesEnabled: t.enabledModules.length,
        targetModules: 5,
        enablementVelocity: Math.round(enablementVelocity * 10) / 10,
        healthScore: health.score,
        riskLevel: health.band === "critical" ? "high" : health.band === "watch" ? "medium" : "low",
        lastActivity: t.liveAt ?? t.createdAt,
      };
    });
  }, [tenantRoster]);

  const stats = useMemo(() => ({
    totalTenants: tenantRoster.length,
    engagedCount: adoptionRows.filter(r => r.currentStage === "engaged").length,
    stalledCount: adoptionRows.filter(r => r.daysInStage > 30 && r.currentStage !== "engaged").length,
    avgVelocity: adoptionRows.reduce((s, r) => s + r.enablementVelocity, 0) / Math.max(1, adoptionRows.length),
  }), [tenantRoster, adoptionRows]);

  const riskTones: Record<"low" | "medium" | "high", "success" | "info" | "warning" | "danger"> = {
    low: "success",
    medium: "warning",
    high: "danger",
  };

  const columns: Column<TenantAdoptionRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-medium text-primary">{r.tenant[0]}</span>
          </div>
          <span className="font-medium">{r.tenant}</span>
        </div>
      ),
      sortValue: (r) => r.tenant,
    },
    {
      key: "currentStage",
      header: "Stage",
      cell: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.currentStage.charAt(0).toUpperCase() + r.currentStage.slice(1)}
        </Badge>
      ),
      sortValue: (r) => r.currentStage,
    },
    {
      key: "daysInStage",
      header: "Days in Stage",
      cell: (r) => <span className="text-sm">{r.daysInStage}</span>,
      sortValue: (r) => r.daysInStage,
    },
    {
      key: "modulesEnabled",
      header: "Modules",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <span className="font-semibold">{r.modulesEnabled}</span>
          <span className="text-xs text-muted-foreground">/ {r.targetModules}</span>
          {r.modulesEnabled >= r.targetModules && (
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          )}
        </div>
      ),
      sortValue: (r) => r.modulesEnabled,
    },
    {
      key: "enablementVelocity",
      header: "Velocity (mod/mo)",
      cell: (r) => <span className="text-sm font-medium">{r.enablementVelocity}</span>,
      sortValue: (r) => r.enablementVelocity,
    },
    {
      key: "healthScore",
      header: "Health",
      cell: (r) => (
        <Badge variant="outline" className={`text-[10px] font-bold ${r.healthScore >= 75 ? "border-emerald-500 text-emerald-500" : r.healthScore >= 45 ? "border-amber-500 text-amber-500" : "border-rose-500 text-rose-500"}`}>
          {r.healthScore}
        </Badge>
      ),
      sortValue: (r) => r.healthScore,
    },
    {
      key: "riskLevel",
      header: "Risk",
      cell: (r) => (
        <Badge variant={r.riskLevel === "high" ? "destructive" : r.riskLevel === "medium" ? "secondary" : "default"}>
          {r.riskLevel}
        </Badge>
      ),
      sortValue: (r) => r.riskLevel,
    },
    {
      key: "lastActivity",
      header: "Last Active",
      cell: (r) => <span className="text-xs text-muted-foreground">{new Date(r.lastActivity).toLocaleDateString()}</span>,
      sortValue: (r) => new Date(r.lastActivity).getTime(),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Adoption Funnel"
        description="Tenant module adoption drill-down: invited → engaged, velocity, and drop-off analysis."
        icon={Funnel}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading adoption data…"
        >
          {/* Funnel Overview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Funnel className="h-4 w-4" /> Adoption Funnel
                </h2>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Funnel Visualization */}
                  <div className="flex-1 space-y-2">
                    {stages.map((stage, idx) => {
                      const maxCount = Math.max(...stages.map(s => s.count), 1);
                      const width = (stage.count / maxCount) * 100;
                      return (
                        <div key={stage.id} className="group relative">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="w-32 font-medium text-sm">{stage.label}</span>
                              <span className="w-16 text-right text-sm font-semibold">{stage.count}</span>
                              <span className="w-16 text-right text-sm text-muted-foreground">{stage.percentage}%</span>
                              {stage.dropOff > 0 && (
                                <span className="w-20 text-right text-sm text-rose-500">−{stage.dropOff}</span>
                              )}
                            </div>
                          </div>
                          <div className="h-8 bg-muted rounded relative overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-300"
                              style={{
                                width: `${width}%`,
                                background: idx === 0
                                  ? "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.6))"
                                  : idx === stages.length - 1
                                  ? "linear-gradient(90deg, var(--brand-primary), var(--brand-primary)/0.6)"
                                  : "linear-gradient(90deg, hsl(var(--muted-foreground)/0.3), hsl(var(--muted-foreground)/0.1))",
                              }}
                            />
                            {stage.dropOff > 0 && (
                              <div className="absolute right-0 top-1/2 -translate-y-1/2 mr-2 text-[10px] text-rose-500">
                                {stage.dropOffReason}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Stats Cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <MetricCard label="Total Tenants" value={stats.totalTenants} icon={Users} />
                    <MetricCard label="Engaged" value={stats.engagedCount} icon={CheckCircle2} tone="positive" />
                    <MetricCard label="Stalled (>30d)" value={stats.stalledCount} icon={AlertTriangle} tone="negative" />
                    <MetricCard label="Avg Velocity" value={`${stats.avgVelocity.toFixed(1)} mod/mo`} icon={Zap} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Drill-down Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <BarChart2 className="h-4 w-4" /> Tenant Adoption Drill-Down
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => {
                    const name = window.prompt("Name this view:", `View ${views.length + 1}`);
                    if (!name) return;
                    saveView(name, { stage: "all", risk: "all" });
                  }}
                >
                  <Filter className="h-3 w-3" /> Views
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  columns={columns}
                  data={adoptionRows}
                  rowKey={(r) => r.id}
                  searchableText={(r) => `${r.tenant} ${r.currentStage} ${r.riskLevel}`}
                  searchPlaceholder="Search tenants…"
                  emptyTitle="No tenants found"
                  emptyDescription="Adjust your search or filters."
                  pageSize={10}
                />
              </CardContent>
            </Card>
          </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}