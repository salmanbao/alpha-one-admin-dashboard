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
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
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
import { Inbox, ShieldAlert, Wallet, AlertTriangle, Clock } from "lucide-react";
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

  const rows = useMemo<QueueRow[]>(() => {
    return allTenants
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
  }, []);

  const totalKyc = rows.reduce((s, r) => s + r.kyc, 0);
  const totalRisk = rows.reduce((s, r) => s + r.risk, 0);
  const totalPayouts = rows.reduce((s, r) => s + r.payouts, 0);
  const totalSupport = rows.reduce((s, r) => s + r.support, 0);
  const alertCount = rows.filter((r) => r.hasAlert).length;

  const columns: Column<QueueRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: r.tenant.branding.primaryColor }}>
            {r.tenant.branding.initials}
          </span>
          <div>
            <p className="font-medium text-foreground">{r.tenant.name}</p>
            <p className="text-[10px] text-muted-foreground">{r.tenant.plan} plan</p>
          </div>
        </div>
      ),
      sortValue: (r) => r.tenant.name,
    },
    {
      key: "kyc",
      header: "KYC",
      cell: (r) => (
        <span className={cn("font-medium tabular-nums", r.kyc > 5 ? "text-amber-600" : "")}>{r.kyc}</span>
      ),
      sortValue: (r) => r.kyc,
      numeric: true,
    },
    {
      key: "risk",
      header: "Risk",
      cell: (r) => (
        <span className={cn("font-medium tabular-nums", r.risk > 3 ? "text-rose-600" : "")}>{r.risk}</span>
      ),
      sortValue: (r) => r.risk,
      numeric: true,
    },
    {
      key: "payouts",
      header: "Payouts",
      cell: (r) => (
        <span className={cn("font-medium tabular-nums", r.payouts > 2 ? "text-amber-600" : "")}>{r.payouts}</span>
      ),
      sortValue: (r) => r.payouts,
      numeric: true,
    },
    {
      key: "support",
      header: "Support",
      cell: (r) => (
        <span className={cn("font-medium tabular-nums", r.support > 5 ? "text-amber-600" : "")}>{r.support}</span>
      ),
      sortValue: (r) => r.support,
      numeric: true,
    },
    {
      key: "total",
      header: "Total",
      cell: (r) => (
        <Badge variant="outline" className={cn("font-bold tabular-nums", r.hasAlert ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : "")}>
          {r.total}
        </Badge>
      ),
      sortValue: (r) => r.total,
      numeric: true,
    },
    {
      key: "alert",
      header: "Status",
      cell: (r) =>
        r.hasAlert ? (
          <StatusBadge tone="warning"><AlertTriangle className="mr-1 h-3 w-3" /> Needs attention</StatusBadge>
        ) : (
          <StatusBadge tone="success">Healthy</StatusBadge>
        ),
      sortValue: (r) => (r.hasAlert ? 1 : 0),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <button
          onClick={() => navigate("tenant-detail", { id: r.tenant.id })}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open →
        </button>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Cross-Tenant Queues"
        description="Per-tenant queue overview — identify operational problems before the tenant complains."
        icon={Inbox}
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Total KYC Pending" value={totalKyc} icon={ShieldAlert} tone={totalKyc > 10 ? "warning" : "positive"} />
          <MetricCard label="Open Breaches" value={totalRisk} icon={AlertTriangle} tone={totalRisk > 5 ? "negative" : "positive"} />
          <MetricCard label="Pending Payouts" value={totalPayouts} icon={Wallet} tone={totalPayouts > 5 ? "warning" : "positive"} />
          <MetricCard label="Open Tickets" value={totalSupport} icon={Inbox} />
          <MetricCard label="Tenants with Alerts" value={alertCount} icon={Clock} tone={alertCount > 0 ? "warning" : "positive"} />
        </div>

        {alertCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {alertCount} tenant{alertCount === 1 ? "" : "s"} need attention — review the highlighted queue counts below.
            </p>
          </div>
        )}

        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.tenant.id}
          searchableText={(r) => `${r.tenant.name} ${r.tenant.plan} ${r.kyc} ${r.risk} ${r.payouts} ${r.support}`}
          searchPlaceholder="Search tenants…"
          pageSize={20}
          emptyTitle="No tenants"
          emptyDescription="Tenants will appear here once provisioned."
        />
      </PageContent>
    </Page>
  );
}
