"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantChallenges, type Challenge } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { AttentionCenter } from "@/components/platform/attention-center";
import { Target, Trophy, Clock, Flame, CheckCircle2, XCircle, Percent } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ChallengeTable({ filter }: { filter?: (c: Challenge) => boolean }) {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const chs = getTenantChallenges(tid).filter(filter ?? (() => true));

  const columns: Column<Challenge>[] = [
    { key: "trader", header: term("trader"), cell: (c) => <span className="font-medium">{c.traderName}</span>, sortValue: (c) => c.traderName },
    { key: "name", header: term("challenge"), cell: (c) => c.name, sortValue: (c) => c.name },
    { key: "phase", header: "Phase", cell: (c) => <Badge variant="outline" className="text-[10px]">{c.phase}</Badge>, sortValue: (c) => c.phase },
    { key: "size", header: "Account Size", cell: (c) => formatCurrency(c.accountSize, currency), sortValue: (c) => c.accountSize },
    { key: "target", header: "Profit Target", cell: (c) => formatCurrency(c.profitTarget, currency), sortValue: (c) => c.profitTarget },
    { key: "current", header: "Current Profit", cell: (c) => <span className={c.currentProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatCurrency(c.currentProfit, currency)}</span>, sortValue: (c) => c.currentProfit },
    {
      key: "progress",
      header: "Progress",
      cell: (c) => (
        <div className="flex items-center gap-2">
          <Progress value={c.progressPct} className="h-1.5 w-16" />
          <span className="text-xs">{c.progressPct}%</span>
        </div>
      ),
      sortValue: (c) => c.progressPct,
    },
    { key: "days", header: "Days Left", cell: (c) => <span className="text-xs">{c.daysLeft}d</span>, sortValue: (c) => c.daysLeft },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge tone={c.status === "in-progress" ? "info" : c.status === "passed" ? "success" : "warning"}>{c.status}</StatusBadge>,
      sortValue: (c) => c.status,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={chs}
      rowKey={(c) => c.id}
      searchableText={(c) => `${c.traderName} ${c.name} ${c.phase}`}
      searchPlaceholder={`Search ${plural(term("challenge")).toLowerCase()}…`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Challenge funnel — Started → Phase 1 → Phase 2 → Funded          */
/* (deterministic, derived from challenge data — §9 actionable KPI)   */
/* ------------------------------------------------------------------ */

interface FunnelStage {
  label: string;
  value: number;
  pctOfStarted: number;
  color: string; // Terra palette only (no blue/indigo/violet)
}

function buildFunnel(chs: Challenge[]): FunnelStage[] {
  const started = chs.length;
  const pastPhase1 = chs.filter(
    (c) =>
      c.phase === "phase-2" ||
      c.phase === "funded" ||
      c.status === "passed" ||
      c.status === "funded",
  ).length;
  const pastPhase2 = chs.filter(
    (c) => c.phase === "funded" || c.status === "passed" || c.status === "funded",
  ).length;
  const funded = chs.filter((c) => c.phase === "funded" || c.status === "funded").length;

  const pct = (n: number) => (started ? Math.round((n / started) * 100) : 0);
  return [
    { label: "Started", value: started, pctOfStarted: 100, color: "#0f766e" }, // teal-700
    { label: "Phase 1 Passed", value: pastPhase1, pctOfStarted: pct(pastPhase1), color: "#059669" }, // emerald-600
    { label: "Phase 2 Passed", value: pastPhase2, pctOfStarted: pct(pastPhase2), color: "#d97706" }, // amber-600
    { label: "Funded", value: funded, pctOfStarted: pct(funded), color: "#15803d" }, // forest green-700
  ];
}

function ChallengeFunnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-sm font-medium text-foreground">Evaluation Funnel</p>
        <p className="text-xs text-muted-foreground">
          Conversion through each phase — {stages[0].value} started → {stages[stages.length - 1].value} funded.
        </p>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {stages.map((stage, i) => {
          const prev = i === 0 ? stage.value : stages[i - 1].value;
          const drop = prev - stage.value;
          return (
            <div key={stage.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{stage.label}</span>
                <span className="text-muted-foreground">
                  <span className="tabular-nums font-medium text-foreground">{stage.value}</span>
                  {" · "}
                  <span>{stage.pctOfStarted}% of started</span>
                  {i > 0 && drop > 0 ? (
                    <span className="ml-1 text-rose-600">−{drop}</span>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${stage.pctOfStarted}%`,
                    background: stage.color,
                    minWidth: stage.value > 0 ? "4px" : 0,
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Challenges Overview                                                */
/* ------------------------------------------------------------------ */

export function ChallengesOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const chs = getTenantChallenges(tid);
  const active = chs.filter((c) => c.status === "in-progress").length;
  const passed = chs.filter((c) => c.status === "passed" || c.phase === "funded").length;
  const failed = chs.filter((c) => c.status === "failed").length;
  const avgProgress = chs.length ? Math.round(chs.reduce((s, c) => s + c.progressPct, 0) / chs.length) : 0;
  const completed = passed + failed;
  const passRate = completed ? (passed / completed) * 100 : 0;
  const funnelStages = buildFunnel(chs);

  return (
    <Page>
      <PageHeader title={plural(term("challenge"))} description={`${term("trader")} evaluation phases.`} icon={Target} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Active" value={active} icon={Flame} tone="warning" />
          <MetricCard label="Passed" value={passed} icon={Trophy} tone="positive" />
          <MetricCard label="Failed" value={failed} icon={XCircle} tone={failed > 0 ? "negative" : "positive"} />
          <MetricCard
            label="Pass Rate"
            value={`${passRate.toFixed(1)}%`}
            icon={Percent}
            tone={passRate >= 60 ? "positive" : "warning"}
            deltaLabel={`of all completed ${plural(term("challenge")).toLowerCase()}`}
          />
          <MetricCard label="Avg Progress" value={`${avgProgress}%`} icon={CheckCircle2} />
          <MetricCard label="Total" value={chs.length} icon={Target} />
        </div>

        {/* Attention Center — §11 centralized attention model */}
        <AttentionCenter />

        {/* Evaluation Funnel — §9 actionable KPI (visible conversion through phases) */}
        <ChallengeFunnel stages={funnelStages} />

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">{`All ${plural(term("challenge"))}`}</p>
          <ChallengeTable />
        </div>
      </PageContent>
    </Page>
  );
}

export function ActiveChallengesPage() {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  return (
    <Page>
      <PageHeader title={`Active ${plural(term("challenge"))}`} description="Currently in-progress evaluations." icon={Flame} />
      <PageContent>
        <ChallengeTable filter={(c) => c.status === "in-progress"} />
      </PageContent>
    </Page>
  );
}

export function PassedChallengesPage() {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  return (
    <Page>
      <PageHeader title={`Passed ${plural(term("challenge"))}`} description="Successfully completed evaluations." icon={Trophy} />
      <PageContent>
        <ChallengeTable filter={(c) => c.status === "passed" || c.phase === "funded"} />
      </PageContent>
    </Page>
  );
}

export function FailedChallengesPage() {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  return (
    <Page>
      <PageHeader title={`Failed ${plural(term("challenge"))}`} description="Evaluations that did not pass." icon={Target} />
      <PageContent>
        <ChallengeTable filter={(c) => c.status === "failed"} />
      </PageContent>
    </Page>
  );
}
