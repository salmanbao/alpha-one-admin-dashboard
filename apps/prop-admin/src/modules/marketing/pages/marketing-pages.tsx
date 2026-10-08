"use client";

/**
 * Marketing Module — pages.
 *
 *   1. MarketingOverviewPage   — KPIs + channel breakdown + campaign performance
 *   2. MarketingCampaignsPage  — DataTable of all campaigns
 *   3. MarketingPerformancePage — performance charts grouped by channel
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { getTenantCampaigns, type MarketingCampaign } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, formatCompact, campaignStatusTone, StatusBadge } from "@/components/platform/status";
import { BarSeries, DonutSeries } from "@/components/platform/charts";
import { Megaphone, DollarSign, Eye, Target, TrendingUp, LayoutList, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const CHANNEL_COLORS: Record<string, string> = {
  email: "#b45309",
  social: "#f59e0b",
  "paid-ads": "#b45309", // amber-700 — Terra-allowed; replaces violet (#8b5cf6).
  content: "#059669",
  affiliate: "#0f766e",
};

export function MarketingOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const campaigns = getTenantCampaigns(tid);
  const active = campaigns.filter((c) => c.status === "active").length;
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const conversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const roi = totalSpend > 0 ? Math.round(((revenue - totalSpend) / totalSpend) * 100) : 0;

  const byChannel = new Map<string, number>();
  for (const c of campaigns) {
    byChannel.set(c.channel, (byChannel.get(c.channel) ?? 0) + c.spend);
  }
  const channelData = Array.from(byChannel.entries()).map(([label, value]) => ({
    label,
    value,
    color: CHANNEL_COLORS[label] ?? "#64748b",
  }));

  const perfData = campaigns.slice(0, 6).map((c) => ({ name: c.name, revenue: c.revenue }));

  const handleExport = () => {
    exportToCsv(
      campaigns,
      [
        { key: "name", header: "Campaign", value: (c) => c.name },
        { key: "channel", header: "Channel", value: (c) => c.channel },
        { key: "status", header: "Status", value: (c) => c.status },
        { key: "budget", header: "Budget", value: (c) => c.budget },
        { key: "spend", header: "Spend", value: (c) => c.spend },
        { key: "impressions", header: "Impressions", value: (c) => c.impressions },
        { key: "clicks", header: "Clicks", value: (c) => c.clicks },
        { key: "conversions", header: "Conversions", value: (c) => c.conversions },
        { key: "revenue", header: "Revenue", value: (c) => c.revenue },
        { key: "roi", header: "ROI %", value: (c) => c.spend > 0 ? Math.round(((c.revenue - c.spend) / c.spend) * 100) : 0 },
      ],
      `marketing-overview-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Marketing"
        description={`Campaigns, spend, and channel performance for this ${term("account").toLowerCase()} tenant.`}
        icon={Megaphone}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
          >
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Active Campaigns" value={active} delta={6} icon={Megaphone} tone="positive" />
          <MetricCard label="Total Spend" value={formatCurrency(totalSpend, currency)} delta={4} icon={DollarSign} />
          <MetricCard label="Impressions" value={formatCompact(impressions)} delta={11} icon={Eye} />
          <MetricCard label="Conversions" value={formatCompact(conversions)} delta={8} icon={Target} tone="positive" />
          <MetricCard label="ROI" value={`${roi}%`} delta={roi} icon={TrendingUp} tone={roi >= 0 ? "positive" : "negative"} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Campaign Revenue</p>
            <BarSeries data={perfData} xKey="name" yKey="revenue" color="#b45309" formatValue={(v) => formatCurrency(v, currency)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Spend by Channel</p>
            <DonutSeries data={channelData} formatValue={(v) => formatCurrency(v, currency)} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function MarketingCampaignsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const campaigns = getTenantCampaigns(tid);

  const columns: Column<MarketingCampaign>[] = [
    { key: "name", header: "Campaign", cell: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name },
    {
      key: "channel",
      header: "Channel",
      cell: (c) => <span className="capitalize">{c.channel}</span>,
      sortValue: (c) => c.channel,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge tone={campaignStatusTone(c.status)}>{c.status}</StatusBadge>,
      sortValue: (c) => c.status,
    },
    { key: "budget", header: "Budget", cell: (c) => formatCurrency(c.budget, currency), sortValue: (c) => c.budget },
    { key: "spend", header: "Spend", cell: (c) => formatCurrency(c.spend, currency), sortValue: (c) => c.spend },
    { key: "impressions", header: "Impr.", cell: (c) => formatCompact(c.impressions), sortValue: (c) => c.impressions },
    { key: "clicks", header: "Clicks", cell: (c) => formatCompact(c.clicks), sortValue: (c) => c.clicks },
    { key: "conversions", header: "Conv.", cell: (c) => c.conversions, sortValue: (c) => c.conversions },
    { key: "revenue", header: "Revenue", cell: (c) => <span className="font-semibold">{formatCurrency(c.revenue, currency)}</span>, sortValue: (c) => c.revenue },
    {
      key: "roi",
      header: "ROI",
      cell: (c) => {
        const r = c.spend > 0 ? Math.round(((c.revenue - c.spend) / c.spend) * 100) : 0;
        return <span className={r >= 0 ? "text-emerald-600" : "text-rose-600"}>{r}%</span>;
      },
      sortValue: (c) => (c.spend > 0 ? Math.round(((c.revenue - c.spend) / c.spend) * 100) : 0),
    },
  ];

  return (
    <Page>
      <PageHeader title="Campaigns" description={`All marketing campaigns for this ${term("account").toLowerCase()} tenant.`} icon={LayoutList} />
      <PageContent>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Campaigns ({campaigns.length})</p>
          <DataTable
            columns={columns}
            data={campaigns}
            rowKey={(c) => c.id}
            searchableText={(c) => `${c.name} ${c.channel} ${c.status}`}
            searchPlaceholder="Search campaigns…"
            emptyTitle="No campaigns yet"
            emptyDescription="Create your first campaign to start tracking marketing performance."
          />
        </div>
      </PageContent>
    </Page>
  );
}

export function MarketingPerformancePage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const campaigns = getTenantCampaigns(tid);

  // Aggregate per-channel metrics
  const channels = Array.from(new Set(campaigns.map((c) => c.channel)));
  const revenueByChannel = channels.map((ch) => ({
    name: ch,
    revenue: campaigns.filter((c) => c.channel === ch).reduce((s, c) => s + c.revenue, 0),
  }));
  const convByChannel = channels.map((ch) => ({
    name: ch,
    conversions: campaigns.filter((c) => c.channel === ch).reduce((s, c) => s + c.conversions, 0),
  }));
  const spendData = channels.map((ch) => ({
    label: ch,
    value: campaigns.filter((c) => c.channel === ch).reduce((s, c) => s + c.spend, 0),
    color: CHANNEL_COLORS[ch] ?? "#64748b",
  }));

  return (
    <Page>
      <PageHeader title="Performance" description={`Marketing performance by channel for this ${term("account").toLowerCase()} tenant.`} icon={TrendingUp} />
      <PageContent>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Revenue by Channel</p>
            <BarSeries data={revenueByChannel} xKey="name" yKey="revenue" color="#b45309" formatValue={(v) => formatCurrency(v, currency)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Conversions by Channel</p>
            <BarSeries data={convByChannel} xKey="name" yKey="conversions" color="#059669" />
          </div>
          <div className="rounded-lg border bg-card p-4 lg:col-span-2">
            <p className="mb-2 text-sm font-medium">Spend Distribution</p>
            <DonutSeries data={spendData} formatValue={(v) => formatCurrency(v, currency)} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
