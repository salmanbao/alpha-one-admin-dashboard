"use client";

/**
 * Tenant Offboarding Page — export, retention, purge, restore per tenant.
 *
 * Stitch screen: (new)
 * Tier 3 — Offboarding lifecycle with data export, retention period
 * configuration, purge scheduling, and restore capability.
 */

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants } from "@/lib/platform/tenant-store";
import type { TenantContext } from "@/lib/platform/types";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency } from "@/components/platform/status";
import {
  Package,
  Trash2,
  RotateCcw,
  Download,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Users,
  AlertCircle,
  EyeOff,
  Zap,
  Filter,
} from "lucide-react";
import { useSavedViews } from "@/lib/platform/saved-views";
import { recordAudit } from "@/lib/platform/console-store";
import { toast } from "@/hooks/use-toast";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";

interface OffboardingTenantRow {
  id: string;
  tenant: string;
  tenantId: string;
  status: TenantContext["status"];
  plan: TenantContext["plan"];
  dataSize: string;
  retentionPeriod: string;
  purgeStatus: "none" | "scheduled" | "completed" | "blocked";
  daysUntilPurge?: number;
  lastExport?: string;
}

const RETENTION_PERIODS: { label: string; value: string; days: number }[] = [
  { label: "30 days", value: "30d", days: 30 },
  { label: "90 days", value: "90d", days: 90 },
  { label: "1 year", value: "1y", days: 365 },
  { label: "2 years", value: "2y", days: 730 },
  { label: "Indefinite", value: "indefinite", days: 0 },
];

export function TenantOffboardingPage() {
  const { user } = usePlatform();
  const tenants = useTenants();
  const { views, saveView } = useSavedViews("tenant-offboarding", user?.id ?? "anon");

  const tenantRoster = tenants.filter((t) => t.id !== "platform");

  const offboardingRows = useMemo((): OffboardingTenantRow[] => {
    return tenantRoster.map((t) => {
      const isTerminated = t.status === "terminated";
      const purgeStatus: OffboardingTenantRow["purgeStatus"] =
        isTerminated ? "scheduled" : t.status === "suspended" ? "blocked" : "none";

      return {
        id: `off-${t.id}`,
        tenant: t.name,
        tenantId: t.id,
        status: t.status,
        plan: t.plan,
        dataSize: `${t.enabledModules.length * 12} GB`,
        retentionPeriod: isTerminated ? "90d" : "30d",
        purgeStatus,
        daysUntilPurge: isTerminated ? 45 : undefined,
        lastExport: isTerminated ? new Date(Date.now() - 2 * 86400000).toISOString() : undefined,
      };
    });
  }, [tenantRoster]);

  const stats = useMemo(() => ({
    terminatedCount: offboardingRows.filter((r) => r.status === "terminated").length,
    scheduledPurges: offboardingRows.filter((r) => r.purgeStatus === "scheduled").length,
    blockedPurges: offboardingRows.filter((r) => r.purgeStatus === "blocked").length,
    lastExportCount: offboardingRows.filter((r) => r.lastExport).length,
  }), [offboardingRows]);

  const columns: Column<OffboardingTenantRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs font-medium text-muted-foreground">{r.tenant[0]}</span>
          </div>
          <span className="font-medium">{r.tenant}</span>
        </div>
      ),
      sortValue: (r) => r.tenant,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge variant={r.status === "terminated" ? "destructive" : "outline"}>{r.status}</Badge>,
      sortValue: (r) => r.status,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (r) => <span className="text-xs text-muted-foreground">{r.plan}</span>,
      sortValue: (r) => r.plan,
    },
    {
      key: "dataSize",
      header: "Data Size",
      cell: (r) => <span className="text-sm">{r.dataSize}</span>,
      sortValue: (r) => r.dataSize,
    },
    {
      key: "retentionPeriod",
      header: "Retention",
      cell: (r) => <Badge variant="outline" className="text-[10px]">{r.retentionPeriod}</Badge>,
      sortValue: (r) => r.retentionPeriod,
    },
    {
      key: "purgeStatus",
      header: "Purge Status",
      cell: (r) => (
        <Badge
          variant={
            r.purgeStatus === "scheduled" ? "secondary" :
            r.purgeStatus === "completed" ? "outline" :
            r.purgeStatus === "blocked" ? "destructive" :
            "default"
          }
        >{r.purgeStatus}</Badge>
      ),
      sortValue: (r) => r.purgeStatus,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => {
        const isTerminated = r.status === "terminated";
        const isScheduledPurge = r.purgeStatus === "scheduled";

        return (
          <div className="flex items-center gap-1">
            {isTerminated ? (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-[10px]"
                onClick={() => handlePurge(r.tenantId, r.tenant)}
              >
                <Trash2 className="h-3 w-3" /> Purge
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px]"
                onClick={() => handleExport(r.tenantId, r.tenant)}
              >
                <Download className="h-3 w-3" /> Export
              </Button>
            )}
            {isScheduledPurge && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] text-emerald-500 hover:text-emerald-600"
                onClick={() => handleRestore(r.tenantId, r.tenant)}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      },
      sortValue: () => "",
    },
  ];

  const handleExport = (tenantId: string, tenantName: string) => {
    recordAudit({
      actor: user.name,
      action: "tenant.export",
      target: tenantName,
      tenantId,
      severity: "info",
      detail: "Exporting tenant data package for offboarding review",
    });
    toast({ title: "Export started", description: `Data package for ${tenantName} queued for generation.` });
  };

  const handlePurge = (tenantId: string, tenantName: string) => {
    recordAudit({
      actor: user.name,
      action: "tenant.purge",
      target: tenantName,
      tenantId,
      severity: "critical",
      detail: "Purging tenant data — irreversible data deletion",
    });
    toast({ title: "Purge initiated", description: `Purge scheduled for ${tenantName}. This cannot be undone.` });
  };

  const handleRestore = (tenantId: string, tenantName: string) => {
    recordAudit({
      actor: user.name,
      action: "tenant.restore",
      target: tenantName,
      tenantId,
      severity: "warning",
      detail: "Restoring tenant from retention window",
    });
    toast({ title: "Restore initiated", description: `Restore requested for ${tenantName} — pending approval.` });
  };

  return (
    <Page>
      <PageHeader
        title="Tenant Offboarding"
        description="Manage tenant offboarding lifecycle: data export, retention, purge scheduling, and restore."
        icon={Package}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={false}
          error={undefined}
          onRetry={() => {}}
          hasData={true}
          loadingLabel="Loading offboarding data…"
        >
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Terminated Tenants" value={stats.terminatedCount} icon={AlertCircle} tone="negative" />
            <MetricCard label="Scheduled Purges" value={stats.scheduledPurges} icon={Clock} tone="warning" />
            <MetricCard label="Blocked Purges" value={stats.blockedPurges} icon={AlertTriangle} tone="warning" />
            <MetricCard label="Recent Exports" value={stats.lastExportCount} icon={Download} />
          </div>

          {/* Tenant Offboarding Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" /> Tenant Offboarding Package
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs"
                  onClick={() => {
                    const name = window.prompt("Name this view:", `View ${views.length + 1}`);
                    if (!name) return;
                    saveView(name, { status: "all", purge: "all" });
                  }}
                >
                  <Filter className="h-3 w-3" /> Views
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={offboardingRows}
                rowKey={(r) => r.id}
                searchableText={(r) => `${r.tenant} ${r.status} ${r.plan} ${r.purgeStatus}`}
                searchPlaceholder="Search tenants…"
                emptyTitle="No tenants in offboarding state"
                emptyDescription="No tenants require offboarding at this time."
                pageSize={10}
              />
            </CardContent>
          </Card>

          {/* Retention Policy Info */}
          <Card className="mt-4 bg-muted/50 border border-muted/30">
            <CardContent className="p-4">
              <h3 className="text-sm font-medium mb-2">Retention Policy</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {RETENTION_PERIODS.map((p) => (
                  <div key={p.value} className="rounded bg-background border p-3">
                    <span className="text-xs font-medium text-muted-foreground">{p.label}</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs">{p.days > 0 ? `${p.days} days` : p.label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-2" />
              <p className="text-xs text-muted-foreground">
                Terminated tenants remain in the retention window for 90 days before
                automatic purge. Purge actions are audit-logged and irreversible.
                Restores require two-operator approval.
              </p>
            </CardContent>
          </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}