"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantBreaches, getTenantTraders, riskDistribution, breachTrend } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { StatusBadge, breachSeverityTone, formatCompact } from "@/components/platform/status";
import { ShieldAlert, ShieldCheck, Activity, AlertTriangle, TrendingDown } from "lucide-react";
import { DonutSeries, AreaSeries } from "@/components/platform/charts";
import { Badge } from "@/components/ui/badge";
import { effectiveBreachStatus, useBreachVersion } from "@/modules/risk/breach-store";

export function RiskOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useBreachVersion();
  const breaches = getTenantBreaches(tid).map((b) => ({ ...b, status: effectiveBreachStatus(b) }));
  const open = breaches.filter((b) => b.status === "open").length;
  const critical = breaches.filter((b) => b.severity === "critical" && b.status === "open").length;
  const traders = getTenantTraders(tid);
  const atRisk = traders.filter((t) => t.status === "breached").length;
  // Compute a tenant-derived risk score from breach counts + severity weighting
  // (mirrors the page-level formula). Falls back to a tenant-seeded baseline so
  // the score is never identical across tenants.
  const seed = tid.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const baseline = (seed % 30) + 55; // 55..84
  const riskScore = Math.max(0, Math.min(100, baseline - open * 3 - critical * 5));

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Open Breaches" value={open} icon={ShieldAlert} tone={open > 0 ? "warning" : "positive"} />
      <MetricCard label="Critical" value={critical} icon={AlertTriangle} tone={critical > 0 ? "negative" : "positive"} />
      <MetricCard label="Traders at Risk" value={atRisk} icon={TrendingDown} tone={atRisk > 0 ? "warning" : "positive"} />
      <MetricCard
        label="Risk Score"
        value={`${riskScore}/100`}
        icon={ShieldCheck}
        tone={riskScore >= 80 ? "positive" : riskScore >= 60 ? "warning" : "negative"}
      />
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
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useBreachVersion();
  const breaches = getTenantBreaches(tid)
    .map((b) => ({ ...b, status: effectiveBreachStatus(b) }))
    .filter((b) => b.status === "open")
    .slice(0, 5);
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
        <li key={b.id}>
          <button
            type="button"
            onClick={() => navigate("risk-breaches", { focus: b.id })}
            aria-label={`Investigate breach for ${b.traderName}`}
            className="flex w-full items-center gap-2.5 rounded-md border bg-card p-2 text-left transition hover:bg-accent/40"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              <ShieldAlert className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{b.traderName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{b.rule}</p>
            </div>
            <StatusBadge tone={breachSeverityTone(b.severity)}>{b.severity}</StatusBadge>
          </button>
        </li>
      ))}
    </ul>
  );
}
