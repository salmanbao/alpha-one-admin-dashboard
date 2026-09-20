"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantChallenges, type Challenge } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { Target, Trophy, Clock, Flame, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

function ChallengeTable({ filter }: { filter?: (c: Challenge) => boolean }) {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const chs = getTenantChallenges(tid).filter(filter ?? (() => true));

  const columns: Column<Challenge>[] = [
    { key: "trader", header: "Trader", cell: (c) => <span className="font-medium">{c.traderName}</span>, sortValue: (c) => c.traderName },
    { key: "name", header: "Challenge", cell: (c) => c.name, sortValue: (c) => c.name },
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
      searchPlaceholder="Search challenges…"
    />
  );
}

export function ChallengesOverviewPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const chs = getTenantChallenges(tid);
  const active = chs.filter((c) => c.status === "in-progress").length;
  const passed = chs.filter((c) => c.status === "passed" || c.phase === "funded").length;
  const avgProgress = chs.length ? Math.round(chs.reduce((s, c) => s + c.progressPct, 0) / chs.length) : 0;

  return (
    <Page>
      <PageHeader title="Challenges" description="Trader evaluation phases." icon={Target} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Active" value={active} icon={Flame} tone="warning" />
          <MetricCard label="Passed" value={passed} icon={Trophy} tone="positive" />
          <MetricCard label="Avg Progress" value={`${avgProgress}%`} icon={CheckCircle2} />
          <MetricCard label="Total" value={chs.length} icon={Target} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">All Challenges</p>
          <ChallengeTable />
        </div>
      </PageContent>
    </Page>
  );
}

export function ActiveChallengesPage() {
  return (
    <Page>
      <PageHeader title="Active Challenges" description="Currently in-progress evaluations." icon={Flame} />
      <PageContent>
        <ChallengeTable filter={(c) => c.status === "in-progress"} />
      </PageContent>
    </Page>
  );
}

export function PassedChallengesPage() {
  return (
    <Page>
      <PageHeader title="Passed Challenges" description="Successfully completed evaluations." icon={Trophy} />
      <PageContent>
        <ChallengeTable filter={(c) => c.status === "passed" || c.phase === "funded"} />
      </PageContent>
    </Page>
  );
}

export function FailedChallengesPage() {
  return (
    <Page>
      <PageHeader title="Failed Challenges" description="Evaluations that did not pass." icon={Target} />
      <PageContent>
        <ChallengeTable filter={(c) => c.status === "failed"} />
      </PageContent>
    </Page>
  );
}
