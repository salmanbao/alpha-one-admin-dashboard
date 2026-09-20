"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAffiliates } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { AreaSeries } from "@/components/platform/charts";
import { Megaphone, Users, Target, DollarSign } from "lucide-react";

const tierTone: Record<string, string> = {
  bronze: "#b45309",
  silver: "#64748b",
  gold: "#d97706",
  platinum: "#7c3aed",
};

/**
 * Build a synthetic 12-point monthly revenue series for the affiliate
 * program derived from the tenant's affiliate commission totals. The
 * mock-data layer seeds a fixed set of affiliates and campaigns but no
 * historical series, so we derive a smooth trend line here.
 */
function affiliateRevenueSeries(totalCommission: number): { date: string; value: number }[] {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const base = Math.max(totalCommission / 12, 200);
  return months.map((m, i) => ({
    date: m,
    value: Math.round(base * (0.7 + 0.5 * Math.sin(i / 2) + i * 0.04)),
  }));
}

export function AffiliateOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const aff = getTenantAffiliates(tid);
  const active = aff.filter((a) => a.status === "active").length;
  const conversions = aff.reduce((s, a) => s + a.conversions, 0);
  const earned = aff.reduce((s, a) => s + a.commissionEarned, 0);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Total Affiliates" value={aff.length} icon={Users} />
      <MetricCard label="Active" value={active} icon={Megaphone} tone="positive" />
      <MetricCard label="Conversions" value={formatCompact(conversions)} icon={Target} delta={6} tone="positive" />
      <MetricCard label="Commission Earned" value={formatCurrency(earned, currency)} icon={DollarSign} delta={11} tone="positive" />
    </div>
  );
}

export function TopAffiliatesWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const aff = [...getTenantAffiliates(tid)].sort((a, b) => b.conversions - a.conversions).slice(0, 6);
  const maxConversions = aff.length ? Math.max(...aff.map((a) => a.conversions)) : 1;
  if (aff.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No affiliates yet for this tenant.</div>;
  }
  return (
    <ul className="space-y-2">
      {aff.map((a, i) => (
        <li key={a.id} className="flex items-center gap-2.5 rounded-md border bg-card p-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-600 dark:bg-violet-950 dark:text-violet-400">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 w-24 shrink-0 rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${Math.round((a.conversions / maxConversions) * 100)}%`,
                    background: tierTone[a.tier] ?? "#a21caf",
                  }}
                />
              </div>
              <span className="shrink-0 text-[10px] capitalize text-muted-foreground">{a.tier}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">{formatCurrency(a.commissionEarned, currency)}</p>
            <p className="text-[10px] text-muted-foreground">{a.conversions} conv</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AffiliateRevenueWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const total = getTenantAffiliates(tid).reduce((s, a) => s + a.commissionEarned, 0);
  const data = affiliateRevenueSeries(total);
  return (
    <AreaSeries
      data={data}
      xKey="date"
      yKey="value"
      color="#a21caf"
      formatValue={(v) => formatCurrency(v, currency)}
      height={200}
    />
  );
}
