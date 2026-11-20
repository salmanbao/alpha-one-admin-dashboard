"use client";

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { PayoutLedgerEntry } from "@/lib/platform/payout-ledger";
import { useLedgerForTenant } from "@/lib/platform/payout-ledger";
import { usePayouts } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";
import { Download, AlertTriangle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function PayoutProfitSplitPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();
  const ledgerEntries = useLedgerForTenant("");

  const paid = useMemo(() => payouts.filter((p) => p.status === "paid"), [payouts]);

  const byTenant = useMemo(() => {
    const map = new Map<string, {
      tenantId: string;
      tenantName: string;
      count: number;
      totalAmount: number;
      splits: number[];
      payouts: { id: string; reference: string; traderName: string; profitSplit: number; currency: string; amount: number }[];
    }>();
    for (const p of paid) {
      const entry = map.get(p.tenantId) ?? {
        tenantId: p.tenantId,
        tenantName: p.tenantName ?? p.tenantId,
        count: 0,
        totalAmount: 0,
        splits: [],
        payouts: [],
      };
      entry.count++;
      entry.totalAmount += p.amount;
      entry.splits.push(p.profitSplit);
      entry.payouts.push({
        id: p.id,
        reference: p.reference,
        traderName: p.traderName,
        profitSplit: p.profitSplit,
        currency: p.currency,
        amount: p.amount,
      });
      map.set(p.tenantId, entry);
    }
    return [...map.values()];
  }, [paid]);

  const tenantStats = byTenant.map((t) => {
    const sorted = [...t.splits].sort((a, b) => a - b);
    const avg = t.splits.reduce((s, v) => s + v, 0) / t.splits.length;
    const min = Math.min(...t.splits);
    const max = Math.max(...t.splits);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const outliers = t.splits.filter(s => s > q3 + 1.5 * iqr || s < q1 - 1.5 * iqr).length;

    return {
      tenantId: t.tenantId,
      tenantName: t.tenantName,
      count: t.count,
      totalAmount: t.totalAmount,
      avgSplit: avg,
      minSplit: min,
      maxSplit: max,
      outliers,
      payouts: t.payouts,
    };
  }).sort((a, b) => b.avgSplit - a.avgSplit);

  const avgSplitAll = tenantStats.length > 0
    ? tenantStats.reduce((s, t) => s + t.avgSplit, 0) / tenantStats.length
    : 0;

  const outlierCount = tenantStats.reduce((s, t) => s + t.outliers, 0);

  return (
    <Page>
      <PageHeader
        title="Profit-Split Governance"
        description="Review profit-split configurations across tenants. Flag outlier splits and uneven distribution. (R10 PF-06)"
        icon={DollarSign}
        actions={
          <Button variant="outline" size="sm" onClick={() => {}}>
            <Download className="mr-1" /> Export CSV
          </Button>
        }
      />
      <PageContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard label="Average Split %" value={avgSplitAll.toFixed(1)} icon={DollarSign} tone="positive" />
          <MetricCard label="Tenants Reviewed" value={tenantStats.length} icon={DollarSign} tone="default" />
          <MetricCard label="Split Outliers" value={outlierCount} icon={AlertTriangle} tone={outlierCount > 0 ? "warning" : "default"} />
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={[{
                key: "tenant",
                header: "Tenant",
                cell: (t) => <span className="text-sm font-medium">{t.tenantName}</span>,
              }, {
                key: "count",
                header: "Payouts",
                cell: (t) => <span className="font-mono text-sm">{t.count}</span>,
                numeric: true,
              }, {
                key: "totalAmount",
                header: "Total Paid",
                numeric: true,
                cell: (t) => <span className={`font-mono text-sm tabular-nums ${t.totalAmount > 50000 ? "text-rose-600" : "text-emerald-600"}`}>\n${formatCurrency(t.totalAmount, "USD")}\n</span>,
              }, {
                key: "avgSplit",
                header: "Avg Split %",
                numeric: true,
                cell: (t) => <span className={`font-mono text-sm ${Math.abs(t.avgSplit - 80) > 10 ? "text-rose-600 font-semibold" : "text-emerald-600"}`}>\n{t.avgSplit.toFixed(1)}%\n</span>,
              }, {
                key: "range",
                header: "Split Range",
                cell: (t) => <span className="font-mono text-sm">{t.minSplit.toFixed(1)}% - {t.maxSplit.toFixed(1)}%</span>,
              }, {
                key: "outliers",
                header: "Outliers",
                cell: (t) => <span className={`font-mono text-sm ${t.outliers > 0 ? "text-rose-600 font-semibold" : "text-emerald-600"}`}>{t.outliers}</span>,
              }]}
              data={tenantStats}
              rowKey={(t) => t.tenantId}
              pageSize={20}
              emptyTitle="No payout data"
              emptyDescription="No paid payouts available to analyze."
            />
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Governance Notes
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Profit-split percentage is the trader's share paid out by the tenant firm.</li>
            <li>Average split across all tenants: {avgSplitAll.toFixed(1)}%.</li>
            <li>Outliers are flagged using IQR method per tenant.</li>
            <li>This view supports PF-06: reviewing profit-split configurations for fairness and compliance.</li>
            <li>Unfair or non-compliant split schemes are a regulatory flashpoint for prop firms.</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}