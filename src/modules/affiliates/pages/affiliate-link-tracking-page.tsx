"use client";

/**
 * Affiliates — Link Tracking Page (UX Constitution §9, §22-24, §33).
 *
 * Spec section 72 — Phase 9. Operational view of every affiliate
 * tracking link in the tenant: clicks, unique clicks, conversions,
 * revenue, source attribution, geo distribution, and per-link click
 * analytics. Surfaces top affiliates by clicks so the partner team
 * can prioritize relationship management.
 *
 * Sections:
 *   1. KPI row — Total Clicks (30d), Total Conversions, Conversion
 *      Rate, Top Affiliate Clicks (with affiliate name in deltaLabel)
 *   2. Filter bar — affiliate Select / source Select / date range + Export CSV
 *   3. Link Performance DataTable — Code / Affiliate / Source / Clicks /
 *      Unique Clicks / Conversions / Conv Rate / Revenue / Status / Actions
 *   4. Create Link button + Link Analytics Sheet Drawer (view + create)
 *   5. Click Trend (30d) — AreaSeries
 *   6. Clicks by Source — DonutSeries (Direct / Email / Social / Paid Ad /
 *      Referral / Banner)
 *   7. Top Affiliates by Clicks — DataTable
 *   8. Geo Distribution — DataTable (top 10 countries)
 *   9. Recent Clicks DataTable inside the Sheet drawer
 *
 * Terra palette only — emerald / amber / rose / slate / sky.
 * No Math.random — deterministic patterns (Math.sin + seeded counters).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { AreaSeries, DonutSeries } from "@/components/platform/charts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
  Link as LinkIcon,
  Plus,
  Download,
  Copy,
  MousePointerClick,
  Filter,
  Users,
  Target,
  TrendingUp,
  Globe,
  Ban,
  Trash2,
  Save,
  ExternalLink,
  Mail,
  Share2,
  Megaphone,
  UserCheck,
  Image as ImageIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type LinkSource = "Direct" | "Email" | "Social" | "Paid Ad" | "Referral" | "Banner";
type LinkStatus = "active" | "inactive" | "suspended";

interface AffiliateLink {
  id: string;
  url: string;
  refCode: string;
  affiliate: string;
  affiliateId: string;
  source: LinkSource;
  clicks: number;
  uniqueClicks: number;
  conversions: number;
  revenue: number;
  status: LinkStatus;
  createdAt: string;
  utmCampaign: string;
}

interface AffiliateRollup {
  rank: number;
  name: string;
  links: number;
  clicks: number;
  conversions: number;
  revenue: number;
  convRate: number;
  status: LinkStatus;
}

interface GeoRow {
  country: string;
  code: string;
  clicks: number;
  conversions: number;
  revenue: number;
}

interface RecentClick {
  timestamp: string;
  ip: string;
  country: string;
  device: "Desktop" | "Mobile" | "Tablet";
  converted: boolean;
}

const LINKS: AffiliateLink[] = [
  {
    id: "LNK-001",
    url: "https://propfirm.com/?ref=ACME24",
    refCode: "ACME24",
    affiliate: "Alex Trader",
    affiliateId: "AFF-001",
    source: "Direct",
    clicks: 1840,
    uniqueClicks: 1240,
    conversions: 47,
    revenue: 4700,
    status: "active",
    createdAt: "2026-01-12",
    utmCampaign: "q1_direct_push",
  },
  {
    id: "LNK-002",
    url: "https://propfirm.com/?ref=BETA50",
    refCode: "BETA50",
    affiliate: "Sarah Marketing",
    affiliateId: "AFF-002",
    source: "Email",
    clicks: 920,
    uniqueClicks: 720,
    conversions: 32,
    revenue: 3200,
    status: "active",
    createdAt: "2026-02-03",
    utmCampaign: "newsletter_feb",
  },
  {
    id: "LNK-003",
    url: "https://propfirm.com/?ref=GAMMA77",
    refCode: "GAMMA77",
    affiliate: "Maria Lopez",
    affiliateId: "AFF-003",
    source: "Social",
    clicks: 1340,
    uniqueClicks: 980,
    conversions: 28,
    revenue: 2800,
    status: "active",
    createdAt: "2026-02-14",
    utmCampaign: "ig_funded_stories",
  },
  {
    id: "LNK-004",
    url: "https://propfirm.com/?ref=DELTA12",
    refCode: "DELTA12",
    affiliate: "David Chen",
    affiliateId: "AFF-004",
    source: "Paid Ad",
    clicks: 2480,
    uniqueClicks: 1740,
    conversions: 64,
    revenue: 6400,
    status: "active",
    createdAt: "2026-01-22",
    utmCampaign: "google_branded",
  },
  {
    id: "LNK-005",
    url: "https://propfirm.com/?ref=ECHO88",
    refCode: "ECHO88",
    affiliate: "Emma Wilson",
    affiliateId: "AFF-005",
    source: "Referral",
    clicks: 640,
    uniqueClicks: 510,
    conversions: 19,
    revenue: 1900,
    status: "active",
    createdAt: "2026-03-01",
    utmCampaign: "friend_referral",
  },
  {
    id: "LNK-006",
    url: "https://propfirm.com/?ref=FOXTROT3",
    refCode: "FOXTROT3",
    affiliate: "Alex Trader",
    affiliateId: "AFF-001",
    source: "Banner",
    clicks: 410,
    uniqueClicks: 290,
    conversions: 9,
    revenue: 900,
    status: "inactive",
    createdAt: "2025-12-04",
    utmCampaign: "blog_sidebar",
  },
  {
    id: "LNK-007",
    url: "https://propfirm.com/?ref=GOLF55",
    refCode: "GOLF55",
    affiliate: "Sarah Marketing",
    affiliateId: "AFF-002",
    source: "Email",
    clicks: 1180,
    uniqueClicks: 860,
    conversions: 41,
    revenue: 4100,
    status: "active",
    createdAt: "2026-03-18",
    utmCampaign: "drip_onboarding",
  },
  {
    id: "LNK-008",
    url: "https://propfirm.com/?ref=HOTEL99",
    refCode: "HOTEL99",
    affiliate: "Maria Lopez",
    affiliateId: "AFF-003",
    source: "Social",
    clicks: 520,
    uniqueClicks: 380,
    conversions: 4,
    revenue: 400,
    status: "suspended",
    createdAt: "2026-04-02",
    utmCampaign: "tiktok_viral_test",
  },
];

const AFFILIATE_NAMES = Array.from(
  new Set(LINKS.map((l) => l.affiliate)),
);

/* Top Affiliates by Clicks — deterministic roll-up */
const TOP_AFFILIATES: AffiliateRollup[] = AFFILIATE_NAMES.map((name, i) => {
  const links = LINKS.filter((l) => l.affiliate === name);
  const clicks = links.reduce((s, l) => s + l.clicks, 0);
  const conversions = links.reduce((s, l) => s + l.conversions, 0);
  const revenue = links.reduce((s, l) => s + l.revenue, 0);
  // Status: suspended if any link is suspended, else active
  const anySuspended = links.some((l) => l.status === "suspended");
  const anyActive = links.some((l) => l.status === "active");
  const status: LinkStatus = anySuspended ? "suspended" : anyActive ? "active" : "inactive";
  return {
    rank: i + 1,
    name,
    links: links.length,
    clicks,
    conversions,
    revenue,
    convRate: clicks === 0 ? 0 : (conversions / clicks) * 100,
    status,
  };
}).sort((a, b) => b.clicks - a.clicks).map((r, i) => ({ ...r, rank: i + 1 }));

/* Geo distribution — top 10 countries */
const GEO: GeoRow[] = [
  { country: "United States", code: "US", clicks: 3120, conversions: 89, revenue: 8900 },
  { country: "United Kingdom", code: "GB", clicks: 1180, conversions: 34, revenue: 3400 },
  { country: "United Arab Emirates", code: "AE", clicks: 840, conversions: 28, revenue: 2800 },
  { country: "Singapore", code: "SG", clicks: 720, conversions: 22, revenue: 2200 },
  { country: "Germany", code: "DE", clicks: 640, conversions: 18, revenue: 1800 },
  { country: "Australia", code: "AU", clicks: 580, conversions: 14, revenue: 1400 },
  { country: "Canada", code: "CA", clicks: 510, conversions: 12, revenue: 1200 },
  { country: "France", code: "FR", clicks: 420, conversions: 9, revenue: 900 },
  { country: "Japan", code: "JP", clicks: 360, conversions: 7, revenue: 700 },
  { country: "India", code: "IN", clicks: 290, conversions: 5, revenue: 500 },
];

/* Click trend — 30-day deterministic AreaSeries data */
const CLICK_TREND_30D = Array.from({ length: 30 }, (_, i) => {
  const base = 220 + i * 4; // gentle growth
  const wave = Math.round(Math.sin(i / 3) * 60 + Math.cos(i / 5) * 30);
  return {
    date: `D${i + 1}`,
    value: Math.max(80, base + wave),
  };
});

/* Source palette — Terra only */
const SOURCE_COLORS: Record<LinkSource, string> = {
  Direct: "#475569",      // slate-600
  Email: "#059669",       // emerald
  Social: "#e11d48",      // rose
  "Paid Ad": "#d97706",   // amber
  Referral: "#15803d",   // green-700 (Terra-allowed; replaces sky-600)
  Banner: "#94a3b8",     // slate-400
};

/* Source icon for the Source column */
function sourceIcon(source: LinkSource) {
  switch (source) {
    case "Direct":
      return LinkIcon;
    case "Email":
      return Mail;
    case "Social":
      return Share2;
    case "Paid Ad":
      return Megaphone;
    case "Referral":
      return UserCheck;
    case "Banner":
      return ImageIcon;
  }
}

/* Source distribution for DonutSeries */
const SOURCE_DISTRIBUTION = (Object.keys(SOURCE_COLORS) as LinkSource[])
  .map((s) => ({
    label: s,
    value: LINKS.filter((l) => l.source === s).reduce((sum, l) => sum + l.clicks, 0),
    color: SOURCE_COLORS[s],
  }))
  .filter((d) => d.value > 0);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function linkStatusTone(status: LinkStatus): "success" | "muted" | "danger" {
  switch (status) {
    case "active":
      return "success";
    case "suspended":
      return "danger";
    case "inactive":
    default:
      return "muted";
  }
}

function convRate(clicks: number, conversions: number): number {
  if (clicks === 0) return 0;
  return (conversions / clicks) * 100;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function copyToClipboard(text: string, label = "Link") {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied`, description: text }),
      () => toast({ title: "Copy failed", description: "Clipboard unavailable", variant: "destructive" }),
    );
  } else {
    toast({ title: "Copy failed", description: "Clipboard unavailable", variant: "destructive" });
  }
}

/* Deterministic per-link click series (30d) for the Sheet drawer's
 * mini AreaSeries. Same link id → same series every render. */
function clickSeriesForLink(link: AffiliateLink) {
  // Seed from the link id (deterministic).
  let seed = 0;
  for (let i = 0; i < link.id.length; i++) seed = (seed * 31 + link.id.charCodeAt(i)) & 0x7fffffff;
  const dailyAvg = Math.max(8, Math.round(link.clicks / 30));
  return Array.from({ length: 30 }, (_, i) => {
    const v = (seed + i * 7) & 0x7fffffff;
    const wave = Math.sin((i + (seed % 12)) / 3) * 0.4 + 0.7; // 0.3..1.1
    return {
      date: `D${i + 1}`,
      value: Math.max(2, Math.round(dailyAvg * wave + (v % 5))),
    };
  });
}

/* Deterministic per-link recent clicks (10 entries) for the Sheet
 * drawer's Recent Clicks DataTable. */
const COUNTRIES = ["US", "GB", "AE", "SG", "DE", "AU", "CA", "FR", "JP", "IN"];
const DEVICES: Array<"Desktop" | "Mobile" | "Tablet"> = ["Desktop", "Mobile", "Tablet"];
function recentClicksForLink(link: AffiliateLink): RecentClick[] {
  let seed = 7;
  for (let i = 0; i < link.id.length; i++) seed = (seed * 17 + link.id.charCodeAt(i)) & 0x7fffffff;
  const baseConv = convRate(link.clicks, link.conversions) / 100;
  const out: RecentClick[] = [];
  for (let i = 0; i < 10; i++) {
    const v = (seed + i * 13) & 0x7fffffff;
    const dayOffset = i + 1;
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    d.setHours(8 + (v % 14), (v * 3) % 60, 0, 0);
    out.push({
      timestamp: d.toISOString(),
      ip: `${100 + (v % 150)}.${(v * 7) % 250}.${(v * 11) % 250}.${(v * 13) % 250}`,
      country: COUNTRIES[v % COUNTRIES.length],
      device: DEVICES[v % DEVICES.length],
      converted: (v % 100) / 100 < baseConv,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AffiliateLinkTrackingPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const currency = runtime.tenant?.currency ?? "USD";

  const [affiliateFilter, setAffiliateFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30");
  const [selected, setSelected] = useState<AffiliateLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AffiliateLink | null>(null);

  const filtered = useMemo(() => {
    return LINKS.filter((l) => {
      if (affiliateFilter !== "all" && l.affiliate !== affiliateFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      return true;
    });
  }, [affiliateFilter, sourceFilter]);

  // KPI roll-ups
  const totalClicks = LINKS.reduce((s, l) => s + l.clicks, 0);
  const totalConversions = LINKS.reduce((s, l) => s + l.conversions, 0);
  const convRatePct = convRate(totalClicks, totalConversions);
  const topAffiliate = TOP_AFFILIATES[0];
  const topAffiliateClicks = topAffiliate?.clicks ?? 0;
  const totalRevenue = LINKS.reduce((s, l) => s + l.revenue, 0);

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "Link ID", value: (l) => l.id },
        { key: "url", header: "URL", value: (l) => l.url },
        { key: "refCode", header: "Ref Code", value: (l) => l.refCode },
        { key: "affiliate", header: "Affiliate", value: (l) => l.affiliate },
        { key: "source", header: "Source", value: (l) => l.source },
        { key: "clicks", header: "Clicks", value: (l) => l.clicks },
        { key: "uniqueClicks", header: "Unique Clicks", value: (l) => l.uniqueClicks },
        { key: "conversions", header: "Conversions", value: (l) => l.conversions },
        {
          key: "convRate",
          header: "Conv Rate",
          value: (l) => `${convRate(l.clicks, l.conversions).toFixed(2)}%`,
        },
        { key: "revenue", header: "Revenue", value: (l) => l.revenue },
        { key: "status", header: "Status", value: (l) => l.status },
        { key: "createdAt", header: "Created", value: (l) => l.createdAt },
        { key: "utmCampaign", header: "UTM Campaign", value: (l) => l.utmCampaign },
      ],
      `affiliate-link-tracking-${Date.now()}.csv`,
    );
  };

  const linksColumns: Column<AffiliateLink>[] = [
    {
      key: "url",
      header: "Link",
      cell: (l) => (
        <div className="flex items-center gap-1.5">
          <span className="max-w-[260px] truncate font-mono text-xs text-foreground" title={l.url}>
            {l.url}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(l.url, "Link URL");
            }}
            aria-label={`Copy link URL for ${l.refCode}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
      sortValue: (l) => l.url,
    },
    {
      key: "affiliate",
      header: "Affiliate",
      cell: (l) => <span className="text-xs text-foreground">{l.affiliate}</span>,
      sortValue: (l) => l.affiliate,
    },
    {
      key: "source",
      header: "Source",
      cell: (l) => {
        const Icon = sourceIcon(l.source);
        const color = SOURCE_COLORS[l.source];
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
            <Icon className="h-3 w-3" style={{ color }} />
            {l.source}
          </span>
        );
      },
      sortValue: (l) => l.source,
    },
    {
      key: "clicks",
      header: "Clicks",
      cell: (l) => <span className="tabular-nums">{formatCompact(l.clicks)}</span>,
      sortValue: (l) => l.clicks,
      numeric: true,
    },
    {
      key: "uniqueClicks",
      header: "Unique",
      cell: (l) => <span className="tabular-nums text-muted-foreground">{formatCompact(l.uniqueClicks)}</span>,
      sortValue: (l) => l.uniqueClicks,
      numeric: true,
    },
    {
      key: "conversions",
      header: "Conv.",
      cell: (l) => <span className="tabular-nums">{l.conversions}</span>,
      sortValue: (l) => l.conversions,
      numeric: true,
    },
    {
      key: "convRate",
      header: "Conv Rate",
      cell: (l) => {
        const pct = convRate(l.clicks, l.conversions);
        const tone = pct >= 4 ? "text-emerald-600" : pct >= 2 ? "text-amber-600" : "text-muted-foreground";
        return <span className={`tabular-nums ${tone}`}>{pct.toFixed(1)}%</span>;
      },
      sortValue: (l) => convRate(l.clicks, l.conversions),
      numeric: true,
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (l) => (
        <span className="tabular-nums font-medium text-emerald-600">
          {formatCurrency(l.revenue, currency)}
        </span>
      ),
      sortValue: (l) => l.revenue,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (l) => (
        <StatusBadge tone={linkStatusTone(l.status)} className="capitalize">
          {l.status}
        </StatusBadge>
      ),
      sortValue: (l) => l.status,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (l) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setSelected(l);
              setCreating(false);
            }}
            aria-label={`View analytics for ${l.refCode}`}
          >
            View
          </Button>
          {l.status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
              onClick={() => {
                toast({
                  title: "Link suspended (demo)",
                  description: `${l.refCode} no longer redirects.`,
                  variant: "destructive",
                });
              }}
              aria-label={`Suspend link ${l.refCode}`}
            >
              <Ban className="h-3 w-3" />
            </Button>
          )}
        </div>
      ),
      numeric: true,
    },
  ];

  const topAffiliatesColumns: Column<AffiliateRollup>[] = [
    {
      key: "rank",
      header: "Rank",
      cell: (r) => (
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${r.rank <= 3 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
          {r.rank}
        </span>
      ),
      sortValue: (r) => r.rank,
      numeric: true,
    },
    {
      key: "name",
      header: "Affiliate",
      cell: (r) => <span className="text-sm font-medium text-foreground">{r.name}</span>,
      sortValue: (r) => r.name,
    },
    {
      key: "links",
      header: "Links",
      cell: (r) => <span className="tabular-nums">{r.links}</span>,
      sortValue: (r) => r.links,
      numeric: true,
    },
    {
      key: "clicks",
      header: "Clicks",
      cell: (r) => <span className="tabular-nums">{formatCompact(r.clicks)}</span>,
      sortValue: (r) => r.clicks,
      numeric: true,
    },
    {
      key: "conversions",
      header: "Conv.",
      cell: (r) => <span className="tabular-nums">{r.conversions}</span>,
      sortValue: (r) => r.conversions,
      numeric: true,
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (r) => (
        <span className="tabular-nums font-medium text-emerald-600">
          {formatCurrency(r.revenue, currency)}
        </span>
      ),
      sortValue: (r) => r.revenue,
      numeric: true,
    },
    {
      key: "convRate",
      header: "Conv Rate",
      cell: (r) => {
        const tone = r.convRate >= 4 ? "text-emerald-600" : r.convRate >= 2 ? "text-amber-600" : "text-muted-foreground";
        return <span className={`tabular-nums ${tone}`}>{r.convRate.toFixed(1)}%</span>;
      },
      sortValue: (r) => r.convRate,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge tone={linkStatusTone(r.status)} className="capitalize">
          {r.status}
        </StatusBadge>
      ),
      sortValue: (r) => r.status,
    },
  ];

  const geoColumns: Column<GeoRow>[] = [
    {
      key: "country",
      header: "Country",
      cell: (g) => (
        <span className="inline-flex items-center gap-2 text-xs text-foreground">
          <Globe className="h-3 w-3 text-muted-foreground" />
          {g.country}
          <Badge variant="outline" className="text-[10px]">{g.code}</Badge>
        </span>
      ),
      sortValue: (g) => g.country,
    },
    {
      key: "clicks",
      header: "Clicks",
      cell: (g) => <span className="tabular-nums">{formatCompact(g.clicks)}</span>,
      sortValue: (g) => g.clicks,
      numeric: true,
    },
    {
      key: "conversions",
      header: "Conv.",
      cell: (g) => <span className="tabular-nums">{g.conversions}</span>,
      sortValue: (g) => g.conversions,
      numeric: true,
    },
    {
      key: "convRate",
      header: "Conv Rate",
      cell: (g) => {
        const pct = convRate(g.clicks, g.conversions);
        const tone = pct >= 4 ? "text-emerald-600" : pct >= 2 ? "text-amber-600" : "text-muted-foreground";
        return <span className={`tabular-nums ${tone}`}>{pct.toFixed(1)}%</span>;
      },
      sortValue: (g) => convRate(g.clicks, g.conversions),
      numeric: true,
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (g) => (
        <span className="tabular-nums font-medium text-emerald-600">
          {formatCurrency(g.revenue, currency)}
        </span>
      ),
      sortValue: (g) => g.revenue,
      numeric: true,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Link Tracking"
        description={`Monitor every affiliate tracking link — clicks, conversions, revenue, and source attribution for ${term("trader").toLowerCase()} signups.`}
        icon={LinkIcon}
        term={`Attributable revenue · 30-day window · ${term("trader")} → funded conversion`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelected(null);
                setCreating(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Create Link
            </Button>
          </>
        }
      />
      <PageContent>
        {/* KPI row — §9 every metric carries context */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Clicks (30d)"
            value={formatCompact(totalClicks)}
            icon={MousePointerClick}
            tone="positive"
            deltaLabel={`${formatCompact(LINKS.reduce((s, l) => s + l.uniqueClicks, 0))} unique`}
          />
          <MetricCard
            label="Total Conversions"
            value={formatCompact(totalConversions)}
            icon={Target}
            tone="positive"
            deltaLabel={`funded ${term("trader").toLowerCase()} signups`}
          />
          <MetricCard
            label="Conversion Rate"
            value={`${convRatePct.toFixed(1)}%`}
            icon={TrendingUp}
            tone="positive"
            deltaLabel="industry benchmark: 2-4%"
          />
          <MetricCard
            label="Top Affiliate Clicks"
            value={formatCompact(topAffiliateClicks)}
            icon={Users}
            tone="positive"
            deltaLabel={topAffiliate?.name ?? "—"}
          />
        </div>

        {/* Filter bar + Link Performance DataTable */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              Link Performance
              <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
                <SelectTrigger size="sm" className="h-8 w-44 text-xs" aria-label="Filter by affiliate">
                  <SelectValue placeholder="All affiliates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All affiliates</SelectItem>
                  {AFFILIATE_NAMES.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger size="sm" className="h-8 w-36 text-xs" aria-label="Filter by source">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Social">Social</SelectItem>
                  <SelectItem value="Paid Ad">Paid Ad</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Banner">Banner</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger size="sm" className="h-8 w-28 text-xs" aria-label="Filter by date range">
                  <SelectValue placeholder="30 days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={linksColumns}
            data={filtered}
            rowKey={(l) => l.id}
            searchableText={(l) => `${l.url} ${l.refCode} ${l.affiliate} ${l.source} ${l.utmCampaign}`}
            searchPlaceholder="Search by ref code or affiliate…"
            pageSize={8}
            onRowClick={(l) => {
              setSelected(l);
              setCreating(false);
            }}
            emptyTitle="No links match"
            emptyDescription="Adjust the affiliate or source filter and try again."
          />
        </div>

        {/* Click Trend + Clicks by Source */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MousePointerClick className="h-3.5 w-3.5 text-emerald-600" />
                Click Trend (30d)
              </div>
              <span className="text-xs text-muted-foreground">Deterministic — same value on every render</span>
            </div>
            <AreaSeries
              data={CLICK_TREND_30D}
              xKey="date"
              yKey="value"
              color="#059669"
              height={240}
              formatValue={(v) => formatCompact(v)}
            />
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
              <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
              <LabelWithHelp help="Distribution of all tracked clicks across the six affiliate sources. Direct = unattributed; Referral = friend-invite; Banner = partner site embeds.">
                Clicks by Source
              </LabelWithHelp>
            </div>
            <DonutSeries
              data={SOURCE_DISTRIBUTION}
              height={240}
              formatValue={(v) => formatCompact(v)}
            />
          </div>
        </div>

        {/* Top Affiliates by Clicks */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
              Top Affiliates by Clicks
            </div>
            <span className="text-xs text-muted-foreground">
              Ranked by total clicks across all their links.
            </span>
          </div>
          <DataTable
            columns={topAffiliatesColumns}
            data={TOP_AFFILIATES}
            rowKey={(r) => r.name}
            pageSize={5}
            emptyTitle="No affiliates"
            emptyDescription="Top affiliates will appear here once links generate clicks."
          />
        </div>

        {/* Geo Distribution */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Globe className="h-3.5 w-3.5 text-emerald-600" />
              <LabelWithHelp help="Top 10 countries by click volume. Conversion rate is computed as conversions / clicks for each country.">
                Geo Distribution
              </LabelWithHelp>
            </div>
            <span className="text-xs text-muted-foreground">Top 10 countries</span>
          </div>
          <DataTable
            columns={geoColumns}
            data={GEO}
            rowKey={(g) => g.code}
            pageSize={10}
            emptyTitle="No geo data"
            emptyDescription="Geo distribution will populate once links start receiving clicks."
          />
        </div>
      </PageContent>

      <LinkAnalyticsSheet
        key={selected?.id ?? (creating ? "__create__" : "__closed__")}
        link={selected}
        creating={creating}
        currency={currency}
        onClose={() => {
          setSelected(null);
          setCreating(false);
        }}
        onDelete={(l) => {
          setSelected(null);
          setCreating(false);
          setDeleteTarget(l);
        }}
      />

      {/* Delete Link AlertDialog — destructive friction §24 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete link {deleteTarget?.refCode ?? ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The tracking link will stop redirecting immediately. Past
              {deleteTarget ? ` ${deleteTarget.clicks.toLocaleString()} clicks and ${deleteTarget.conversions} conversions` : " all click and conversion"} data is{" "}
              <strong>retained</strong> for attribution reporting — only the
              link itself is removed. Existing marketing creative that points
              at this URL will return a 404. This action is logged in the
              audit trail and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep link</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (deleteTarget) {
                  toast({
                    title: "Link deleted",
                    description: `${deleteTarget.refCode} no longer redirects. Past analytics retained.`,
                    variant: "destructive",
                  });
                }
                setDeleteTarget(null);
              }}
            >
              Delete link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Link Analytics Sheet Drawer (View or Create)                       */
/* ------------------------------------------------------------------ */

function LinkAnalyticsSheet({
  link,
  creating,
  currency,
  onClose,
  onDelete,
}: {
  link: AffiliateLink | null;
  creating: boolean;
  currency: string;
  onClose: () => void;
  onDelete: (l: AffiliateLink) => void;
}) {
  const open = creating || link !== null;
  // The parent component passes a `key` prop so the entire sheet
  // remounts whenever the target link changes (or when entering
  // create mode). Lazy useState initializers read from `link`
  // and `creating` on mount — no useEffect, no setState-in-effect
  // warning (react-hooks/set-state-in-effect).
  const [affiliate, setAffiliate] = useState(() => link?.affiliateId ?? "AFF-001");
  const [source, setSource] = useState<LinkSource>(() => link?.source ?? "Direct");
  const [campaign, setCampaign] = useState(() => link?.utmCampaign ?? "");
  const [created, setCreated] = useState(() => link?.createdAt ?? new Date().toISOString().slice(0, 10));
  const [url, setUrl] = useState(() => link?.url ?? "https://propfirm.com/?ref=NEWLINK");
  const [refCode, setRefCode] = useState(() => link?.refCode ?? "NEWLINK");

  // Derived analytics for the viewed link (deterministic per link)
  const series = link ? clickSeriesForLink(link) : [];
  const recentClicks = link ? recentClicksForLink(link) : [];

  const handleSave = () => {
    if (!refCode.trim()) {
      toast({ title: "Ref code required", description: "Generate or type a ref code first.", variant: "destructive" });
      return;
    }
    toast({
      title: creating ? "Link created" : "Link saved",
      description: `${refCode} — ${source} · ${affiliate}.`,
    });
    onClose();
  };

  const handleSuspend = () => {
    toast({
      title: "Link suspended (demo)",
      description: `${refCode} no longer redirects.`,
      variant: "destructive",
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            {creating ? "Create Tracking Link" : `Link Analytics — ${link?.refCode ?? ""}`}
          </SheetTitle>
          <SheetDescription>
            {creating
              ? "Configure the affiliate, source, and UTM campaign for a new tracking link."
              : `${link?.clicks.toLocaleString() ?? 0} clicks · ${link?.conversions ?? 0} conversions · ${formatCurrency(link?.revenue ?? 0, currency)} revenue`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4">
          {/* Link URL (read-only + Copy) */}
          <div className="space-y-1.5">
            <Label htmlFor="lnk-url" className="text-xs">
              <LabelWithHelp help="The full tracking URL the affiliate shares. The ?ref= parameter is what ties clicks to this affiliate.">
                Link URL
              </LabelWithHelp>
            </Label>
            <div className="flex gap-2">
              <Input
                id="lnk-url"
                value={url}
                readOnly
                className="font-mono text-xs"
                aria-label="Link URL (read-only)"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(url, "Link URL")}
                aria-label="Copy link URL"
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-xs text-muted-foreground hover:bg-muted"
                aria-label="Open link in new tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Affiliate + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Affiliate</Label>
              <Select value={affiliate} onValueChange={setAffiliate}>
                <SelectTrigger size="sm" className="h-9 text-xs" aria-label="Affiliate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AFF-001">Alex Trader</SelectItem>
                  <SelectItem value="AFF-002">Sarah Marketing</SelectItem>
                  <SelectItem value="AFF-003">Maria Lopez</SelectItem>
                  <SelectItem value="AFF-004">David Chen</SelectItem>
                  <SelectItem value="AFF-005">Emma Wilson</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                <LabelWithHelp help="The marketing channel that drove the click. Used for source-level reporting and the Clicks by Source donut.">
                  Source
                </LabelWithHelp>
              </Label>
              <Select value={source} onValueChange={(v) => setSource(v as LinkSource)}>
                <SelectTrigger size="sm" className="h-9 text-xs" aria-label="Traffic source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direct">Direct</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Social">Social</SelectItem>
                  <SelectItem value="Paid Ad">Paid Ad</SelectItem>
                  <SelectItem value="Referral">Referral</SelectItem>
                  <SelectItem value="Banner">Banner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campaign + Created */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lnk-campaign" className="text-xs">
                <LabelWithHelp help="UTM campaign parameter — surfaces in GA4 / Mixpanel alongside the ref code. Lowercase, underscore-separated.">
                  UTM Campaign
                </LabelWithHelp>
              </Label>
              <Input
                id="lnk-campaign"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                placeholder="q1_direct_push"
                className="font-mono text-xs"
                aria-label="UTM campaign"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lnk-created" className="text-xs">Created</Label>
              <Input
                id="lnk-created"
                type="date"
                value={created}
                readOnly
                aria-label="Link created date"
                className="bg-muted/40 text-xs"
              />
            </div>
          </div>

          <Separator />

          {/* Click analytics mini-chart (30d) — view mode only */}
          {!creating && series.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MousePointerClick className="h-3.5 w-3.5 text-emerald-600" />
                  Click Analytics (30d)
                </div>
                <span className="text-xs text-muted-foreground">
                  Peak: {Math.max(...series.map((s) => Number(s.value)))} clicks
                </span>
              </div>
              <AreaSeries
                data={series}
                xKey="date"
                yKey="value"
                color="#059669"
                height={160}
                formatValue={(v) => formatCompact(v)}
              />
            </div>
          )}

          {/* Recent Clicks DataTable — view mode only */}
          {!creating && recentClicks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                  Recent Clicks (last 10)
                </div>
                <span className="text-xs text-muted-foreground">
                  {recentClicks.filter((c) => c.converted).length} converted
                </span>
              </div>
              <RecentClicksTable rows={recentClicks} />
            </div>
          )}
        </div>

        <SheetFooter className="mt-auto flex-row gap-2 border-t pt-4">
          <Button size="sm" onClick={handleSave}>
            <Save className="mr-1 h-3.5 w-3.5" /> {creating ? "Create" : "Save"}
          </Button>
          {!creating && link && link.status === "active" && (
            <Button size="sm" variant="outline" onClick={handleSuspend}>
              <Ban className="mr-1 h-3.5 w-3.5" /> Suspend
            </Button>
          )}
          {!creating && link && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="ml-auto"
                  aria-label="Delete this link"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete link {link.refCode}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The tracking link will stop redirecting immediately. Past
                    {` ${link.clicks.toLocaleString()} clicks and ${link.conversions} conversions`} data is{" "}
                    <strong>retained</strong> for attribution reporting — only the
                    link itself is removed. Existing marketing creative that points
                    at this URL will return a 404. This action is logged in the
                    audit trail and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep link</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 text-white hover:bg-rose-700"
                    onClick={() => onDelete(link)}
                  >
                    Delete link
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {creating && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose}>
              Cancel
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Recent Clicks mini-table (inline — not the platform DataTable)     */
/* ------------------------------------------------------------------ */

function RecentClicksTable({ rows }: { rows: RecentClick[] }) {
  const data: RecentClick[] = Array.isArray(rows) ? rows : [];
  return (
    <div className="rounded-lg border bg-background">
      <div className="grid grid-cols-5 gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Timestamp</span>
        <span>IP</span>
        <span>Country</span>
        <span>Device</span>
        <span className="text-right">Converted</span>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {data.map((c, i) => (
          <div
            key={i}
            className="grid grid-cols-5 gap-2 border-b px-3 py-1.5 text-xs last:border-b-0"
          >
            <span className="font-mono text-[11px] text-muted-foreground">
              {new Date(c.timestamp).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{c.ip}</span>
            <Badge variant="outline" className="w-fit text-[10px]">{c.country}</Badge>
            <span className="text-xs">{c.device}</span>
            <span className="text-right">
              {c.converted ? (
                <Badge className="border-transparent bg-emerald-100 text-emerald-700 text-[10px] dark:bg-emerald-950 dark:text-emerald-400">
                  ✓ Converted
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
