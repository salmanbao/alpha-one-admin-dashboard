"use client";

/**
 * Churn Prevention Page — Proactive churn rules & at-risk interventions (M13 Automation).
 *
 * Stitch screen: (new)
 * Tier 3 — At-risk account detection, intervention rules, saved-revenue tracking.
 */

import { useState, useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { recordAudit, useConsoleStore } from "@/lib/platform/console-store";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  TrendingDown,
  Users,
  HeartHandshake,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Send,
  Pause,
  Play,
  Gift,
  MessageSquare,
} from "lucide-react";
import { useTenants } from "@/lib/platform/tenant-store";
import { tenantHealthScore, tenantForecast, type TenantForecast } from "@/lib/platform/tenant-health";
import { readPlans } from "@/lib/platform/plan-catalog-store";
import { listChurnRules, toggleChurnRule, useChurnRulesVersion } from "@/lib/platform/churn-rules-store";
import type { TenantContext } from "@/lib/platform/types";

const stageTones: Record<string, "success" | "warning" | "info" | "danger"> = {
  "at-risk": "danger",
  "intervention-sent": "warning",
  monitoring: "info",
  recovered: "success",
};

const riskColor = (score: number) => (score >= 80 ? "#b83230" : score >= 60 ? "#705c30" : "#4a7c59");

/** Map every live tenant to an at-risk view row using tenantHealthScore / tenantForecast (live signals — replaces the hardcoded demoAtRisk array). */
function toAtRiskRow(tenant: any, forecast: TenantForecast) {
  const health = tenantHealthScore(tenant);
  const signals: string[] = [];
  if (tenant.status !== "active") signals.push(`Status: ${tenant.status}`);
  if (tenant.enabledModules.length < 5) signals.push(`Only ${tenant.enabledModules.length} module${tenant.enabledModules.length === 1 ? "" : "s"} enabled`);
  if (forecast.nearLimit) signals.push(`At ${forecast.peakUtilization}% of ${tenant.plan} ceiling`);
  if (forecast.underutilized) signals.push("Consumption flat across every metric");
  if (signals.length === 0) signals.push("No live churn signals");
  return {
    id: `t-${tenant.id}`,
    name: tenant.name,
    tenant: tenant.name,
    tenantId: tenant.id,
    mrr: getPlanPrice(tenant.plan),
    riskScore: forecast.churnScore,
    signals,
    lastActive: tenant.liveAt ?? tenant.createdAt,
    stage: forecast.churnRisk === "high" ? "at-risk" : forecast.churnRisk === "medium" ? "monitoring" : "recovered",
    savedValue: 0,
  };
}

/** Get the base plan price for a tenant (shared with BillingTab pattern). */
function getPlanPrice(plan: TenantContext["plan"]): number {
  return readPlans().find((p) => p.id === plan)?.priceMonthly ?? 0;
}

export function ChurnPreventionPage() {
  const { user } = usePlatform();
  const tenants = useTenants();
  const forecasts = useMemo(() => tenants.map((t) => ({ tenant: t, forecast: tenantForecast(t) })), [tenants]);

  const filtered = useMemo(() => {
    return forecasts.map(({ tenant, forecast }) => toAtRiskRow(tenant, forecast));
  }, [forecasts]);

  const stats = useMemo(() => {
    return {
      atRiskCount: filtered.filter((u) => u.stage !== "recovered").length,
      mrrAtRisk: filtered.filter((u) => u.stage !== "recovered").reduce((s, u) => s + u.mrr, 0),
      savedRevenue: filtered.reduce((s, u) => s + u.savedValue, 0),
      activeRules: forecasts.filter((f) => f.forecast.churnRisk === "high").length,
    };
  }, [filtered, forecasts]);

  const [stageFilter, setStageFilter] = useState<string>("all");

  const stageFiltered = useMemo(() => {
    return stageFilter === "all" ? filtered : filtered.filter((u) => u.stage === stageFilter);
  }, [filtered, stageFilter]);

  const [interventionDialogOpen, setInterventionDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<{ name: string; tenantId: string } | null>(null);
  const [interventionNote, setInterventionNote] = useState("");

  const recordIntervention = (account: string, tenantId: string, action: string, note: string) => {
    recordAudit({
      actor: user.name,
      action: "console.churn_intervention",
      target: account,
      tenantId,
      severity: "info",
      detail: `${action}: ${note}`,
    });
    toast({ title: "Intervention recorded", description: `${action} for ${account} — audit row written.` });
  };

  useChurnRulesVersion();
  const rules = listChurnRules();

  const handleToggleRule = (id: string) => {
    const rule = toggleChurnRule(id, user.name);
    if (!rule) return;
    toast({
      title: rule.status === "active" ? "Rule resumed" : "Rule paused",
      description: `${rule.name} is now ${rule.status}.`,
    });
  };

  const handleRetentionReport = () => {
    recordAudit({
      actor: user.name,
      action: "churn.retention_report",
      target: "retention",
      severity: "info",
      detail: "Monthly retention report queued for delivery",
    });
    toast({ title: "Retention report queued", description: "Monthly retention report queued for delivery." });
  };

  const handleNewRule = () => {
    toast({ title: "New rule", description: "Rule form: trigger condition → action sequence → audience." });
  };

  return (
    <Page>
      <PageHeader
        title="Churn Prevention"
        description="At-risk account detection, intervention rules, and saved revenue."
        icon={TrendingDown}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRetentionReport}>
              <DollarSign className="mr-1 h-4 w-4" /> Retention Report
            </Button>
            <Button size="sm" onClick={handleNewRule}>
              <Play className="mr-1 h-4 w-4" /> New Rule
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={false}
          error={undefined}
          onRetry={() => {}}
          hasData={true}
          loadingLabel="Loading churn data…"
        >
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="At-Risk Accounts" value={stats.atRiskCount} icon={AlertTriangle} tone="negative" />
            <MetricCard label="MRR at Risk" value={formatCurrency(stats.mrrAtRisk)} icon={TrendingDown} tone="warning" />
            <MetricCard label="Revenue Saved (30d)" value={formatCurrency(stats.savedRevenue)} icon={HeartHandshake} tone="positive" />
            <MetricCard label="High-Risk Tenants" value={stats.activeRules} icon={CheckCircle2} />
          </div>

          {/* Stage filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Stage:</span>
            <Button size="sm" variant={stageFilter === "all" ? "default" : "outline"} onClick={() => setStageFilter("all")}>All</Button>
            <Button size="sm" variant={stageFilter === "at-risk" ? "default" : "outline"} onClick={() => setStageFilter("at-risk")} className="text-[10px]">At-Risk</Button>
            <Button size="sm" variant={stageFilter === "intervention-sent" ? "default" : "outline"} onClick={() => setStageFilter("intervention-sent")} className="text-[10px]">Intervention Sent</Button>
            <Button size="sm" variant={stageFilter === "monitoring" ? "default" : "outline"} onClick={() => setStageFilter("monitoring")} className="text-[10px]">Monitoring</Button>
          </div>

          {/* At-risk accounts */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">At-Risk Accounts</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">MRR</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risk</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signals</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stage</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stageFiltered.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">Active {new Date(u.lastActive).toLocaleDateString()}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{u.tenant}</td>
                        <td className="px-4 py-3 text-sm font-semibold">${u.mrr}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px] font-bold" style={{ borderColor: riskColor(u.riskScore), color: riskColor(u.riskScore) }}>
                            {u.riskScore}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[260px]">
                            {u.signals.map((sig) => (
                              <Badge key={sig} variant="secondary" className="text-[9px]">{sig}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge tone={stageTones[u.stage]}>{u.stage}</StatusBadge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => {
                              setSelectedAccount({ name: u.name, tenantId: u.tenantId });
                              setInterventionDialogOpen(true);
                            }}>
                              <Send className="h-3 w-3" /> Outreach
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => recordIntervention(u.name, u.tenantId, "Retention offer", "10% × 3mo retention offer applied via churn-prevention page")}>
                              <Gift className="h-3 w-3" /> Offer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {stageFiltered.length === 0 && (
                      <div className="flex flex-col items-center justify-center p-8 text-center">
                        <Users className="h-8 w-8 text-muted-foreground" />
                        <p className="mt-2 font-medium">No accounts in this stage</p>
                        <p className="text-sm text-muted-foreground">Try a different stage filter.</p>
                      </div>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Automation rules */}
          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-base font-semibold">Intervention Rules</h2>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rule</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trigger</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Triggered (30d)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saved (30d)</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{rule.name}</td>
                        <td className="px-4 py-3 text-xs"><code className="bg-muted px-1.5 py-0.5 rounded">{rule.trigger}</code></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">{rule.action}</td>
                        <td className="px-4 py-3 text-sm">{rule.triggered30d}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{rule.saved30d.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <StatusBadge tone={rule.status === "active" ? "success" : "warning"}>{rule.status}</StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => handleToggleRule(rule.id)}
                            aria-label={`${rule.status === "active" ? "Pause" : "Resume"} ${rule.name}`}
                          >
                            {rule.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Separator />
              <div className="px-4 py-3 text-xs text-muted-foreground">
                Rules run every 15 minutes against the risk-scoring pipeline. Interventions are recorded in the platform audit log.
              </div>
            </CardContent>
          </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}