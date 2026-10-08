"use client";

/**
 * Affiliates — Coupon Codes Page (UX Constitution §9, §22-24, §33).
 *
 * Spec section 72 — Phase 9. Operational CRUD surface for affiliate
 * coupon codes: code generation, discount config, redemption caps,
 * plan targeting, and per-affiliate attribution. Surfaces top-performing
 * coupons so marketing leads can double-down on what converts.
 *
 * Sections:
 *   1. KPI row — Active Coupons, Total Redemptions (30d),
 *      Discount Given (30d), Revenue from Coupons (30d)
 *   2. Filter bar — status Select / discount-type Select + Export CSV
 *   3. Coupons DataTable — full lifecycle (Code / Type / Value / Used /
 *      Limit / Expires / Status / Actions)
 *   4. Create Coupon button + Coupon Sheet Drawer (view + create modes)
 *   5. Disable Coupon AlertDialog — destructive friction §24
 *   6. Top Performing Coupons DataTable — Code / Redemptions / Discount
 *      Given / Revenue Attributed / Conversion Rate / Top Affiliate
 *
 * Terra palette only — emerald / amber / rose / slate / sky.
 * No Math.random — deterministic patterns (LCG seed + Math.sin).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Ticket,
  Plus,
  Download,
  Copy,
  Pencil,
  Ban,
  Files,
  RefreshCw,
  Calendar,
  Filter,
  DollarSign,
  Users,
  TrendingUp,
  Percent,
  Gift,
  Coins,
  Tag,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type CouponStatus = "active" | "expired" | "disabled" | "scheduled";
type DiscountType = "Percentage" | "Flat" | "Free Trial" | "Bonus Credit";
type PlanName = "Starter" | "Growth" | "Scale" | "Enterprise";

interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minPurchase: number;
  used: number;
  limit: number;
  validFrom: string;
  expires: string;
  status: CouponStatus;
  applicablePlans: PlanName[];
  affiliateId: string;
  affiliateName: string;
  redemptions30d: number;
  discountGiven30d: number;
  revenueAttributed30d: number;
  conversionRate: number; // 0-100
  topAffiliate: string;
}

const ALL_PLANS: PlanName[] = ["Starter", "Growth", "Scale", "Enterprise"];

const COUPONS: Coupon[] = [
  {
    id: "CPN-001",
    code: "WELCOME20",
    description: "20% off first challenge — welcome offer",
    discountType: "Percentage",
    discountValue: 20,
    minPurchase: 100,
    used: 184,
    limit: 500,
    validFrom: "2026-01-01",
    expires: "2026-12-31",
    status: "active",
    applicablePlans: ["Starter", "Growth"],
    affiliateId: "AFF-001",
    affiliateName: "Alex Trader",
    redemptions30d: 47,
    discountGiven30d: 940,
    revenueAttributed30d: 4700,
    conversionRate: 12.4,
    topAffiliate: "Alex Trader",
  },
  {
    id: "CPN-002",
    code: "SUMMER50",
    description: "$50 off any plan — summer promo",
    discountType: "Flat",
    discountValue: 50,
    minPurchase: 200,
    used: 92,
    limit: 200,
    validFrom: "2026-06-01",
    expires: "2026-09-30",
    status: "active",
    applicablePlans: ["Starter", "Growth", "Scale"],
    affiliateId: "AFF-002",
    affiliateName: "Sarah Marketing",
    redemptions30d: 23,
    discountGiven30d: 1150,
    revenueAttributed30d: 2300,
    conversionRate: 9.8,
    topAffiliate: "Sarah Marketing",
  },
  {
    id: "CPN-003",
    code: "FREETRIAL",
    description: "Free 14-day trial — no credit card required",
    discountType: "Free Trial",
    discountValue: 14,
    minPurchase: 0,
    used: 47,
    limit: 100,
    validFrom: "2026-03-01",
    expires: "2026-12-31",
    status: "active",
    applicablePlans: ["Starter"],
    affiliateId: "AFF-003",
    affiliateName: "Maria Lopez",
    redemptions30d: 12,
    discountGiven30d: 0,
    revenueAttributed30d: 980,
    conversionRate: 14.2,
    topAffiliate: "Maria Lopez",
  },
  {
    id: "CPN-004",
    code: "BONUS100",
    description: "$100 bonus credit on funded account",
    discountType: "Bonus Credit",
    discountValue: 100,
    minPurchase: 500,
    used: 28,
    limit: 50,
    validFrom: "2026-04-15",
    expires: "2026-12-31",
    status: "active",
    applicablePlans: ["Scale", "Enterprise"],
    affiliateId: "AFF-004",
    affiliateName: "David Chen",
    redemptions30d: 8,
    discountGiven30d: 800,
    revenueAttributed30d: 4000,
    conversionRate: 18.6,
    topAffiliate: "David Chen",
  },
  {
    id: "CPN-005",
    code: "SPRING15",
    description: "15% off — spring promo (ended)",
    discountType: "Percentage",
    discountValue: 15,
    minPurchase: 0,
    used: 312,
    limit: 500,
    validFrom: "2026-03-01",
    expires: "2026-06-30",
    status: "expired",
    applicablePlans: ["Starter", "Growth"],
    affiliateId: "AFF-005",
    affiliateName: "Emma Wilson",
    redemptions30d: 0,
    discountGiven30d: 0,
    revenueAttributed30d: 0,
    conversionRate: 10.1,
    topAffiliate: "Emma Wilson",
  },
  {
    id: "CPN-006",
    code: "FALL25",
    description: "25% off — fall launch (scheduled)",
    discountType: "Percentage",
    discountValue: 25,
    minPurchase: 150,
    used: 0,
    limit: 250,
    validFrom: "2026-10-01",
    expires: "2026-11-30",
    status: "scheduled",
    applicablePlans: ["Starter", "Growth", "Scale"],
    affiliateId: "AFF-001",
    affiliateName: "Alex Trader",
    redemptions30d: 0,
    discountGiven30d: 0,
    revenueAttributed30d: 0,
    conversionRate: 0,
    topAffiliate: "Alex Trader",
  },
  {
    id: "CPN-007",
    code: "VIP40",
    description: "40% off — VIP offer (manually disabled)",
    discountType: "Percentage",
    discountValue: 40,
    minPurchase: 1000,
    used: 18,
    limit: 50,
    validFrom: "2026-02-01",
    expires: "2026-12-31",
    status: "disabled",
    applicablePlans: ["Scale", "Enterprise"],
    affiliateId: "AFF-002",
    affiliateName: "Sarah Marketing",
    redemptions30d: 0,
    discountGiven30d: 0,
    revenueAttributed30d: 0,
    conversionRate: 16.7,
    topAffiliate: "Sarah Marketing",
  },
  {
    id: "CPN-008",
    code: "WELCOME10",
    description: "$10 off — entry tier",
    discountType: "Flat",
    discountValue: 10,
    minPurchase: 50,
    used: 421,
    limit: 1000,
    validFrom: "2026-01-15",
    expires: "2026-12-31",
    status: "active",
    applicablePlans: ["Starter"],
    affiliateId: "AFF-003",
    affiliateName: "Maria Lopez",
    redemptions30d: 88,
    discountGiven30d: 880,
    revenueAttributed30d: 1760,
    conversionRate: 8.3,
    topAffiliate: "Maria Lopez",
  },
];

/* Top performing coupons — separate panel for marketing leads */
const TOP_PERF: Coupon[] = [...COUPONS]
  .filter((c) => c.status === "active")
  .sort((a, b) => b.revenueAttributed30d - a.revenueAttributed30d)
  .slice(0, 5);

const AFFILIATE_NAMES = Array.from(
  new Set(COUPONS.map((c) => c.affiliateName)),
);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function couponStatusTone(status: CouponStatus): "success" | "muted" | "danger" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "scheduled":
      return "info";
    case "disabled":
      return "danger";
    case "expired":
    default:
      return "muted";
  }
}

function discountTypeIcon(type: DiscountType) {
  switch (type) {
    case "Percentage":
      return Percent;
    case "Flat":
      return DollarSign;
    case "Free Trial":
      return Gift;
    case "Bonus Credit":
      return Coins;
  }
}

function formatDiscountValue(type: DiscountType, value: number, currency = "USD"): string {
  switch (type) {
    case "Percentage":
      return `${value}%`;
    case "Flat":
      return formatCurrency(value, currency);
    case "Free Trial":
      return `${value} days`;
    case "Bonus Credit":
      return formatCurrency(value, currency);
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* Deterministic 8-char code generator — LCG seeded by an integer
 * counter. No Math.random — same seed always produces same code. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I O 0 1
function generateCode(seed: number): string {
  let v = seed * 31 + 7;
  let out = "";
  for (let i = 0; i < 8; i++) {
    v = (v * 1103515245 + 12345) & 0x7fffffff;
    out += CODE_ALPHABET[v % CODE_ALPHABET.length];
  }
  return out;
}

function copyToClipboard(text: string, label = "Code") {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: `${label} copied`, description: text }),
      () => toast({ title: "Copy failed", description: "Clipboard unavailable", variant: "destructive" }),
    );
  } else {
    toast({ title: "Copy failed", description: "Clipboard unavailable", variant: "destructive" });
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AffiliateCouponsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const currency = runtime.tenant?.currency ?? "USD";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [disableTarget, setDisableTarget] = useState<Coupon | null>(null);

  const filtered = useMemo(() => {
    return COUPONS.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.discountType !== typeFilter) return false;
      return true;
    });
  }, [statusFilter, typeFilter]);

  // KPI roll-ups (30-day window for the active coupons)
  const activeCount = COUPONS.filter((c) => c.status === "active").length;
  const totalRedemptions = COUPONS.reduce((s, c) => s + c.redemptions30d, 0);
  const totalDiscountGiven = COUPONS.reduce((s, c) => s + c.discountGiven30d, 0);
  const totalRevenue = COUPONS.reduce((s, c) => s + c.revenueAttributed30d, 0);
  const topPerformer = TOP_PERF[0]?.code ?? "—";

  const handleExport = () => {
    exportToCsv(
      filtered,
      [
        { key: "id", header: "Coupon ID", value: (c) => c.id },
        { key: "code", header: "Code", value: (c) => c.code },
        { key: "description", header: "Description", value: (c) => c.description },
        { key: "discountType", header: "Discount Type", value: (c) => c.discountType },
        { key: "discountValue", header: "Discount Value", value: (c) => c.discountValue },
        { key: "minPurchase", header: "Min Purchase", value: (c) => c.minPurchase },
        { key: "used", header: "Used", value: (c) => c.used },
        { key: "limit", header: "Limit", value: (c) => c.limit },
        { key: "validFrom", header: "Valid From", value: (c) => c.validFrom },
        { key: "expires", header: "Expires", value: (c) => c.expires },
        { key: "status", header: "Status", value: (c) => c.status },
        { key: "affiliate", header: "Affiliate", value: (c) => c.affiliateName },
        { key: "redemptions30d", header: "Redemptions (30d)", value: (c) => c.redemptions30d },
        { key: "discountGiven30d", header: "Discount Given (30d)", value: (c) => c.discountGiven30d },
        { key: "revenueAttributed30d", header: "Revenue Attributed (30d)", value: (c) => c.revenueAttributed30d },
      ],
      `affiliate-coupons-${Date.now()}.csv`,
    );
  };

  const couponsColumns: Column<Coupon>[] = [
    {
      key: "code",
      header: "Code",
      cell: (c) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium text-foreground">{c.code}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              copyToClipboard(c.code, "Coupon code");
            }}
            aria-label={`Copy coupon code ${c.code}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
      sortValue: (c) => c.code,
    },
    {
      key: "description",
      header: "Description",
      cell: (c) => (
        <span className="line-clamp-1 text-xs text-muted-foreground">{c.description}</span>
      ),
      sortValue: (c) => c.description,
    },
    {
      key: "discountType",
      header: "Type",
      cell: (c) => {
        const Icon = discountTypeIcon(c.discountType);
        return (
          <span className="inline-flex items-center gap-1 text-xs text-foreground">
            <Icon className="h-3 w-3 text-muted-foreground" />
            {c.discountType}
          </span>
        );
      },
      sortValue: (c) => c.discountType,
    },
    {
      key: "discountValue",
      header: "Value",
      cell: (c) => (
        <span className="font-medium tabular-nums text-foreground">
          {formatDiscountValue(c.discountType, c.discountValue, currency)}
        </span>
      ),
      sortValue: (c) => c.discountValue,
      numeric: true,
    },
    {
      key: "minPurchase",
      header: "Min Purchase",
      cell: (c) =>
        c.minPurchase === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <span className="tabular-nums text-xs">{formatCurrency(c.minPurchase, currency)}</span>
        ),
      sortValue: (c) => c.minPurchase,
      numeric: true,
    },
    {
      key: "used",
      header: "Used",
      cell: (c) => (
        <span className="tabular-nums text-xs">
          {c.used}
          <span className="text-muted-foreground"> / {c.limit}</span>
        </span>
      ),
      sortValue: (c) => c.used,
      numeric: true,
    },
    {
      key: "expires",
      header: "Expires",
      cell: (c) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(c.expires)}
        </span>
      ),
      sortValue: (c) => c.expires,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <StatusBadge tone={couponStatusTone(c.status)} className="capitalize">
          {c.status}
        </StatusBadge>
      ),
      sortValue: (c) => c.status,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (c) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setSelected(c);
              setCreating(false);
            }}
            aria-label={`Edit coupon ${c.code}`}
          >
            <Pencil className="mr-1 h-3 w-3" /> Edit
          </Button>
          {c.status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
              onClick={() => setDisableTarget(c)}
              aria-label={`Disable coupon ${c.code}`}
            >
              <Ban className="mr-1 h-3 w-3" /> Disable
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() =>
              toast({
                title: "Coupon duplicated",
                description: `${c.code} → ${c.code}-COPY draft created.`,
              })
            }
            aria-label={`Duplicate coupon ${c.code}`}
          >
            <Files className="h-3 w-3" />
          </Button>
        </div>
      ),
      numeric: true,
    },
  ];

  const topPerfColumns: Column<Coupon>[] = [
    {
      key: "code",
      header: "Code",
      cell: (c) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-medium text-foreground">{c.code}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => copyToClipboard(c.code, "Coupon code")}
            aria-label={`Copy ${c.code}`}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      ),
      sortValue: (c) => c.code,
    },
    {
      key: "redemptions30d",
      header: "Redemptions",
      cell: (c) => <span className="tabular-nums">{c.redemptions30d}</span>,
      sortValue: (c) => c.redemptions30d,
      numeric: true,
    },
    {
      key: "discountGiven30d",
      header: "Discount Given",
      cell: (c) => (
        <span className="tabular-nums text-rose-600">
          {formatCurrency(c.discountGiven30d, currency)}
        </span>
      ),
      sortValue: (c) => c.discountGiven30d,
      numeric: true,
    },
    {
      key: "revenueAttributed30d",
      header: "Revenue",
      cell: (c) => (
        <span className="tabular-nums font-medium text-emerald-600">
          {formatCurrency(c.revenueAttributed30d, currency)}
        </span>
      ),
      sortValue: (c) => c.revenueAttributed30d,
      numeric: true,
    },
    {
      key: "conversionRate",
      header: "Conv. Rate",
      cell: (c) => {
        const tone = c.conversionRate >= 12 ? "text-emerald-600" : "text-muted-foreground";
        return <span className={`tabular-nums ${tone}`}>{c.conversionRate.toFixed(1)}%</span>;
      },
      sortValue: (c) => c.conversionRate,
      numeric: true,
    },
    {
      key: "topAffiliate",
      header: "Top Affiliate",
      cell: (c) => <span className="text-xs text-foreground">{c.topAffiliate}</span>,
      sortValue: (c) => c.topAffiliate,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Coupon Codes"
        description={`Create and track coupon codes that ${term("account").toLowerCase()}s redeem on ${term("challenge")} purchases via affiliate links.`}
        icon={Ticket}
        term={`Attributable revenue · 30-day window · ${term("account")} → funded conversion`}
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
              <Plus className="mr-1 h-4 w-4" /> Create Coupon
            </Button>
          </>
        }
      />
      <PageContent>
        {/* KPI row — §9 every metric carries context */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Active Coupons"
            value={activeCount}
            icon={Ticket}
            tone="positive"
            deltaLabel={`${COUPONS.length} total · ${COUPONS.filter((c) => c.status === "scheduled").length} scheduled`}
          />
          <MetricCard
            label="Total Redemptions (30d)"
            value={formatCompact(totalRedemptions)}
            icon={Users}
            tone="positive"
            deltaLabel={`across all ${term("account").toLowerCase()} signups`}
          />
          <MetricCard
            label="Discount Given (30d)"
            value={formatCurrency(totalDiscountGiven, currency)}
            icon={Tag}
            tone="negative"
            deltaLabel="reduces recognized revenue"
          />
          <MetricCard
            label="Revenue from Coupons (30d)"
            value={formatCurrency(totalRevenue, currency)}
            icon={TrendingUp}
            tone="positive"
            deltaLabel={`top: ${topPerformer}`}
          />
        </div>

        {/* Filter bar + Coupons DataTable */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              All Coupons
              <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="h-8 w-36 text-xs" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger size="sm" className="h-8 w-40 text-xs" aria-label="Filter by discount type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All discount types</SelectItem>
                  <SelectItem value="Percentage">Percentage</SelectItem>
                  <SelectItem value="Flat">Flat</SelectItem>
                  <SelectItem value="Free Trial">Free Trial</SelectItem>
                  <SelectItem value="Bonus Credit">Bonus Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DataTable
            columns={couponsColumns}
            data={filtered}
            rowKey={(c) => c.id}
            searchableText={(c) => `${c.code} ${c.description} ${c.affiliateName} ${c.discountType}`}
            searchPlaceholder="Search by code or affiliate…"
            pageSize={8}
            onRowClick={(c) => {
              setSelected(c);
              setCreating(false);
            }}
            emptyTitle="No coupons match"
            emptyDescription="Adjust the status or discount-type filter and try again."
          />
        </div>

        {/* Top Performing Coupons — separate section per spec */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              Top Performing Coupons (30d)
            </div>
            <span className="text-xs text-muted-foreground">
              Ranked by revenue attributed to coupon-driven signups.
            </span>
          </div>
          <DataTable
            columns={topPerfColumns}
            data={TOP_PERF}
            rowKey={(c) => c.id}
            pageSize={5}
            emptyTitle="No active coupons"
            emptyDescription="Top performers will appear here once redemptions roll in."
          />
        </div>
      </PageContent>

      <CouponSheet
        key={selected?.id ?? (creating ? "__create__" : "__closed__")}
        coupon={selected}
        creating={creating}
        onClose={() => {
          setSelected(null);
          setCreating(false);
        }}
        currency={currency}
        onDisable={(c) => {
          setSelected(null);
          setCreating(false);
          setDisableTarget(c);
        }}
      />

      {/* Disable Coupon AlertDialog — destructive friction §24 */}
      <AlertDialog
        open={!!disableTarget}
        onOpenChange={(open) => {
          if (!open) setDisableTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disable coupon {disableTarget?.code ?? ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The coupon will stop accepting new redemptions immediately.
              {disableTarget
                ? ` ${disableTarget.used} ${term("account").toLowerCase()}${disableTarget.used === 1 ? "" : "s"} have already redeemed this code — those discounts remain honored.`
                : ""}
              {" "}Existing tracked links continue to work but return a "code disabled" error to the {term("account").toLowerCase()} at checkout. This action is logged in the audit trail and can be reversed by re-enabling the coupon.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep coupon</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                if (disableTarget) {
                  toast({
                    title: "Coupon disabled",
                    description: `${disableTarget.code} no longer accepts redemptions.`,
                    variant: "destructive",
                  });
                }
                setDisableTarget(null);
              }}
            >
              Disable coupon
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Coupon Sheet Drawer (View or Create)                                */
/* ------------------------------------------------------------------ */

function CouponSheet({
  coupon,
  creating,
  onClose,
  currency,
  onDisable,
}: {
  coupon: Coupon | null;
  creating: boolean;
  onClose: () => void;
  currency: string;
  onDisable: (c: Coupon) => void;
}) {
  const open = creating || coupon !== null;
  // The parent component passes a `key` prop so the entire sheet
  // remounts whenever the target coupon changes (or when entering
  // create mode). Lazy useState initializers read from `coupon`
  // and `creating` on mount — no useEffect, no setState-in-effect
  // warning (react-hooks/set-state-in-effect).
  const [codeValue, setCodeValue] = useState(() => coupon?.code ?? generateCode(1));
  const [description, setDescription] = useState(() => coupon?.description ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(() => coupon?.discountType ?? "Percentage");
  const [discountValue, setDiscountValue] = useState(() => String(coupon?.discountValue ?? 10));
  const [minPurchase, setMinPurchase] = useState(() => String(coupon?.minPurchase ?? 0));
  const [limit, setLimit] = useState(() => String(coupon?.limit ?? 100));
  const [unlimited, setUnlimited] = useState(() => coupon?.limit === 0);
  const [validFrom, setValidFrom] = useState(() => coupon?.validFrom ?? new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(() => coupon?.expires ?? "");
  const [plans, setPlans] = useState<PlanName[]>(() => coupon?.applicablePlans ?? ["Starter"]);
  const [affiliate, setAffiliate] = useState<string>(() => coupon?.affiliateId ?? "AFF-001");
  const [active, setActive] = useState(() => coupon?.status === "active" || !coupon);
  const [seed, setSeed] = useState(1);

  const handleGenerate = () => {
    const next = seed + 1;
    setSeed(next);
    setCodeValue(generateCode(next));
  };

  const togglePlan = (p: PlanName) => {
    setPlans((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]));
  };

  const handleSave = () => {
    if (!codeValue.trim()) {
      toast({ title: "Code required", description: "Generate or type a coupon code first.", variant: "destructive" });
      return;
    }
    toast({
      title: creating ? "Coupon created" : "Coupon saved",
      description: `${codeValue} — ${discountType} ${formatDiscountValue(discountType, Number(discountValue) || 0, currency)}${plans.length ? ` · ${plans.length} plan${plans.length === 1 ? "" : "s"}` : ""}.`,
    });
    onClose();
  };

  const handleDuplicate = () => {
    toast({
      title: "Coupon duplicated",
      description: `${codeValue}-COPY draft created in the Coupons table.`,
    });
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            {creating ? "Create Coupon" : `Edit ${coupon?.code ?? ""}`}
          </SheetTitle>
          <SheetDescription>
            {creating
              ? "Configure the discount, redemption caps, and which plans this code applies to."
              : `Last redeemed ${coupon?.used ?? 0} times · limit ${coupon?.limit ?? "—"}.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4">
          {/* Code field with Generate button */}
          <div className="space-y-1.5">
            <Label htmlFor="cpn-code" className="text-xs">
              <LabelWithHelp help="The code {trader}s type at checkout. Use 6-12 uppercase alphanumeric characters. Avoid I, O, 0, 1 for legibility.">
                Code
              </LabelWithHelp>
            </Label>
            <div className="flex gap-2">
              <Input
                id="cpn-code"
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value.toUpperCase())}
                className="font-mono text-sm"
                placeholder="WELCOME20"
                aria-label="Coupon code"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                aria-label="Generate random coupon code"
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Generate
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="cpn-desc" className="text-xs">Description</Label>
            <Input
              id="cpn-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="20% off first challenge"
              aria-label="Coupon description"
            />
          </div>

          {/* Discount type + value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Discount Type</Label>
              <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                <SelectTrigger size="sm" className="h-9 text-xs" aria-label="Discount type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Percentage">Percentage off</SelectItem>
                  <SelectItem value="Flat">Flat amount off</SelectItem>
                  <SelectItem value="Free Trial">Free trial days</SelectItem>
                  <SelectItem value="Bonus Credit">Bonus credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpn-value" className="text-xs">
                {discountType === "Percentage"
                  ? "Percent (%)"
                  : discountType === "Free Trial"
                    ? "Trial days"
                    : `Amount (${currency})`}
              </Label>
              <Input
                id="cpn-value"
                type="number"
                min={0}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                aria-label="Discount value"
              />
            </div>
          </div>

          <Separator />

          {/* Min purchase + Max redemptions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cpn-min" className="text-xs">
                <LabelWithHelp help="Minimum cart subtotal required before the coupon applies. Set to 0 for no minimum.">
                  Min Purchase ({currency})
                </LabelWithHelp>
              </Label>
              <Input
                id="cpn-min"
                type="number"
                min={0}
                value={minPurchase}
                onChange={(e) => setMinPurchase(e.target.value)}
                aria-label="Minimum purchase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpn-limit" className="text-xs">
                <LabelWithHelp help="Maximum total redemptions across all {trader}s. Once hit, the coupon stops accepting new redemptions.">
                  Max Redemptions
                </LabelWithHelp>
              </Label>
              <Input
                id="cpn-limit"
                type="number"
                min={0}
                value={limit}
                disabled={unlimited}
                aria-label="Maximum redemptions"
                className={unlimited ? "opacity-50" : ""}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={unlimited} onCheckedChange={(v) => setUnlimited(v === true)} aria-label="Unlimited redemptions" />
                Unlimited
              </label>
            </div>
          </div>

          {/* Valid From / Valid Until */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cpn-from" className="text-xs">Valid From</Label>
              <Input
                id="cpn-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                aria-label="Valid from date"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpn-until" className="text-xs">Valid Until</Label>
              <Input
                id="cpn-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                aria-label="Valid until date"
              />
            </div>
          </div>

          {/* Applicable Plans — multi-select */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              <LabelWithHelp help="Restricts the coupon to specific plans at checkout. Leave all unchecked for any plan.">
                Applicable Plans
              </LabelWithHelp>
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ALL_PLANS.map((p) => (
                <label
                  key={p}
                  className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs"
                >
                  <Checkbox
                    checked={plans.includes(p)}
                    onCheckedChange={() => togglePlan(p)}
                    aria-label={`Apply to ${p} plan`}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Affiliate select */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              <LabelWithHelp help="The affiliate who earns commission on each redemption. Choose 'Any' to allow all affiliates to share the coupon.">
                Owning Affiliate
              </LabelWithHelp>
            </Label>
            <Select value={affiliate} onValueChange={setAffiliate}>
              <SelectTrigger size="sm" className="h-9 text-xs" aria-label="Owning affiliate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AFF-001">Alex Trader</SelectItem>
                <SelectItem value="AFF-002">Sarah Marketing</SelectItem>
                <SelectItem value="AFF-003">Maria Lopez</SelectItem>
                <SelectItem value="AFF-004">David Chen</SelectItem>
                <SelectItem value="AFF-005">Emma Wilson</SelectItem>
                <SelectItem value="any">Any affiliate</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status toggle */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="flex flex-col">
              <span className="text-xs font-medium">Status</span>
              <span className="text-[11px] text-muted-foreground">
                {active ? "Accepting redemptions" : "Disabled — no new redemptions"}
              </span>
            </div>
            <Switch checked={active} onCheckedChange={setActive} aria-label="Coupon status" />
          </div>
        </div>

        <SheetFooter className="mt-auto flex-row gap-2 border-t pt-4">
          <Button size="sm" onClick={handleSave}>
            <Plus className="mr-1 h-3.5 w-3.5" /> {creating ? "Create" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDuplicate}>
            <Files className="mr-1 h-3.5 w-3.5" /> Duplicate
          </Button>
          {!creating && coupon && coupon.status === "active" ? (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto text-rose-600 hover:text-rose-700"
              onClick={() => onDisable(coupon)}
            >
              <Ban className="mr-1 h-3.5 w-3.5" /> Disable
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose}>
              Cancel
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
