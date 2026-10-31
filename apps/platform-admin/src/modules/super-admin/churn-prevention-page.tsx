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
import { toast } from "@/hooks/use-toast";
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

const demoAtRisk = [
  { id: "usr-001", name: "Marcus Webb", tenant: "Alpha Capital", mrr: 149, riskScore: 92, signals: ["Login 45d inactive", "Payout declined", "Support ticket unresolved"], lastActive: "2026-08-24T10:00:00Z", stage: "intervention-sent", savedValue: 1788 },
  { id: "usr-002", name: "Elena Petrova", tenant: "Beta Trading", mrr: 99, riskScore: 85, signals: ["Downgrade viewed ×3", "Usage -60% MoM"], lastActive: "2026-10-01T14:30:00Z", stage: "at-risk", savedValue: 0 },
  { id: "usr-003", name: "Jonas Keller", tenant: "Alpha Capital", mrr: 249, riskScore: 78, signals: ["Failed payment ×2", "NPS detractor"], lastActive: "2026-10-05T09:00:00Z", stage: "intervention-sent", savedValue: 2988 },
  { id: "usr-004", name: "Aiko Tanaka", tenant: "Gamma Futures", mrr: 149, riskScore: 71, signals: ["Challenge failed", "Login slowed"], lastActive: "2026-09-30T16:45:00Z", stage: "at-risk", savedValue: 0 },
  { id: "usr-005", name: "David Okoro", tenant: "Beta Trading", mrr: 59, riskScore: 64, signals: ["Feature request ignored", "Usage -30% MoM"], lastActive: "2026-10-06T11:20:00Z", stage: "monitoring", savedValue: 0 },
  { id: "usr-006", name: "Sofia Reyes", tenant: "Gamma Futures", mrr: 199, riskScore: 58, signals: ["Competitor research page visits"], lastActive: "2026-10-07T13:00:00Z", stage: "monitoring", savedValue: 0 },
];

const demoRules = [
  { id: "rule-001", name: "Failed payment escalation", trigger: "2+ failed charges", action: "Dunning email → 7d → account pause warning", status: "active", triggered30d: 34, saved30d: 48200 },
  { id: "rule-002", name: "Usage decline", trigger: "Usage −50% MoM", action: "Check-in email + success-manager task", status: "active", triggered30d: 18, saved30d: 21400 },
  { id: "rule-003", name: "Inactivity window", trigger: "No login 30d", action: "Win-back series (3 emails over 14d)", status: "active", triggered30d: 52, saved30d: 15900 },
  { id: "rule-004", name: "Downgrade intent", trigger: "Pricing/downgrade page ×3", action: "Retention offer (10% off 3 months)", status: "active", triggered30d: 9, saved30d: 8600 },
  { id: "rule-005", name: "Challenge failure", trigger: "Challenge failed 2×", action: "Free retake coupon + coaching email", status: "paused", triggered30d: 0, saved30d: 0 },
];

const stageTones: Record<string, "success" | "warning" | "info" | "danger"> = {
  "at-risk": "danger",
  "intervention-sent": "warning",
  monitoring: "info",
  recovered: "success",
};

const riskColor = (score: number) => (score >= 80 ? "#b83230" : score >= 60 ? "#705c30" : "#4a7c59");

export function ChurnPreventionPage() {
  const {
    data: loadedData,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => ({ atRisk: demoAtRisk, rules: demoRules }), { delayMs: 500 }), []);
  const data = loadedData ?? { atRisk: [], rules: [] };
  const [stageFilter, setStageFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return data.atRisk.filter((u) => stageFilter === "all" || u.stage === stageFilter);
  }, [data.atRisk, stageFilter]);

  const stats = useMemo(() => ({
    atRiskCount: data.atRisk.filter((u) => u.stage !== "recovered").length,
    mrrAtRisk: data.atRisk.filter((u) => u.stage !== "recovered").reduce((s, u) => s + u.mrr, 0),
    savedRevenue: data.atRisk.reduce((s, u) => s + u.savedValue, 0) + data.rules.reduce((s, r) => s + r.saved30d, 0),
    activeRules: data.rules.filter((r) => r.status === "active").length,
  }), [data]);

  return (
    <Page>
      <PageHeader
        title="Churn Prevention"
        description="At-risk account detection, intervention rules, and saved revenue."
        icon={TrendingDown}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast({ title: "Retention report", description: "Monthly retention report queued for delivery." })}>
              <DollarSign className="mr-1 h-4 w-4" /> Retention Report
            </Button>
            <Button size="sm" onClick={() => toast({ title: "New rule", description: "Rule form: trigger condition → action sequence → audience." })}>
              <Play className="mr-1 h-4 w-4" /> New Rule
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
          loadingLabel="Loading churn data…"
        >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="At-Risk Accounts" value={stats.atRiskCount} icon={AlertTriangle} tone="negative" />
          <MetricCard label="MRR at Risk" value={formatCurrency(stats.mrrAtRisk)} icon={TrendingDown} tone="warning" />
          <MetricCard label="Revenue Saved (30d)" value={formatCurrency(stats.savedRevenue)} icon={HeartHandshake} tone="positive" />
          <MetricCard label="Active Rules" value={stats.activeRules} icon={CheckCircle2} />
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
                  {filtered.map((u) => (
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
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Outreach sent", description: `Retention email queued for ${u.name}. Audited.` })}>
                            <Send className="h-3 w-3" /> Outreach
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Offer applied", description: `10% × 3mo retention offer sent to ${u.name}.` })}>
                            <Gift className="h-3 w-3" /> Offer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 font-medium">No accounts in this stage</p>
                  <p className="text-sm text-muted-foreground">Try a different stage filter.</p>
                </div>
              )}
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
                  {data.rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium">{rule.name}</td>
                      <td className="px-4 py-3 text-xs"><code className="bg-muted px-1.5 py-0.5 rounded">{rule.trigger}</code></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">{rule.action}</td>
                      <td className="px-4 py-3 text-sm">{rule.triggered30d}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-emerald-600">${rule.saved30d.toLocaleString()}</td>
                      <td className="px-4 py-3"><StatusBadge tone={rule.status === "active" ? "success" : "warning"}>{rule.status}</StatusBadge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: rule.status === "active" ? "Rule paused" : "Rule resumed", description: `${rule.name} ${rule.status === "active" ? "paused" : "resumed"}. Audited.` })}>
                            {rule.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => toast({ title: "Rule history", description: `${rule.name}: ${rule.triggered30d} triggers, $${rule.saved30d.toLocaleString()} saved.` })}>
                            <MessageSquare className="h-3 w-3" />
                          </Button>
                        </div>
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
