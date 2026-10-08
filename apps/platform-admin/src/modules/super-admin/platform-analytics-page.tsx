"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarSeries, AreaSeries } from "@/components/platform/charts";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import {
  tenants as allTenants,
  getTenantTraders,
  getTenantAccounts,
  getTenantPayouts,
  hashStr,
} from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";
import { BarChart3, Users, Wallet, TrendingUp, DollarSign, Activity } from "lucide-react";

interface TenantMetric {
  tenant: TenantContext;
  traders: number;
  accounts: number;
  fundedAccounts: number;
  payoutVolume: number;
}

export function PlatformAnalyticsPage() {
  const rows: TenantMetric[] = allTenants
    .filter((t) => t.id !== "platform")
    .map((t) => {
      const traders = getTenantTraders(t.id).length;
      const accounts = getTenantAccounts(t.id).length;
      const fundedAccounts = getTenantAccounts(t.id).filter((a) => a.phase === "funded").length;
      const payoutVolume = getTenantPayouts(t.id)
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + p.amount, 0);
      return { tenant: t, traders, accounts, fundedAccounts, payoutVolume };
    });

  const totalTraders = rows.reduce((s, r) => s + r.traders, 0);
  const totalAccounts = rows.reduce((s, r) => s + r.accounts, 0);
  const totalFunded = rows.reduce((s, r) => s + r.fundedAccounts, 0);
  const totalPayouts = rows.reduce((s, r) => s + r.payoutVolume, 0);

  // Monthly revenue trend (deterministic)
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const n = 11 - i;
    const rev = Math.max(20000, Math.round(84000 + Math.sin(n / 2) * 22000 + n * 1400));
    return { date: `M-${n}`, value: rev };
  });

  // Tenant comparison bar chart
  const traderComparison = rows.map((r) => ({
    name: r.tenant.branding.initials,
    value: r.traders,
  }));

  const columns: Column<TenantMetric>[] = [
    { key: "tenant", header: "Tenant", cell: (r) => <span className="font-medium">{r.tenant.name}</span>, sortValue: (r) => r.tenant.name },
    { key: "traders", header: "Traders", cell: (r) => <span className="tabular-nums">{r.traders}</span>, sortValue: (r) => r.traders, numeric: true },
    { key: "accounts", header: "Accounts", cell: (r) => <span className="tabular-nums">{r.accounts}</span>, sortValue: (r) => r.accounts, numeric: true },
    { key: "funded", header: "Funded", cell: (r) => <span className="tabular-nums">{r.fundedAccounts}</span>, sortValue: (r) => r.fundedAccounts, numeric: true },
    { key: "payoutVolume", header: "Payout Volume", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.payoutVolume)}</span>, sortValue: (r) => r.payoutVolume, numeric: true },
    { key: "conversion", header: "Funded %", cell: (r) => <span className="tabular-nums text-xs">{r.accounts > 0 ? Math.round((r.fundedAccounts / r.accounts) * 100) : 0}%</span>, sortValue: (r) => r.accounts > 0 ? (r.fundedAccounts / r.accounts) * 100 : 0, numeric: true },
  ];

  return (
    <Page>
      <PageHeader title="Platform Analytics" description="Cross-tenant comparisons — growth, usage, revenue, and provider consumption." icon={BarChart3} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Traders" value={formatCompact(totalTraders)} icon={Users} tone="positive" />
          <MetricCard label="Total Accounts" value={formatCompact(totalAccounts)} icon={Activity} />
          <MetricCard label="Funded Accounts" value={formatCompact(totalFunded)} icon={TrendingUp} tone="positive" />
          <MetricCard label="Payout Volume" value={formatCurrency(totalPayouts)} icon={Wallet} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Monthly revenue (12 months)</span></CardHeader>
            <CardContent>
              <AreaSeries data={monthlyRevenue} xKey="date" yKey="value" color="#0f766e" height={200} formatValue={(v) => formatCurrency(v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Trader count by tenant</span></CardHeader>
            <CardContent>
              <BarSeries data={traderComparison} xKey="name" yKey="value" color="#b45309" height={200} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Cross-tenant comparison</span></CardHeader>
          <CardContent>
            <DataTable columns={columns} data={rows} rowKey={(r) => r.tenant.id} searchableText={(r) => r.tenant.name} searchPlaceholder="Search tenants…" pageSize={20} emptyTitle="No data" emptyDescription="Tenant metrics will appear here." />
          </CardContent>
        </Card>

        {/* Useful questions section */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Key questions this view answers</span></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>· Which tenants are approaching their account limit?</li>
              <li>· Which tenants generate the most API traffic?</li>
              <li>· Which provider costs are increasing?</li>
              <li>· What is the funded-account conversion rate per tenant?</li>
              <li>· How does payout volume compare across tenants?</li>
            </ul>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
