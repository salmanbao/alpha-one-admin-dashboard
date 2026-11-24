"use client";

/**
 * Adoption Funnel Page — drill-down for tenant module adoption.
 *
 * Stitch screen: (new)
 * Tier 2 — Per-tenant funnel from invited → trial → active → engaged,
 * with drop-off reasons, cohort retention, and module enablement velocity.
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants } from "@/lib/platform/tenant-store";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { TenantContext } from "@/lib/platform/types";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/platform/data-table";
import {
  Users,
  Filter,
  Funnel,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Plus,
  PackageX,
} from "lucide-react";
import { useSavedViews } from "@/lib/platform/saved-views";
import { tenantHealthScore, forecastSummary, tenantForecast } from "@/lib/platform/tenant-health";
import { readRuns, OnboardingRun } from "@/lib/platform/onboarding-runs-store";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { EmptyState } from "@/components/platform/guards";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { funnelStageOf, funnelSummaries, ENGAGED_MODULE_THRESHOLD } from "@/lib/platform/adoption-stages";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

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
  enablementVelocity: number | "—"; // modules/month or em-dash when unavailable
  healthScore: number;
  riskLevel: "low" | "medium" | "high";
  lastActivity: string | undefined; // liveAt only; no fallback to createdAt
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
  const { views, saveView } = useSavedViews("adoption-funnel", user?.id ?? "anon");

  // URL state
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stageParam = searchParams.get("stage");
  const riskParam = searchParams.get("risk");
  const searchParam = searchParams.get("search");

  const tenantRoster = tenants.filter((t) => t.id !== "platform");

  // Async seam for data hydration
  const { data: hydrated, loading, error, retry } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const [onboardingRuns, setOnboardingRuns] = useState<OnboardingRun[]>([]);
  
  useEffect(() => {
    // Load onboarding runs data
    const loadRuns = async () => {
      try {
        const runs = readRuns();
        setOnboardingRuns(runs);
      } catch (error) {
        console.error("Failed to load onboarding runs:", error);
      }
    };
    loadRuns();
  }, []);

  // Calculate adoption stages using shared funnel derivation
  const stages = useMemo(() => {
    const runsConverted: Array<{ stamps: Record<string, string>; tenantId?: string | null }> = [];
    onboardingRuns.forEach((run) => {
      runsConverted.push({
        stamps: run.stamps,
        tenantId: run.tenantId,
      });
    });
    return funnelSummaries(tenantRoster, runsConverted);
  }, [tenantRoster, onboardingRuns]);

  // Build tenant adoption rows for drill-down table
  const adoptionRows = useMemo((): TenantAdoptionRow[] => {
    let rows = tenantRoster.map((t) => {
      const health = tenantHealthScore(t);
      const currentStage = funnelStageOf(t);

      // Days in current status from statusHistory (honest derivation)
      const now = Date.now();
      let daysInStatus: number;
      if (t.statusHistory && t.statusHistory.length > 0) {
        const lastStatus = t.statusHistory[t.statusHistory.length - 1];
        daysInStatus = Math.floor((now - new Date(lastStatus.at).getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Fallback to createdAt — rename column to "Days in Status" to be honest
        daysInStatus = Math.floor((now - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      }

      // Velocity: derive from status/module change deltas if history exists
      // For now render — (em dash) when no delta history; don't fabricate a constant
      const enablementVelocity: number | "—" = "—";

      return {
        id: `adopt-${t.id}`,
        tenant: t.name,
        tenantId: t.id,
        currentStage,
        daysInStage: daysInStatus,
        modulesEnabled: t.enabledModules.length,
        targetModules: ENGAGED_MODULE_THRESHOLD,
        enablementVelocity,
        healthScore: health.score,
        riskLevel: (health.band === "critical" ? "high" : health.band === "watch" ? "medium" : "low") as "low" | "medium" | "high",
        lastActivity: t.liveAt,
      };
    });

    // Filter by stage if URL param present
    if (stageParam) {
      rows = rows.filter((r) => r.currentStage === stageParam);
    }
    // Filter by risk if URL param present
    if (riskParam) {
      rows = rows.filter((r) => r.riskLevel === riskParam);
    }
    // Filter by search if URL param present
    if (searchParam) {
      const search = searchParam.toLowerCase();
      rows = rows.filter((r) => 
        r.tenant.toLowerCase().includes(search) ||
        r.currentStage.toLowerCase().includes(search)
      );
    }
    return rows;
  }, [tenantRoster, stageParam, riskParam, searchParam]);

  const stats = useMemo(() => {
    // Count engaged tenants from adoption rows
    const engagedCount = adoptionRows.filter(r => r.currentStage === "engaged").length;
    
    // Stalled count: days in status > 30 and not engaged
    const stalledCount = adoptionRows.filter(r => r.daysInStage > 30 && r.currentStage !== "engaged").length;
    
    // Average velocity: only active+engaged tenants with valid velocity data (active tenants only)
    const activePlusEngagedWithVelocity = adoptionRows.filter(r => 
      (r.currentStage === "active" || r.currentStage === "engaged") && r.enablementVelocity !== "—"
    );
    const avgVelocity = activePlusEngagedWithVelocity.length > 0 
      ? activePlusEngagedWithVelocity.reduce((s, r) => {
          const velocity = typeof r.enablementVelocity === "number" ? r.enablementVelocity : 0;
          return s + velocity;
        }, 0) / activePlusEngagedWithVelocity.length 
      : 0;
    
    return {
      totalTenants: tenantRoster.length,
      engagedCount,
      stalledCount,
      avgVelocity,
    };
  }, [tenantRoster, adoptionRows]);

  const riskTones: Record<"low" | "medium" | "high", "success" | "info" | "warning" | "danger"> = {
    low: "success",
    medium: "warning",
    high: "danger",
  };

  const columns: Column<TenantAdoptionRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => {
        const handleViewDetail = () => {
          router.push(`/tenant-detail/${r.tenantId}`, { scroll: false });
        };
        
        return (
          <div 
            className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
            onClick={handleViewDetail}
            role="button"
            aria-label={`View detail for ${r.tenant}`}
            tabIndex={0}
          >
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-medium text-primary">{r.tenant[0]}</span>
            </div>
            <span className="font-medium">{r.tenant}</span>
          </div>
        );
      },
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
      header: "Days in Status",
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
      cell: (r) => <span className="text-sm font-medium">{r.enablementVelocity === "—" ? "—" : r.enablementVelocity}</span>,
      sortValue: (r) => r.enablementVelocity === "—" ? 0 : r.enablementVelocity,
    },
    {
      key: "healthScore",
      header: "Health",
      cell: (r) => {
        const tenant = tenantRoster.find(t => t.id === r.tenantId);
        const healthScoreResult = tenant 
          ? tenantHealthScore(tenant) 
          : { score: 0, band: "healthy" };
        const band = healthScoreResult.band;
        
        return (
          <Badge variant="outline" className={`text-[10px] font-bold ${band === "healthy" ? "border-emerald-500 text-emerald-500" : band === "watch" ? "border-amber-500 text-amber-500" : "border-rose-500 text-rose-500"}`}>
            {r.healthScore}
          </Badge>
        );
      },
      sortValue: (r) => r.healthScore,
    },
    {
      key: "riskLevel",
      header: "Risk",
      cell: (r) => {
        const tenant = tenantRoster.find(t => t.id === r.tenantId);
        const forecast = tenant ? tenantForecast(tenant) : null;
        const churnRisk = forecast?.churnRisk ?? "low";
        const topDriver = forecast?.churnDrivers?.[0];
        
        return (
          <div className="flex flex-col gap-0.5">
            <Badge variant={churnRisk === "high" ? "destructive" : churnRisk === "medium" ? "secondary" : "default"}>
              {churnRisk}
            </Badge>
            {topDriver && (
              <span className="text-[10px] text-muted-foreground" title={topDriver}>
                {topDriver.length > 30 ? topDriver.slice(0, 30) + "…" : topDriver}
              </span>
            )}
          </div>
        );
      },
      sortValue: (r) => r.riskLevel,
    },
    {
      key: "lastActivity",
      header: "Live Since",
      cell: (r) => r.lastActivity ? <span className="text-xs text-muted-foreground">{new Date(r.lastActivity).toLocaleDateString()}</span> : <span className="text-xs text-muted-foreground">—</span>,
      sortValue: (r) => r.lastActivity ? new Date(r.lastActivity).getTime() : 0,
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
                {tenantRoster.length === 0 ? (
                  <EmptyState
                    title="No tenants found"
                    description="There are no tenants to display in the adoption funnel."
                    action={<Button onClick={() => router.push("/tenants/create")}>Create tenant</Button>}
                  />
                ) : (
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Funnel Visualization */}
                    <div className="flex-1 space-y-2">
                        {stages.map((stage, idx) => {
                      const maxCount = Math.max(...stages.map(s => s.count), 1);
                      const width = (stage.count / maxCount) * 100;
                      // Gradient ramp across all five stages — valid hsl() pattern everywhere
                      const gradientRamp: Record<number, string> = {
                        0: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.6))",
                        1: "linear-gradient(90deg, hsl(var(--secondary)/0.8), hsl(var(--secondary)/0.4))",
                        2: "linear-gradient(90deg, hsl(var(--accent)/0.8), hsl(var(--accent)/0.4))",
                        3: "linear-gradient(90deg, hsl(var(--warning)/0.8), hsl(var(--warning)/0.4))",
                        4: "linear-gradient(90deg, hsl(var(--destructive)/0.8), hsl(var(--destructive)/0.4))",
                      };
                      const background = stage.isOutside
                        ? "linear-gradient(90deg, hsl(var(--muted-foreground)/0.3), hsl(var(--muted-foreground)/0.1))"
                        : gradientRamp[idx] ?? "linear-gradient(90deg, hsl(var(--muted-foreground)/0.3), hsl(var(--muted-foreground)/0.1))";
                      
                      const handleStageClick = () => {
                        if (stage.isOutside) return; // Don't filter for outside stages
                        const newParams = new URLSearchParams(window.location.search);
                        if (stageParam === stage.id) {
                          // Click again clears filter
                          newParams.delete("stage");
                        } else {
                          newParams.set("stage", stage.id);
                        }
                        newParams.delete("page"); // Reset pagination on filter change
                        router.push(`?${newParams.toString()}`, { scroll: false });
                      };
                      
                      return (
                        <div 
                          key={stage.id} 
                          className={`group relative ${!stage.isOutside ? "cursor-pointer hover:bg-muted/50 rounded" : ""}`}
                          onClick={handleStageClick}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStageClick(); } }}
                          tabIndex={stage.isOutside ? undefined : 0}
                          role={stage.isOutside ? undefined : "button"}
                          aria-label={`${stage.label} — ${stage.count} tenants, ${stage.pctOfFleet}% of fleet${stage.conversionPct !== null ? `, ${stage.conversionPct}% conversion from previous` : ""}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-32 font-medium text-sm ${stage.isOutside ? "text-muted-foreground" : ""}`}>
                                {stage.label}
                              </span>
                              <span className="w-16 text-right text-sm font-semibold">{stage.count}</span>
                              <span className="w-16 text-right text-sm text-muted-foreground">{stage.pctOfFleet}%</span>
                              {stage.conversionPct !== null && (
                                <span className="text-right text-sm text-muted-foreground">
                                  → {stage.conversionPct}%
                                </span>
                              )}
                            </div>
                            {stage.dropOff > 0 && (
                              <span className="w-20 text-right text-sm text-rose-500">−{stage.dropOff}</span>
                            )}
                          </div>
                          <div className="h-8 bg-muted rounded relative overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-300"
                              style={{ width: `${width}%`, background }}
                            />
                          </div>
                          {stage.dropOffReason && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {stage.dropOffReason} (demo)
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                
                  {/* Stats Cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <MetricCard label="Total Tenants" value={stats.totalTenants} icon={Users} />
                    <MetricCard label="Engaged" value={stats.engagedCount} icon={CheckCircle2} tone="positive" />
                    <MetricCard label="Stalled (>30d)" value={stats.stalledCount} icon={AlertTriangle} tone="negative" />
                    <MetricCard
                      label="Avg Velocity (active+)"
                      value={stats.avgVelocity === 0 ? "—" : `${stats.avgVelocity.toFixed(1)} mod/mo`}
                      icon={Zap}
                    />
                  </div>
                </div>
              )}
              {/* End EmptyState conditional */}
              {/* Drill-down Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" /> Tenant Adoption Drill-Down
                  </h2>
                  <div className="flex items-center gap-2">
                    {stageParam && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        Stage: {stageParam}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newParams = new URLSearchParams(window.location.search);
                            newParams.delete("stage");
                            newParams.delete("page");
                            router.push(`?${newParams.toString()}`, { scroll: false });
                          }}
                          className="hover:text-foreground"
                        >
                          ✕
                        </button>
                      </Badge>
                    )}
                    {riskParam && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        Risk: {riskParam}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newParams = new URLSearchParams(window.location.search);
                            newParams.delete("risk");
                            newParams.delete("page");
                            router.push(`?${newParams.toString()}`, { scroll: false });
                          }}
                          className="hover:text-foreground"
                        >
                          ✕
                        </button>
                      </Badge>
                    )}
                    {searchParam && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        Search: "{searchParam}"
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const newParams = new URLSearchParams(window.location.search);
                            newParams.delete("search");
                            newParams.delete("page");
                            router.push(`?${newParams.toString()}`, { scroll: false });
                          }}
                          className="hover:text-foreground"
                        >
                          ✕
                        </button>
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="h-8 gap-1 text-xs">
                          <Filter className="h-3 w-3" /> Views
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {views.length === 0 ? (
                          <DropdownMenuItem className="text-muted-foreground text-center py-4">
                            No saved views
                          </DropdownMenuItem>
                        ) : (
                          views.map((view) => (
                            <DropdownMenuItem 
                              key={view.id} 
                              className="flex items-center justify-between gap-2"
                              onClick={() => {
                                const newParams = new URLSearchParams(window.location.search);
                                Object.entries(view.filters).forEach(([key, value]) => {
                                  if (value === "all") {
                                    newParams.delete(key);
                                  } else {
                                    newParams.set(key, value);
                                  }
                                });
                                newParams.delete("page");
                                router.push(`?${newParams.toString()}`, { scroll: false });
                              }}
                            >
                              <span>{view.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(view.createdAt).toLocaleDateString()}
                              </span>
                            </DropdownMenuItem>
                          ))
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="flex items-center gap-2"
                          onClick={() => {
                            const name = window.prompt("Name this view:", `View ${views.length + 1}`);
                            if (!name) return;
                            const currentFilters: Record<string, string> = {};
                            if (stageParam) currentFilters.stage = stageParam;
                            if (riskParam) currentFilters.risk = riskParam;
                            if (searchParam) currentFilters.search = searchParam;
                            saveView(name, currentFilters);
                          }}
                        >
                          <Plus className="h-3 w-3" /> Save current filters
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {tenantRoster.length === 0 && !stageParam && !riskParam && !searchParam ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <div className="h-8 w-8 mx-auto rounded-full bg-muted">
                        <PackageX className="h-4 w-4" />
                      </div>
                      <p className="mt-2 font-medium">No tenants found</p>
                      <p className="mt-1 text-sm">No tenants match the current filters.</p>
                    </div>
                  ) : (
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
                  )}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}