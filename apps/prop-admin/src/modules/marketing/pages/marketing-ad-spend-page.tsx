"use client";

/**
 * Marketing — Ad-Spend Tracking Page
 *
 * Spec: tracks paid advertising spend across multiple platforms
 * (Google Ads, Meta, TikTok, LinkedIn, Twitter/X), attribution
 * (CPA, ROAS), and conversion funnel down to funded traders.
 *
 * Sections:
 *   1. KPI row — Total Ad Spend, Total Conversions, CPA, ROAS
 *   2. Filter bar — platform / campaign / date range + Export CSV
 *   3. Spend by Platform — BarSeries
 *   4. Spend by Platform — DonutSeries (share)
 *   5. ROAS by Platform — BarSeries
 *   6. Ad Campaigns DataTable (CTR / CPC / CPA / ROAS computed)
 *   7. Spend Trend (30d) AreaSeries
 *   8. Conversion Funnel — 4-stage BarSeries
 *   9. Ad Campaign Sheet Drawer (View or Create)
 *  10. Connect Ad Account button (top right — toast)
 *
 * Terra palette only — emerald / amber / rose / slate / sky.
 * No Math.random — deterministic Math.sin patterns.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { AreaSeries, BarSeries, DonutSeries } from "@/components/platform/charts";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Megaphone,
  Plus,
  Download,
  DollarSign,
  Target,
  TrendingUp,
  Plug,
  Save,
  Pause,
  Trash2,
  MousePointerClick,
  Filter,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type AdPlatform = "Google Ads" | "Meta" | "TikTok" | "LinkedIn" | "Twitter/X";
type AdStatus = "active" | "paused" | "ended" | "draft";
type DateRange = "7d" | "30d" | "90d";

interface AdCampaign {
  id: string;
  name: string;
  platform: AdPlatform;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  status: AdStatus;
  startDate: string;
  endDate?: string;
  budget: number;
  budgetType: "daily" | "total";
  target: string;
  creative: string;
  active: boolean;
}

const AD_CAMPAIGNS: AdCampaign[] = [
  {
    id: "AC-001",
    name: "Google Search — Prop Trading",
    platform: "Google Ads",
    spend: 1840,
    impressions: 28400,
    clicks: 482,
    conversions: 24,
    revenue: 7200,
    status: "active",
    startDate: "2026-03-15",
    budget: 2000,
    budgetType: "total",
    target: "Traders searching 'prop firm' / 'funded trader'",
    creative: "/ads/google-search-prop.png",
    active: true,
  },
  {
    id: "AC-002",
    name: "Facebook Retargeting",
    platform: "Meta",
    spend: 1240,
    impressions: 18400,
    clicks: 318,
    conversions: 18,
    revenue: 4800,
    status: "active",
    startDate: "2026-03-20",
    budget: 1500,
    budgetType: "total",
    target: "Website visitors last 30d, not converted",
    creative: "/ads/meta-retargeting.png",
    active: true,
  },
  {
    id: "AC-003",
    name: "TikTok Discovery — Gen Z",
    platform: "TikTok",
    spend: 840,
    impressions: 42100,
    clicks: 284,
    conversions: 12,
    revenue: 3600,
    status: "active",
    startDate: "2026-04-01",
    budget: 1000,
    budgetType: "daily",
    target: "Ages 18-34, interest in trading",
    creative: "/ads/tiktok-discovery.mp4",
    active: true,
  },
  {
    id: "AC-004",
    name: "LinkedIn B2B — Recruiting",
    platform: "LinkedIn",
    spend: 2480,
    impressions: 9200,
    clicks: 184,
    conversions: 8,
    revenue: 6200,
    status: "paused",
    startDate: "2026-03-01",
    endDate: "2026-03-30",
    budget: 3000,
    budgetType: "total",
    target: "Senior finance professionals",
    creative: "/ads/linkedin-b2b.png",
    active: false,
  },
  {
    id: "AC-005",
    name: "Twitter/X Trend Takeover",
    platform: "Twitter/X",
    spend: 1820,
    impressions: 12800,
    clicks: 96,
    conversions: 4,
    revenue: 1200,
    status: "ended",
    startDate: "2026-02-15",
    endDate: "2026-03-01",
    budget: 2000,
    budgetType: "total",
    target: "Trending topic: #CryptoCrash",
    creative: "/ads/twitter-trend.png",
    active: false,
  },
  {
    id: "AC-006",
    name: "Google Display — Brand Awareness",
    platform: "Google Ads",
    spend: 640,
    impressions: 48200,
    clicks: 218,
    conversions: 6,
    revenue: 1800,
    status: "active",
    startDate: "2026-04-05",
    budget: 800,
    budgetType: "daily",
    target: "Lookalike audiences + finance blogs",
    creative: "/ads/google-display.png",
    active: true,
  },
  {
    id: "AC-007",
    name: "Meta Lookalike — High-LTV",
    platform: "Meta",
    spend: 1480,
    impressions: 21800,
    clicks: 382,
    conversions: 22,
    revenue: 8400,
    status: "draft",
    startDate: "2026-04-18",
    budget: 1800,
    budgetType: "total",
    target: "Lookalike of high-LTV traders",
    creative: "/ads/meta-lookalike.png",
    active: false,
  },
];

const SPEND_TREND_30D = Array.from({ length: 30 }, (_, i) => ({
  label: `Day ${i + 1}`,
  value: Math.round(120 + Math.sin(i / 3) * 40 + i * 2),
}));

const PLATFORM_COLORS: Record<AdPlatform, string> = {
  "Google Ads": "#059669", // emerald
  Meta: "#e11d48", // rose
  TikTok: "#d97706", // amber
  LinkedIn: "#475569", // slate-600
  "Twitter/X": "#15803d", // green-700 (Terra-allowed; replaces sky-600)
};

const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All platforms" },
  { value: "Google Ads", label: "Google Ads" },
  { value: "Meta", label: "Meta (Facebook)" },
  { value: "TikTok", label: "TikTok" },
  { value: "LinkedIn", label: "LinkedIn" },
  { value: "Twitter/X", label: "Twitter/X" },
];

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function adStatusTone(status: AdStatus): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (status) {
    case "active": return "success";
    case "paused": return "warning";
    case "ended": return "muted";
    case "draft": return "muted";
    default: return "muted";
  }
}

function ctr(c: AdCampaign): number {
  return c.impressions > 0 ? c.clicks / c.impressions : 0;
}
function cpc(c: AdCampaign): number {
  return c.clicks > 0 ? c.spend / c.clicks : 0;
}
function cpa(c: AdCampaign): number {
  return c.conversions > 0 ? c.spend / c.conversions : 0;
}
function roas(c: AdCampaign): number {
  return c.spend > 0 ? c.revenue / c.spend : 0;
}

const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
const fmtMoney = (v: number, currency: string) =>
  v > 0 ? formatCurrency(v, currency) : "—";
const fmtRoas = (v: number) => `${v.toFixed(1)}x`;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type SheetState =
  | { mode: "create" }
  | { mode: "view"; campaign: AdCampaign }
  | null;

export function MarketingAdSpendPage() {
  const { tenant, runtime } = usePlatform();
  const term = makeTermResolver(tenant);
  const currency = runtime.tenant?.currency ?? "USD";

  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [range, setRange] = useState<DateRange>("30d");
  const [sheetState, setSheetState] = useState<SheetState>(null);

  const filtered = useMemo(() => {
    return AD_CAMPAIGNS.filter((c) => {
      const platformOk = platformFilter === "all" || c.platform === platformFilter;
      const campaignOk = campaignFilter === "all" || c.id === campaignFilter;
      return platformOk && campaignOk;
    });
  }, [platformFilter, campaignFilter]);

  // KPIs — derived from the full filtered set (deterministic)
  const totalSpend = filtered.reduce((s, c) => s + c.spend, 0);
  const totalConversions = filtered.reduce((s, c) => s + c.conversions, 0);
  const totalRevenue = filtered.reduce((s, c) => s + c.revenue, 0);
  const cpaValue = totalConversions > 0 ? totalSpend / totalConversions : 0;
  const roasValue = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // Aggregate by platform
  const platforms: AdPlatform[] = ["Google Ads", "Meta", "TikTok", "LinkedIn", "Twitter/X"];
  const spendByPlatform = platforms.map((p) => {
    const items = AD_CAMPAIGNS.filter((c) => c.platform === p);
    const spend = items.reduce((s, c) => s + c.spend, 0);
    const revenue = items.reduce((s, c) => s + c.revenue, 0);
    return {
      platform: p,
      spend,
      revenue,
      roas: spend > 0 ? revenue / spend : 0,
    };
  });

  const spendBars = spendByPlatform.map((p) => ({
    label: p.platform === "Twitter/X" ? "Twitter" : p.platform.split(" ")[0],
    value: p.spend,
  }));
  const spendDonut = spendByPlatform.map((p) => ({
    label: p.platform,
    value: p.spend,
    color: PLATFORM_COLORS[p.platform],
  }));
  const roasBars = spendByPlatform.map((p) => ({
    label: p.platform === "Twitter/X" ? "Twitter" : p.platform.split(" ")[0],
    value: Math.round(p.roas * 10) / 10,
  }));

  // Conversion funnel (aggregate)
  const totalImpressions = AD_CAMPAIGNS.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = AD_CAMPAIGNS.reduce((s, c) => s + c.clicks, 0);
  const funnelData = [
    { label: "Impressions", value: totalImpressions },
    { label: "Clicks", value: totalClicks },
    { label: "Signups", value: Math.round(totalClicks * 0.22) },
    { label: `Funded ${term("account")}s`, value: totalConversions },
  ];
  const funnelStages = funnelData.map((s, i, arr) => {
    const prev = i === 0 ? s.value : arr[i - 1].value;
    const rate = prev > 0 ? (s.value / prev) * 100 : 0;
    return { ...s, rate };
  });

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "ID", value: (c) => c.id },
        { key: "name", header: "Campaign", value: (c) => c.name },
        { key: "platform", header: "Platform", value: (c) => c.platform },
        { key: "status", header: "Status", value: (c) => c.status },
        { key: "spend", header: "Spend", value: (c) => c.spend },
        { key: "budget", header: "Budget", value: (c) => c.budget },
        { key: "impressions", header: "Impressions", value: (c) => c.impressions },
        { key: "clicks", header: "Clicks", value: (c) => c.clicks },
        { key: "ctr", header: "CTR %", value: (c) => (ctr(c) * 100).toFixed(2) },
        { key: "cpc", header: "CPC", value: (c) => cpc(c).toFixed(2) },
        { key: "conversions", header: "Conversions", value: (c) => c.conversions },
        { key: "cpa", header: "CPA", value: (c) => cpa(c).toFixed(2) },
        { key: "revenue", header: "Revenue", value: (c) => c.revenue },
        { key: "roas", header: "ROAS", value: (c) => roas(c).toFixed(2) },
      ],
      `ad-spend-${range}-${Date.now()}.csv`,
    );
  };

  const columns: Column<AdCampaign>[] = [
    {
      key: "name",
      header: "Campaign",
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.name}</p>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-mono">{c.id}</span> · {c.platform}
          </p>
        </div>
      ),
      sortValue: (c) => c.name,
      width: "240px",
    },
    {
      key: "platform",
      header: "Platform",
      cell: (c) => (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ background: PLATFORM_COLORS[c.platform] }}
            aria-hidden
          />
          {c.platform}
        </span>
      ),
      sortValue: (c) => c.platform,
    },
    {
      key: "spend",
      header: "Spend",
      cell: (c) => <span className="font-medium">{formatCurrency(c.spend, currency)}</span>,
      sortValue: (c) => c.spend,
      numeric: true,
    },
    {
      key: "impressions",
      header: "Impr.",
      cell: (c) => formatCompact(c.impressions),
      sortValue: (c) => c.impressions,
      numeric: true,
    },
    {
      key: "clicks",
      header: "Clicks",
      cell: (c) => formatCompact(c.clicks),
      sortValue: (c) => c.clicks,
      numeric: true,
    },
    {
      key: "ctr",
      header: "CTR",
      cell: (c) => (
        <span className={ctr(c) >= 0.02 ? "text-emerald-600" : ""}>
          {fmtPct(ctr(c))}
        </span>
      ),
      sortValue: (c) => ctr(c),
      numeric: true,
    },
    {
      key: "cpc",
      header: "CPC",
      cell: (c) => fmtMoney(cpc(c), currency),
      sortValue: (c) => cpc(c),
      numeric: true,
    },
    {
      key: "conversions",
      header: "Conv.",
      cell: (c) => c.conversions,
      sortValue: (c) => c.conversions,
      numeric: true,
    },
    {
      key: "cpa",
      header: "CPA",
      cell: (c) => (
        <span className={cpa(c) > 0 && cpa(c) <= 100 ? "text-emerald-600" : cpa(c) > 200 ? "text-rose-600" : ""}>
          {fmtMoney(cpa(c), currency)}
        </span>
      ),
      sortValue: (c) => cpa(c),
      numeric: true,
    },
    {
      key: "roas",
      header: "ROAS",
      cell: (c) => (
        <span className={roas(c) >= 2 ? "text-emerald-600 font-medium" : roas(c) < 1 ? "text-rose-600" : ""}>
          {fmtRoas(roas(c))}
        </span>
      ),
      sortValue: (c) => roas(c),
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <StatusBadge tone={adStatusTone(c.status)}>
          <span className="capitalize">{c.status}</span>
        </StatusBadge>
      ),
      sortValue: (c) => c.status,
    },
    {
      key: "actions",
      header: "",
      cell: (c) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setSheetState({ mode: "view", campaign: c });
          }}
          aria-label={`View ${c.name}`}
        >
          View
        </Button>
      ),
      width: "80px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Ad Spend"
        description={`Track paid acquisition performance and ROI across platforms for this ${term("account").toLowerCase()} tenant.`}
        icon={Megaphone}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              toast({
                title: "Connect ad account (demo)",
                description: "The OAuth flow to connect Google Ads / Meta / TikTok ad accounts would open here.",
              })
            }
          >
            <Plug className="mr-1 h-4 w-4" /> Connect Ad Account
          </Button>
        }
      />

      <PageContent>
        {/* KPI row — 4 cards with contextual help via deltaLabel */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Ad Spend (30d)"
            value={formatCurrency(totalSpend, currency)}
            delta={6}
            deltaLabel={`${range} window · ${filtered.length} campaigns`}
            icon={DollarSign}
            tone="default"
          />
          <MetricCard
            label="Total Conversions"
            value={totalConversions}
            delta={8}
            deltaLabel={`became funded ${term("account").toLowerCase()}`}
            icon={Target}
            tone="positive"
          />
          <MetricCard
            label="Cost per Acquisition (CPA)"
            value={cpaValue > 0 ? formatCurrency(cpaValue, currency) : "—"}
            delta={-4}
            deltaLabel="lower is better · target: $100"
            icon={DollarSign}
            tone={cpaValue > 0 && cpaValue <= 100 ? "positive" : "warning"}
          />
          <MetricCard
            label="Return on Ad Spend (ROAS)"
            value={fmtRoas(roasValue)}
            delta={12}
            deltaLabel={`$${roasValue.toFixed(2)} revenue per $1 spent`}
            icon={TrendingUp}
            tone={roasValue >= 2 ? "positive" : "warning"}
          />
        </div>

        {/* Filter bar + Export */}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger size="sm" className="h-8 w-[160px]" aria-label="Filter by platform">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger size="sm" className="h-8 w-[200px]" aria-label="Filter by campaign">
                  <SelectValue placeholder="Campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All campaigns</SelectItem>
                  {AD_CAMPAIGNS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="truncate">{c.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
                <SelectTrigger size="sm" className="h-8 w-[140px]" aria-label="Date range">
                  <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(platformFilter !== "all" || campaignFilter !== "all") && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setPlatformFilter("all");
                    setCampaignFilter("all");
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Charts: spend bar + donut */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Spend by Platform</p>
            <BarSeries
              data={spendBars}
              xKey="label"
              yKey="value"
              color="#059669"
              height={200}
              formatValue={(v) => formatCurrency(v, currency)}
            />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Spend Distribution</p>
            <DonutSeries
              data={spendDonut}
              height={200}
              formatValue={(v) => formatCurrency(v, currency)}
            />
          </div>
        </div>

        {/* ROAS by platform */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-1 flex items-center gap-1 text-sm font-medium">
            <LabelWithHelp help="Return on Ad Spend = revenue / spend. A ROAS of 2.0x means $2 of revenue per $1 spent. Above 2.0x is generally profitable; below 1.0x means you're losing money.">
              ROAS by Platform
            </LabelWithHelp>
          </p>
          <BarSeries
            data={roasBars}
            xKey="label"
            yKey="value"
            color="#d97706"
            height={200}
            formatValue={(v) => fmtRoas(Number(v))}
          />
        </div>

        {/* Ad campaigns DataTable */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Ad Campaigns ({filtered.length})
          </p>
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(c) => c.id}
            searchableText={(c) => `${c.id} ${c.name} ${c.platform} ${c.status}`}
            searchPlaceholder="Search campaigns…"
            pageSize={8}
            emptyTitle="No ad campaigns match your filters"
            emptyDescription="Try changing the platform or campaign filter, or reset to see all campaigns."
            onRowClick={(c) => setSheetState({ mode: "view", campaign: c })}
          />
        </div>

        {/* Spend trend (30d) AreaSeries */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-1 flex items-center gap-1 text-sm font-medium">
            Spend Trend
            <span className="text-xs font-normal text-muted-foreground">— 30 days</span>
          </p>
          <AreaSeries
            data={SPEND_TREND_30D}
            xKey="label"
            yKey="value"
            color="#15803d"
            height={220}
            formatValue={(v) => formatCurrency(v, currency)}
          />
        </div>

        {/* Conversion funnel */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-1 flex items-center gap-1 text-sm font-medium">
            <LabelWithHelp help="The funnel shows how impressions convert down to funded traders. Each stage's conversion rate is relative to the previous stage.">
              Conversion Funnel
            </LabelWithHelp>
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <BarSeries
                data={funnelData}
                xKey="label"
                yKey="value"
                color="#059669"
                height={200}
                formatValue={(v) => formatCompact(Number(v))}
              />
            </div>
            <div className="flex flex-col gap-2">
              {funnelStages.map((s, i) => (
                <div key={s.label} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatCompact(s.value)}</span>
                  </div>
                  {i > 0 && (
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">from previous</span>
                      <span className={s.rate >= 20 ? "font-medium text-emerald-600" : "text-amber-600"}>
                        {s.rate.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Create button to add new campaign */}
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setSheetState({ mode: "create" })}>
            <Plus className="mr-1 h-4 w-4" /> New Ad Campaign
          </Button>
        </div>
      </PageContent>

      {/* View / Create Sheet drawer */}
      <AdCampaignSheet
        state={sheetState}
        onClose={() => setSheetState(null)}
        currency={currency}
      />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet drawer — view / create / edit shared form                    */
/* ------------------------------------------------------------------ */

interface AdCampaignSheetProps {
  state: SheetState;
  onClose: () => void;
  currency: string;
}

function AdCampaignSheet({ state, onClose, currency }: AdCampaignSheetProps) {
  const isCreate = state?.mode === "create";
  const campaign = state?.mode === "view" ? state.campaign : undefined;

  // Local form state — reset on drawer reopen (via key prop on Tabs)
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<AdPlatform>("Google Ads");
  const [budget, setBudget] = useState("");
  const [budgetType, setBudgetType] = useState<"daily" | "total">("total");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [target, setTarget] = useState("");
  const [creative, setCreative] = useState("");
  const [active, setActive] = useState(true);

  if (!state) {
    return (
      <Sheet open={false} onOpenChange={() => {}}>
        <SheetContent side="right" />
      </Sheet>
    );
  }

  const formKey = campaign?.id ?? "create";

  // Use existing campaign values when in view mode
  const nameValue = name || campaign?.name || "";
  const platformValue = platform || campaign?.platform || "Google Ads";
  const budgetValue = budget || (campaign ? String(campaign.budget) : "");
  const budgetTypeValue = budgetType || campaign?.budgetType || "total";
  const startDateValue = startDate || campaign?.startDate || "";
  const endDateValue = endDate || campaign?.endDate || "";
  const targetValue = target || campaign?.target || "";
  const creativeValue = creative || campaign?.creative || "";
  const activeValue = campaign ? campaign.active : active;

  return (
    <Sheet
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="sm:max-w-[560px] overflow-y-auto" side="right">
        <div className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle className="text-lg">
              {isCreate ? "New Ad Campaign" : campaign!.name}
            </SheetTitle>
            <SheetDescription className="mt-1">
              {isCreate ? (
                <>Configure a new paid acquisition campaign across an ad platform.</>
              ) : (
                <>
                  <span className="font-mono">{campaign!.id}</span> · {campaign!.platform} ·{" "}
                  <span className="capitalize">{campaign!.status}</span>
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          {/* KPI strip — only in view mode for sent campaigns */}
          {campaign && campaign.spend > 0 && (
            <div className="grid grid-cols-4 gap-2 px-4 py-2">
              <KpiPill label="Spend" value={formatCurrency(campaign.spend, currency)} tone="slate" />
              <KpiPill label="CPA" value={fmtMoney(cpa(campaign), currency)} tone="amber" />
              <KpiPill label="ROAS" value={fmtRoas(roas(campaign))} tone={roas(campaign) >= 2 ? "emerald" : "rose"} />
              <KpiPill label="CTR" value={fmtPct(ctr(campaign))} tone="emerald" />
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div key={formKey} className="space-y-3">
              {/* Campaign name */}
              <div className="space-y-1.5">
                <LabelWithHelp help="Internal name shown only to your team. The ad platform displays its own auto-generated name.">
                  <Label htmlFor="ac-name" className="text-xs font-medium">Campaign Name</Label>
                </LabelWithHelp>
                <Input
                  id="ac-name"
                  value={nameValue}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Google Search — Prop Trading"
                />
              </div>

              {/* Platform */}
              <div className="space-y-1.5">
                <Label htmlFor="ac-platform" className="text-xs font-medium">Platform</Label>
                <Select
                  value={platformValue}
                  onValueChange={(v) => setPlatform(v as AdPlatform)}
                >
                  <SelectTrigger id="ac-platform" className="w-full">
                    <SelectValue placeholder="Choose platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORM_OPTIONS.filter((p) => p.value !== "all").map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Budget + type */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <LabelWithHelp help="Spending cap. Daily budgets reset every 24h; total budgets are spread across the campaign lifetime.">
                    <Label htmlFor="ac-budget" className="text-xs font-medium">Budget</Label>
                  </LabelWithHelp>
                  <Input
                    id="ac-budget"
                    type="number"
                    min="0"
                    value={budgetValue}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 2000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-budget-type" className="text-xs font-medium">Budget Type</Label>
                  <Select
                    value={budgetTypeValue}
                    onValueChange={(v) => setBudgetType(v as "daily" | "total")}
                  >
                    <SelectTrigger id="ac-budget-type" className="w-full">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ac-start" className="text-xs font-medium">Start Date</Label>
                  <Input
                    id="ac-start"
                    type="date"
                    value={startDateValue}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-end" className="text-xs font-medium">End Date</Label>
                  <Input
                    id="ac-end"
                    type="date"
                    value={endDateValue}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Target audience */}
              <div className="space-y-1.5">
                <LabelWithHelp help="Free-form description of the audience you're targeting (demographics, interests, behaviors). Most platforms require this to be set in their native UI; this field is a reference for your team.">
                  <Label htmlFor="ac-target" className="text-xs font-medium">Target Audience</Label>
                </LabelWithHelp>
                <Textarea
                  id="ac-target"
                  value={targetValue}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g. Traders searching 'prop firm' / 'funded trader', ages 25-54, US/UK"
                  className="min-h-[60px]"
                />
              </div>

              {/* Creative URL */}
              <div className="space-y-1.5">
                <LabelWithHelp help="Reference URL to the creative asset (image, video, copy doc). The actual upload happens on the ad platform; this field tracks which creative is associated with this campaign.">
                  <Label htmlFor="ac-creative" className="text-xs font-medium">Creative URL</Label>
                </LabelWithHelp>
                <Input
                  id="ac-creative"
                  type="url"
                  value={creativeValue}
                  onChange={(e) => setCreative(e.target.value)}
                  placeholder="https://example.com/ads/creative.png"
                />
              </div>

              <Separator />

              {/* Status toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="ac-active" className="text-xs font-medium">Campaign Active</Label>
                  <p className="text-[11px] text-muted-foreground">
                    When off, the campaign is paused on the ad platform.
                  </p>
                </div>
                <Switch
                  id="ac-active"
                  checked={activeValue}
                  onCheckedChange={setActive}
                  aria-label="Toggle campaign active"
                />
              </div>
            </div>
          </div>

          <SheetFooter className="mt-auto flex-row gap-2 border-t pt-4">
            <Button
              size="sm"
              onClick={() => {
                toast({
                  title: "Campaign saved (demo)",
                  description: `${nameValue || "Untitled"} saved to ${platformValue}.`,
                });
                onClose();
              }}
            >
              <Save className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                toast({
                  title: "Campaign paused (demo)",
                  description: `${nameValue || "Untitled"} paused on ${platformValue}.`,
                });
                onClose();
              }}
            >
              <Pause className="mr-1 h-3.5 w-3.5" /> Pause
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The campaign will be removed from the dashboard. The
                    underlying ad platform campaign is <strong>not</strong>{" "}
                    automatically deleted — you must end it on{" "}
                    {platformValue} separately. This action is logged in the
                    audit trail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      toast({
                        title: "Campaign deleted (demo)",
                        description: `${campaign?.id ?? "new"} removed.`,
                      });
                      onClose();
                    }}
                  >
                    Delete campaign
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Sheet helpers                                                       */
/* ------------------------------------------------------------------ */

function KpiPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "amber" | "rose" | "slate";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "amber"
      ? "text-amber-600"
      : tone === "rose"
      ? "text-rose-600"
      : "text-foreground";
  return (
    <div className="rounded-lg border p-2 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${toneClass} tabular-nums`}>{value}</div>
    </div>
  );
}
