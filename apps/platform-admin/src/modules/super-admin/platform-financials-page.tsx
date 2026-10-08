"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import { tenants as allTenants, getTenantTraders, getTenantAccounts } from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";
import { DollarSign, TrendingUp, TrendingDown, Receipt, CheckCircle2, Clock } from "lucide-react";

interface TenantRevenue {
  tenant: TenantContext;
  planRevenue: number;
  usageRevenue: number;
  passThrough: number;
  total: number;
}

export function PlatformFinancialsPage() {
  const rows: TenantRevenue[] = allTenants.filter((t) => t.id !== "platform").map((t) => {
    const planRevenue = t.plan === "enterprise" ? 4900 : t.plan === "scale" ? 1900 : 890;
    const traders = getTenantTraders(t.id).length;
    const usageRevenue = Math.round(traders * 12); // $12/trader/month
    const passThrough = Math.round(traders * 35); // pass-through margin
    return { tenant: t, planRevenue, usageRevenue, passThrough, total: planRevenue + usageRevenue + passThrough };
  });

  const mrr = rows.reduce((s, r) => s + r.total, 0);
  const arr = mrr * 12;
  const planTotal = rows.reduce((s, r) => s + r.planRevenue, 0);
  const usageTotal = rows.reduce((s, r) => s + r.usageRevenue, 0);
  const passThroughTotal = rows.reduce((s, r) => s + r.passThrough, 0);

  const columns: Column<TenantRevenue>[] = [
    { key: "tenant", header: "Tenant", cell: (r) => <span className="font-medium">{r.tenant.name}</span>, sortValue: (r) => r.tenant.name },
    { key: "plan", header: "Plan", cell: (r) => <Badge variant="outline" className="text-[10px] capitalize">{r.tenant.plan}</Badge>, sortValue: (r) => r.tenant.plan },
    { key: "planRev", header: "Plan Revenue", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.planRevenue)}</span>, sortValue: (r) => r.planRevenue, numeric: true },
    { key: "usage", header: "Usage Revenue", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.usageRevenue)}</span>, sortValue: (r) => r.usageRevenue, numeric: true },
    { key: "passThrough", header: "Pass-Through", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.passThrough)}</span>, sortValue: (r) => r.passThrough, numeric: true },
    { key: "total", header: "Total MRR", cell: (r) => <span className="font-bold tabular-nums">{formatCurrency(r.total)}</span>, sortValue: (r) => r.total, numeric: true },
  ];

  return (
    <Page>
      <PageHeader title="Platform Financials" description="Revenue, billing, and metering across all tenants." icon={DollarSign} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="MRR" value={formatCurrency(mrr)} icon={TrendingUp} tone="positive" />
          <MetricCard label="ARR (projected)" value={formatCurrency(arr)} icon={DollarSign} tone="positive" />
          <MetricCard label="Plan Revenue" value={formatCurrency(planTotal)} icon={Receipt} />
          <MetricCard label="Pass-Through Margin" value={formatCurrency(passThroughTotal)} icon={TrendingDown} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Revenue breakdown</span></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Plan revenue", value: planTotal, pct: Math.round((planTotal / mrr) * 100), color: "#0f766e" },
                { label: "Usage revenue", value: usageTotal, pct: Math.round((usageTotal / mrr) * 100), color: "#b45309" },
                { label: "Pass-through margin", value: passThroughTotal, pct: Math.round((passThroughTotal / mrr) * 100), color: "#4d7c0f" },
              ].map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground">{formatCurrency(r.value)} · {r.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Invoice status</span></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />Paid (30d)</span><span className="font-medium">12 invoices</span></div>
              <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" />Pending</span><span className="font-medium">3 invoices</span></div>
              <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-rose-500" />Past due</span><span className="font-medium">1 invoice</span></div>
              <div className="flex items-center justify-between text-xs"><span>Total outstanding</span><span className="font-bold tabular-nums">{formatCurrency(14700)}</span></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Per-tenant revenue</span></CardHeader>
          <CardContent>
            <DataTable columns={columns} data={rows} rowKey={(r) => r.tenant.id} searchableText={(r) => r.tenant.name} searchPlaceholder="Search tenants…" pageSize={20} emptyTitle="No data" emptyDescription="Tenants will appear here." />
          </CardContent>
        </Card>

        <div className="rounded-lg border border-slate-500/20 bg-slate-50/30 p-3 text-xs text-muted-foreground dark:bg-slate-950/10">
          <p className="font-medium text-foreground">Billing mode</p>
          <p className="mt-1">Currently in manual contract mode (V1/V2). V3 will add the full productized billing engine with plans, add-ons, subscriptions, usage-based billing, dunning, and self-service tenant signup.</p>
        </div>
      </PageContent>
    </Page>
  );
}
