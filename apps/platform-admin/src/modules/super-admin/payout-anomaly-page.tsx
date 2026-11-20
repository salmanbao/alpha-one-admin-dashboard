"use client";

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/platform/export-utils";
import { usePayouts, type PlatformPayout } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";
import { Download, AlertTriangle, Search, Users, TrendingUp, DollarSign, Share2 } from "lucide-react";

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function getBeneficiaryKey(p: PlatformPayout): string {
  if (p.beneficiary) {
    if (p.beneficiary.accountLast4) return `bank:${p.beneficiary.accountLast4}`;
    if (p.beneficiary.walletAddress) return `crypto:${p.beneficiary.walletAddress}`;
    return `name:${p.beneficiary.name}`;
  }
  return `trader:${p.traderId}`;
}

interface BeneficiaryGroup {
  key: string;
  count: number;
  tenants: Set<string>;
  totalAmount: number;
  payouts: PlatformPayout[];
}

interface VelocityAlert {
  traderId: string;
  traderName: string;
  tenantId: string;
  tenantName: string;
  count: number;
  amount: number;
}

export function PayoutAnomalyPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();

  const paid = useMemo(() => payouts.filter((p) => p.status === "paid"), [payouts]);
  const inFlight = useMemo(() => payouts.filter((p) => ["pending", "approved", "processing", "on-hold"].includes(p.status)), [payouts]);

  const [activeTab, setActiveTab] = useState("beneficiary");

  // --- 1. Cross-tenant same beneficiary ---
  const beneficiaryGroups = useMemo((): BeneficiaryGroup[] => {
    const groups = new Map<string, BeneficiaryGroup>();
    for (const p of paid) {
      const key = getBeneficiaryKey(p);
      const g = groups.get(key) ?? { key, count: 0, tenants: new Set<string>(), totalAmount: 0, payouts: [] };
      g.count++;
      g.tenants.add(p.tenantId);
      g.totalAmount += p.amount;
      g.payouts.push(p);
      groups.set(key, g);
    }
    return [...groups.values()]
      .filter((g) => g.tenants.size > 1)
      .sort((a, b) => b.tenants.size - a.tenants.size);
  }, [paid]);

  // --- 2. Velocity spikes (payouts per trader per 7 days) ---
  const velocityAlerts = useMemo((): VelocityAlert[] => {
    const byTrader = new Map<string, { payouts: PlatformPayout[]; tenantId: string; tenantName: string }>();
    const alerts: VelocityAlert[] = [];
    for (const p of paid) {
      const key = `${p.tenantId}:${p.traderId}`;
      const g = byTrader.get(key) ?? { payouts: [] as PlatformPayout[], tenantId: p.tenantId, tenantName: p.tenantName ?? p.tenantId };
      g.payouts.push(p);
      byTrader.set(key, g);
    }
    for (const [key, g] of byTrader.entries()) {
      const recent = g.payouts.filter((p) => ageDays(p.createdAt) <= 7);
      if (recent.length >= 3) {
        alerts.push({
          traderId: key.split(":")[1] ?? "",
          traderName: g.payouts[0].traderName,
          tenantId: g.tenantId,
          tenantName: g.tenantName,
          count: recent.length,
          amount: recent.reduce((s, p) => s + p.amount, 0),
        });
      }
    }
    return alerts.sort((a, b) => b.count - a.count);
  }, [paid]);

  // --- 3. Amount outliers (per tenant, per method) ---
  const amountOutliers = useMemo((): PlatformPayout[] => {
    const outliers: PlatformPayout[] = [];
    const byTenantMethod = new Map<string, number[]>();
    for (const p of paid) {
      const key = `${p.tenantId}:${p.method}`;
      if (!byTenantMethod.has(key)) byTenantMethod.set(key, []);
      byTenantMethod.get(key)!.push(p.amount);
    }
    for (const [key, amounts] of byTenantMethod.entries()) {
      if (amounts.length < 3) continue;
      const sorted = [...amounts].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const upper = q3 + 1.5 * iqr;
      for (const p of paid) {
        if (p.amount > upper && `${p.tenantId}:${p.method}` === key) {
          outliers.push(p);
        }
      }
    }
    return outliers.sort((a, b) => b.amount - a.amount);
  }, [paid]);

  // --- 4. Profit-split outliers ---
  const splitOutliers = useMemo((): PlatformPayout[] => {
    const outliers: PlatformPayout[] = [];
    const byTenant = new Map<string, number[]>();
    for (const p of paid) {
      if (!byTenant.has(p.tenantId)) byTenant.set(p.tenantId, []);
      byTenant.get(p.tenantId)!.push(p.profitSplit);
    }
    for (const [tenantId, splits] of byTenant.entries()) {
      if (splits.length < 3) continue;
      const sorted = [...splits].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const upper = q3 + 1.5 * iqr;
      const lower = q1 - 1.5 * iqr;
      for (const p of paid) {
        if (p.tenantId === tenantId && (p.profitSplit > upper || p.profitSplit < lower)) {
          outliers.push(p);
        }
      }
    }
    return outliers.sort((a, b) => Math.abs(b.profitSplit - 80) - Math.abs(a.profitSplit - 80));
  }, [paid]);

  // --- 5. Newly funded traders withdrawing instantly ---
  const instantWithdrawals = useMemo((): PlatformPayout[] => {
    return paid.filter((p) => ageDays(p.createdAt) <= 2);
  }, [paid]);

  const tabs = [
    { id: "beneficiary", label: "Same Beneficiary", count: beneficiaryGroups.length, icon: Users, desc: "Beneficiaries receiving payouts across multiple tenant firms" },
    { id: "velocity", label: "Velocity Spikes", count: velocityAlerts.length, icon: TrendingUp, desc: "Traders with 3+ payouts in 7 days" },
    { id: "amount", label: "Amount Outliers", count: amountOutliers.length, icon: DollarSign, desc: "Statistical outliers per tenant/method (IQR method)" },
    { id: "split", label: "Split % Outliers", count: splitOutliers.length, icon: Share2, desc: "Profit-split percentages outside normal range" },
    { id: "instant", label: "Instant Withdrawals", count: instantWithdrawals.length, icon: AlertTriangle, desc: "Newly funded traders withdrawing within 2 days" },
  ];

  function exportTab() {
    const data = activeTab === "beneficiary" ? beneficiaryGroups.map((g) => ({
      beneficiary: g.key,
      tenantCount: g.tenants.size,
      tenants: [...g.tenants].map(t => allTenants.find(tt => tt.id === t)?.name ?? t).join(", "),
      payoutCount: g.count,
      totalAmount: g.totalAmount,
    })) : activeTab === "velocity" ? velocityAlerts.map(a => ({
      trader: a.traderName,
      tenant: a.tenantName,
      count: a.count,
      amount: a.amount,
    })) : activeTab === "amount" ? amountOutliers.map(p => ({
      reference: p.reference,
      tenant: p.tenantName ?? p.tenantId,
      trader: p.traderName,
      method: p.method,
      amount: p.amount,
    })) : activeTab === "split" ? splitOutliers.map(p => ({
      reference: p.reference,
      tenant: p.tenantName ?? p.tenantId,
      trader: p.traderName,
      profitSplit: p.profitSplit,
    })) : instantWithdrawals.map(p => ({
      reference: p.reference,
      tenant: p.tenantName ?? p.tenantId,
      trader: p.traderName,
      ageDays: ageDays(p.createdAt),
      amount: p.amount,
    }));

    exportToCsv(data, Object.keys(data[0] ?? {}).map(k => ({ key: k, header: k, value: (r: any) => r[k] })), `anomaly-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const active = tabs.find(t => t.id === activeTab)!;
  const beneficiaryCols: Column<BeneficiaryGroup>[] = [
    { key: "key", header: "Beneficiary", cell: (g) => <span className="font-mono text-xs">{g.key}</span> },
    { key: "tenants", header: "Tenants", cell: (g) => g.tenants.size, numeric: true },
    { key: "tenantList", header: "Tenant Names", cell: (g) => [...g.tenants].map(t => allTenants.find(tt => tt.id === t)?.name ?? t).join(", ") },
    { key: "count", header: "Payouts", cell: (g) => g.count, numeric: true },
    { key: "totalAmount", header: "Total Amount", cell: (g) => formatCurrency(g.totalAmount, g.payouts[0]?.currency ?? "USD"), numeric: true },
  ];

  return (
    <Page>
      <PageHeader
        title="Payout Anomaly Review Board"
        description="Cross-tenant payout patterns: same beneficiary, velocity spikes, amount outliers, split % outliers, instant withdrawals. (R10 PS-07 / PF-10)"
        icon={Share2}
        actions={
          <Button variant="outline" size="sm" onClick={exportTab} disabled={active.count === 0}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          {tabs.map(t => (
            <MetricCard
              key={t.id}
              label={t.label}
              value={t.count}
              icon={t.icon}
              tone={t.count > 0 ? "warning" : "default"}
            />
          ))}
        </div>

        <div className="flex gap-2 mb-4 border-b">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-2">
            {active.icon && <active.icon className="h-5 w-5 text-muted-foreground mb-1" />}
            <p className="text-sm text-muted-foreground">{active.desc}</p>
          </CardHeader>
          <CardContent className="p-0">
            {activeTab === "beneficiary" && (
              <DataTable
                columns={beneficiaryCols}
                data={beneficiaryGroups}
                rowKey={(g) => g.key}
                pageSize={20}
                emptyTitle="No cross-tenant beneficiaries"
                emptyDescription="No beneficiary appears across multiple tenant firms."
              />
            )}
            {activeTab === "velocity" && (
              <DataTable
                columns={[
                  { key: "trader", header: "Trader", cell: (a: VelocityAlert) => <span className="text-sm">{a.traderName}</span> },
                  { key: "tenant", header: "Tenant", cell: (a: VelocityAlert) => <span className="text-sm font-medium">{a.tenantName}</span> },
                  { key: "count", header: "Payouts (7d)", cell: (a: VelocityAlert) => <span className="font-mono text-sm font-semibold text-rose-600">{a.count}</span>, numeric: true },
                  { key: "amount", header: "Total Amount", cell: (a: VelocityAlert) => <span className="font-mono text-sm">{formatCurrency(a.amount, "USD")}</span>, numeric: true },
                ]}
                data={velocityAlerts}
                rowKey={(a: VelocityAlert) => a.traderId}
                pageSize={20}
                emptyTitle="No velocity spikes"
                emptyDescription="No trader has 3+ payouts in 7 days."
              />
            )}
            {["amount", "split", "instant"].includes(activeTab) && (
              <DataTable
                columns={activeTab === "amount" ? [
                  { key: "reference", header: "Reference", cell: (p: PlatformPayout) => <span className="font-mono text-xs">{p.reference}</span> },
                  { key: "tenant", header: "Tenant", cell: (p: PlatformPayout) => <span className="text-sm font-medium">{p.tenantName ?? p.tenantId}</span> },
                  { key: "trader", header: "Trader", cell: (p: PlatformPayout) => <span className="text-sm">{p.traderName}</span> },
                  { key: "method", header: "Method", cell: (p: PlatformPayout) => <Badge variant="secondary" className="text-[10px]">{p.method}</Badge> },
                  { key: "amount", header: "Amount", cell: (p: PlatformPayout) => <span className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(p.amount, p.currency)}</span>, numeric: true },
                ] : activeTab === "split" ? [
                  { key: "reference", header: "Reference", cell: (p: PlatformPayout) => <span className="font-mono text-xs">{p.reference}</span> },
                  { key: "tenant", header: "Tenant", cell: (p: PlatformPayout) => <span className="text-sm font-medium">{p.tenantName ?? p.tenantId}</span> },
                  { key: "trader", header: "Trader", cell: (p: PlatformPayout) => <span className="text-sm">{p.traderName}</span> },
                  { key: "profitSplit", header: "Profit Split %", cell: (p: PlatformPayout) => <span className="font-mono text-sm font-semibold text-rose-600">{p.profitSplit}%</span>, numeric: true },
                ] : [
                  { key: "reference", header: "Reference", cell: (p: PlatformPayout) => <span className="font-mono text-xs">{p.reference}</span> },
                  { key: "tenant", header: "Tenant", cell: (p: PlatformPayout) => <span className="text-sm font-medium">{p.tenantName ?? p.tenantId}</span> },
                  { key: "trader", header: "Trader", cell: (p: PlatformPayout) => <span className="text-sm">{p.traderName}</span> },
                  { key: "ageDays", header: "Age (days)", cell: (p: PlatformPayout) => <span className="font-mono text-xs font-semibold text-rose-600">{ageDays(p.createdAt)}d</span>, numeric: true },
                  { key: "amount", header: "Amount", cell: (p: PlatformPayout) => <span className="font-mono text-sm">{formatCurrency(p.amount, p.currency)}</span>, numeric: true },
                ]}
                data={activeTab === "amount" ? amountOutliers : activeTab === "split" ? splitOutliers : instantWithdrawals}
                rowKey={(p: PlatformPayout) => p.id}
                pageSize={20}
                emptyTitle="No anomalies"
                emptyDescription="No anomalies detected for this category."
              />
            )}
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <Share2 className="h-4 w-4" /> Detection Methodology
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Same beneficiary:</strong> Groups by bank account last-4 / wallet address / name; flags beneficiaries appearing across {'>'}1 tenant.</li>
            <li><strong>Velocity:</strong> Counts paid payouts per trader in trailing 7 days; flags {'>='}3.</li>
            <li><strong>Amount outliers:</strong> IQR method per tenant/method; upper fence = Q3 + 1.5 * IQR.</li>
            <li><strong>Split % outliers:</strong> IQR method per tenant; flags outside 1.5 * IQR from Q1/Q3.</li>
            <li><strong>Instant withdrawals:</strong> Paid payouts created within 2 days of trader appearing in fixture.</li>
            <li>Requires PF-10 beneficiary entity on payout rows for high-confidence matching.</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}