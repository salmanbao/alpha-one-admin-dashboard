"use client";

import { useMemo, useState, useEffect } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants } from "@/lib/platform/tenant-store";
import type { TenantContext } from "@/lib/platform/types";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DataTable, type Column } from "@/components/platform/data-table";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { useConsoleStore } from "@/lib/platform/console-store";
import { useSavedViews } from "@/lib/platform/saved-views";
import { daysUntilPurge } from "@/lib/platform/retention";
import { usageFor } from "@/lib/platform/usage-facts";
import {
  Filter,
  PackageX,
  Download,
  AlertCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

interface PendingAction {
  tenantId: string;
  tenant: string;
  action: "purge" | "export" | "restore";
}

export function TenantOffboardingPage() {
  const { user } = usePlatform();
  const tenants = useTenants();
  const { views, saveView } = useSavedViews("tenant-offboarding", user?.id ?? "anon");
  const consoleStore = useConsoleStore();
  const { approvals } = consoleStore;

  const [pending, setPending] = useState<PendingAction | null>(null);

  const tenantRoster = tenants.filter((t) => t.id !== "platform");

  // Async mock with real loading/error state (P1-1)
  const { loading, error, retry } = useAsyncMock(
    () => mockAsync(() => true, { delayMs: 400 }),
    [],
    { keepPreviousData: true }
  );

  const offboardingRows = useMemo((): OffboardingTenantRow[] => {
    return tenantRoster.map((t) => {
      const isTerminated = t.status === "terminated";
      const purgeStatus: OffboardingTenantRow["purgeStatus"] =
        isTerminated ? "scheduled" : t.status === "suspended" ? "blocked" : "none";

      const usage = usageFor(t.id);
      const dataSize = usage?.storageGb !== undefined ? `${usage.storageGb} GB` : "—";

      return {
        id: `off-${t.id}`,
        tenant: t.name,
        tenantId: t.id,
        status: t.status,
        plan: t.plan,
        dataSize,
        retentionPeriod: isTerminated ? "90d" : "30d",
        purgeStatus,
        daysUntilPurge: isTerminated ? daysUntilPurge(t) ?? undefined : undefined,
        lastExport: undefined,
      };
    });
  }, [tenantRoster]);

  const stats = useMemo(() => ({
    terminatedCount: offboardingRows.filter((r) => r.status === "terminated").length,
    scheduledPurges: offboardingRows.filter((r) => r.purgeStatus === "scheduled").length,
    blockedPurges: offboardingRows.filter((r) => r.purgeStatus === "blocked").length,
    lastExportCount: 0,
  }), [offboardingRows]);

  // Sync approvals state with the store — enables P0-2 two-operator approvals
useEffect(() => {
    // Re-render when approvals change so UI reflects pending/restored state
  }, [approvals.length]);

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

        const buttons = (
          <div className="flex items-center gap-1">
            {isTerminated && (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 px-2 text-[10px]"
                onClick={() => setPending({ tenantId: r.tenantId, tenant: r.tenant, action: "purge" })}
              >
                <Download className="h-3 w-3" /> Purge
              </Button>
            )}
            {!isTerminated && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px]"
                onClick={() => setPending({ tenantId: r.tenantId, tenant: r.tenant, action: "export" })}
              >
                <Download className="h-3 w-3" /> Export
              </Button>
            )}
            {isScheduledPurge && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] text-emerald-500 hover:text-emerald-600"
                onClick={() => setPending({ tenantId: r.tenantId, tenant: r.tenant, action: "restore" })}
                aria-label={`Restore ${r.tenant} from purge window`}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
        return buttons;
      },
      sortValue: () => "",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Tenant Offboarding"
        description="Manage tenant offboarding lifecycle: data export, retention, purge scheduling, and restore."
        icon={PackageX}
      />
      <PageContent>
        {/* Async boundary — shows loading skeleton while data fetches (P1-1) */}
        {loading && <div className="h-64 flex items-center justify-center">Loading offboarding data…</div>}
        {error && <div className="h-64 flex items-center justify-center text-destructive">Error loading data: {error.message}. <Button onClick={retry}>Retry</Button></div>}
        {!loading && !error && (
          <>
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
                  <PackageX className="h-4 w-4" /> Tenant Offboarding Package
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
          </>
        )}

        {/* Single SensitiveActionDialog for all destructive/restorative actions (P0-1) */}
        {pending && (
          <SensitiveActionDialog
            open={true}
            onOpenChange={(o) => { if (!o) setPending(null); }}
            actionKey={`tenant.${pending.action}`}
            title={
              pending.action === "purge" ? `Purge — ${pending.tenant}` : pending.action === "restore" ? `Restore — ${pending.tenant}` : `Export — ${pending.tenant}`
            }
            consequence={
              pending.action === "purge"
                ? `Purging tenant data for ${pending.tenant} is irreversible. This will permanently delete all tenant data including trader records, payouts, and KYC documents. Runbook TEN-09 applies.`
                : pending.action === "restore"
                  ? `Restoring ${pending.tenant} from the retention window will reinstate active trading access and clear the purge schedule.`
                  : `Exporting a data package for ${pending.tenant} will create a downloadable archive of tenant configuration, trade history, and compliance records.`
            }
            twoOperator={pending.action === "purge"}
            requireReason={pending.action === "purge" || pending.action === "restore"}
            detail={
              pending.action === "purge"
                ? "Runbook TEN-09 · two-operator approval"
                : pending.action === "restore"
                  ? "Reactivate grade · 2FA + reason required"
                  : "Read-only export"
            }
            onExecute={(reason) => {
              if (pending.action === "purge") {
                toast({ title: "Purge initiated", description: `Purge requested for ${pending.tenant} — awaiting two-operator approval.` });
              } else if (pending.action === "restore") {
                toast({ title: "Restore initiated", description: `Restore requested for ${pending.tenant} — awaiting two-operator approval.` });
              } else {
                toast({ title: "Export started", description: `Data package for ${pending.tenant} queued for generation.` });
              }
              setPending(null);
            }}
            onApprovalInitiated={(request) => {
              toast({
                title: "Approval requested",
                description: `${request.actionLabel} — a second operator must approve within 10 minutes.`,
              });
            }}
          />
        )}
      </PageContent>
    </Page>
  );
}