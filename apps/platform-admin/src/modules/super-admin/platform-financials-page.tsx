"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, StatusBadge } from "@/components/platform/status";
import { readInvoices, useInvoices } from "@/lib/platform/invoice-store";
import { DollarSign, TrendingUp, TrendingDown, Receipt, CheckCircle2, Clock, FileText } from "lucide-react";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";

interface PlatformInvoice {
  id: string;
  tenant: string;
  amount: number;
  status: "paid" | "pending" | "past due" | "disputed";
  due: string;
  method: string;
}

export function PlatformFinancialsPage() {
  // Real invoice data from the invoice store
  const invoices = readInvoices();

  const invoiceMap = new Map<string, PlatformInvoice>();
  invoices.forEach((inv) => {
    invoiceMap.set(inv.id, {
      id: inv.id,
      tenant: inv.tenantId,
      amount: inv.total,
      status: (inv.status as "paid" | "pending" | "past due" | "disputed") ?? "pending",
      due: inv.dueDate,
      method: "platform",
    });
  });

  const invoiceRows = Array.from(invoiceMap.values());

  const mrr = invoices.reduce((s, inv) => s + inv.total, 0);
  const arr = mrr * 12;
  const planTotal = invoices.reduce((s, inv) => s + inv.total, 0);
  const usageTotal = invoices.reduce((s, inv) => s + inv.total, 0);
  const passThroughTotal = invoices.reduce((s, inv) => s + inv.total, 0);

  const columns: Column<PlatformInvoice>[] = [
    { key: "id", header: "Invoice", cell: (r) => <span className="font-mono text-xs">{r.id}</span>, sortValue: (r) => r.id },
    { key: "tenant", header: "Tenant", cell: (r) => <span className="font-medium">{r.tenant}</span>, sortValue: (r) => r.tenant },
    { key: "amount", header: "Amount", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.amount, "USD")}</span>, sortValue: (r) => r.amount, numeric: true },
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
            toast({
              title: "Invoice opened",
              description: `${r.id} · ${r.tenant} — PDF preview would open here. (demo)`,
            })
          }
        >
          <FileText className="mr-1 h-3 w-3" /> View
        </Button>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Platform Financials" description="Revenue, billing, and metering across all tenants. (Demo data)" icon={DollarSign} />
      <PageContent>
        <PageAsyncBoundary
          loading={false}
          error={undefined}
          onRetry={() => {}}
          hasData={invoices.length > 0}
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
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Plan revenue</span>
                  <span className="text-muted-foreground">{formatCurrency(planTotal)} · {Math.round((planTotal / mrr) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((planTotal / mrr) * 100)}%`, background: "#0f766e" }} />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Usage revenue</span>
                  <span className="text-muted-foreground">{formatCurrency(usageTotal)} · {Math.round((usageTotal / mrr) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((usageTotal / mrr) * 100)}%`, background: "#b45309" }} />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Pass-through margin</span>
                  <span className="text-muted-foreground">{formatCurrency(passThroughTotal)} · {Math.round((passThroughTotal / mrr) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((passThroughTotal / mrr) * 100)}%`, background: "#4d7c0f" }} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><span className="text-sm font-medium">Invoice status</span></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Paid (30d)</span><span className="font-medium">12 invoices</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" /> Pending</span><span className="font-medium">3 invoices</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-rose-500" /> Past due</span><span className="font-medium">1 invoice</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Total outstanding</span><span className="font-bold tabular-nums">{formatCurrency(14700)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Per-tenant revenue</span>
              <Badge variant="outline" className="text-[10px]">(Demo data — fixture)</Badge>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={invoiceRows}
                rowKey={(r) => r.id}
                searchableText={(r) => `${r.id} ${r.tenant}`}
                searchPlaceholder="Search invoices…"
                pageSize={10}
                emptyTitle="No invoices yet"
                emptyDescription="Invoices appear here after the first billing cycle."
              />
            </CardContent>
          </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}