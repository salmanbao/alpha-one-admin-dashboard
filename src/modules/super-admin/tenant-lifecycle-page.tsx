"use client";

/**
 * Tenant Lifecycle Page — pipeline visualization of tenant states.
 *
 * Spec §6, §17. Shows the tenant lifecycle as a horizontal pipeline:
 *
 *   Invited → Trial → Active → Suspended → Terminated
 *
 * Each stage card shows count + tenant names + color-coded badge. Clicking
 * a stage filters the table below by that stage. The table includes a
 * lifecycle-action button per row (Suspend / Reactivate / Terminate)
 * appropriate to the current status. Destructive actions use AlertDialog
 * with explicit consequence text (§24).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import type { TenantContext } from "@/lib/platform/types";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Building2,
  Mail,
  Clock,
  CheckCircle2,
  Pause,
  Ban,
  Play,
  ArrowRight,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Lifecycle stages                                                   */
/* ------------------------------------------------------------------ */

type LifecycleStage = "invited" | "trial" | "active" | "suspended" | "terminated";

const STAGES: {
  id: LifecycleStage;
  label: string;
  tone: "info" | "warning" | "success" | "danger" | "muted";
  color: string;
  icon: typeof Mail;
  description: string;
}[] = [
  { id: "invited", label: "Invited", tone: "info", color: "#0d9488", icon: Mail, description: "Invitation sent, awaiting first login." },
  { id: "trial", label: "Trial", tone: "warning", color: "#d97706", icon: Clock, description: "Active trial — limited features." },
  { id: "active", label: "Active", tone: "success", color: "#059669", icon: CheckCircle2, description: "Full platform access, billed normally." },
  { id: "suspended", label: "Suspended", tone: "danger", color: "#e11d48", icon: Pause, description: "Access paused — reversible." },
  { id: "terminated", label: "Terminated", tone: "muted", color: "#6b7280", icon: Ban, description: "Permanently archived — irreversible." },
];

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function TenantLifecyclePage() {
  const { availableTenants, setTenant, navigate, pushNotification } = usePlatform();
  const [activeFilter, setActiveFilter] = useState<LifecycleStage | "all">("all");

  const tenants = availableTenants.filter((t) => t.id !== "platform");

  /* ---- Bucket tenants into lifecycle stages ---- */
  const buckets = useMemo(() => {
    const map: Record<LifecycleStage, TenantContext[]> = {
      invited: [],
      trial: [],
      active: [],
      suspended: [],
      terminated: [],
    };
    for (const t of tenants) {
      const stage = (t.status as LifecycleStage) ?? "active";
      if (map[stage]) map[stage].push(t);
    }
    return map;
  }, [tenants]);

  const filteredTenants =
    activeFilter === "all" ? tenants : (buckets[activeFilter] ?? []);

  /* ---- Apply status change ---- */
  const applyStatus = (
    tenant: TenantContext,
    status: TenantContext["status"],
    verb: string,
  ) => {
    const updated: TenantContext = { ...tenant, status };
    setTenant(updated);
    pushNotification({
      title: `Tenant ${verb}`,
      message: `${tenant.name} is now ${status}.`,
      severity:
        status === "suspended" || status === "terminated" ? "warning" : "success",
      module: "super-admin",
    });
    toast({
      title: `Tenant ${verb}`,
      description: `${tenant.name} is now ${status}.`,
    });
  };

  /* ---- Table columns ---- */
  const columns: Column<TenantContext>[] = [
    {
      key: "name",
      header: "Tenant",
      cell: (t) => (
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
            style={{ background: t.branding.primaryColor }}
          >
            {t.branding.initials}
          </span>
          <div>
            <p className="font-medium text-foreground">{t.name}</p>
            <p className="text-[10px] text-muted-foreground">{t.branding.tagline}</p>
          </div>
        </div>
      ),
      sortValue: (t) => t.name,
    },
    {
      key: "stage",
      header: "Lifecycle stage",
      cell: (t) => {
        const stage = STAGES.find((s) => s.id === t.status);
        if (!stage) return <StatusBadge tone="muted">{t.status}</StatusBadge>;
        const StageIcon = stage.icon;
        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium"
            style={{ color: stage.color, borderColor: `${stage.color}40`, background: `${stage.color}10` }}
          >
            <StageIcon className="h-3 w-3" /> {stage.label}
          </span>
        );
      },
      sortValue: (t) => t.status,
    },
    {
      key: "plan",
      header: "Plan",
      cell: (t) => <Badge variant="outline" className="text-[10px] capitalize">{t.plan}</Badge>,
      sortValue: (t) => t.plan,
    },
    {
      key: "modules",
      header: "Modules",
      cell: (t) => <span className="text-sm">{t.enabledModules.length}</span>,
      sortValue: (t) => t.enabledModules.length,
      numeric: true,
    },
    {
      key: "created",
      header: "Created",
      cell: (t) => <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</span>,
      sortValue: (t) => t.createdAt,
    },
    {
      key: "actions",
      header: "",
      cell: (t) => <RowActions tenant={t} onApply={applyStatus} onView={() => navigate("tenant-detail", { id: t.id })} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Tenant Lifecycle"
        description="Pipeline of tenants across lifecycle stages."
        icon={Building2}
        actions={
          <Select
            value={activeFilter}
            onValueChange={(v) => setActiveFilter(v as LifecycleStage | "all")}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label} ({buckets[s.id].length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <PageContent>
        {/* KPI row summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {STAGES.map((s) => {
            const StageIcon = s.icon;
            return (
              <MetricCard
                key={s.id}
                label={s.label}
                value={buckets[s.id].length}
                icon={StageIcon}
                tone={
                  s.tone === "success"
                    ? "positive"
                    : s.tone === "danger"
                      ? "negative"
                      : s.tone === "warning"
                        ? "warning"
                        : "default"
                }
              />
            );
          })}
        </div>

        {/* Lifecycle pipeline */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Lifecycle pipeline</p>
          <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
            {STAGES.map((s, i) => {
              const StageIcon = s.icon;
              const list = buckets[s.id];
              const isSelected = activeFilter === s.id;
              return (
                <div key={s.id} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveFilter((curr) =>
                        curr === s.id ? "all" : s.id,
                      )
                    }
                    className={cn(
                      "flex-1 rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                      isSelected
                        ? "ring-2 ring-primary/40 bg-primary/5"
                        : "hover:border-primary/30",
                    )}
                    style={{ borderColor: isSelected ? s.color : undefined }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="rounded-md p-1.5" style={{ background: `${s.color}1a`, color: s.color }}>
                        <StageIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold" style={{ color: s.color }}>
                            {s.label}
                          </p>
                          <span className="text-lg font-bold tabular-nums">{list.length}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{s.description}</p>
                      </div>
                    </div>
                    {/* Tenant names in this stage */}
                    <div className="mt-2 space-y-1">
                      {list.length === 0 ? (
                        <p className="text-[10px] italic text-muted-foreground">No tenants</p>
                      ) : (
                        list.slice(0, 4).map((t) => (
                          <div key={t.id} className="flex items-center gap-1.5">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: t.branding.primaryColor }}
                            />
                            <span className="truncate text-[11px] text-foreground">{t.name}</span>
                          </div>
                        ))
                      )}
                      {list.length > 4 ? (
                        <p className="text-[10px] text-muted-foreground">+ {list.length - 4} more</p>
                      ) : null}
                    </div>
                  </button>
                  {i < STAGES.length - 1 ? (
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block" />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tenants table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {activeFilter === "all"
                ? `All tenants (${filteredTenants.length})`
                : `Filtered by: ${activeFilter} (${filteredTenants.length})`}
            </p>
            {activeFilter !== "all" ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setActiveFilter("all")}
              >
                Clear filter
              </Button>
            ) : null}
          </div>
          <DataTable
            columns={columns}
            data={filteredTenants}
            rowKey={(t) => t.id}
            onRowClick={(t) => navigate("tenant-detail", { id: t.id })}
            searchableText={(t) => `${t.name} ${t.slug} ${t.plan} ${t.status}`}
            searchPlaceholder="Search tenants…"
            emptyTitle="No tenants in this stage"
            emptyDescription="Try a different lifecycle stage or clear the filter."
          />
        </div>

        {/* Help card */}
        <Card className="bg-muted/20">
          <CardContent className="flex items-start gap-3 pt-6 text-xs text-muted-foreground">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">How lifecycle works</p>
              <p className="mt-1">
                Tenants progress through five stages. <strong>Invited</strong> means an invitation
                is pending first login. <strong>Trial</strong> is a limited-feature active state.
                <strong> Active</strong> is full access with normal billing. <strong>Suspended</strong>{" "}
                pauses access (reversible). <strong>Terminated</strong> permanently archives the
                tenant. Click any pipeline stage above to filter the table.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Row actions (suspend / reactivate / terminate)                     */
/* ------------------------------------------------------------------ */

function RowActions({
  tenant,
  onApply,
  onView,
}: {
  tenant: TenantContext;
  onApply: (t: TenantContext, status: TenantContext["status"], verb: string) => void;
  onView: () => void;
}) {
  const isActive = tenant.status === "active" || tenant.status === "trial";
  const isSuspended = tenant.status === "suspended";
  const isTerminated = tenant.status === "terminated";

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          onView();
        }}
      >
        View
      </Button>

      {isActive ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-amber-600 hover:text-amber-700"
              onClick={(e) => e.stopPropagation()}
            >
              <Pause className="h-3 w-3" />Suspend
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Suspend {tenant.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                The tenant will lose platform access immediately. Trader logins and
                payout processing are paused. This is reversible — reactivate at any time.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={cn("bg-amber-600 text-white hover:bg-amber-700")}
                onClick={() => onApply(tenant, "suspended", "suspended")}
              >
                Suspend tenant
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {isSuspended ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
          onClick={(e) => {
            e.stopPropagation();
            onApply(tenant, "active", "reactivated");
          }}
        >
          <Play className="h-3 w-3" />Reactivate
        </Button>
      ) : null}

      {!isTerminated ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
              onClick={(e) => e.stopPropagation()}
            >
              <Ban className="h-3 w-3" />Terminate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Terminate {tenant.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                All trader data, accounts, payouts, and audit logs for this tenant will be
                permanently archived. The tenant will lose all platform access immediately.
                This action cannot be reversed from the standard admin UI.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={cn("bg-destructive text-white hover:bg-destructive/90")}
                onClick={() => onApply(tenant, "terminated", "terminated")}
              >
                Terminate tenant
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
