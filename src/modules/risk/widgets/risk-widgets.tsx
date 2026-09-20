"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantBreaches, getTenantTraders, riskDistribution, breachTrend } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { StatusBadge, breachSeverityTone, formatCompact } from "@/components/platform/status";
import { ShieldAlert, ShieldCheck, Activity, AlertTriangle, TrendingDown } from "lucide-react";
import { DonutSeries, AreaSeries } from "@/components/platform/charts";
import { Badge } from "@/components/ui/badge";

export function RiskOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const breaches = getTenantBreaches(tid);
  const open = breaches.filter((b) => b.status === "open").length;
  const critical = breaches.filter((b) => b.severity === "critical").length;
  const traders = getTenantTraders(tid);
  const atRisk = traders.filter((t) => t.status === "breached").length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Open Breaches" value={open} icon={ShieldAlert} tone={open > 0 ? "warning" : "positive"} />
      <MetricCard label="Critical" value={critical} icon={AlertTriangle} tone={critical > 0 ? "negative" : "positive"} />
      <MetricCard label="Traders at Risk" value={atRisk} icon={TrendingDown} tone="warning" />
      <MetricCard label="Risk Score" value="72/100" icon={ShieldCheck} tone="positive" />
    </div>
  );
}

export function RiskDistributionWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  return <DonutSeries data={riskDistribution(tid)} />;
}

export function BreachTrendWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const data = breachTrend(tid);
  return <AreaSeries data={data} xKey="date" yKey="value" color="#dc2626" height={180} />;
}

export function OpenBreachesWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const breaches = getTenantBreaches(tid).filter((b) => b.status === "open").slice(0, 5);
  if (breaches.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-emerald-600">
        <ShieldCheck className="h-4 w-4" /> No open breaches. All clear.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {breaches.map((b) => (
        <li key={b.id} className="flex items-center gap-3 rounded-md border bg-card p-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <ShieldAlert className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{b.traderName}</p>
            <p className="text-[10px] text-muted-foreground">{b.rule}</p>
          </div>
          <StatusBadge tone={breachSeverityTone(b.severity)}>{b.severity}</StatusBadge>
        </li>
      ))}
    </ul>
  );
}
