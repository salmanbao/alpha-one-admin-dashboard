"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, StatusBadge } from "@/components/platform/status";
import { tenants as allTenants, getTenantTraders } from "@/lib/platform/mock-data";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import type { TenantContext } from "@/lib/platform/types";
import { DollarSign, TrendingUp, TrendingDown, Receipt, CheckCircle2, Clock, FileText } from "lucide-react";

interface TenantRevenue {
  tenant: TenantContext;
  planRevenue: number;
  usageRevenue: number;
  passThrough: number;
  total: number;
}

/** One row of the platform-level invoice ledger (audit X #2). */
interface PlatformInvoice {
  id: string;
  tenant: TenantContext;
  amount: number;
  status: "paid" | "pending" | "past due" | "disputed";
  due: string;
  method: string;
}

export function PlatformFinancialsPage() {
  // Async seam (frontend-first): the revenue roll-up is "fetched" through the
  // mock layer so the skeleton / error+retry states are exercised.
  const {
    data: rows = [],
    loading,
    error,
    retry,
  } = useAsyncMock(
    () =>
      mockAsync(
        () =>
          allTenants
            .filter((t) => t.id !== "platform")
            .map((t): TenantRevenue => {
              const planRevenue = t.plan === "enterprise" ? 4900 : t.plan === "scale" ? 1900 : 890;
              const traders = getTenantTraders(t.id).length;
              const usageRevenue = Math.round(traders * 12); // $12/trader/month
              const passThrough = Math.round(traders * 35); // pass-through margin
              return { tenant: t, planRevenue, usageRevenue, passThrough, total: planRevenue + usageRevenue + passThrough };
            }),
        { delayMs: 450 },
      ),
    [],
  );

  const mrr = rows.reduce((s, r) => s + r.total, 0);
  const arr = mrr * 12;
  const planTotal = rows.reduce((s, r) => s + r.planRevenue, 0);
  const usageTotal = rows.reduce((s, r) => s + r.usageRevenue, 0);
  const passThroughTotal = rows.reduce((s, r) => s + r.passThrough, 0);

  // Invoice ledger (audit X #2) — deterministic per-tenant invoice
  // history derived from the same revenue rows, so the platform-level
  // billing screen has the invoice list its evidence said was missing.
  const invoices: PlatformInvoice[] = [];
  rows.forEach((r) => {
    const seed = r.tenant.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    const methods = ["Card", "ACH", "Wire transfer"];
    const count = 2 + (seed % 2); // 2–3 invoices per tenant
    for (let i = 0; i < count; i++) {
      const status: PlatformInvoice["status"] =
        i === 0
          ? seed % 7 === 0
            ? "past due"
            : "pending"
          : (seed + i) % 9 === 0
            ? "disputed"
            : "paid";
      const dueDate = new Date(Date.now() + (i - 1) * 30 * 24 * 60 * 60 * 1000);
      invoices.push({
        id: `INV-${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(((seed + i * 13) % 900) + 100)}`,
        tenant: r.tenant,
        amount: r.total,
        status,
        due: dueDate.toISOString(),
        method: methods[(seed + i) % methods.length],
      });
    }
  });

  const columns: Column<TenantRevenue>[] = [
    { key: "tenant", header: "Tenant", cell: (r) => <span className="font-medium">{r.tenant.name}</span>, sortValue: (r) => r.tenant.name },
    { key: "plan", header: "Plan", cell: (r) => <Badge variant="outline" className="text-[10px] capitalize">{r.tenant.plan}</Badge>, sortValue: (r) => r.tenant.plan },
    { key: "planRev", header: "Plan Revenue", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.planRevenue)}</span>, sortValue: (r) => r.planRevenue, numeric: true },
    { key: "usage", header: "Usage Revenue", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.usageRevenue)}</span>, sortValue: (r) => r.usageRevenue, numeric: true },
    { key: "passThrough", header: "Pass-Through", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.passThrough)}</span>, sortValue: (r) => r.passThrough, numeric: true },
    { key: "total", header: "Total MRR", cell: (r) => <span className="font-bold tabular-nums">{formatCurrency(r.total)}</span>, sortValue: (r) => r.total, numeric: true },
  ];

  const invoiceColumns: Column<PlatformInvoice>[] = [
    { key: "id", header: "Invoice", cell: (r) => <span className="font-mono text-xs">{r.id}</span>, sortValue: (r) => r.id },
    { key: "tenant", header: "Tenant", cell: (r) => <span className="font-medium">{r.tenant.name}</span>, sortValue: (r) => r.tenant.name },
    { key: "amount", header: "Amount", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.amount, r.tenant.currency)}</span>, sortValue: (r) => r.amount, numeric: true },
    { key: "due", header: "Due", cell: (r) => <span className="text-xs">{new Date(r.due).toLocaleDateString()}</span>, sortValue: (r) => r.due },
    { key: "method", header: "Method", cell: (r) => <span className="text-xs text-muted-foreground">{r.method}</span>, sortValue: (r) => r.method },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge tone={r.status === "paid" ? "success" : r.status === "pending" ? "warning" : "danger"}>
          {r.status}
        </StatusBadge>
      ),
      sortValue: (r) => r.status,
    },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() =>
            toast({ title: "Invoice opened", description: `${r.id} · ${r.tenant.name} — PDF preview would open here. (demo)` })
          }
        >
          <FileText className="mr-1 h-3 w-3" /> View
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Platform Financials" description="Revenue, billing, and metering across all tenants." icon={DollarSign} />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={rows.length > 0}
          loadingLabel="Loading financials…"
        >
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

        {/* Invoice ledger (audit X #2) — platform-level invoice history
            across every tenant: the invoice list, statuses, methods and
            per-invoice actions the billing screen was missing. */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">Invoice ledger</span>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={invoiceColumns}
              data={invoices}
              rowKey={(r) => r.id}
              searchableText={(r) => `${r.id} ${r.tenant.name} ${r.status}`}
              searchPlaceholder="Search invoices…"
              pageSize={10}
              emptyTitle="No invoices yet"
              emptyDescription="Invoices appear here after the first billing cycle."
            />
          </CardContent>
        </Card>

        {/* Plan / Pricing Catalog (reference for all call sites) */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Plan catalog</span></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { id: "starter", name: "Starter", price: 890, features: "Core trading, 5 accounts, basic analytics" },
              { id: "growth", name: "Growth", price: 1900, features: "15 accounts, advanced analytics, API access" },
              { id: "scale", name: "Scale", price: 4900, features: "50 accounts, priority support, custom integrations" },
              { id: "enterprise", name: "Enterprise", price: null, features: "Unlimited, SLA, dedicated infra, custom pricing" },
            ].map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium capitalize">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.features}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold tabular-nums">{p.price ? `${formatCurrency(p.price, "USD")}/mo` : "Custom"}</span>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => toast({ title: "Plan details", description: `${p.name} plan configuration opened.` })}>
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="rounded-lg border border-slate-500/20 bg-slate-50/30 p-3 text-xs text-muted-foreground dark:bg-slate-950/10">
          <p className="font-medium text-foreground">Billing mode</p>
          <p className="mt-1">Currently in manual contract mode (V1/V2). V3 will add the full productized billing engine with plans, add-ons, subscriptions, usage-based billing, dunning, and self-service tenant signup.</p>
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
