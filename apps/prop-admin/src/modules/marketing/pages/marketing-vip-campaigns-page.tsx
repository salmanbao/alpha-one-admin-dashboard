"use client";

/**
 * Marketing — VIP Campaigns & Exclusive Coupons (finding #7b).
 *
 * Customer segmentation the CRM lacked: target a trader segment with a
 * personalized offer, issue per-trader exclusive coupon codes, and see
 * exactly how the offer reads on the trader's side before it ships.
 *
 * Sections:
 *   1. KPI row — active campaigns, coupons issued, redemption rate, revenue
 *   2. Campaign list (DataTable) with status + segment
 *   3. Create campaign Sheet — deterministic coupon generation (FNV-1a
 *      over seed+segment, never Math.random)
 *   4. Exclusive coupons DataTable — copy / status per code
 *   5. Trader preview — the offer exactly as the trader sees it
 *
 * Terra palette only. No Math.random — fixed fixtures, integer hashing.
 */

import { useMemo, useState } from "react";
import { formatCurrencyValue } from "@pfaas/platform-core";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { toast } from "@/hooks/use-toast";
import {
  Crown,
  Plus,
  Ticket,
  Percent,
  Copy,
  Eye,
  Send,
  Sparkles,
  Users,
  TrendingUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & deterministic fixtures                                      */
/* ------------------------------------------------------------------ */

type VipStatus = "draft" | "scheduled" | "active" | "completed" | "paused";

type Segment =
  | "Champions"
  | "High-value traders"
  | "At-risk scalers"
  | "Dormant 60d"
  | "New VIP joins";

interface VipCampaign {
  id: string;
  name: string;
  segment: Segment;
  offer: string;
  status: VipStatus;
  couponsIssued: number;
  couponsRedeemed: number;
  revenue: number;
  startsAt: string;
  endsAt: string;
}

type CouponStatus = "active" | "redeemed" | "expired" | "revoked";

interface ExclusiveCoupon {
  code: string;
  campaignId: string;
  discount: string;
  status: CouponStatus;
  assignedTo: string;
  createdAt: string;
}

const SEGMENTS: Segment[] = [
  "Champions",
  "High-value traders",
  "At-risk scalers",
  "Dormant 60d",
  "New VIP joins",
];

const VIP_CAMPAIGNS: VipCampaign[] = [
  {
    id: "VIP-001",
    name: "Champions Black-Friday Pass",
    segment: "Champions",
    offer: "30% off challenge fee",
    status: "active",
    couponsIssued: 40,
    couponsRedeemed: 17,
    revenue: 5083,
    startsAt: "Oct 24, 2026",
    endsAt: "Nov 14, 2026",
  },
  {
    id: "VIP-002",
    name: "At-Risk Scalper Win-Back",
    segment: "At-risk scalers",
    offer: "25% off reset fee",
    status: "active",
    couponsIssued: 25,
    couponsRedeemed: 6,
    revenue: 1194,
    startsAt: "Oct 30, 2026",
    endsAt: "Nov 20, 2026",
  },
  {
    id: "VIP-003",
    name: "Dormant 60-Day Reactivation",
    segment: "Dormant 60d",
    offer: "$50 account credit",
    status: "scheduled",
    couponsIssued: 60,
    couponsRedeemed: 0,
    revenue: 0,
    startsAt: "Nov 10, 2026",
    endsAt: "Dec 08, 2026",
  },
  {
    id: "VIP-004",
    name: "New VIP Welcome Bundle",
    segment: "New VIP joins",
    offer: "15% off first challenge",
    status: "completed",
    couponsIssued: 30,
    couponsRedeemed: 21,
    revenue: 3759,
    startsAt: "Sep 12, 2026",
    endsAt: "Oct 10, 2026",
  },
];

const EXCLUSIVE_COUPONS: ExclusiveCoupon[] = [
  { code: "VIP-CHM-001-9F2K1", campaignId: "VIP-001", discount: "30% off", status: "redeemed", assignedTo: "m.okafor@trader.io", createdAt: "Oct 24, 2026" },
  { code: "VIP-CHM-002-3B7QX", campaignId: "VIP-001", discount: "30% off", status: "redeemed", assignedTo: "l.marchetti@trader.io", createdAt: "Oct 24, 2026" },
  { code: "VIP-CHM-003-M4T8Z", campaignId: "VIP-001", discount: "30% off", status: "active", assignedTo: "s.novak@trader.io", createdAt: "Oct 25, 2026" },
  { code: "VIP-CHM-004-P2V6C", campaignId: "VIP-001", discount: "30% off", status: "active", assignedTo: "Unassigned", createdAt: "Oct 25, 2026" },
  { code: "VIP-ATR-001-R8J3W", campaignId: "VIP-002", discount: "25% off", status: "redeemed", assignedTo: "d.kim@trader.io", createdAt: "Oct 30, 2026" },
  { code: "VIP-ATR-002-X5N9B", campaignId: "VIP-002", discount: "25% off", status: "active", assignedTo: "r.almeida@trader.io", createdAt: "Oct 30, 2026" },
  { code: "VIP-ATR-003-K7D4F", campaignId: "VIP-002", discount: "25% off", status: "revoked", assignedTo: "Unassigned", createdAt: "Oct 31, 2026" },
  { code: "VIP-NVJ-001-H6S2P", campaignId: "VIP-004", discount: "15% off", status: "redeemed", assignedTo: "a.haddad@trader.io", createdAt: "Sep 12, 2026" },
  { code: "VIP-NVJ-002-T9W5M", campaignId: "VIP-004", discount: "15% off", status: "redeemed", assignedTo: "j.tanaka@trader.io", createdAt: "Sep 13, 2026" },
  { code: "VIP-NVJ-003-C3L8Q", campaignId: "VIP-004", discount: "15% off", status: "expired", assignedTo: "Unassigned", createdAt: "Sep 14, 2026" },
];

/**
 * Deterministic exclusive coupon codes — FNV-1a over the seed and segment
 * label, base-36 encoded. Same inputs always produce the same code; no
 * Math.random anywhere in the generation path.
 */
function couponCode(seed: number, label: string): string {
  const seg = label
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3)
    .padEnd(3, "X");
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < label.length; i++) {
    hash ^= label.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const tail = (hash >>> 0)
    .toString(36)
    .toUpperCase()
    .slice(0, 5)
    .padStart(5, "0");
  return `VIP-${seg}-${String(seed).padStart(3, "0")}-${tail}`;
}

function vipStatusTone(status: VipStatus): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (status) {
    case "active": return "success";
    case "scheduled": return "info";
    case "draft": return "muted";
    case "completed": return "default";
    case "paused": return "warning";
    default: return "muted";
  }
}

function couponStatusTone(status: CouponStatus): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (status) {
    case "active": return "info";
    case "redeemed": return "success";
    case "expired": return "muted";
    case "revoked": return "danger";
    default: return "muted";
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function MarketingVipCampaignsPage() {
  const [campaigns, setCampaigns] = useState<VipCampaign[]>(VIP_CAMPAIGNS);
  const [coupons, setCoupons] = useState<ExclusiveCoupon[]>(EXCLUSIVE_COUPONS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Create form
  const [name, setName] = useState("");
  const [segment, setSegment] = useState<Segment>("Champions");
  const [offerPct, setOfferPct] = useState("20");
  const [couponCount, setCouponCount] = useState("10");
  const [formError, setFormError] = useState<string | null>(null);

  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const redeemed = coupons.filter((c) => c.status === "redeemed").length;
  const redemptionRate = coupons.length > 0 ? Math.round((redeemed / coupons.length) * 100) : 0;
  const attributedRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

  // Deterministic seed for the next batch — position in the fixture list,
  // so identical demo runs always mint identical codes.
  const nextSeed = useMemo(
    () => 500 + campaigns.length * 10,
    [campaigns.length],
  );

  const campaignColumns: Column<VipCampaign>[] = [
    { key: "id", header: "ID", cell: (c) => <span className="font-mono text-xs">{c.id}</span>, width: "88px" },
    {
      key: "name",
      header: "Campaign",
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{c.name}</p>
          <p className="text-[11px] text-muted-foreground">{c.segment}</p>
        </div>
      ),
      sortValue: (c) => c.name,
    },
    { key: "offer", header: "Offer", cell: (c) => <span className="text-sm">{c.offer}</span>, sortValue: (c) => c.offer },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge tone={vipStatusTone(c.status)}><span className="capitalize">{c.status}</span></StatusBadge>,
      sortValue: (c) => c.status,
    },
    {
      key: "redemptions",
      header: "Redeemed",
      cell: (c) => (
        <span className="text-sm tabular-nums">
          {c.couponsRedeemed}/{c.couponsIssued}
        </span>
      ),
      numeric: true,
      sortValue: (c) => c.couponsRedeemed,
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (c) => <span className="text-sm tabular-nums">{formatCurrency(c.revenue)}</span>,
      numeric: true,
      sortValue: (c) => c.revenue,
    },
    {
      key: "window",
      header: "Window",
      cell: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.startsAt} → {c.endsAt}
        </span>
      ),
    },
  ];

  const couponColumns: Column<ExclusiveCoupon>[] = [
    {
      key: "code",
      header: "Code",
      cell: (c) => (
        <div className="flex items-center gap-1.5">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{c.code}</code>
          <button
            type="button"
            aria-label={`Copy coupon ${c.code}`}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                void navigator.clipboard.writeText(c.code);
              }
              toast({ title: "Coupon code copied", description: c.code });
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
      sortValue: (c) => c.code,
    },
    { key: "campaign", header: "Campaign", cell: (c) => <span className="font-mono text-xs">{c.campaignId}</span> },
    { key: "discount", header: "Discount", cell: (c) => <span className="text-sm">{c.discount}</span> },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge tone={couponStatusTone(c.status)}><span className="capitalize">{c.status}</span></StatusBadge>,
      sortValue: (c) => c.status,
    },
    {
      key: "assigned",
      header: "Assigned to",
      cell: (c) => (
        <span className={c.assignedTo === "Unassigned" ? "text-xs text-muted-foreground" : "text-sm"}>
          {c.assignedTo}
        </span>
      ),
      sortValue: (c) => c.assignedTo,
    },
    { key: "created", header: "Created", cell: (c) => <span className="text-xs text-muted-foreground">{c.createdAt}</span> },
  ];

  const resetForm = () => {
    setName("");
    setSegment("Champions");
    setOfferPct("20");
    setCouponCount("10");
    setFormError(null);
  };

  const createCampaign = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError("Campaign name is required — traders see it as the headline.");
      return;
    }
    const pct = Number(offerPct);
    if (!Number.isFinite(pct) || pct < 1 || pct > 90) {
      setFormError("Offer must be a whole percentage between 1 and 90.");
      return;
    }
    const count = Number(couponCount);
    const id = `VIP-${String(campaigns.length + 1).padStart(3, "0")}`;

    const minted: ExclusiveCoupon[] = Array.from({ length: count }, (_, i) => ({
      code: couponCode(nextSeed + i, segment),
      campaignId: id,
      discount: `${pct}% off`,
      status: "active" as const,
      assignedTo: "Unassigned",
      createdAt: "Nov 06, 2026",
    }));

    setCampaigns([
      {
        id,
        name: trimmed,
        segment,
        offer: `${pct}% off challenge fee`,
        status: "active",
        couponsIssued: count,
        couponsRedeemed: 0,
        revenue: 0,
        startsAt: "Nov 06, 2026",
        endsAt: "Nov 20, 2026",
      },
      ...campaigns,
    ]);
    setCoupons([...minted, ...coupons]);
    toast({
      title: "VIP campaign created (demo)",
      description: `${count} exclusive coupons generated deterministically for "${trimmed}".`,
    });
    resetForm();
    setSheetOpen(false);
  };

  // Trader preview — the newest campaign rendered exactly as the trader
  // meets it (headline, personalized segment line, code, checkout note).
  const previewCampaign = campaigns[0];
  const previewCode =
    coupons.find((c) => c.campaignId === previewCampaign.id)?.code ??
    coupons[0]?.code ??
    "VIP-CHM-000-00000";

  return (
    <Page>
      <PageHeader
        title="VIP Campaigns & Exclusive Coupons"
        description="Segment high-value traders, mint per-trader exclusive coupons, and preview the offer exactly as traders see it."
        icon={Crown}
        actions={
          <Button size="sm" onClick={() => { resetForm(); setSheetOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> New VIP Campaign
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Active Campaigns" value={String(activeCampaigns)} delta={1} icon={Crown} tone="positive" />
          <MetricCard label="Coupons Issued" value={String(coupons.length)} delta={coupons.length - EXCLUSIVE_COUPONS.length} icon={Ticket} />
          <MetricCard label="Redemption Rate" value={`${redemptionRate}%`} delta={4} icon={Percent} tone="positive" />
          <MetricCard label="Attributed Revenue" value={formatCurrencyValue(attributedRevenue, "USD")} delta={12} icon={TrendingUp} tone="positive" />
        </div>

        {/* Campaign list */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-foreground">VIP Campaigns</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Segmented offers with issued / redeemed coupon tracking.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setSheetOpen(true); }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create
            </Button>
          </div>
          <DataTable
            columns={campaignColumns}
            data={campaigns}
            rowKey={(c) => c.id}
            searchableText={(c) => `${c.id} ${c.name} ${c.segment} ${c.offer} ${c.status}`}
            searchPlaceholder="Search campaigns…"
            pageSize={6}
            emptyTitle="No VIP campaigns yet"
            emptyDescription="Create a segmented campaign to issue exclusive coupons to your best traders."
          />
        </div>

        {/* Exclusive coupons */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-medium text-foreground">Exclusive Coupons</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                One code per trader — generated deterministically, never reused across campaigns.
              </p>
            </div>
            <StatusBadge tone="info">
              {coupons.filter((c) => c.status === "active").length} active
            </StatusBadge>
          </div>
          <DataTable
            columns={couponColumns}
            data={coupons}
            rowKey={(c) => c.code}
            searchableText={(c) => `${c.code} ${c.campaignId} ${c.status} ${c.assignedTo}`}
            searchPlaceholder="Search codes or traders…"
            pageSize={8}
            emptyTitle="No coupons minted yet"
            emptyDescription="Coupons appear here as soon as a VIP campaign is created."
          />
        </div>

        {/* Trader preview */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-medium text-foreground">Trader Preview</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                How the newest campaign&apos;s offer appears on the trader&apos;s dashboard.
              </p>
            </div>
          </div>
          <div className="mx-auto max-w-lg rounded-xl border border-amber-400/50 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm dark:from-amber-950/30 dark:to-orange-950/30">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white" aria-hidden="true">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  {previewCampaign.segment} exclusive
                </p>
                <p className="mt-0.5 text-sm font-bold text-foreground">{previewCampaign.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enjoy <strong className="text-foreground">{previewCampaign.offer}</strong> on your
                  next challenge — this code is reserved for you alone.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="rounded-lg border border-dashed border-amber-500/60 bg-white px-3 py-1.5 font-mono text-sm font-bold tracking-wide text-amber-800 dark:bg-black/30 dark:text-amber-300">
                    {previewCode}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText(previewCode);
                      }
                      toast({ title: "Coupon code copied", description: previewCode });
                    }}
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Valid {previewCampaign.startsAt} → {previewCampaign.endsAt} · Applies
                  automatically at checkout · Single use per trader.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Create campaign sheet ── */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-600" /> New VIP Campaign
              </SheetTitle>
              <SheetDescription>
                Pick a segment, set the offer, and exclusive coupon codes are minted
                deterministically for that batch.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-4 px-4">
              <div className="space-y-1.5">
                <Label htmlFor="vip-name">Campaign name</Label>
                <Input
                  id="vip-name"
                  placeholder="e.g. Champions Black-Friday Pass"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setFormError(null); }}
                  aria-invalid={Boolean(formError) || undefined}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="vip-segment">Target segment</Label>
                <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                  <SelectTrigger id="vip-segment" aria-label="Target segment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {s}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vip-offer">Offer (% off)</Label>
                  <Input
                    id="vip-offer"
                    type="number"
                    min={1}
                    max={90}
                    value={offerPct}
                    onChange={(e) => { setOfferPct(e.target.value); setFormError(null); }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vip-count">Coupons to mint</Label>
                  <Select value={couponCount} onValueChange={setCouponCount}>
                    <SelectTrigger id="vip-count" aria-label="Coupons to mint">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 codes</SelectItem>
                      <SelectItem value="10">10 codes</SelectItem>
                      <SelectItem value="25">25 codes</SelectItem>
                      <SelectItem value="50">50 codes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Live code preview — same generator the create path uses. */}
              <div className="rounded-lg border border-dashed p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  First code in this batch
                </p>
                <code className="mt-1 block font-mono text-sm font-bold">
                  {couponCode(nextSeed, segment)}
                </code>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Same inputs always mint the same codes — safe to re-run the demo.
                </p>
              </div>

              {formError && (
                <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                  {formError}
                </p>
              )}
            </div>

            <Separator className="my-4" />

            <SheetFooter>
              <Button variant="outline" onClick={() => { resetForm(); setSheetOpen(false); }}>
                Cancel
              </Button>
              <Button onClick={createCampaign}>
                <Send className="mr-1.5 h-4 w-4" /> Create &amp; mint coupons
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </PageContent>
    </Page>
  );
}
