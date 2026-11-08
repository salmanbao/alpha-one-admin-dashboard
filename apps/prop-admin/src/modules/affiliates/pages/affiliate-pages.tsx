"use client";

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { getTenantAffiliates, affiliateCampaigns, type Affiliate, type AffiliateCampaign } from "@/lib/platform/mock-data";
import { payCommission, useAffiliatePayouts } from "@/modules/affiliates/affiliate-payouts-store";
import { exportToCsv } from "@/lib/platform/export-utils";
import { loadDemoState, saveDemoState } from "@/lib/platform/demo-persistence";
import { demoAffiliateKpisSchema, type DemoAffiliateKpi } from "@/lib/platform/validation";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, campaignStatusTone, formatCurrency, formatCompact } from "@/components/platform/status";
import { AreaSeries } from "@/components/platform/charts";
import { EmptyState } from "@/components/platform/guards";
import {
  Megaphone,
  Users,
  UserCheck,
  UserPlus,
  Share2,
  Target,
  Percent,
  DollarSign,
  Clock,
  Download,
  LineChart,
  TrendingUp,
  Award,
  MousePointerClick,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

const tierTone = (tier: string) =>
  tier === "platinum" ? "info" :
  tier === "gold" ? "warning" :
  tier === "silver" ? "muted" : "default";

function affiliateStatusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "pending") return "warning" as const;
  return "danger" as const;
}

/* ---------------------------------------------------------------- */
/* Overview page                                                    */
/* ---------------------------------------------------------------- */

export function AffiliatesOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const aff = getTenantAffiliates(tid);
  const active = aff.filter((a) => a.status === "active").length;
  const conversions = aff.reduce((s, a) => s + a.conversions, 0);
  const earned = aff.reduce((s, a) => s + a.commissionEarned, 0);
  const campaigns = affiliateCampaigns.filter((c) => c.tenantId === tid).slice(0, 5);

  const handleExport = () => {
    exportToCsv(
      aff,
      [
        { key: "name", header: "Affiliate", value: (a) => a.name },
        { key: "email", header: "Email", value: (a) => a.email },
        { key: "code", header: "Code", value: (a) => a.code },
        { key: "tier", header: "Tier", value: (a) => a.tier },
        { key: "referrals", header: "Referrals", value: (a) => a.referrals },
        { key: "activeReferrals", header: "Active Referrals", value: (a) => a.activeReferrals },
        { key: "conversions", header: "Conversions", value: (a) => a.conversions },
        { key: "commissionEarned", header: "Commission Earned", value: (a) => a.commissionEarned },
        { key: "commissionPending", header: "Commission Pending", value: (a) => a.commissionPending },
        { key: "status", header: "Status", value: (a) => a.status },
      ],
      `affiliates-overview-${Date.now()}.csv`,
    );
  };

  return (
    <Page>
      <PageHeader
        title="Affiliates"
        description={`Affiliate partners, campaigns, and commission performance for this ${term("account").toLowerCase()} tenant.`}
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Affiliates" value={aff.length} icon={Users} />
          <MetricCard label="Active" value={active} icon={Megaphone} tone="positive" />
          <MetricCard label="Conversions" value={formatCompact(conversions)} icon={Target} delta={6} tone="positive" />
          <MetricCard label="Commission Earned" value={formatCurrency(earned, currency)} icon={DollarSign} delta={11} tone="positive" />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium">Commission trend (12 mo)</p>
          <AreaSeries
            data={[
              "Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            ].map((m, i) => ({ date: m, value: Math.round(earned / 12 * (0.7 + 0.5 * Math.sin(i / 2) + i * 0.04)) }))}
            xKey="date"
            yKey="value"
            color="#b45309"
            formatValue={(v) => formatCurrency(v, currency)}
          />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Recent Campaigns</p>
          <DataTable
            columns={[
              { key: "name", header: "Campaign", cell: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name },
              { key: "affiliate", header: "Affiliate", cell: (c) => c.affiliateName, sortValue: (c) => c.affiliateName },
              { key: "clicks", header: "Clicks", cell: (c) => formatCompact(c.clicks), sortValue: (c) => c.clicks },
              { key: "signups", header: "Signups", cell: (c) => c.signups, sortValue: (c) => c.signups },
              { key: "conversions", header: "Conv.", cell: (c) => c.conversions, sortValue: (c) => c.conversions },
              { key: "revenue", header: "Revenue", cell: (c) => <span className="font-medium">{formatCurrency(c.revenue, currency)}</span>, sortValue: (c) => c.revenue },
              {
                key: "status",
                header: "Status",
                cell: (c) => <StatusBadge tone={campaignStatusTone(c.status)}>{c.status}</StatusBadge>,
                sortValue: (c) => c.status,
              },
            ]}
            data={campaigns}
            rowKey={(c) => c.id}
            searchableText={(c) => `${c.name} ${c.affiliateName} ${c.status}`}
            searchPlaceholder="Search campaigns…"
            emptyTitle="No campaigns match"
            emptyDescription="Adjust your search, or create a campaign to start driving traffic."
            pageSize={5}
          />
        </div>
      </PageContent>
    </Page>
  );
}

/* ---------------------------------------------------------------- */
/* Affiliates list page                                             */
/* ---------------------------------------------------------------- */

export function AffiliatesListPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const aff = getTenantAffiliates(tid);

  // PRD §4.18 affiliate lifecycle (approve / suspend / commission rate)
  // lives in session state so the table reflects each decision instantly.
  const [statusOverrides, setStatusOverrides] = React.useState<Record<string, Affiliate["status"]>>({});
  const [rates, setRates] = React.useState<Record<string, number>>({});
  const [rateTarget, setRateTarget] = React.useState<Affiliate | null>(null);
  const [rateValue, setRateValue] = React.useState("25");

  const items = aff.map((a) => ({ ...a, status: statusOverrides[a.id] ?? a.status }));

  const approve = (a: Affiliate) => {
    setStatusOverrides((prev) => ({ ...prev, [a.id]: "active" }));
    toast({ title: "Affiliate approved", description: `${a.name} can now refer traders and earn commission.` });
  };
  const suspend = (a: Affiliate) => {
    setStatusOverrides((prev) => ({ ...prev, [a.id]: "suspended" }));
    toast({ title: "Affiliate suspended", description: `${a.name}'s links are disabled and payouts are held.`, variant: "destructive" });
  };
  const saveRate = () => {
    if (!rateTarget) return;
    const pct = Math.min(60, Math.max(0, Number(rateValue) || 0));
    setRates((prev) => ({ ...prev, [rateTarget.id]: pct }));
    toast({ title: "Commission rate updated", description: `${rateTarget.name} → ${pct}% of generated revenue.` });
    setRateTarget(null);
  };

  const columns: Column<Affiliate>[] = [
    { key: "name", header: "Name", cell: (a) => <span className="font-medium">{a.name}</span>, sortValue: (a) => a.name },
    { key: "code", header: "Code", cell: (a) => <span className="font-mono text-xs">{a.code}</span>, sortValue: (a) => a.code },
    {
      key: "tier",
      header: "Tier",
      cell: (a) => <StatusBadge tone={tierTone(a.tier)} className="capitalize">{a.tier}</StatusBadge>,
      sortValue: (a) => a.tier,
    },
    { key: "referrals", header: "Referrals", cell: (a) => a.referrals, sortValue: (a) => a.referrals },
    { key: "conversions", header: "Conversions", cell: (a) => a.conversions, sortValue: (a) => a.conversions },
    {
      key: "commission",
      header: "Commission Earned",
      cell: (a) => <span className="font-medium">{formatCurrency(a.commissionEarned, currency)}</span>,
      sortValue: (a) => a.commissionEarned,
    },
    {
      key: "rate",
      header: "Rate",
      cell: (a) => (
        <button
          type="button"
          className="rounded-md bg-surface-container px-2 py-0.5 text-xs font-semibold hover:bg-surface-container-high"
          onClick={() => { setRateTarget(a); setRateValue(String(rates[a.id] ?? 25)); }}
        >
          {rates[a.id] ?? 25}%
        </button>
      ),
      sortValue: (a) => rates[a.id] ?? 25,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge tone={affiliateStatusTone(a.status)} className="capitalize">{a.status}</StatusBadge>,
      sortValue: (a) => a.status,
    },
    {
      key: "actions",
      header: "",
      cell: (a) => (
        <div className="flex items-center justify-end gap-1.5">
          {a.status !== "active" ? (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => approve(a)}>Approve</Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700" onClick={() => suspend(a)}>Suspend</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Affiliates" description="All affiliate partners for this tenant." icon={Users} />
      <PageContent>
        <DataTable
          columns={columns}
          data={items}
          rowKey={(a) => a.id}
          searchableText={(a) => `${a.name} ${a.code} ${a.tier} ${a.status}`}
          searchPlaceholder="Search affiliates…"
          emptyTitle="No affiliates"
          emptyDescription="This tenant has no affiliate partners yet."
        />

        {/* PRD §4.18 PATCH /affiliates/:id — commission rate dialog */}
        <Dialog open={!!rateTarget} onOpenChange={(o) => !o && setRateTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Commission rate</DialogTitle>
              <DialogDescription>
                {rateTarget ? `${rateTarget.name} (${rateTarget.code})` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="commission-rate" className="text-xs">Revenue share (%)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="commission-rate"
                  type="number"
                  min={0}
                  max={60}
                  value={rateValue}
                  onChange={(e) => setRateValue(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">0–60% of referred revenue</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setRateTarget(null)}>Cancel</Button>
              <Button size="sm" onClick={saveRate}>Save rate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContent>
    </Page>
  );
}

/* ---------------------------------------------------------------- */
/* Campaigns page                                                  */
/* ---------------------------------------------------------------- */

export function AffiliateCampaignsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const campaigns = affiliateCampaigns.filter((c) => c.tenantId === tid);

  const columns: Column<AffiliateCampaign>[] = [
    { key: "name", header: "Campaign", cell: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name },
    { key: "affiliate", header: "Affiliate", cell: (c) => c.affiliateName, sortValue: (c) => c.affiliateName },
    { key: "clicks", header: "Clicks", cell: (c) => formatCompact(c.clicks), sortValue: (c) => c.clicks },
    { key: "signups", header: "Signups", cell: (c) => c.signups, sortValue: (c) => c.signups },
    { key: "conversions", header: "Conv.", cell: (c) => c.conversions, sortValue: (c) => c.conversions },
    { key: "spend", header: "Spend", cell: (c) => formatCurrency(c.spend, currency), sortValue: (c) => c.spend },
    { key: "revenue", header: "Revenue", cell: (c) => <span className="font-medium">{formatCurrency(c.revenue, currency)}</span>, sortValue: (c) => c.revenue },
    {
      key: "roi",
      header: "ROI",
      cell: (c) => {
        const roi = c.spend > 0 ? Math.round(((c.revenue - c.spend) / c.spend) * 100) : 0;
        return <span className={roi >= 0 ? "font-medium text-emerald-600" : "font-medium text-rose-600"}>{roi >= 0 ? "+" : ""}{roi}%</span>;
      },
      sortValue: (c) => c.spend > 0 ? Math.round(((c.revenue - c.spend) / c.spend) * 100) : 0,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge tone={campaignStatusTone(c.status)}>{c.status}</StatusBadge>,
      sortValue: (c) => c.status,
    },
  ];

  return (
    <Page>
      <PageHeader title="Campaigns" description="Affiliate marketing campaigns and ROI." icon={Megaphone} />
      <PageContent>
        <DataTable
          columns={columns}
          data={campaigns}
          rowKey={(c) => c.id}
          searchableText={(c) => `${c.name} ${c.affiliateName} ${c.status}`}
          searchPlaceholder="Search campaigns…"
          emptyTitle="No campaigns"
          emptyDescription="This tenant has no affiliate campaigns yet."
        />
      </PageContent>
    </Page>
  );
}

/* ---------------------------------------------------------------- */
/* Commissions page                                                 */
/* ---------------------------------------------------------------- */

export function AffiliateCommissionsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const aff = getTenantAffiliates(tid);
  const paidPayouts = useAffiliatePayouts(tid);
  const paidIds = new Set(paidPayouts.map((p) => p.affiliateId));
  const earned = aff.reduce((s, a) => s + a.commissionEarned, 0);
  const pending = aff.reduce((s, a) => s + a.commissionPending, 0);
  const totalConversions = aff.reduce((s, a) => s + a.conversions, 0);
  const avgTicket = totalConversions > 0 ? earned / totalConversions : 0;

  const columns: Column<Affiliate>[] = [
    { key: "name", header: "Affiliate", cell: (a) => <span className="font-medium">{a.name}</span>, sortValue: (a) => a.name },
    { key: "tier", header: "Tier", cell: (a) => <StatusBadge tone={tierTone(a.tier)} className="capitalize">{a.tier}</StatusBadge>, sortValue: (a) => a.tier },
    { key: "referrals", header: "Referrals", cell: (a) => a.referrals, sortValue: (a) => a.referrals },
    { key: "conversions", header: "Conversions", cell: (a) => a.conversions, sortValue: (a) => a.conversions },
    {
      key: "earned",
      header: "Earned",
      cell: (a) => <span className="font-medium text-emerald-600">{formatCurrency(a.commissionEarned, currency)}</span>,
      sortValue: (a) => a.commissionEarned,
    },
    {
      key: "pending",
      header: "Pending",
      cell: (a) => <span className="font-medium text-amber-600">{formatCurrency(a.commissionPending, currency)}</span>,
      sortValue: (a) => a.commissionPending,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge tone={affiliateStatusTone(a.status)} className="capitalize">{a.status}</StatusBadge>,
      sortValue: (a) => a.status,
    },
    {
      key: "pay",
      header: "Action",
      cell: (a) => {
        const alreadyPaid = paidIds.has(a.id);
        return alreadyPaid ? (
          <span className="text-xs text-emerald-600 font-medium">Paid</span>
        ) : a.commissionPending > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              payCommission({
                affiliateId: a.id,
                affiliateName: a.name,
                tenantId: tid,
                amount: a.commissionPending,
                currency,
              });
              toast({ title: "Commission paid", description: `${a.name} — ${formatCurrency(a.commissionPending, currency)}` });
            }}
          >
            Pay commission
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
  ];

  return (
    <Page>
      <PageHeader title="Commissions" description="Affiliate commission summary and ledger." icon={DollarSign} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Earned" value={formatCurrency(earned, currency)} icon={DollarSign} tone="positive" />
          <MetricCard label="Pending Payout" value={formatCurrency(pending, currency)} icon={Target} tone="warning" />
          <MetricCard label="Avg Ticket" value={formatCurrency(avgTicket, currency)} icon={Megaphone} />
          <MetricCard label="Active Partners" value={aff.filter((a) => a.status === "active").length} icon={Users} tone="positive" />
        </div>
        <DataTable
          columns={columns}
          data={aff}
          rowKey={(a) => a.id}
          searchableText={(a) => `${a.name} ${a.tier} ${a.status}`}
          searchPlaceholder="Search commissions…"
          emptyTitle="No commissions"
          emptyDescription="This tenant has no affiliate commission records."
        />
      </PageContent>
    </Page>
  );
}

/* ---------------------------------------------------------------- */
/* Performance page (audit B #8)                                     */
/* ---------------------------------------------------------------- */

const MONTHS_12 = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const TIER_ORDER = ["platinum", "gold", "silver", "bronze"] as const;

/* ── Custom KPIs (audit #5) ─────────────────────────────────────── */

/** Metric options the operator can hang a custom target on. */
const KPI_METRICS: { id: DemoAffiliateKpi["metric"]; label: string }[] = [
  { id: "referrals", label: "Referrals" },
  { id: "activeReferrals", label: "Active referrals" },
  { id: "conversions", label: "Conversions" },
  { id: "commissionEarned", label: "Commission earned" },
  { id: "revenue", label: "Attributed revenue" },
];

/** Metrics formatted as money rather than a count. */
const KPI_CURRENCY: DemoAffiliateKpi["metric"][] = ["commissionEarned", "revenue"];

/** Shown until the operator adds or removes their own targets. */
const DEFAULT_KPIS: DemoAffiliateKpi[] = [
  { id: "kpi-default-conversions", label: "Conversions", metric: "conversions", target: 200 },
  { id: "kpi-default-commission", label: "Commission earned", metric: "commissionEarned", target: 100000 },
];

export function AffiliatePerformancePage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const aff = getTenantAffiliates(tid);
  const camps = affiliateCampaigns.filter((c) => c.tenantId === tid);

  // ── Custom KPIs (audit #5) — operator-defined targets on the metrics
  //    this page already derives. Hydrated from the demo session after
  //    mount (localStorage is unavailable during SSR, so the seeded
  //    defaults render first and the effect swaps in saved rows). ──
  const [kpis, setKpis] = React.useState<DemoAffiliateKpi[]>(DEFAULT_KPIS);
  React.useEffect(() => {
    setKpis(loadDemoState("affiliate-kpis", demoAffiliateKpisSchema, DEFAULT_KPIS));
  }, []);
  const [kpiMetric, setKpiMetric] = React.useState<DemoAffiliateKpi["metric"]>("conversions");
  const [kpiLabel, setKpiLabel] = React.useState("");
  const [kpiTarget, setKpiTarget] = React.useState("");

  const persistKpis = (next: DemoAffiliateKpi[]) => {
    setKpis(next);
    saveDemoState("affiliate-kpis", next);
  };

  // ── Affiliate-side aggregates ──
  const active = aff.filter((a) => a.status === "active").length;
  const referrals = aff.reduce((s, a) => s + a.referrals, 0);
  const activeReferrals = aff.reduce((s, a) => s + a.activeReferrals, 0);
  const conversions = aff.reduce((s, a) => s + a.conversions, 0);
  const earned = aff.reduce((s, a) => s + a.commissionEarned, 0);
  const pending = aff.reduce((s, a) => s + a.commissionPending, 0);
  const convRate = referrals > 0 ? (conversions / referrals) * 100 : 0;

  // ── Campaign-side funnel (clicks → signups → conversions) ──
  const clicks = camps.reduce((s, c) => s + c.clicks, 0);
  const signups = camps.reduce((s, c) => s + c.signups, 0);
  const campConversions = camps.reduce((s, c) => s + c.conversions, 0);
  const spend = camps.reduce((s, c) => s + c.spend, 0);
  const revenue = camps.reduce((s, c) => s + c.revenue, 0);
  const roas = spend > 0 ? revenue / spend : 0;
  const clickToSignup = clicks > 0 ? (signups / clicks) * 100 : 0;
  const signupToConv = signups > 0 ? (campConversions / signups) * 100 : 0;

  // ── Tier mix ──
  const tierCounts = TIER_ORDER.map((tier) => ({
    tier,
    count: aff.filter((a) => a.tier === tier).length,
  }));

  // ── Top performers (the table is sorted by construction; DataTable sort
  //    still works off the sortValue columns) ──
  const top = [...aff].sort((a, b) => b.commissionEarned - a.commissionEarned);
  const top3Earned = top.slice(0, 3).reduce((s, a) => s + a.commissionEarned, 0);
  const top3Share = earned > 0 ? (top3Earned / earned) * 100 : 0;

  // ── 12-month commission shape (deterministic: no Math.random) — a slow
  //    seasonal wave over a rising ramp, renormalised so the curve totals
  //    the lifetime commission shown in the KPI above. ──
  const shape = MONTHS_12.map((_, i) => 0.75 + 0.35 * Math.sin(i / 1.9) + i * 0.045);
  const shapeMean = shape.reduce((s, v) => s + v, 0) / shape.length;
  const trend = MONTHS_12.map((m, i) => ({
    date: m,
    value: Math.round((earned / shape.length) * (shape[i] / shapeMean)),
  }));

  // ── Deterministic read-outs — every sentence is a computed ratio, so the
  //    copy changes only when the underlying numbers do. ──
  const readouts = [
    top3Share >= 60
      ? `Top 3 partners produce ${top3Share.toFixed(0)}% of earned commission — the book is concentrated. Recruiting beyond the current leaders reduces single-partner risk.`
      : `Commission is spread across the partner base — the top 3 account for ${top3Share.toFixed(0)}% of earned commission.`,
    roas >= 2
      ? `Campaigns returned ${roas.toFixed(1)}× on ${formatCurrency(spend, currency)} of spend (${formatCurrency(revenue, currency)} attributed revenue).`
      : `Campaign return is ${roas.toFixed(1)}× on ${formatCurrency(spend, currency)} of spend — review targeting before increasing budget.`,
    `Referral conversion is ${convRate.toFixed(1)}% (${conversions} of ${referrals} referrals); ${activeReferrals} referrals are still active in the window.`,
  ];

  const handleExport = () => {
    exportToCsv(
      top,
      [
        { key: "name", header: "Affiliate", value: (a) => a.name },
        { key: "tier", header: "Tier", value: (a) => a.tier },
        { key: "referrals", header: "Referrals", value: (a) => a.referrals },
        { key: "activeReferrals", header: "Active Referrals", value: (a) => a.activeReferrals },
        { key: "conversions", header: "Conversions", value: (a) => a.conversions },
        {
          key: "rate",
          header: "Conversion Rate %",
          value: (a) => (a.referrals > 0 ? ((a.conversions / a.referrals) * 100).toFixed(1) : "0.0"),
        },
        { key: "commissionEarned", header: "Commission Earned", value: (a) => a.commissionEarned },
        { key: "commissionPending", header: "Commission Pending", value: (a) => a.commissionPending },
        { key: "status", header: "Status", value: (a) => a.status },
      ],
      `affiliate-performance-${tid}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  const columns: Column<Affiliate>[] = [
    {
      key: "name",
      header: "Affiliate",
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{a.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{a.code}</p>
        </div>
      ),
      sortValue: (a) => a.name,
    },
    { key: "tier", header: "Tier", cell: (a) => <StatusBadge tone={tierTone(a.tier)} className="capitalize">{a.tier}</StatusBadge>, sortValue: (a) => a.tier },
    { key: "referrals", header: "Referrals", cell: (a) => formatCompact(a.referrals), sortValue: (a) => a.referrals },
    { key: "conversions", header: "Conversions", cell: (a) => a.conversions, sortValue: (a) => a.conversions },
    {
      key: "rate",
      header: "Conv. rate",
      cell: (a) => (
        <span className="tabular-nums">
          {a.referrals > 0 ? ((a.conversions / a.referrals) * 100).toFixed(1) : "0.0"}%
        </span>
      ),
      sortValue: (a) => (a.referrals > 0 ? a.conversions / a.referrals : 0),
    },
    {
      key: "commission",
      header: "Commission earned",
      cell: (a) => <span className="font-medium tabular-nums">{formatCurrency(a.commissionEarned, currency)}</span>,
      sortValue: (a) => a.commissionEarned,
    },
    {
      key: "share",
      header: "Share of earned",
      cell: (a) => {
        const pct = earned > 0 ? (a.commissionEarned / earned) * 100 : 0;
        return (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <span
                className="block h-full rounded-full"
                style={{ width: `${pct.toFixed(1)}%`, background: "#b45309" }}
              />
            </span>
            <span className="tabular-nums text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
          </span>
        );
      },
      sortValue: (a) => a.commissionEarned,
    },
    {
      key: "pending",
      header: "Pending",
      cell: (a) => <span className="tabular-nums">{formatCurrency(a.commissionPending, currency)}</span>,
      sortValue: (a) => a.commissionPending,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge tone={affiliateStatusTone(a.status)} className="capitalize">{a.status}</StatusBadge>,
      sortValue: (a) => a.status,
    },
  ];

  const funnelStages = [
    { label: "Clicks", value: clicks, icon: MousePointerClick },
    { label: "Signups", value: signups, icon: UserPlus },
    { label: "Conversions", value: campConversions, icon: Target },
  ];
  const funnelMax = Math.max(1, ...funnelStages.map((s) => s.value));
  const funnelRates = [
    { from: "Clicks", to: "Signups", pct: clickToSignup },
    { from: "Signups", to: "Conversions", pct: signupToConv },
  ];

  // ── Affiliate-side conversion funnel (audit #5) — the partner journey
  //    the campaign funnel can't see: referred → still active → converted. ──
  const referralStages = [
    { label: "Referrals", value: referrals, icon: Share2 },
    { label: "Active", value: activeReferrals, icon: UserCheck },
    { label: "Conversions", value: conversions, icon: Target },
  ];
  const referralMax = Math.max(1, ...referralStages.map((s) => s.value));
  const activationRate = referrals > 0 ? (activeReferrals / referrals) * 100 : 0;
  const activeToConvRate = activeReferrals > 0 ? (conversions / activeReferrals) * 100 : 0;
  const referralRates = [
    { from: "Referrals", to: "Active", pct: activationRate },
    { from: "Active", to: "Conversions", pct: activeToConvRate },
  ];

  // ── Partner LTV (audit #5) — what a converted referral is worth to the
  //    partner (commission), to the firm (attributed revenue), and how
  //    that differs by tier. ──
  const commissionPerConv = conversions > 0 ? earned / conversions : 0;
  const commissionPerActive = activeReferrals > 0 ? earned / activeReferrals : 0;
  const revenuePerConv = campConversions > 0 ? revenue / campConversions : 0;
  const commissionPerPartner = aff.length > 0 ? earned / aff.length : 0;
  const ltvByTier = TIER_ORDER.map((tier) => {
    const inTier = aff.filter((a) => a.tier === tier);
    const tierConversions = inTier.reduce((s, a) => s + a.conversions, 0);
    const tierEarned = inTier.reduce((s, a) => s + a.commissionEarned, 0);
    return {
      tier,
      partners: inTier.length,
      conversions: tierConversions,
      earned: tierEarned,
      perConv: tierConversions > 0 ? tierEarned / tierConversions : 0,
    };
  }).filter((t) => t.partners > 0);
  const maxPerConv = Math.max(1, ...ltvByTier.map((t) => t.perConv));

  // ── 6-month projection (audit #5) — least-squares slope over the same
  //    12-month trend above, extrapolated forward. Pure arithmetic on the
  //    fixture: no Math.random(), no Date.now(), same numbers every run. ──
  const trendN = trend.length;
  const meanX = (trendN - 1) / 2;
  const meanY = trend.reduce((s, p) => s + p.value, 0) / trendN;
  let slopeNum = 0;
  let slopeDen = 0;
  trend.forEach((p, i) => {
    slopeNum += (i - meanX) * (p.value - meanY);
    slopeDen += (i - meanX) ** 2;
  });
  const slope = slopeDen > 0 ? slopeNum / slopeDen : 0;
  const projection = Array.from({ length: 6 }, (_, k) => ({
    date: `M+${k + 1}`,
    value: Math.max(0, Math.round(meanY + slope * (trendN - 1 + (k + 1) - meanX))),
  }));
  const projected6 = projection.reduce((s, p) => s + p.value, 0);
  const recent6 = trend.slice(-6).reduce((s, p) => s + p.value, 0);
  const projectionDelta = recent6 > 0 ? ((projected6 - recent6) / recent6) * 100 : 0;
  const projMax = Math.max(1, ...projection.map((p) => p.value));

  // ── Custom KPI progress (audit #5) ──
  const kpiValues: Record<DemoAffiliateKpi["metric"], number> = {
    referrals,
    activeReferrals,
    conversions,
    commissionEarned: earned,
    revenue,
  };
  const kpiFormat = (m: DemoAffiliateKpi["metric"], v: number) =>
    KPI_CURRENCY.includes(m) ? formatCurrency(v, currency) : formatCompact(v);

  const addKpi = () => {
    const label = kpiLabel.trim();
    const target = Number(kpiTarget);
    if (!label || !Number.isFinite(target) || target <= 0) {
      toast({
        title: "KPI needs a label and a positive target",
        description: "Pick the metric, name it, and set a target above zero.",
        variant: "destructive",
      });
      return;
    }
    // Deterministic, collision-free id (no Date.now / Math.random).
    const slug =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32) || "kpi";
    let n = kpis.length + 1;
    let id = `kpi-${kpiMetric}-${slug}-${n}`;
    while (kpis.some((k) => k.id === id)) {
      n += 1;
      id = `kpi-${kpiMetric}-${slug}-${n}`;
    }
    persistKpis([...kpis, { id, label, metric: kpiMetric, target }]);
    setKpiLabel("");
    setKpiTarget("");
  };

  const removeKpi = (id: string) => persistKpis(kpis.filter((k) => k.id !== id));

  const empty = aff.length === 0;

  return (
    <Page>
      <PageHeader
        title="Performance"
        description={`Partner and campaign performance — conversion, concentration and return on spend for this ${term("account").toLowerCase()} tenant.`}
        icon={LineChart}
        actions={
          <Button size="sm" variant="outline" onClick={handleExport} disabled={empty}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        }
      />
      <PageContent>
        {empty ? (
          <EmptyState
            icon={LineChart}
            title="No affiliate performance yet"
            description="Performance is computed from partner referrals and campaign traffic — nothing has been recorded for this tenant yet."
            hint="Add affiliates from the Affiliates list and launch a campaign; conversions, funnel rates and commission trends will appear here."
          />
        ) : (
          <>
            {/* KPI strip (audit density rule: page-level grids use gap-4) */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
              <MetricCard label="Total Affiliates" value={aff.length} icon={Users} />
              <MetricCard label="Active" value={active} icon={UserCheck} tone="positive" />
              <MetricCard label="Referrals" value={formatCompact(referrals)} icon={Share2} />
              <MetricCard label="Conversions" value={formatCompact(conversions)} icon={Target} tone="positive" />
              <MetricCard label="Conversion Rate" value={`${convRate.toFixed(1)}%`} icon={Percent} />
              <MetricCard label="Commission Earned" value={formatCurrency(earned, currency)} icon={DollarSign} tone="positive" />
              <MetricCard label="Commission Pending" value={formatCurrency(pending, currency)} icon={Clock} tone="warning" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Commission trend */}
              <div className="rounded-lg border bg-card p-4 lg:col-span-2">
                <p className="mb-1 text-sm font-medium">Commission trend (12 mo)</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Monthly booking shape across {formatCurrency(earned, currency)} of lifetime earned commission.
                </p>
                <AreaSeries
                  data={trend}
                  xKey="date"
                  yKey="value"
                  color="#b45309"
                  formatValue={(v) => formatCurrency(v, currency)}
                  label={`Monthly affiliate commission — 12 months, ${formatCurrency(earned, currency)} lifetime earned`}
                />
              </div>

              {/* Tier mix */}
              <div className="rounded-lg border bg-card p-4">
                <p className="mb-1 text-sm font-medium">Tier mix</p>
                <p className="mb-4 text-xs text-muted-foreground">Partners by commission tier.</p>
                <ul className="space-y-3">
                  {tierCounts.map(({ tier, count }) => {
                    const pct = aff.length > 0 ? (count / aff.length) * 100 : 0;
                    return (
                      <li key={tier} className="flex items-center gap-3">
                        <span className="flex w-20 shrink-0 items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          <StatusBadge tone={tierTone(tier)} className="capitalize">{tier}</StatusBadge>
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${pct}%`, background: "#b45309" }}
                          />
                        </span>
                        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {count} · {pct.toFixed(0)}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Campaign funnel */}
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-medium">Campaign funnel</p>
              <p className="mb-4 text-xs text-muted-foreground">
                {camps.length} campaign{camps.length === 1 ? "" : "s"} — clicks to attributed conversions.
              </p>
              <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                {funnelStages.map((stage, i) => (
                  <React.Fragment key={stage.label}>
                    {i > 0 && (
                      <div className="flex flex-col items-center justify-center px-1 text-center">
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {funnelRates[i - 1].pct.toFixed(1)}%
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {funnelRates[i - 1].from} → {funnelRates[i - 1].to}
                        </span>
                      </div>
                    )}
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <stage.icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {stage.label}
                        </span>
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {formatCompact(stage.value)}
                        </span>
                      </div>
                      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (stage.value / funnelMax) * 100)}%`,
                            background: "#b45309",
                          }}
                        />
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                <MetricCard label="Campaign spend" value={formatCurrency(spend, currency)} icon={DollarSign} />
                <MetricCard label="Attributed revenue" value={formatCurrency(revenue, currency)} icon={TrendingUp} tone="positive" />
                <MetricCard label="ROAS" value={`${roas.toFixed(1)}×`} icon={Percent} tone={roas >= 2 ? "positive" : "warning"} />
                <MetricCard label="Revenue / click" value={formatCurrency(clicks > 0 ? revenue / clicks : 0, currency)} icon={MousePointerClick} />
              </div>
            </div>

            {/* Affiliate-side conversion funnel (audit #5) — referrals →
                active → conversions, the partner journey behind the
                campaign-side clicks → signups → conversions above. */}
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-medium">Partner referral funnel</p>
              <p className="mb-4 text-xs text-muted-foreground">
                {formatCompact(referrals)} referrals → {formatCompact(activeReferrals)} still active →{" "}
                {formatCompact(conversions)} converted — activation and conversion at each step.
              </p>
              <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
                {referralStages.map((stage, i) => (
                  <React.Fragment key={stage.label}>
                    {i > 0 && (
                      <div className="flex flex-col items-center justify-center px-1 text-center">
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {referralRates[i - 1].pct.toFixed(1)}%
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {referralRates[i - 1].from} → {referralRates[i - 1].to}
                        </span>
                      </div>
                    )}
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <stage.icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {stage.label}
                        </span>
                        <span className="text-lg font-bold tabular-nums text-foreground">
                          {formatCompact(stage.value)}
                        </span>
                      </div>
                      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (stage.value / referralMax) * 100)}%`,
                            background: "#b45309",
                          }}
                        />
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <p className="mt-4 border-t pt-3 text-[11px] text-muted-foreground">
                {activationRate.toFixed(1)}% of referrals stay active, and {activeToConvRate.toFixed(1)}% of
                active referrals convert ({convRate.toFixed(1)}% end-to-end). The campaign funnel above
                measures traffic; this one measures the partners behind it.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Partner LTV (audit #5) */}
              <div className="rounded-lg border bg-card p-4">
                <p className="mb-1 text-sm font-medium">Partner LTV</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  What a converted referral is worth — to the partner in commission, to the firm in
                  attributed revenue — plus the per-tier split.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Commission / conversion
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {formatCurrency(commissionPerConv, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Commission / active
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {formatCurrency(commissionPerActive, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Revenue / conversion
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {formatCurrency(revenuePerConv, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Commission / partner
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {formatCurrency(commissionPerPartner, currency)}
                    </p>
                  </div>
                </div>
                <ul className="mt-4 space-y-3">
                  {ltvByTier.map((t) => (
                    <li key={t.tier} className="flex items-center gap-3">
                      <span className="flex w-32 shrink-0 items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <StatusBadge tone={tierTone(t.tier)} className="capitalize">{t.tier}</StatusBadge>
                      </span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${Math.max(2, (t.perConv / maxPerConv) * 100)}%`, background: "#b45309" }}
                        />
                      </span>
                      <span className="w-40 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(t.perConv, currency)}/conv · {t.conversions} conv
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Commission per conversion is earned commission ÷ conversions for partners in that
                  tier; revenue per conversion is campaign-attributed — the spread between them is
                  the firm&apos;s margin on a referred trader.
                </p>
              </div>

              {/* 6-month projection (audit #5) */}
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">6-month projection</p>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                    linear extrapolation
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Least-squares slope over the trailing 12-month commission trend, extended six
                  months forward — arithmetic on the fixture, no random draws.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Next 6 months
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {formatCurrency(projected6, currency)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      vs last 6 months
                    </p>
                    <p
                      className={`mt-1 text-lg font-bold tabular-nums ${
                        projectionDelta >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {projectionDelta >= 0 ? "+" : ""}
                      {projectionDelta.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Monthly slope
                    </p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {slope >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(slope), currency)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex h-28 items-end gap-1.5" role="img" aria-label={`Projected monthly commission for the next 6 months: ${projection.map((p) => `${p.date} ${formatCurrency(p.value, currency)}`).join(", ")}.`}>
                  {projection.map((p) => (
                    <div key={p.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-[9px] tabular-nums text-muted-foreground">
                        {formatCompact(p.value)}
                      </span>
                      <div
                        className="w-full rounded-t"
                        style={{
                          height: `${Math.max(6, (p.value / projMax) * 64)}px`,
                          background: "#b45309",
                        }}
                      />
                      <span className="text-[9px] text-muted-foreground">{p.date}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
                  Projection holds the trailing trend constant: {formatCurrency(recent6, currency)} over
                  the last 6 months → {formatCurrency(projected6, currency)} over the next 6 if the
                  current slope persists. Recomputed from the chart data on every render.
                </p>
              </div>
            </div>

            {/* Custom KPIs (audit #5) — operator-defined targets on the
                same derived metrics, persisted to the demo session. */}
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-medium">Custom KPIs</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Set your own targets against the metrics on this page — progress is saved to this
                demo session and survives a reload.
              </p>

              {kpis.length === 0 ? (
                <p className="mb-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  No custom KPIs yet — add one below to track a target the default cards don&apos;t
                  cover.
                </p>
              ) : (
                <ul className="mb-4 space-y-3">
                  {kpis.map((k) => {
                    const current = kpiValues[k.metric];
                    const pct = k.target > 0 ? (current / k.target) * 100 : 0;
                    const done = pct >= 100;
                    return (
                      <li key={k.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">{k.label}</span>
                          <span className="flex items-center gap-2">
                            <span
                              className={`text-xs tabular-nums ${done ? "text-primary" : "text-muted-foreground"}`}
                            >
                              {kpiFormat(k.metric, current)} of {kpiFormat(k.metric, k.target)} (
                              {pct.toFixed(0)}%)
                            </span>
                            <button
                              type="button"
                              onClick={() => removeKpi(k.id)}
                              aria-label={`Remove ${k.label} KPI`}
                              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        </div>
                        <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(2, pct))}%`,
                              background: done ? "#15803d" : "#b45309",
                            }}
                          />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                <div className="space-y-1">
                  <Label htmlFor="kpi-metric" className="text-xs text-muted-foreground">
                    Metric
                  </Label>
                  <select
                    id="kpi-metric"
                    value={kpiMetric}
                    onChange={(e) => setKpiMetric(e.target.value as DemoAffiliateKpi["metric"])}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-ring"
                  >
                    {KPI_METRICS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="kpi-label" className="text-xs text-muted-foreground">
                    Label
                  </Label>
                  <Input
                    id="kpi-label"
                    value={kpiLabel}
                    onChange={(e) => setKpiLabel(e.target.value)}
                    placeholder="e.g. Gold-tier conversions"
                    className="h-9 w-48"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="kpi-target" className="text-xs text-muted-foreground">
                    Target
                  </Label>
                  <Input
                    id="kpi-target"
                    type="number"
                    min={1}
                    value={kpiTarget}
                    onChange={(e) => setKpiTarget(e.target.value)}
                    placeholder="100"
                    className="h-9 w-28"
                  />
                </div>
                <Button size="sm" onClick={addKpi}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> Add KPI
                </Button>
              </div>
            </div>

            {/* Read-outs */}
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-2 text-sm font-medium">Performance read-outs</p>
              <ul className="space-y-1.5">
                {readouts.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Top affiliates */}
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-1 text-sm font-medium">Top affiliates by commission</p>
              <p className="mb-3 text-xs text-muted-foreground">
                Ranked by earned commission — share shows each partner&apos;s weight in the {formatCurrency(earned, currency)} total.
              </p>
              <DataTable
                columns={columns}
                data={top}
                rowKey={(a) => a.id}
                searchableText={(a) => `${a.name} ${a.tier} ${a.status}`}
                searchPlaceholder="Search affiliates…"
                emptyTitle="No affiliates"
                emptyDescription="This tenant has no affiliate records yet."
                pageSize={10}
              />
            </div>
          </>
        )}
      </PageContent>
    </Page>
  );
}
