"use client";

/**
 * Tenant Health Dashboard — audit finding #2 (MEDIUM).
 *
 * Cross-tenant health overview: status distribution, module adoption,
 * operational signals (open tickets + breaches), and a tenant list with
 * health indicators and quick actions for at-risk tenants — so operators
 * can spot systemic problems without opening each tenant individually.
 *
 * All values are derived deterministically from the platform mock data
 * (tenants, support tickets, breaches) — no Math.random(), stable across
 * renders.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants } from "@/lib/platform/tenant-store";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { supportTickets, breaches } from "@/lib/platform/mock-data";
import {
  healthOf,
  tenantHealthScore,
  tenantForecast,
  forecastSummary,
  type Health,
} from "@/lib/platform/tenant-health";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Gauge,
  HeartPulse,
  Inbox,
  LifeBuoy,
  Package,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Health model (deterministic)                                        */
/* ------------------------------------------------------------------ */
/* Band + numeric score come from lib/platform/tenant-health — the one */
/* derivation shared with the lifecycle list and tenant detail (audit  */
/* V #7), so the three surfaces can never disagree.                    */
/* ------------------------------------------------------------------ */

const healthTone: Record<Health, "destructive" | "secondary" | "default"> = {
  critical: "destructive",
  watch: "secondary",
  healthy: "default",
};

const healthLabel: Record<Health, string> = {
  critical: "Needs attention",
  watch: "Watch",
  healthy: "Healthy",
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function TenantHealthPage() {
  // Async seam (frontend-first): skeleton while hydrating, like every
  // other super-admin screen.
  const { data: hydrated, loading, error, retry } = useAsyncMock(
    () => mockAsync(() => true, { delayMs: 400 }),
    [],
  );
  const { navigate } = usePlatform();
const tenants = useTenants();
  const [focus, setFocus] = useState<Health | "all">("all");

  const rows = useMemo(() => {
    return tenants
      .filter((t) => t.id !== "platform") // the console's own pseudo-tenant
      .map((t) => {
        const health = healthOf(t);
        const openTickets = supportTickets.filter(
          (s) => s.tenantId === t.id && (s.status === "open" || s.status === "in-progress"),
        );
        const highTickets = openTickets.filter((s) => s.priority === "high" || s.priority === "urgent");
        const openBreaches = breaches.filter(
          (b) => b.tenantId === t.id && b.status === "open",
        );
        return {
          tenant: t,
          health,
          score: tenantHealthScore(t),
          forecast: tenantForecast(t),
          openTickets,
          highTickets,
          openBreaches,
        };
      })
      .filter((r) => focus === "all" || r.health === focus)
      .sort((a, b) => {
        const rank: Record<Health, number> = { critical: 0, watch: 1, healthy: 2 };
        return rank[a.health] - rank[b.health];
      });
  }, [tenants, focus]);

  const allRows = useMemo(
    () =>
      tenants
        .filter((t) => t.id !== "platform")
        .map((t) => ({ tenant: t, health: healthOf(t), forecast: tenantForecast(t) })),
    [tenants],
  );

  const critical = allRows.filter((r) => r.health === "critical").length;
  const watch = allRows.filter((r) => r.health === "watch").length;
  const healthy = allRows.filter((r) => r.health === "healthy").length;

  // Module adoption — share of tenants that enable each module.
  const adoption = useMemo(() => {
    const counts: Record<string, number> = {};
    allRows.forEach((r) => {
      r.tenant.enabledModules.forEach((m) => {
        counts[m] = (counts[m] ?? 0) + 1;
      });
    });
    const total = Math.max(1, allRows.length);
    return Object.entries(counts)
      .map(([module, n]) => ({ module, n, pct: Math.round((n / total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }, [allRows]);

  // Operational signals — open tickets and breaches across tenants.
  const openTickets = supportTickets.filter((s) => s.status === "open" || s.status === "in-progress");
  const highTickets = openTickets.filter((s) => s.priority === "high" || s.priority === "urgent");
  const openBreaches = breaches.filter((b) => b.status === "open");
  const criticalBreaches = openBreaches.filter((b) => b.severity === "critical");

  // Predictive layer (audit finding #8) — churn risk + growth signals,
  // derived in lib/platform/tenant-health from the same fixtures as the
  // health score, so the forecast never contradicts the score next to it.
  const forecastCounts = useMemo(
    () => forecastSummary(allRows.map((r) => r.forecast)),
    [allRows],
  );
  const churnRanked = useMemo(
    () =>
      allRows
        .filter((r) => r.forecast.churnScore > 0)
        .sort((a, b) => b.forecast.churnScore - a.forecast.churnScore),
    [allRows],
  );
  const nearLimitTenants = useMemo(
    () => allRows.filter((r) => r.forecast.nearLimit),
    [allRows],
  );
  const underusedTenants = useMemo(
    () => allRows.filter((r) => r.forecast.underutilized),
    [allRows],
  );

  /**
   * Recommended Actions — dynamic intervention suggestions derived from
   * the same signals as the cards above, each with a one-click path to
   * the affected segment (audit: proactive intervention from the health
   * overview instead of manually investigating each tenant).
   */
  const recommendations = useMemo(() => {
    type Rec = {
      key: string;
      icon: typeof Package;
      title: string;
      detail: string;
      /** Affected tenants (max 3 linked) — direct path to their detail. */
      tenants: { id: string; name: string }[];
      count: number;
      action: { label: string; onClick: () => void };
      /** Mock direct intervention — one-click outreach from this screen. */
      outreach?: { label: string; done: string };
    };
    const out: Rec[] = [];
    const nameOf = (id: string) =>
      tenants.find((t) => t.id === id)?.name ?? id;
    const link = (ids: string[]) =>
      ids.slice(0, 3).map((id) => ({ id, name: nameOf(id) }));

    const attention = allRows.filter((r) => r.health === "critical");
    if (attention.length > 0) {
      out.push({
        key: "critical",
        icon: ShieldAlert,
        title: `${attention.length} tenant${attention.length === 1 ? "" : "s"} need attention`,
        detail: "Suspended, terminated, or failed provisioning — confirm status and reach out before the account churns.",
        tenants: link(attention.map((r) => r.tenant.id)),
        count: attention.length,
        action: { label: "Review tenants", onClick: () => setFocus("critical") },
        outreach: {
          label: "Schedule check-in",
          done: `Check-in scheduled for ${attention
            .slice(0, 3)
            .map((r) => r.tenant.name)
            .join(", ")}${attention.length > 3 ? ` +${attention.length - 3} more` : ""} (mock).`,
        },
      });
    }

    const lowAdoption = allRows.filter(
      (r) => r.health === "watch" && r.tenant.enabledModules.length < 5,
    );
    if (lowAdoption.length > 0) {
      out.push({
        key: "adoption",
        icon: Package,
        title: `${lowAdoption.length} tenant${lowAdoption.length === 1 ? "" : "s"} have low module adoption`,
        detail: "Fewer than 5 modules enabled — schedule an onboarding call to unlock more of the platform.",
        tenants: link(lowAdoption.map((r) => r.tenant.id)),
        count: lowAdoption.length,
        action: { label: "Show these tenants", onClick: () => setFocus("watch") },
        outreach: {
          label: "Send onboarding email",
          done: `Onboarding email queued for ${lowAdoption
            .slice(0, 3)
            .map((r) => r.tenant.name)
            .join(", ")}${lowAdoption.length > 3 ? ` +${lowAdoption.length - 3} more` : ""} (mock).`,
        },
      });
    }

    if (criticalBreaches.length > 0) {
      out.push({
        key: "breaches",
        icon: AlertTriangle,
        title: `${criticalBreaches.length} open critical breach${criticalBreaches.length === 1 ? "" : "es"}`,
        detail: "Risk events waiting on triage — resolve before they escalate to payout or compliance issues.",
        tenants: link([...new Set(criticalBreaches.map((b) => b.tenantId))]),
        count: criticalBreaches.length,
        action: { label: "Open queues", onClick: () => navigate("cross-tenant-queues") },
      });
    }

    if (highTickets.length > 0) {
      out.push({
        key: "tickets",
        icon: LifeBuoy,
        title: `${highTickets.length} high-priority support ticket${highTickets.length === 1 ? "" : "s"} open`,
        detail: "Slow first responses are the top churn signal for at-risk tenants.",
        tenants: link([...new Set(highTickets.map((s) => s.tenantId))]),
        count: highTickets.length,
        action: { label: "Open queues", onClick: () => navigate("cross-tenant-queues") },
        outreach: {
          label: "Reply to all",
          done: `Draft replies queued for ${highTickets.length} ticket${highTickets.length === 1 ? "" : "s"} (mock).`,
        },
      });
    }

    return out;
  }, [allRows, criticalBreaches, highTickets, navigate, tenants]);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate("tenant-detail", { id: r.tenant.id });
          }}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          {r.tenant.name}
        </button>
      ),
      sortValue: (r) => r.tenant.name,
    },
    {
      key: "score",
      header: "Score",
      cell: (r) => (
        <span
          className="text-xs font-semibold tabular-nums"
          title={r.score.recommendations.join(" ")}
        >
          {r.score.score}
          <span className="ml-0.5 font-normal text-muted-foreground">/100</span>
        </span>
      ),
      sortValue: (r) => r.score.score,
    },
    {
      key: "health",
      header: "Health",
      cell: (r) => <Badge variant={healthTone[r.health]}>{healthLabel[r.health]}</Badge>,
      sortValue: (r) => (r.health === "critical" ? 0 : r.health === "watch" ? 1 : 2),
    },
    {
      key: "churn",
      header: "Churn risk",
      cell: (r) => (
        <span
          className="text-xs font-semibold tabular-nums"
          title={r.forecast.churnDrivers.join(" ") || "No churn signals."}
        >
          <span
            className={cn(
              "mr-1.5 text-[10px] font-semibold uppercase tracking-wide",
              r.forecast.churnRisk === "high"
                ? "text-destructive"
                : r.forecast.churnRisk === "medium"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {r.forecast.churnRisk}
          </span>
          {r.forecast.churnScore}/100
        </span>
      ),
      sortValue: (r) => r.forecast.churnScore,
    },
    { key: "status", header: "Status", cell: (r) => <Badge variant="outline" className="capitalize">{r.tenant.status}</Badge>, sortValue: (r) => r.tenant.status },
    { key: "plan", header: "Plan", cell: (r) => <span className="capitalize text-xs">{r.tenant.plan}</span>, sortValue: (r) => r.tenant.plan },
    { key: "modules", header: "Modules", cell: (r) => <span className="text-xs tabular-nums">{r.tenant.enabledModules.length}</span>, sortValue: (r) => r.tenant.enabledModules.length },
    { key: "tickets", header: "Open tickets", cell: (r) => <span className="text-xs tabular-nums">{r.openTickets.length}{r.highTickets.length > 0 ? ` (${r.highTickets.length} high)` : ""}</span>, sortValue: (r) => r.openTickets.length },
    { key: "breaches", header: "Open breaches", cell: (r) => <span className="text-xs tabular-nums">{r.openBreaches.length}</span>, sortValue: (r) => r.openBreaches.length },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" title="Open the full tenant profile" onClick={(e) => { e.stopPropagation(); navigate("tenant-detail", { id: r.tenant.id }); }}>
            Open tenant
          </Button>
          {r.health !== "healthy" && (
            <Button
              size="sm"
              variant="ghost"
              title="Review this tenant's usage, limits, and overage risk"
              onClick={(e) => { e.stopPropagation(); navigate("usage-metering"); }}
            >
              Check usage
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Tenant Health"
        description="Health distribution, module adoption, and operational signals across every tenant — the at-risk view operators check before issues escalate."
        icon={HeartPulse}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading tenant health…"
        >
          {/* KPI cards — status distribution + adoption + signals */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="Tenants tracked"
              value={allRows.length}
              icon={Building2}
            />
            <MetricCard
              label="Needs attention"
              value={critical}
              icon={AlertTriangle}
              tone={critical > 0 ? "negative" : "positive"}
              deltaLabel="suspended, terminated, or failed provisioning"
            />
            <MetricCard
              label="On watch"
              value={watch}
              icon={Activity}
              tone={watch > 0 ? "warning" : "positive"}
              deltaLabel="trial / onboarding / low adoption"
            />
            <MetricCard
              label="Healthy"
              value={healthy}
              icon={CheckCircle2}
              tone="positive"
              deltaLabel="active with full module footprint"
            />
          </div>

          {/* Recommended Actions — what to do about the numbers above */}
          <Card>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Recommended Actions</h2>
                <p className="text-xs text-muted-foreground">
                  Suggested interventions, derived from live health signals.
                </p>
              </div>
              {recommendations.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {recommendations.length} pending
                </Badge>
              )}
            </div>
            {recommendations.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                Nothing needs intervention — all tenants are healthy.
              </p>
            ) : (
              <ul className="divide-y">
                {recommendations.map((rec) => {
                  const RecIcon = rec.icon;
                  return (
                    <li key={rec.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <RecIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{rec.title}</p>
                        <p className="text-xs text-muted-foreground">{rec.detail}</p>
                        {rec.tenants.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Affects:{" "}
                            {rec.tenants.map((tn, i) => (
                              <span key={tn.id}>
                                {i > 0 && " · "}
                                <button
                                  type="button"
                                  className="font-medium text-primary underline-offset-2 hover:underline"
                                  title={`Open ${tn.name}`}
                                  onClick={() => navigate("tenant-detail", { id: tn.id })}
                                >
                                  {tn.name}
                                </button>
                              </span>
                            ))}
                            {rec.count > rec.tenants.length
                              ? ` +${rec.count - rec.tenants.length} more`
                              : ""}
                          </p>
                        )}
                      </div>
                      {rec.outreach && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() =>
                            toast({ title: "Queued (mock)", description: rec.outreach!.done })
                          }
                        >
                          {rec.outreach.label}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={rec.action.onClick}>
                        {rec.action.label} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Predictive insights (audit finding #8) — churn risk scores,
              plan-limit warnings and growth suggestions derived from
              health + usage signals, so operators act before tenants
              churn instead of after. */}
          <Card>
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">Predictive insights</h2>
                <p className="text-xs text-muted-foreground">
                  90-day churn risk and growth opportunities, derived from health, support, and plan usage.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Badge variant={forecastCounts.high > 0 ? "destructive" : "secondary"} className="text-[10px]">
                  {forecastCounts.high} high churn risk
                </Badge>
                <Badge variant={forecastCounts.nearLimit > 0 ? "default" : "secondary"} className="text-[10px]">
                  {forecastCounts.nearLimit} near plan limit
                </Badge>
                <Badge variant={forecastCounts.underutilized > 0 ? "secondary" : "outline"} className="text-[10px]">
                  {forecastCounts.underutilized} underutilized
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
              {/* Churn risk ranking */}
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Highest churn risk
                </p>
                {churnRanked.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tenant shows churn signals right now.</p>
                ) : (
                  <ul className="space-y-2">
                    {churnRanked.slice(0, 4).map((r) => (
                      <li key={r.tenant.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                            onClick={() => navigate("tenant-detail", { id: r.tenant.id })}
                          >
                            {r.tenant.name}
                          </button>
                          <span
                            className="flex items-center gap-2"
                            title={r.forecast.churnDrivers.join(" ")}
                          >
                            <span
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-wide",
                                r.forecast.churnRisk === "high"
                                  ? "text-destructive"
                                  : r.forecast.churnRisk === "medium"
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400",
                              )}
                            >
                              {r.forecast.churnRisk} risk
                            </span>
                            <span className="text-xs font-semibold tabular-nums">
                              {r.forecast.churnScore}
                              <span className="font-normal text-muted-foreground">/100</span>
                            </span>
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuenow={r.forecast.churnScore}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${r.tenant.name} churn risk: ${r.forecast.churnScore} of 100 (${r.forecast.churnRisk})`}
                        >
                          <div
                            className={cn(
                              "h-full rounded-full",
                              r.forecast.churnRisk === "high"
                                ? "bg-destructive"
                                : r.forecast.churnRisk === "medium"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                            style={{ width: `${r.forecast.churnScore}%` }}
                          />
                        </div>
                        {r.forecast.churnDrivers.length > 0 && (
                          <p className="mt-1.5 text-[11px] text-muted-foreground">
                            {r.forecast.churnDrivers[0]}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {/* Growth suggestions — expansion vs adoption plays */}
              <div className="space-y-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" aria-hidden /> Growth suggestions
                </p>
                {nearLimitTenants.length === 0 && underusedTenants.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    All tenants sit comfortably inside their plan — no expansion or adoption plays.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {nearLimitTenants.map((r) => (
                      <li key={`limit-${r.tenant.id}`} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {r.tenant.name} — at {r.forecast.peakUtilization}% of {r.tenant.plan}
                          </span>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => navigate("usage-metering")}>
                            Usage <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {r.forecast.suggestions[0]}
                        </p>
                      </li>
                    ))}
                    {underusedTenants.map((r) => (
                      <li key={`under-${r.tenant.id}`} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {r.tenant.name} — underusing the {r.tenant.plan} plan
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => navigate("tenant-detail", { id: r.tenant.id })}
                          >
                            Tenant <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {r.forecast.suggestions[0]}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-7 text-xs"
                          onClick={() =>
                            toast({
                              title: "Queued (mock)",
                              description: `Adoption review queued for ${r.tenant.name}.`,
                            })
                          }
                        >
                          Queue adoption review
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          {/* Health focus filter — jump straight to the at-risk segment */}
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "critical", "watch", "healthy"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={focus === f ? "default" : "outline"}
                className="h-8 text-xs"
                onClick={() => setFocus(f)}
              >
                {f === "all" ? "All tenants" : healthLabel[f]}
                {f !== "all" ? ` (${f === "critical" ? critical : f === "watch" ? watch : healthy})` : ""}
              </Button>
            ))}
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => navigate("tenants")}>
              All tenants view <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Module adoption + operational signals side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Module adoption</p>
                  <Badge variant="secondary" className="ml-auto">{adoption.length} modules</Badge>
                </div>
                {adoption.length === 0 ? (
                  <EmptyState title="No module data" description="No tenants have enabled modules yet." icon={Inbox} />
                ) : (
                  <div className="space-y-2">
                    {adoption.slice(0, 6).map((a) => (
                      <div key={a.module} className="space-y-1">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="capitalize text-muted-foreground">{a.module.replace(/-/g, " ")}</span>
                          <span className="font-semibold tabular-nums">{a.pct}% of tenants</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${a.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Risk alerts & support load</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> Open support tickets
                    </span>
                    <span className="font-semibold tabular-nums">{openTickets.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5" /> High / urgent tickets
                    </span>
                    <span className={`font-semibold tabular-nums ${highTickets.length > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                      {highTickets.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <ShieldAlert className="h-3.5 w-3.5" /> Open breaches (all tenants)
                    </span>
                    <span className="font-semibold tabular-nums">{openBreaches.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-3.5 w-3.5" /> Critical breaches
                    </span>
                    <span className={`font-semibold tabular-nums ${criticalBreaches.length > 0 ? "text-destructive" : ""}`}>
                      {criticalBreaches.length}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("cross-tenant-queues")}>
                  Open cross-tenant queues <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Tenant list with health indicators + quick actions */}
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.tenant.id}
            searchableText={(r) => `${r.tenant.name} ${r.tenant.plan} ${r.tenant.status}`}
            searchPlaceholder="Search tenants…"
            onRowClick={(r) => navigate("tenant-detail", { id: r.tenant.id })}
            emptyTitle="No tenants in this view"
            emptyDescription="Switch the health focus to see other tenants."
          />
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
