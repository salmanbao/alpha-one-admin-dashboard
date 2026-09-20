"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantChallenges, type Challenge } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { formatCurrency, formatCompact, StatusBadge } from "@/components/platform/status";
import { Target, Trophy, Clock, Flame, CheckCircle2, XCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DonutSeries } from "@/components/platform/charts";
import { makeTermResolver } from "@/lib/platform/terminology";

export function ChallengeOverviewWidget() {
  const { runtime, tenant } = usePlatform();
  const t = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const chs = getTenantChallenges(tid);
  const active = chs.filter((c) => c.status === "in-progress").length;
  const passed = chs.filter((c) => c.status === "passed" || c.phase === "funded").length;
  const failed = 0;
  const avgProgress = chs.length ? Math.round(chs.reduce((s, c) => s + c.progressPct, 0) / chs.length) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label={`Active ${t("challenge")}`} value={active} icon={Flame} tone="warning" />
      <MetricCard label="Passed" value={passed} icon={Trophy} tone="positive" />
      <MetricCard label="Failed" value={failed} icon={XCircle} tone="negative" />
      <MetricCard label="Avg Progress" value={`${avgProgress}%`} icon={Target} />
    </div>
  );
}

export function ChallengeProgressWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const chs = getTenantChallenges(tid).slice(0, 5);
  return (
    <div className="space-y-3">
      {chs.map((c) => (
        <div key={c.id}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">{c.traderName}</span>
            <span className="text-muted-foreground">{c.progressPct}% · {c.daysLeft}d left</span>
          </div>
          <Progress value={c.progressPct} className="h-2" />
        </div>
      ))}
    </div>
  );
}

export function ChallengePhasesWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const chs = getTenantChallenges(tid);
  const data = [
    { label: "Phase 1", value: chs.filter((c) => c.phase === "phase-1").length, color: "#0ea5e9" },
    { label: "Phase 2", value: chs.filter((c) => c.phase === "phase-2").length, color: "#8b5cf6" },
    { label: "Funded", value: chs.filter((c) => c.phase === "funded").length, color: "#16a34a" },
    { label: "Failed", value: chs.filter((c) => c.phase === "failed").length, color: "#dc2626" },
  ];
  return <DonutSeries data={data} />;
}
