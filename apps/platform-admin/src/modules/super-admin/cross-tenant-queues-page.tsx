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

import { useMemo, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { useTenants } from "@/lib/platform/tenant-store";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/platform/status";
import {
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
  RefreshCw,
} from "lucide-react";
import { LineSeries } from "@/components/platform/charts";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

function parseParams(params: Record<string, string>): { queue?: string } {
  return {
    queue: params.queue,
  };
}

interface QueueRow {
  tenant: TenantContext;
  kyc: number;
  risk: number;
  payouts: number;
  support: number;
  total: number;
  hasAlert: boolean;
  oldestAge: number | null;
  slaBreached: boolean;
}

export function CrossTenantQueuesPage() {
  const { navigate, router } = usePlatform();
  const tenants = useTenants();

  // Deep-link params — hub queue buttons + attention items pass
  // `?queue=<kyc|payouts|risk|support>` and optional `?tenant=<id>`.
  const { queue: queueParam } = useMemo(
    () => parseParams(router.params),
    [router.params],
  );
  const queueFilter = (["kyc", "risk", "payouts", "support"] as const).includes(
    queueParam as "kyc" | "risk" | "payouts" | "support",
  )
    ? queueParam
    : undefined;

  // Sync the filter back to the URL (§51) — clearing it drops the param.
  const setQueueFilter = (value: string | undefined) => {
    const next = { ...router.params };
    if (value && value !== "all") next.queue = value;
    else delete next.queue;
    navigate("cross-tenant-queues", next, { replace: true });
  };

  // URL sync on mount (two-sided ?queue= param)
  useEffect(() => {
    const params = router.params;
    if (params.queue) {
      setQueueFilter(params.queue);
    }
  }, [router.params]);

  // Async seam (frontend-first): queue roll-up resolves via the mock layer.
  // Key to tenants.length so new tenants appear after creation.
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
                const kyc = getTenantKyc(t.id).filter(
                  (k) => k.status === "pending" || k.status === "review",
                ).length;
                const risk = getTenantBreaches(t.id).filter(
                  (b) => b.status === "open",
                ).length;
                const payouts = getTenantPayouts(t.id).filter(
                  (p) => p.status === "pending",
                ).length;
                const support = getTenantTickets(t.id).filter(
                  (tk) => tk.status === "open",
                ).length;
                const total = kyc + risk + payouts + support;
                // Derive oldest item age and SLA breach status from timestamps
                const kycItems = getTenantKyc(t.id).filter(
                  (k) => k.status === "pending" || k.status === "review",
                );
                const riskItems = getTenantBreaches(t.id).filter(
                  (b) => b.status === "open",
                );
                const payoutItems = getTenantPayouts(t.id).filter(
                  (p) => p.status === "pending",
                );
                const supportItems = getTenantTickets(t.id).filter(
                  (tk) => tk.status === "open",
                );

                const oldestKyc =
                  kycItems.length > 0
                    ? Math.floor(
                        (Date.now() - new Date(kycItems[0].createdAt).getTime()) /
                          36e5,
                      ) // hours
                    : null;
                const oldestRisk =
                  riskItems.length > 0
                    ? Math.floor(
                        (Date.now() - new Date(riskItems[0].triggeredAt).getTime()) /
                          36e5,
                      ) // hours
                    : null;
                const oldestPayout =
                  payoutItems.length > 0
                    ? Math.floor(
                        (Date.now() - new Date(payoutItems[0].createdAt).getTime()) /
                          36e5,
                      ) // hours
                    : null;
                const oldestSupport =
                  supportItems.length > 0
                    ? Math.floor(
                        (Date.now() - new Date(supportItems[0].createdAt).getTime()) /
                          36e5,
                      ) // hours
                    : null;

                const oldestAge =
                  [oldestKyc, oldestRisk, oldestPayout, oldestSupport]
                    .filter((a): a is number => a != null)
                    .reduce((a, b) => Math.min(a, b), Infinity) ?? null;

                const slaWindows = { payouts: 24 }; // 24h payout SLA baseline
                const slaBreached =
                  oldestAge != null &&
                  oldestAge > slaWindows["payouts"]
                    ? true
                    : false;

                return {
                  tenant: t,
                  kyc,
                  risk,
                  payouts,
                  support,
                  total,
                  hasAlert: total > 5 || payouts > 2 || risk > 3,
                  oldestAge,
                  slaBreached,
                };
              })
              .sort((a, b) => b.total - a.total);
          })();
        },
        { delayMs: 450 },
      ),
    [tenants.length], // re-run when tenant roster changes (P0-1)
  );

  const totalKyc = rows.reduce((s, r) => s + r.kyc, 0);
  const totalRisk = rows.reduce((s, r) => s + r.risk, 0);
  const totalPayouts = rows.reduce((s, r) => s + r.payouts, 0);
  const totalSupport = rows.reduce((s, r) => s + r.support, 0);
  const alertCount = rows.filter((r) => r.hasAlert).length;

  // QUEUE_THRESHOLDS — one source of truth for all four threshold vocabularies (P2-1)
  const QUEUE_THRESHOLDS = {
    kycOverThreshold: 5,
    payoutsOverThreshold: 2,
    riskOverThreshold: 3,
  };

  // Trend analysis data — 30-day historical queue counts per tenant
  // Removed fabricated Math.sin/i*0.3 drift (P0-3). Charts replaced with aging/SLA columns.

  const cols: Column<QueueRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      sortValue: (r) => r.tenant.name,
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
      numeric: true,
      sortValue: (r) => r.kyc,
      cell: (r) => (
        <span className={cn(
          "font-mono tabular-nums",
          r.kyc > QUEUE_THRESHOLDS.kycOverThreshold && "text-amber-600",
        )}>
          {r.kyc}
        </span>
      ),
    },
    {
      key: "risk",
      header: "Risk",
      numeric: true,
      sortValue: (r) => r.risk,
      cell: (r) => (
        <span className={cn(
          "font-mono tabular-nums",
          r.risk > QUEUE_THRESHOLDS.riskOverThreshold && "text-amber-600",
        )}>
          {r.risk}
        </span>
      ),
    },
    {
      key: "payouts",
      header: "Payouts",
      numeric: true,
      sortValue: (r) => r.payouts,
      cell: (r) => (
        <span className={cn(
          "font-mono tabular-nums",
          r.payouts > QUEUE_THRESHOLDS.payoutsOverThreshold && "text-rose-600",
        )}>
          {r.payouts}
        </span>
      ),
    },
    {
      key: "support",
      header: "Support",
      numeric: true,
      sortValue: (r) => r.support,
      cell: (r) => <span className="font-mono tabular-nums">{r.support}</span>,
    },
    {
      key: "total",
      header: "Total",
      numeric: true,
      sortValue: (r) => r.total,
      cell: (r) => (
        <span className={cn(
          "font-mono tabular-nums font-medium",
          r.total > QUEUE_THRESHOLDS.kycOverThreshold && "text-rose-600",
        )}>
          {r.total}
        </span>
      ),
    },
    {
      key: "oldestAge",
      header: "Oldest",
      numeric: true,
      sortValue: (r) => r.oldestAge ?? Infinity,
      cell: (r) => {
        if (r.oldestAge == null) return <span>—</span>;
        const hrs = r.oldestAge;
        const label = hrs === 1 ? "1h" : `${hrs}h`;
        const tone = hrs > QUEUE_THRESHOLDS.payoutsOverThreshold ? "warning" : "default";
        return (
          <StatusBadge tone={tone} className="text-xs">
            {label}
          </StatusBadge>
        );
      },
    },
    {
      key: "slaBreached",
      header: "SLA",
      cell: (r) => {
        if (r.slaBreached) {
          return (
            <StatusBadge tone="danger" className="text-xs">
              <AlertTriangle className="h-3 w-3" /> Breached
            </StatusBadge>
          );
        }
        return <StatusBadge tone="success" className="text-xs">OK</StatusBadge>;
      },
    },
  ];

  // KPI emphasis based on selected queue filter
  const kpiToneOverrides = useMemo(() => {
    if (!queueFilter) return {};
    return {
      kyc: queueFilter === "kyc" ? "warning" : "default",
      risk: queueFilter === "risk" ? "warning" : "default",
      payouts: queueFilter === "payouts" ? "negative" : "default",
      support: queueFilter === "support" ? "default" : "default",
    };
  }, [queueFilter]);

  return (
    <Page>
      <PageHeader
        title="Cross-Tenant Queue Overview"
        description="Monitor KYC, risk, payout and support queues across all tenants. Sort by total to find the most backlogged tenants."
        icon={Inbox}
      />
      <PageContent>
        {/* Status chip row — ?queue= filter, mirrors system-health pattern */}
        {queueFilter ? (
          <div className="grid gap-2 sm:grid-cols-5 mb-4">
            <Button
              key="all"
              size="sm"
              variant={queueFilter === "all" ? "default" : "outline"}
              onClick={() => setQueueFilter("all")}
            >
              All
            </Button>
            <Button
              key="kyc"
              size="sm"
              variant={queueFilter === "kyc" ? "default" : "outline"}
              onClick={() => setQueueFilter("kyc")}
            >
              KYC
            </Button>
            <Button
              key="risk"
              size="sm"
              variant={queueFilter === "risk" ? "default" : "outline"}
              onClick={() => setQueueFilter("risk")}
            >
              Risk
            </Button>
            <Button
              key="payouts"
              size="sm"
              variant={queueFilter === "payouts" ? "default" : "outline"}
              onClick={() => setQueueFilter("payouts")}
            >
              Payouts
            </Button>
            <Button
              key="support"
              size="sm"
              variant={queueFilter === "support" ? "default" : "outline"}
              onClick={() => setQueueFilter("support")}
            >
              Support
            </Button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-5 mb-4">
            <Button
              key="all"
              size="sm"
              variant="default"
              onClick={() => setQueueFilter("all")}
            >
              All
            </Button>
            <Button
              key="kyc"
              size="sm"
              variant="outline"
              onClick={() => setQueueFilter("kyc")}
            >
              KYC
            </Button>
            <Button
              key="risk"
              size="sm"
              variant="outline"
              onClick={() => setQueueFilter("risk")}
            >
              Risk
            </Button>
            <Button
              key="payouts"
              size="sm"
              variant="outline"
              onClick={() => setQueueFilter("payouts")}
            >
              Payouts
            </Button>
            <Button
              key="support"
              size="sm"
              variant="outline"
              onClick={() => setQueueFilter("support")}
            >
              Support
            </Button>
          </div>
        )}

        {/* KPI row with filter-aware tone emphasis */}
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard
            label="KYC pending"
            value={totalKyc}
            icon={Inbox}
            tone={kpiToneOverrides.kyc}
          />
          <MetricCard
            label="Risk open"
            value={totalRisk}
            icon={ShieldAlert}
            tone={kpiToneOverrides.risk}
          />
          <MetricCard
            label="Payouts pending"
            value={totalPayouts}
            icon={Wallet}
            tone={kpiToneOverrides.payouts}
          />
          <MetricCard
            label="Support open"
            value={totalSupport}
            icon={AlertTriangle}
          />
        </div>

        <Card>
          <CardContent className="pt-0">
            <DataTable
              columns={cols}
              data={rows.filter((r) => queueFilter ? r.tenant.plan === queueFilter || queueFilter === "all" : true)}
              rowKey={(r) => r.tenant.id}
              pageSize={10}
              searchableText={(r) => r.tenant.name}
              onRowClick={(row) =>
                navigate("tenant-detail", { id: row.tenant.id })
              }
            />
          </CardContent>
        </Card>

        {/* Aging & SLA columns replace fabricated trend charts (P0-3) */}
        {rows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <AlertTriangle
                className="h-12 w-12 text-rose-500/50 mx-auto"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground text-center">
                No tenants yet — provision one from Tenants → Create
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Aging & SLA</CardTitle>
            <CardDescription>
              Oldest pending item age per tenant; SLA breach markers for payouts &gt;24h
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {rows.map((r) => {
                const oldest = r.oldestAge;
                if (oldest == null) return null;
                return (
                  <div
                    key={r.tenant.id}
                    className="rounded-lg border p-3 text-xs"
                  >
                    <span className="font-medium text-foreground">
                      {r.tenant.name}</span>
                    <div className="mt-1">
                      <StatusBadge
                        tone={oldest > QUEUE_THRESHOLDS.payoutsOverThreshold ? "danger" : "default"}
                        className="text-amber-600"
                      >
                        {oldest}h oldest
                      </StatusBadge>
                    </div>
                    {r.slaBreached && (
                      <StatusBadge tone="danger" className="text-green-600">
                        <AlertTriangle className="h-2 w-2" /> SLA
                      </StatusBadge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Tenant degradation signals</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              {`${alertCount} tenant${alertCount === 1 ? "" : "s"} flagged with queue totals >${QUEUE_THRESHOLDS.kycOverThreshold} or payout backlog >${QUEUE_THRESHOLDS.payoutsOverThreshold} or risk >${QUEUE_THRESHOLDS.riskOverThreshold}`}
            </li>
            <li>
              Click a tenant row in the table to drill into tenant detail → risk / KYC / payouts tabs
            </li>
            <li>
              Queue data refreshes when the tenant roster changes
            </li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}