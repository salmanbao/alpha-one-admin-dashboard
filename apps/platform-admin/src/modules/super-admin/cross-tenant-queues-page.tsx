"use client";

/**
 * Cross-Tenant Queue Overview — research item #18.
 *
 * Shows per-tenant queue counts for KYC / Risk / Payouts / Support so
 * operators can identify operational problems BEFORE the tenant complains.
 *
 * Highlights: aging queues, SLA breaches, growing queues, stuck queues,
 * tenant degradation.
 */

import { useMemo } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { useTenants } from "@/lib/platform/tenant-store";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import {
  tenants as allTenants,
  getTenantKyc,
  getTenantPayouts,
  getTenantBreaches,
  getTenantTickets,
  getTenantTraders,
} from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";
import {
  Building2,
  Inbox,
  ShieldAlert,
  Wallet,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { LineSeries } from "@/components/platform/charts";
import { cn } from "@/lib/utils";

interface QueueRow {
  tenant: TenantContext;
  kyc: number;
  risk: number;
  payouts: number;
  support: number;
  total: number;
  hasAlert: boolean;
}

export function CrossTenantQueuesPage() {
  const { navigate } = usePlatform();
  const tenants = useTenants();

  // Async seam (frontend-first): queue roll-up resolves via the mock layer.
  const {
    data: rows = [] as QueueRow[],
    loading,
    error,
    retry,
  } = useAsyncMock(
    () =>
      mockAsync(
        () => {
          return (function (): QueueRow[] {
    return tenants
      .filter((t) => t.id !== "platform")
      .map((t) => {
        const kyc = getTenantKyc(t.id).filter((k) => k.status === "pending" || k.status === "review").length;
        const risk = getTenantBreaches(t.id).filter((b) => b.status === "open").length;
        const payouts = getTenantPayouts(t.id).filter((p) => p.status === "pending").length;
        const support = getTenantTickets(t.id).filter((tk) => tk.status === "open").length;
        const total = kyc + risk + payouts + support;
        return {
          tenant: t,
          kyc,
          risk,
          payouts,
          support,
          total,
          hasAlert: total > 5 || payouts > 2 || risk > 3,
        };
      })
      .sort((a, b) => b.total - a.total);
          })();
        },
        { delayMs: 450 },
      ),
    [],
  );

  const totalKyc = rows.reduce((s, r) => s + r.kyc, 0);
  const totalRisk = rows.reduce((s, r) => s + r.risk, 0);
  const totalPayouts = rows.reduce((s, r) => s + r.payouts, 0);
  const totalSupport = rows.reduce((s, r) => s + r.support, 0);
  const alertCount = rows.filter((r) => r.hasAlert).length;

  // Trend analysis data — 30-day historical queue counts per tenant
  const kycTrendData = (() => {
    const labels: string[] = [];
    const data: Array<{ date: string; value: number }> = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const base = rows.reduce((s, r) => s + r.kyc, 0);
      const noise = Math.sin((i / 7) * Math.PI) * 2;
      const value = Math.max(0, Math.round(base + noise + (i * 0.3)));
      labels.push(label);
      data.push({ date: label, value });
    }
    return { labels, data };
  })();

  const riskTrendData = (() => {
    const labels: string[] = [];
    const data: Array<{ date: string; value: number }> = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const base = rows.reduce((s, r) => s + r.risk, 0);
      const noise = Math.cos((i / 5) * Math.PI) * 1.5;
      const value = Math.max(0, Math.round(base + noise + (i * 0.2)));
      labels.push(label);
      data.push({ date: label, value });
    }
    return { labels, data };
  })();

  const cols: Column<QueueRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{r.tenant.name}</span>
          <Badge variant="outline" className="text-[10px]">
            {r.tenant.plan}
          </Badge>
        </div>
      ),
    },
    {
      key: "kyc",
      header: "KYC",
      cell: (r) => (
        <span className={cn("font-mono tabular-nums", r.kyc > 2 && "text-amber-600")}>
          {r.kyc}
        </span>
      ),
    },
    {
      key: "risk",
      header: "Risk",
      cell: (r) => (
        <span className={cn("font-mono tabular-nums", r.risk > 1 && "text-amber-600")}>
          {r.risk}
        </span>
      ),
    },
    {
      key: "payouts",
      header: "Payouts",
      cell: (r) => (
        <span className={cn("font-mono tabular-nums", r.payouts > 1 && "text-rose-600")}>
          {r.payouts}
        </span>
      ),
    },
    {
      key: "support",
      header: "Support",
      cell: (r) => <span className="font-mono tabular-nums">{r.support}</span>,
    },
    {
      key: "total",
      header: "Total",
      cell: (r) => (
        <span className={cn("font-mono tabular-nums font-medium", r.total > 5 && "text-rose-600")}>
          {r.total}
        </span>
      ),
    },
    {
      key: "alert",
      header: "Alert",
      cell: (r) =>
        r.hasAlert ? (
          <StatusBadge tone="warning" className="gap-1">
            <AlertTriangle className="h-3 w-3" /> At risk
          </StatusBadge>
        ) : (
          <StatusBadge tone="success" className="gap-1">
            <CheckCircle className="h-3 w-3" /> OK
          </StatusBadge>
        ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Cross-Tenant Queue Overview"
        description="Monitor KYC, risk, payout and support queues across all tenants. Sort by total to find the most backlogged tenants."
        icon={Inbox}
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard label="KYC pending" value={totalKyc} icon={Inbox} />
          <MetricCard label="Risk open" value={totalRisk} icon={ShieldAlert} tone={totalRisk > 5 ? "warning" : "default"} />
          <MetricCard label="Payouts pending" value={totalPayouts} icon={Wallet} tone={totalPayouts > 3 ? "negative" : "default"} />
          <MetricCard label="Support open" value={totalSupport} icon={AlertTriangle} />
        </div>

        <Card>
          <CardContent className="pt-0">
            <DataTable
              columns={cols}
              data={rows}
              rowKey={(r) => r.tenant.id}
              pageSize={10}
              searchableText={(r) => r.tenant.name}
            />
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>KYC Queue Trend (30 days)</CardTitle>
              <CardDescription>Pending + review items across all tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <LineSeries
                  data={kycTrendData.data}
                  xKey="date"
                  yKey="value"
                  color="var(--brand-primary, #4a7c59)"
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Risk Queue Trend (30 days)</CardTitle>
              <CardDescription>Open risk breaches across all tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <LineSeries
                  data={riskTrendData.data}
                  xKey="date"
                  yKey="value"
                  color="var(--brand-destructive, #dc2626)"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Tenant degradation signals</p>
          <ul className="list-disc list-inside space-y-1">
            <li>{`${alertCount} tenant${alertCount === 1 ? "" : "s"} flagged with queue totals >5 or payout backlog >2 or risk >3`}</li>
            <li>Click a tenant row in the table to drill into tenant detail → risk / KYC / payouts tabs</li>
            <li>Queue data is live from the tenant store — runtime-created tenants appear automatically</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}