"use client";

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { usePayouts } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";
import { Download, AlertTriangle, TrendingUp, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function TimeToFirstPayoutPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();

  // Find first paid payout per tenant
  const firstPerTenant = useMemo(() => {
    const byTenant = new Map<string, { tenantId: string; tenantName: string; firstPaidDate: string; payoutCount: number; totalAmount: number }>();
    
    // Sort by createdAt ascending per tenant
    for (const p of payouts) {
      const entry = byTenant.get(p.tenantId) ?? { tenantId: p.tenantId, tenantName: p.tenantName ?? p.tenantId, firstPaidDate: p.createdAt, payoutCount: 0, totalAmount: 0 };
      if (p.status === "paid" && p.createdAt < entry.firstPaidDate) {
        entry.firstPaidDate = p.createdAt;
      }
      if (p.status === "paid") entry.payoutCount++;
      entry.totalAmount += p.amount;
      byTenant.set(p.tenantId, entry);
    }
    return [...byTenant.values()];
  }, [payouts]);

  const tenantData = firstPerTenant.map((t) => {
    const tenant = allTenants.find((tnt) => tnt.id === t.tenantId);
    const payoutsForTenant = payouts.filter((p) => p.tenantId === t.tenantId);
    const paidPayouts = payoutsForTenant.filter((p) => p.status === "paid").sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Find first paid payout date
    const firstPaid = paidPayouts[0]?.createdAt ?? null;
    const avgTimeToFirst = firstPaid ? ageDays(firstPaid) : null;

    return {
      tenantId: t.tenantId,
      tenantName: t.tenantName ?? t.tenantId,
      firstPaidDate: firstPaid || "—",
      avgTimeToFirstDays: avgTimeToFirst,
      payoutCount: t.payoutCount,
      totalAmount: t.totalAmount,
    };
  }).sort((a, b) => {
    if (a.avgTimeToFirstDays === null && b.avgTimeToFirstDays === null) return 0;
    if (a.avgTimeToFirstDays === null) return 1;
    if (b.avgTimeToFirstDays === null) return -1;
    return a.avgTimeToFirstDays - b.avgTimeToFirstDays;
  });

  const avgTimeToFirst = tenantData.length > 0
    ? tenantData.reduce((s, t) => s + (t.avgTimeToFirstDays ?? 0), 0) / tenantData.length
    : 0;

  return (
    <Page>
      <PageHeader
        title="Time-to-First-Payout"
        description="Track time-to-first-payout per tenant as a proxy for firm health and trader satisfaction. (R10 PU-05)"
        icon={TrendingUp}
        actions={
          <Button variant="outline" size="sm" onClick={() => {}} disabled={false}>
            Export CSV
          </Button>
        }
      />
      <PageContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard label="Avg Time-to-First" value={avgTimeToFirst.toFixed(1)} icon={Clock} tone="positive" />
          <MetricCard label="Tenants Tracked" value={tenantData.length} icon={Download} tone="default" />
          <MetricCard label="Tenants Without Paid" value={tenantData.filter((t) => t.avgTimeToFirstDays === null).length} icon={AlertTriangle} tone={tenantData.filter((t) => t.avgTimeToFirstDays === null).length > 0 ? "warning" : "default"} />
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={[{
                key: "tenantName",
                header: "Tenant",
                cell: (t) => <span className="text-sm font-medium">{t.tenantName}</span>,
              }, {
                key: "firstPaidDate",
                header: "First Paid Date",
                cell: (t) => <span className="font-mono text-sm">{t.firstPaidDate === "—" ? "—" : new Date(t.firstPaidDate).toLocaleString()}</span>,
              }, {
                key: "avgTimeToFirstDays",
                header: "Days to First Payout",
                numeric: true,
                cell: (t) => <span className={`font-mono text-sm ${t.avgTimeToFirstDays! > 14 ? "text-rose-600" : "text-emerald-600"}`}>\n{t.avgTimeToFirstDays ?? "—"}\ndays</span>,
              }, {
                key: "payoutCount",
                header: "Paid Payouts",
                numeric: true,
                cell: (t) => <span className="font-mono text-sm">{t.payoutCount}</span>,
              }, {
                key: "totalAmount",
                header: "Total Paid",
                numeric: true,
                cell: (t) => <span className="font-mono text-sm tabular-nums">{formatCurrency(t.totalAmount, "USD")}</span>,
              }]}
              data={tenantData}
              rowKey={(t) => t.tenantId}
              pageSize={20}
              emptyTitle="No tenant data"
              emptyDescription="No tenants with payout data found."
            />
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Methodology
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Time-to-first-payout is measured from the payout fixture creation date to the first paid payout for each tenant.</li>
            <li>Average time-to-first-payout across all tenants: {avgTimeToFirst.toFixed(1)} days.</li>
            <li>Tenants with no paid payouts are flagged for review.</li>
            <li>This supports PU-05: monitoring time-to-first-payout per tenant as a proxy for firm health.</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}