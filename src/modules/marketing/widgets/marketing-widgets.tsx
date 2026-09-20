"use client";

/**
 * Marketing Module — widgets.
 *
 * Three widgets:
 *   1. MarketingOverviewWidget  — metric row of KPIs
 *   2. CampaignPerformanceWidget — bar chart of revenue per campaign
 *   3. ChannelBreakdownWidget    — donut chart of spend by channel
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantCampaigns } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { BarSeries, DonutSeries } from "@/components/platform/charts";
import { Megaphone, DollarSign, Eye, Target, TrendingUp } from "lucide-react";

const CHANNEL_COLORS: Record<string, string> = {
  email: "#db2777",
  social: "#f59e0b",
  "paid-ads": "#8b5cf6",
  content: "#059669",
  affiliate: "#0891b2",
};

export function MarketingOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const campaigns = getTenantCampaigns(tid);
  const active = campaigns.filter((c) => c.status === "active").length;
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const roi = totalSpend > 0 ? Math.round(((revenue - totalSpend) / totalSpend) * 100) : 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard label="Active Campaigns" value={active} delta={6} icon={Megaphone} tone="positive" />
      <MetricCard label="Total Spend" value={formatCurrency(totalSpend, currency)} delta={4} icon={DollarSign} />
      <MetricCard label="Impressions" value={formatCompact(impressions)} delta={11} icon={Eye} />
      <MetricCard label="Conversions" value={formatCompact(conversions)} delta={8} icon={Target} tone="positive" />
      <MetricCard label="ROI" value={`${roi}%`} delta={roi} icon={TrendingUp} tone={roi >= 0 ? "positive" : "negative"} />
    </div>
  );
}

export function CampaignPerformanceWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const campaigns = getTenantCampaigns(tid);
  const data = campaigns.slice(0, 6).map((c) => ({
    name: c.name,
    revenue: c.revenue,
  }));
  return <BarSeries data={data} xKey="name" yKey="revenue" color="#db2777" height={200} formatValue={(v) => formatCurrency(v, runtime.tenant?.currency)} />;
}

export function ChannelBreakdownWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const campaigns = getTenantCampaigns(tid);
  const byChannel = new Map<string, number>();
  for (const c of campaigns) {
    byChannel.set(c.channel, (byChannel.get(c.channel) ?? 0) + c.spend);
  }
  const data = Array.from(byChannel.entries()).map(([label, value]) => ({
    label,
    value,
    color: CHANNEL_COLORS[label] ?? "#64748b",
  }));
  return <DonutSeries data={data} formatValue={(v) => formatCurrency(v, runtime.tenant?.currency)} />;
}
