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
 * appropriate to the current status. Phase C (CON-06): destructive
 * actions route through SensitiveActionDialog — consequence + required
 * reason + 2FA, and Suspend/Terminate additionally require a second
 * operator's approval (10-min window, decided in the Approval Center)
 * before the status change applies.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
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
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import {
  markApprovalExecuted,
  recordAudit,
  useConsoleStore,
} from "@/lib/platform/console-store";
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
  Database,
} from "lucide-react";
import { hashStr } from "@/lib/platform/mock-data";

/* ------------------------------------------------------------------ */
/* Lifecycle stages                                                   */
/* ------------------------------------------------------------------ */

type LifecycleStage = "invited" | "trial" | "active" | "suspended" | "terminated";
type LifecycleAction = "suspend" | "reactivate" | "terminate";

interface PendingAction {
  tenant: TenantContext;
  action: LifecycleAction;
}

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
/* Suspension data handling (audit fix #7)                            */
/* ------------------------------------------------------------------ */

/** Retention window after suspension before data becomes purge-eligible. */
const RETENTION_DAYS = 90;

/**
 * What happens to a suspended tenant's data — the retention policy in
 * plain language plus a per-tenant status table (deterministic demo
 * figures from the tenant id). Answers the operational question the
 * lifecycle pipeline alone couldn't: "if we suspend, what happens to
 * their data and for how long is it recoverable?"
 */
function SuspensionDataHandlingPanel({ tenants }: { tenants: TenantContext[] }) {
  const suspended = tenants.filter((t) => t.status === "suspended");

  const policy: { label: string; value: string }[] = [
    { label: "Access", value: "Frozen — logins, purchases and payouts stop; console read-only" },
    { label: "Data retention", value: `${RETENTION_DAYS} days from suspension, then purge-eligible` },
    { label: "Backups", value: "Daily snapshots continue through the retention window" },
    { label: "Reactivation", value: "Full state restored instantly — nothing deleted while suspended" },
    { label: "Termination", value: "Ends retention early — data archived, restore requires platform ops" },
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Data handling on suspension</p>
          <Badge variant="outline" className="text-[10px]">{RETENTION_DAYS}-day retention</Badge>
        </div>
        <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          {policy.map((p) => (
            <div key={p.label} className="flex gap-2">
              <dt className="w-28 shrink-0 font-medium text-foreground">{p.label}</dt>
              <dd className="text-muted-foreground">{p.value}</dd>
            </div>
          ))}
        </dl>
        {suspended.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No suspended tenants — nothing currently in the retention window.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1.5 pr-4 font-medium">Tenant</th>
                  <th className="py-1.5 pr-4 font-medium">Traders</th>
                  <th className="py-1.5 pr-4 font-medium">Trade history</th>
                  <th className="py-1.5 pr-4 font-medium">Payout records</th>
                  <th className="py-1.5 pr-4 font-medium">Last backup</th>
                  <th className="py-1.5 font-medium">Purge-eligible</th>
                </tr>
              </thead>
              <tbody>
                {suspended.map((t) => {
                  const h = hashStr(t.id);
                  // Deterministic demo figures — stable per tenant.
                  const traders = 40 + (h % 320);
                  const trades = traders * (18 + (h % 40));
                  const payouts = 6 + (h % 40);
                  const hoursSinceBackup = 1 + (h % 9);
                  const purgeDate = new Date(Date.now() + RETENTION_DAYS * 86_400_000 - hoursSinceBackup * 3_600_000);
                  return (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-medium text-foreground">{t.name}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{traders}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{trades.toLocaleString("en-US")}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{payouts}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{hoursSinceBackup}h ago</td>
                      <td className="py-1.5 text-muted-foreground">
                        {purgeDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function TenantLifecyclePage() {
  const { availableTenants, setTenant, navigate, pushNotification, user } = usePlatform();
  const [activeFilter, setActiveFilter] = useState<LifecycleStage | "all">("all");
  const [pending, setPending] = useState<PendingAction | null>(null);

  // Async seam (frontend-first): roster hydration resolves via the mock
  // layer; `availableTenants` itself stays reactive (runtime-created
  // tenants appear without a refetch).
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);

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

  /* ---- Apply status change (with audit trail) ---- */
  const applyStatus = (
    tenant: TenantContext,
    status: TenantContext["status"],
    verb: string,
    reason: string,
    approver?: string,
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
    recordAudit({
      actor: approver ?? user.name,
      action: approver ? "console.escalation_approved" : "console.operator_action",
      target: `tenant.${status}`,
      tenantId: tenant.id,
      severity: status === "active" ? "info" : "critical",
      detail: approver
        ? `${verb} ${tenant.name} (two-operator approval satisfied; initiated by ${user.name})`
        : `${verb} ${tenant.name} (2FA verified) — reason: ${reason}`,
    });
    toast({
      title: `Tenant ${verb}`,
      description: `${tenant.name} is now ${status}.${approver ? ` Approved by ${approver}.` : " Recorded in the audit trail."}`,
    });
  };

  /* ---- Two-operator closure (CON-06): apply approved tenant actions ---- */
  const consoleStore = useConsoleStore();
  const appliedApprovals = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of consoleStore.approvals) {
      if (!a.actionKey.startsWith("tenant.")) continue;
      if (a.status !== "approved" && a.status !== "executed") continue;
      if (appliedApprovals.current.has(a.id)) continue;
      const tenant = availableTenants.find((t) => t.id === a.tenantId);
      if (!tenant) continue;
      appliedApprovals.current.add(a.id);
      const status: TenantContext["status"] = a.actionKey.includes("suspend")
        ? "suspended"
        : a.actionKey.includes("terminate")
          ? "terminated"
          : "active";
      const verb =
        status === "suspended" ? "suspended" : status === "terminated" ? "terminated" : "reactivated";
      applyStatus(tenant, status, verb, "", a.approver?.name);
      markApprovalExecuted(a.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consoleStore.approvals, availableTenants]);

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
      header: "Actions",
      cell: (t) => (
        <RowActions
          tenant={t}
          onAction={(action) => setPending({ tenant: t, action })}
          onView={() => navigate("tenant-detail", { id: t.id })}
        />
      ),
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
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading tenants…"
        >
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

        {/* Suspension data handling (audit fix #7) — retention policy +
            per-tenant status of everything frozen under suspension. */}
        <SuspensionDataHandlingPanel tenants={tenants} />
        </PageAsyncBoundary>
      </PageContent>

      {/* ── Sensitive lifecycle action (one dialog for all rows) ── */}
      <SensitiveActionDialog
        open={pending !== null}
        onOpenChange={(o) => { if (!o) setPending(null); }}
        actionKey={`tenant.${pending?.action ?? "unknown"}`}
        title={
          pending
            ? `${pending.action === "suspend" ? "Suspend" : pending.action === "terminate" ? "Terminate" : "Reactivate"} ${pending.tenant.name}`
            : ""
        }
        consequence={
          pending?.action === "suspend"
            ? `Suspending ${pending.tenant.name} takes effect once approved: trader logins, purchases, and payouts stop; admins retain console access. Reversible.`
            : pending?.action === "terminate"
              ? `Terminating ${pending.tenant.name} is irreversible from this console: all data is archived and platform access ends.`
              : pending
                ? `Reactivating ${pending.tenant.name} restores trading, purchases, and payouts immediately.`
                : ""
        }
        blastRadius={
          pending?.action === "suspend"
            ? [
                "Traders lose console access; open positions can't be closed manually",
                "Payout queue freezes until reactivation",
                "Admins retain access for suspended-state management",
              ]
            : pending?.action === "terminate"
              ? [
                  "All traders permanently lose access",
                  "Accounts closed out; payouts voided",
                  "Data archived — recovery needs a platform-level restore",
                ]
              : pending
                ? ["Trading, purchases, and payouts resume", "Suspension restrictions lift"]
                : undefined
        }
        confirmPhrase={pending?.action === "terminate" ? pending.tenant.name : undefined}
        twoOperator={pending?.action !== "reactivate"}
        requireReason
        tenantId={pending?.tenant.id}
        detail={
          pending?.action === "terminate"
            ? "Runbook TEN-09 · two-operator approval"
            : pending?.action === "suspend"
              ? "Runbook TEN-04 · two-operator approval"
              : "Recovery action · 2FA only"
        }
        onExecute={(reason) => {
          if (!pending) return;
          const verb =
            pending.action === "suspend" ? "suspended" : pending.action === "terminate" ? "terminated" : "reactivated";
          const status: TenantContext["status"] =
            pending.action === "suspend" ? "suspended" : pending.action === "terminate" ? "terminated" : "active";
          applyStatus(pending.tenant, status, verb, reason);
        }}
        onApprovalInitiated={(request) => {
          setPending(null);
          toast({
            title: "Approval requested",
            description: `${request.actionLabel} — a second operator must approve within 10 minutes.`,
          });
        }}
      />
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Row actions (suspend / reactivate / terminate)                     */
/* ------------------------------------------------------------------ */

function RowActions({
  tenant,
  onAction,
  onView,
}: {
  tenant: TenantContext;
  onAction: (action: LifecycleAction) => void;
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
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-amber-600 hover:text-amber-700"
          onClick={(e) => {
            e.stopPropagation();
            onAction("suspend");
          }}
        >
          <Pause className="h-3 w-3" />Suspend
        </Button>
      ) : null}

      {isSuspended ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
          onClick={(e) => {
            e.stopPropagation();
            onAction("reactivate");
          }}
        >
          <Play className="h-3 w-3" />Reactivate
        </Button>
      ) : null}

      {!isTerminated ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onAction("terminate");
          }}
        >
          <Ban className="h-3 w-3" />Terminate
        </Button>
      ) : null}
    </div>
  );
}
