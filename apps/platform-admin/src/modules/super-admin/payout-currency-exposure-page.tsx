"use client";

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { usePayouts } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";
import { DollarSign, AlertTriangle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PayoutCurrencyExposurePage() {
  const { user } = usePlatform();
  const payouts = usePayouts();

  const allPayouts = useMemo(() => payouts, [payouts]);

  const byCurrency = useMemo(() => {
    const map = new Map<string, {
      currency: string;
      paidCount: number;
      paidAmount: number;
      pendingCount: number;
      pendingAmount: number;
      processingCount: number;
      processingAmount: number;
      rejectedCount: number;
      rejectedAmount: number;
      totalAmount: number;
      tenants: Set<string>;
    }>();
    for (const p of allPayouts) {
      const entry = map.get(p.currency) ?? {
        currency: p.currency,
        paidCount: 0,
        paidAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        processingCount: 0,
        processingAmount: 0,
        rejectedCount: 0,
        rejectedAmount: 0,
        totalAmount: 0,
        tenants: new Set<string>(),
      };
      entry.totalAmount += p.amount;
      entry.tenants.add(p.tenantId);
      if (p.status === "paid") {
        entry.paidCount++;
        entry.paidAmount += p.amount;
      } else if (p.status === "pending") {
        entry.pendingCount++;
        entry.pendingAmount += p.amount;
      } else if (p.status === "processing" || p.status === "approved") {
        entry.processingCount++;
        entry.processingAmount += p.amount;
      } else if (p.status === "rejected") {
        entry.rejectedCount++;
        entry.rejectedAmount += p.amount;
      }
      map.set(p.currency, entry);
    }
    return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  }, [allPayouts]);

  const byTenantCurrency = useMemo(() => {
    const map = new Map<string, {
      tenantId: string;
      tenantName: string;
      currency: string;
      count: number;
      amount: number;
    }>();
    for (const p of allPayouts) {
      const key = `${p.tenantId}:${p.currency}`;
      const entry = map.get(key) ?? {
        tenantId: p.tenantId,
        tenantName: p.tenantName ?? p.tenantId,
        currency: p.currency,
        count: 0,
        amount: 0,
      };
      entry.count++;
      entry.amount += p.amount;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [allPayouts]);

  const totalExposure = byCurrency.reduce((s, c) => s + c.totalAmount, 0);
  const currenciesCount = byCurrency.length;

  return (
    <Page>
      <PageHeader
        title="Payout Currency Exposure"
        description="Aggregate payout obligations by currency across all tenants. Per-currency totals only; no FX conversion. (R10 PF-08)"
        icon={Globe}
        actions={
          <Button variant="outline" size="sm" onClick={() => {}}>
            Export CSV
          </Button>
        }
      />
      <PageContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard label="Total Exposure" value={`${currenciesCount} currencies`} icon={Globe} tone="positive" />
          <MetricCard label="Total Amount" value={`${totalExposure.toLocaleString()} (mixed)`} icon={DollarSign} tone="positive" />
          <MetricCard label="Currencies" value={currenciesCount} icon={Globe} tone="default" />
          <MetricCard label="Tenants" value={allTenants.filter(t => t.id !== "platform").length} icon={Globe} tone="default" />
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={[{
                key: "currency",
                header: "Currency",
                cell: (c) => <span className="text-sm font-medium">{c.currency}</span>,
              }, {
                key: "tenants",
                header: "Tenants",
                cell: (c) => <span className="font-mono text-sm">{c.tenants.size}</span>,
                numeric: true,
              }, {
                key: "totalAmount",
                header: "Total Amount",
                numeric: true,
                cell: (c) => <span className="font-mono text-sm tabular-nums">{formatCurrency(c.totalAmount, c.currency)}</span>,
              }, {
                key: "paidAmount",
                header: "Paid",
                numeric: true,
                cell: (c) => <span className="font-mono text-sm text-emerald-600">{formatCurrency(c.paidAmount, c.currency)}</span>,
              }, {
                key: "paidCount",
                header: "Paid Count",
                numeric: true,
                cell: (c) => <span className="font-mono text-sm">{c.paidCount}</span>,
              }, {
                key: "pendingAmount",
                header: "Pending",
                numeric: true,
                cell: (c) => <span className="font-mono text-sm text-amber-600">{formatCurrency(c.pendingAmount, c.currency)}</span>,
              }, {
                key: "pendingCount",
                header: "Pending Count",
                numeric: true,
                cell: (c) => <span className="font-mono text-sm">{c.pendingCount}</span>,
              }, {
                key: "processingAmount",
                header: "Processing",
                numeric: true,
                cell: (c) => <span className="font-mono text-sm text-blue-600">{formatCurrency(c.processingAmount, c.currency)}</span>,
              }, {
                key: "rejectedAmount",
                header: "Rejected",
                numeric: true,
                cell: (c) => <span className="font-mono text-sm text-rose-600">{formatCurrency(c.rejectedAmount, c.currency)}</span>,
              }]}
              data={byCurrency}
              rowKey={(c) => c.currency}
              pageSize={20}
              emptyTitle="No payout data"
              emptyDescription="No payouts available to analyze."
            />
          </CardContent>
        </Card>

        <div className="mt-8">
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4">Per-Tenant Currency Breakdown</h3>
              <DataTable
                columns={[{
                  key: "tenant",
                  header: "Tenant",
                  cell: (c) => <span className="text-sm font-medium">{c.tenantName}</span>,
                }, {
                  key: "currency",
                  header: "Currency",
                  cell: (c) => <span className="font-mono text-sm">{c.currency}</span>,
                }, {
                  key: "count",
                  header: "Count",
                  numeric: true,
                  cell: (c) => <span className="font-mono text-sm">{c.count}</span>,
                }, {
                  key: "amount",
                  header: "Amount",
                  numeric: true,
                  cell: (c) => <span className="font-mono text-sm tabular-nums">{formatCurrency(c.amount, c.currency)}</span>,
                }]}
                data={byTenantCurrency}
                rowKey={(c) => `${c.tenantId}:${c.currency}`}
                pageSize={25}
                emptyTitle="No data"
                emptyDescription="No tenant-currency data available."
              />
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Methodology
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Currency exposure is shown per-currency; no FX conversion is performed.</li>
            <li>Published methodology refuses FX conversion for honest demo reasons.</li>
            <li>Amounts are in the payout's native currency as seeded (USD, GBP).</li>
            <li>Multi-currency liability and funding-shortfall risk are unobservable without FX rates.</li>
            <li>Supports PF-08: payout currency exposure view.</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}