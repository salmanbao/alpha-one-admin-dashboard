"use client";

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { getTenantAffiliates, affiliateCampaigns, type Affiliate, type AffiliateCampaign } from "@/lib/platform/mock-data";
import { exportToCsv } from "@/lib/platform/export-utils";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, campaignStatusTone, formatCurrency, formatCompact } from "@/components/platform/status";
import { AreaSeries } from "@/components/platform/charts";
import { Megaphone, Users, Target, DollarSign, Download } from "lucide-react";
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
