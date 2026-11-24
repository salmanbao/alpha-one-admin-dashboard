"use client";

/**
 * Tenant Lifecycle Page — pipeline visualization of tenant states.
 *
 * Spec §6, §17. Shows the tenant lifecycle as a horizontal pipeline:
 *
 *   Invited → Trial → Active → Suspended → Terminated
 *
 * Each stage card shows count + tenant names + color-coded badge. Clicking
 * a stage filters the table below by that stage. Above the stage cards sit
 * two derived views (finding #2): a proportional distribution bar (share
 * per stage — no mental mapping between states and counts) and bottleneck
 * callouts that flag operational hot spots (suspended buildup, elevated
 * terminations, stalling invitations, trial backlog) with a one-click
 * Focus filter. The table includes a
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
import { useSearchParams } from "next/navigation";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { useTenants, updateTenant } from "@/lib/platform/tenant-store";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  markApprovalExecuted,
  recordAudit,
  useConsoleStore,
} from "@/lib/platform/console-store";
import { runLifecycleCascade, formatCascadeSummary } from "@/lib/platform/lifecycle-cascade";
import {
  useProvisioningStore,
  isStaleProvisioning,
  isLiveJob,
  reattachProvisioning,
  deleteProvisioningDraft,
  resumeJob,
} from "@/lib/platform/provisioning-saga";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useSavedViews } from "@/lib/platform/saved-views";
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
  ShieldAlert,
  AlertTriangle,
  FileText,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Upload,
  AlertCircle,
  Undo2,
  Bookmark,
  Redo,
} from "lucide-react";
import { hashStr } from "@/lib/platform/mock-data";
import { healthOf, tenantHealthScore, type Health } from "@/lib/platform/tenant-health";
import { formatCurrencyValue } from "@pfaas/platform-core";

/* ------------------------------------------------------------------ */
/* Lifecycle stages                                                   */
/* ------------------------------------------------------------------ */

type LifecycleStage = "invited" | "trial" | "active" | "suspended" | "terminated" | "onboarding" | "provisioning" | "provisioning_failed" | "rolled_back";
type LifecycleAction = "suspend" | "reactivate" | "terminate" | "convert" | "expire" | "start_trial" | "resend_invite";

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
  { id: "onboarding", label: "Onboarding", tone: "warning", color: "#d97706", icon: Clock, description: "Tenant mid-provisioning from the create wizard." },
  { id: "provisioning", label: "Provisioning", tone: "warning", color: "#d97706", icon: Upload, description: "Tenant being provisioned — resources being allocated." },
  { id: "provisioning_failed", label: "Provisioning Failed", tone: "danger", color: "#e11d48", icon: AlertCircle, description: "Tenant provisioning was rolled back or failed." },
  { id: "rolled_back", label: "Rolled Back", tone: "warning", color: "#d97706", icon: Undo2, description: "Provisioning saga compensated — restart or delete the draft." },
];

/* ------------------------------------------------------------------ */
/* Tenant health — imported from lib/platform/tenant-health so the     */
/* lifecycle list, the Tenant Health dashboard and tenant detail all   */
/* read the same band + numeric score (audit V #7) and can never       */
/* disagree.                                                           */
/* ------------------------------------------------------------------ */

const HEALTH_META: Record<
  Health,
  { label: string; variant: "default" | "secondary" | "destructive"; dot: string; tooltip: string }
> = {
  healthy: {
    label: "Healthy",
    variant: "default",
    dot: "bg-emerald-500",
    tooltip: "Healthy — active tenant with a full module footprint.",
  },
  watch: {
    label: "Watch",
    variant: "secondary",
    dot: "bg-amber-500",
    tooltip: "Watch — early lifecycle stage or low module adoption.",
  },
  critical: {
    label: "Needs attention",
    variant: "destructive",
    dot: "bg-rose-500",
    tooltip: "Needs attention — suspended, terminated, or failed provisioning.",
  },
};


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
                  <th className="py-1.5 font-medium">Retention</th>
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
                  const suspendedDays = t.suspendedAt ? Math.ceil((new Date().getTime() - new Date(t.suspendedAt).getTime()) / 86_400_000) : 0;
                  const daysUntilPurge = RETENTION_DAYS - suspendedDays;
                  const purgeDate = new Date(Date.now() + (daysUntilPurge * 86_400_000) - hoursSinceBackup * 3_600_000);
                  return (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="py-1.5 pr-4 font-medium text-foreground">{t.name}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{traders}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{trades.toLocaleString("en-US")}</td>
                      <td className="py-1.5 pr-4 tabular-nums">{payouts}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{hoursSinceBackup}h ago</td>
                      <td className="py-1.5 text-center">
                      <td className="py-1.5 text-muted-foreground">
                        <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, 100 - daysUntilPurge))}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground block">{Math.max(0, Math.min(100, 100 - daysUntilPurge))}%</span>
                      </td>
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
  const tenants = useTenants();
  const { tenant: platformTenant, pushNotification, user, navigate } = usePlatform();
  const searchParams = useSearchParams();
  const urlStage = searchParams.get("stage") as LifecycleStage | undefined;
  const [activeFilter, setActiveFilter] = useState<LifecycleStage | "all">(
    urlStage ?? "all",
  );
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

  const tenantRoster = tenants.filter((t) => t.id !== "platform");
  const { views, saveView, deleteView, renameView, applyView } = useSavedViews("tenant-lifecycle", user?.id ?? "anon");
  const [viewName, setViewName] = useState("");
  const [editingViewId, setEditingViewId] = useState<string | null>(null);

  /* ---- Bucket tenants into lifecycle stages ---- */
  const buckets = useMemo(() => {
    const map: Record<LifecycleStage, TenantContext[]> = {
      invited: [],
      trial: [],
      active: [],
      suspended: [],
      terminated: [],
      onboarding: [],
      provisioning: [],
      provisioning_failed: [],
      rolled_back: [],
    };
    for (const t of tenantRoster) {
      const stage = (t.status as LifecycleStage) ?? "active";
      if (map[stage]) map[stage].push(t);
    }
    return map;
  }, [tenantRoster]);

  const filteredTenants =
    activeFilter === "all" ? tenantRoster : (buckets[activeFilter] ?? []);

  /* ---- Distribution + bottleneck analysis (finding #2) ----
   * The stage cards show raw counts; these derive the two things the
   * pipeline previously made operators work out mentally: each stage's
   * proportional share, and operational hot spots (suspended buildup,
   * unusual terminations, stalling invitations, trial backlog). */
  const total = Object.values(buckets).reduce((sum, tenants) => sum + tenants.length, 0);
  const distribution = useMemo(
    () =>
      STAGES.map((s) => ({
        ...s,
        count: buckets[s.id].length,
      })).filter((s) => s.count > 0),
    [buckets],
  );
  const shareOf = (count: number) =>
    total > 0 ? Math.round((count / total) * 100) : 0;

  const bottlenecks = useMemo(() => {
    const n = (s: LifecycleStage) => buckets[s].length;
    const pctOf = (c: number) => (total > 0 ? Math.round((c / total) * 100) : 0);
    const out: { stage: LifecycleStage; title: string; detail: string }[] = [];
    const heavy = (c: number) => c >= 2 || (total >= 5 && c / total >= 0.2);

    if (heavy(n("suspended"))) {
      out.push({
        stage: "suspended",
        title: `Suspended buildup — ${n("suspended")} tenant${n("suspended") === 1 ? "" : "s"} held`,
        detail: `${pctOf(n("suspended"))}% of tenantRoster sit in the retention window — review for reactivation or schedule a purge.`,
      });
    }
    if (heavy(n("terminated"))) {
      out.push({
        stage: "terminated",
        title: `Elevated terminations — ${n("terminated")} archived`,
        detail: `${pctOf(n("terminated"))}% of the roster has churned — check exit reasons and whether trials convert before termination.`,
      });
    }
    if (heavy(n("invited"))) {
      out.push({
        stage: "invited",
        title: `Invitations stalling — ${n("invited")} awaiting first login`,
        detail: `${pctOf(n("invited"))}% of tenantRoster never started — send a reminder or review onboarding friction.`,
      });
    }
    if (n("trial") >= 2 && n("trial") >= n("active")) {
      out.push({
        stage: "trial",
        title: `Trial backlog — ${n("trial")} in trial vs ${n("active")} active`,
        detail: "Trials are not converting to active billing at the expected rate.",
      });
    }
    // P1-e: trials expiring within 7 days
    const expiringSoon = buckets.trial.filter((t) => t.trialEndsAt && new Date(t.trialEndsAt) <= new Date(Date.now() + 7 * 86_400_000)).length;
    if (expiringSoon > 0) {
      out.push({
        stage: "trial",
        title: `Trials expiring soon — ${expiringSoon} tenant${expiringSoon === 1 ? "" : "s"} within 7 days`,
        detail: "These trials will auto-expire to invited if not converted. Review and convert or extend.",
      });
    }
    return out;
  }, [buckets, total]);

  /* ---- TM-06: stale provisioning (orphaned tenants) ----
   * A tenant whose status claims an in-flight provisioning but has no
   * live saga behind it (the pre-persistence orphan). One-click
   * re-attach restarts the job; the stuck draft can be deleted. */
  const provisioningStore = useProvisioningStore();
  const staleProvisioning = useMemo(
    () => tenantRoster.filter((t) => isStaleProvisioning(t)),
    [tenantRoster, provisioningStore.jobs],
  );

  const reattachStale = (t: TenantContext) => {
    const job = reattachProvisioning({
      tenantId: t.id,
      tenantName: t.name,
      slug: t.slug,
      plan: t.plan,
      createdBy: user.name,
    });
    pushNotification({
      title: "Provisioning re-attached",
      message: `${t.name} — new saga ${job.id} is running from step 1.`,
      severity: "info",
      module: "super-admin",
    });
    toast({
      title: "Saga re-attached",
      description: `${t.name} is provisioning again — follow it on the live view.`,
    });
  };

  const resumeStuckJob = (t: TenantContext) => {
    const job = provisioningStore.jobs.find((j) => j.tenantId === t.id);
    if (!job || !resumeJob(job.id)) return;
    pushNotification({
      title: "Provisioning resumed",
      message: `${t.name} — saga ${job.id} continues from the failed step (idempotent retry).`,
      severity: "info",
      module: "super-admin",
    });
    toast({ title: "Job resumed", description: `${t.name} — retrying the blocked step.` });
  };

  const deleteStuckDraft = (t: TenantContext) => {
    if (!deleteProvisioningDraft(t.id, user.name)) return;
    pushNotification({
      title: "Provisioning draft deleted",
      message: `${t.name} — stuck draft removed with its saga jobs.`,
      severity: "warning",
      module: "super-admin",
    });
    toast({ title: "Draft deleted", description: `${t.name} and its saga jobs were removed.` });
  };

  /* TM-08 — trial lifecycle actions: convert / extend / expire.
   * Convert and expire route through SensitiveActionDialog with reason
   * capture; extend stays inline with a duration chooser. */
  const handleTrialAction = (t: TenantContext, action: "convert" | "extend" | "expire") => {
    if (action === "convert") {
      // Route Convert through SensitiveActionDialog (reactivate grade:
      // twoOperator={false}, requireReason, no confirmPhrase, warning severity).
      const now = new Date().toISOString();
      setPending({
        tenant: t,
        action: "reactivate" as const,
      });
    } else if (action === "extend") {
      // Extend trial by choosing duration: 7, 14, or 30 days.
      const durations = ["7d", "14d", "30d"];
      toast({
        title: "Extend trial",
        description: `Choose duration: ${durations.join(", ")}.`,
      });
      return;
    } else if (action === "expire") {
      // Expire trial now: route through SensitiveActionDialog with reactivate grade
      setPending({
        tenant: t,
        action: "expire" as const,
      });
    }
  };

  const extendTrial = (t: TenantContext, duration: string) => {
    const now = new Date().toISOString();
    let days = 14; // default
    if (duration === "7d") days = 7;
    if (duration === "30d") days = 30;
    const currentEnd = t.trialEndsAt ? new Date(t.trialEndsAt) : new Date();
    currentEnd.setDate(currentEnd.getDate() + days);
    const updated: TenantContext = {
      ...t,
      trialEndsAt: currentEnd.toISOString(),
      statusHistory: [...(t.statusHistory ?? []), { status: "trial", at: now, by: user.name, reason: `Trial extended by ${days} days` }],
    };
    updateTenant(t.id, updated);
    recordAudit({ actor: user.name, action: "console.operator_action", target: "tenant.extend_trial", tenantId: t.id, severity: "info", detail: `Extended trial for ${t.name} by ${days} days` });
    pushNotification({ title: "Trial extended", message: `${t.name} trial extended to ${currentEnd.toLocaleDateString()}.`, severity: "info", module: "super-admin" });
    toast({ title: "Trial extended", description: `${t.name} trial now ends ${currentEnd.toLocaleDateString()}.` });
  };

  const startTrial = (t: TenantContext) => {
    const now = new Date().toISOString();
    const updated: TenantContext = {
      ...t,
      status: "trial",
      trialEndsAt: now,
      statusHistory: [...(t.statusHistory ?? []), { status: "trial", at: now, by: user.name, reason: "Trial started" }],
    };
    updateTenant(t.id, updated);
    recordAudit({ actor: user.name, action: "console.operator_action", target: "tenant.start_trial", tenantId: t.id, severity: "info", detail: `Started trial for ${t.name}` });
    pushNotification({ title: "Trial started", message: `${t.name} is now in trial state.`, severity: "info", module: "super-admin" });
    toast({ title: "Trial started", description: `${t.name} trial ends ${new Date(now).toLocaleDateString()}.` });
  };

  const resendInvite = (t: TenantContext) => {
    const now = new Date().toISOString();
    const updated: TenantContext = {
      ...t,
      status: "invited",
      invitationSentAt: now,
      statusHistory: [...(t.statusHistory ?? []), { status: "invited", at: now, by: user.name, reason: "Invite resent" }],
    };
    updateTenant(t.id, updated);
    recordAudit({ actor: user.name, action: "console.operator_action", target: "tenant.invite_resent", tenantId: t.id, severity: "info", detail: `Resent invite for ${t.name} at ${now}` });
    pushNotification({ title: "Invite resent", message: `${t.name} invitation resent.`, severity: "info", module: "super-admin" });
    toast({ title: "Invite resent", description: `${t.name} invitation resent.` });
  };

  /* ---- Apply status change (with audit trail + status history — TM-12) ---- */
  const applyStatus = (
    tenant: TenantContext,
    status: TenantContext["status"],
    verb: string,
    reason: string,
    approver?: string,
  ) => {
    const now = new Date().toISOString();
    const historyEntry = {
      status,
      at: now,
      by: approver ?? user.name,
      reason: reason || undefined,
    };
    const updated: TenantContext = {
      ...tenant,
      status,
      statusHistory: [...(tenant.statusHistory ?? []), historyEntry],
      ...(status === "suspended" ? { suspensionReason: reason, suspendedAt: now } : {}),
      ...(status === "terminated" ? { terminatedAt: now } : {}),
      ...(status === "active" && tenant.suspendedAt ? { suspendedAt: undefined, suspensionReason: undefined } : {}),
    };
    updateTenant(tenant.id, updated);

    // TM-05: Run lifecycle cascade for restricted statuses.
    // Revokes sessions, ends impersonations, returns summary.
    let cascadeSummary = "";
    if (status === "suspended" || status === "terminated") {
      const cascadeResult = runLifecycleCascade(
        tenant.id,
        tenant.name,
        status,
        consoleStore,
      );
      cascadeSummary = formatCascadeSummary(cascadeResult);
    }

    pushNotification({
      title: `Tenant ${verb}`,
      message: `${tenant.name} is now ${status}.${cascadeSummary ? ` ${cascadeSummary}` : ""}`,
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
        ? `${verb} ${tenant.name} (two-operator approval satisfied; initiated by ${user.name})${cascadeSummary ? ` — ${cascadeSummary}` : ""}`
        : `${verb} ${tenant.name} (2FA verified) — reason: ${reason}${cascadeSummary ? ` — ${cascadeSummary}` : ""}`,
    });
    toast({
      title: `Tenant ${verb}`,
      description: `${tenant.name} is now ${status}.${cascadeSummary ? ` ${cascadeSummary}` : ""}${approver ? ` Approved by ${approver}.` : " Recorded in the audit trail."}`,
    });
  };

  /* ---- Two-operator closure (CON-06): apply approved tenant actions ---- */
  const consoleStore = useConsoleStore();
  const appliedApprovals = useRef<Set<string>>(new Set());
  const TENANT_APPROVAL_ALLOWLIST = new Set([
    "tenant.suspend",
    "tenant.terminate",
    "tenant.reactivate",
  ]);
  useEffect(() => {
    for (const a of consoleStore.approvals) {
      if (!a.actionKey.startsWith("tenant.")) continue;
      if (!TENANT_APPROVAL_ALLOWLIST.has(a.actionKey)) continue;
      if (a.status !== "approved" && a.status !== "executed") continue;
      if (appliedApprovals.current.has(a.id)) continue;
      const tenant = tenantRoster.find((t) => t.id === a.tenantId);
      if (!tenant) continue;
      appliedApprovals.current.add(a.id);
      const status: TenantContext["status"] =
        a.actionKey === "tenant.suspend" ? "suspended"
          : a.actionKey === "tenant.terminate" ? "terminated"
          : "active";
      const verb =
        status === "suspended" ? "suspended" : status === "terminated" ? "terminated" : "reactivated";
      applyStatus(tenant, status, verb, "", a.approver?.name);
      markApprovalExecuted(a.id);
    }
     
  }, [consoleStore.approvals, tenantRoster]);

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
      /* Health at a glance — color-coded with a plain-language tooltip
         and a quick path to the at-risk tenant (audit: tenant health
         indicators in the tenant list). Clicking the row opens the
         tenant detail; critical rows are pre-flagged here. */
      key: "health",
      header: "Health",
      cell: (t) => {
        const meta = HEALTH_META[healthOf(t)];
        const { score, recommendations } = tenantHealthScore(t);
        return (
          <Badge
            variant={meta.variant}
            className="gap-1.5 text-[10px]"
            title={`${meta.tooltip} Health score ${score}/100. ${recommendations.join(" ")}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
            {meta.label}
            <span className="tabular-nums opacity-80">{score}</span>
          </Badge>
        );
      },
      sortValue: (t) => tenantHealthScore(t).score,
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
          onResume={() => resumeStuckJob(t)}
          onReattach={() => reattachStale(t)}
          onDeleteDraft={() => deleteStuckDraft(t)}
          onTrialAction={(action) => handleTrialAction(t, action)}
          onStartTrial={(t) => startTrial(t)}
          onResendInvite={(t) => resendInvite(t)}
        />
      ),
    },
    {
      key: "trial-end",
      header: "Trial ends",
      cell: (t) => {
        if (t.status === "trial" && t.trialEndsAt) {
          const trialDate = new Date(t.trialEndsAt);
          const today = new Date();
          const diffTime = trialDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
          return (
            <Badge
              variant={diffDays <= 7 ? "destructive" : diffDays < 0 ? "destructive" : "default"}
              className="text-[10px]"
              title={`${diffDays} days left`}
            >
              {diffDays} days
            </Badge>
        );
        }
        return <Badge variant="default" className="text-[10px]">-</Badge>;
        },
      sortValue: (t) => t.trialEndsAt ? new Date(t.trialEndsAt).getTime() : 0,
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Lifecycle pipeline</p>
            <span className="text-[11px] text-muted-foreground">
              {total} tenant{total === 1 ? "" : "s"} across{" "}
              {distribution.length} stage{distribution.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* TM-06: stale-provisioning callout — orphaned tenants get a
              one-click re-attach (or resume/delete for stuck jobs) */}
          {staleProvisioning.length > 0 ? (
            <div className="mb-3 space-y-2">
              {staleProvisioning.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border-l-4 border-amber-500 bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20"
                >
                  <AlertCircle
                    className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      Stale provisioning — {t.name} is <code>{t.status}</code> with no live saga
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      The job is gone (reload before persistence) — the tenant would sit here
                      forever. Re-attach restarts the saga; a stuck draft can be deleted instead.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-6 gap-0.5 text-[11px]"
                    onClick={() => reattachStale(t)}
                  >
                    <Upload className="h-3 w-3" /> Re-attach
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 gap-0.5 text-[11px] text-destructive hover:text-destructive"
                    onClick={() => deleteStuckDraft(t)}
                  >
                    <X className="h-3 w-3" /> Delete draft
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Bottleneck callouts — operational hot spots + one-click focus */}
          {bottlenecks.length > 0 ? (
            <div className="mb-3 space-y-2">
              {bottlenecks.map((b) => {
                const stage = STAGES.find((s) => s.id === b.stage)!;
                return (
                  <div
                    key={b.stage}
                    className="flex flex-wrap items-center gap-2 rounded-md border-l-4 bg-muted/40 px-3 py-2"
                    style={{ borderColor: stage.color }}
                  >
                    <AlertTriangle
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: stage.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{b.title}</p>
                      <p className="text-[11px] text-muted-foreground">{b.detail}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 gap-0.5 text-[11px]"
                      onClick={() => {
                        setActiveFilter(b.stage);
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("stage", b.stage);
                        navigate("tenant-lifecycle", Object.fromEntries(params));
                      }}
                    >
                      Focus <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : total > 0 ? (
            <p className="mb-3 flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              No stage bottlenecks — every tenant sits in a healthy stage.
            </p>
          ) : null}

          {/* Proportional distribution — share per stage at a glance (no
              mental mapping between states and counts) */}
          {total > 0 ? (
            <div
              className="mb-3"
              role="img"
              aria-label={`Tenant distribution: ${distribution
                .map(
                  (s) =>
                    `${s.label} ${s.count} (${Math.round((s.count / total) * 100)}%)`,
                )
                .join(", ")}`}
            >
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {distribution.map((s) => (
                  <span
                    key={s.id}
                    className="h-full"
                    style={{
                      width: `${(s.count / total) * 100}%`,
                      background: s.color,
                    }}
                  />
                ))}
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                {distribution.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: s.color }}
                      aria-hidden
                    />
                    {s.label} · {s.count} ({shareOf(s.count)}%)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
            {STAGES.map((s, i) => {
              const StageIcon = s.icon;
              const list = buckets[s.id];
              const isSelected = activeFilter === s.id;
              return (
                <div key={s.id} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next: LifecycleStage | "all" = activeFilter === s.id ? "all" : s.id;
                      setActiveFilter(next);
                      const params = new URLSearchParams(searchParams.toString());
                      if (next === "all") {
                        params.delete("stage");
                      } else {
                        params.set("stage", next);
                      }
                      navigate("tenant-lifecycle", Object.fromEntries(params));
                    }}
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
            <div className="flex items-center gap-2">
              {activeFilter !== "all" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setActiveFilter("all")}
                >
                  Clear filter
                </Button>
              ) : null}
              
              {/* Saved Views button */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => {
                  const name = window.prompt("Name this view:", `View ${views.length + 1}`);
                  if (!name) return;
                  saveView(name, { activeFilter, columns: columns.map(c => c.key).join(",") });
                }}
              >
                <Bookmark className="h-3 w-3" /> Views
              </Button>
            </div>
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
        <SuspensionDataHandlingPanel tenants={tenantRoster} />
        </PageAsyncBoundary>

        {/* Saved views / segments */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" aria-label="Saved segments">
              <Bookmark className="mr-1 h-3 w-3" /> Segments
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-xs">Saved Segments</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {views.length === 0 ? (
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                No saved segments yet
              </DropdownMenuItem>
            ) : (
              <>
                {views.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    className="text-xs flex items-center justify-between gap-2"
                    onClick={() => {
                      const params = applyView(view);
                      navigate("tenant-lifecycle", params);
                    }}
                  >
                    <span className="truncate">{view.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(view.createdAt).toLocaleDateString()}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className="text-xs flex items-center gap-1"
              onClick={() => {
                setViewName("");
                setEditingViewId(null);
              }}
            >
              <Plus className="h-3 w-3" /> Save current filters
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </DropdownMenuContent>
        </DropdownMenu>
      </PageContent>

      {/* ── Sensitive lifecycle action (one dialog for all rows) ── */}
      <SensitiveActionDialog
        open={pending !== null}
        onOpenChange={(o) => { if (!o) setPending(null); }}
        actionKey={pending ? `tenant.${pending.action}` : "tenant.unknown"}
        title={
          pending
            ? `${pending.action === "suspend" ? "Suspend" : pending.action === "terminate" ? "Terminate" : pending.action === "convert" ? "Convert" : pending.action === "expire" ? "Expire" : "Reactivate"} ${pending.tenant.name}`
            : ""
        }
        consequence={
          pending?.action === "suspend"
            ? `Suspending ${pending.tenant.name} takes effect once approved: trader logins, purchases, and payouts stop; admins retain console access. Reversible.`
            : pending?.action === "terminate"
              ? `Terminating ${pending.tenant.name} is irreversible from this console: all data is archived and platform access ends.`
              : pending?.action === "convert"
                ? `Converting ${pending.tenant.name} from trial to active restores full platform access and normal billing. The trial period ends immediately.`
                : pending?.action === "expire"
                  ? `Expiring ${pending.tenant.name}'s trial moves the tenant to invited state — trial access ends, awaiting conversion or re-invitation.`
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
              : pending?.action === "convert"
                ? [
                    "Trial restrictions lifted — full platform access enabled",
                    "Billing transitions to the selected plan",
                    "Trial end date cleared",
                  ]
                : pending?.action === "expire"
                  ? [
                      "Trial access ends immediately",
                      "Tenant returns to invited state",
                      "Awaiting conversion or re-invitation",
                    ]
                  : ["Trading, purchases, and payouts resume", "Suspension restrictions lift"]
        }
        confirmPhrase={pending?.action === "terminate" ? pending.tenant.name : undefined}
        twoOperator={pending?.action === "suspend" || pending?.action === "terminate"}
        requireReason
        tenantId={pending?.tenant.id}
        detail={
          pending?.action === "terminate"
            ? "Runbook TEN-09 · two-operator approval"
            : pending?.action === "suspend"
              ? "Runbook TEN-04 · two-operator approval"
              : pending?.action === "convert"
                ? "Trial conversion · 2FA + reason required"
                : pending?.action === "expire"
                  ? "Trial expiration · 2FA + reason required"
                  : "Recovery action · 2FA only"
        }
        onExecute={(reason) => {
          const p = pending;
          if (!p) return;
          if (p.action === "convert") {
            const now = new Date().toISOString();
            const updated: TenantContext = {
              ...pending.tenant,
              status: "active",
              trialEndsAt: undefined,
              statusHistory: [...(pending.tenant.statusHistory ?? []), { status: "active", at: now, by: user.name, reason: reason || "Trial converted to active" }],
            };
            updateTenant(pending.tenant.id, updated);
            recordAudit({ actor: user.name, action: "console.operator_action", target: "tenant.convert_trial", tenantId: pending.tenant.id, severity: "warning", detail: `Converted trial ${pending.tenant.name} to active — ${reason}` });
            pushNotification({ title: "Trial converted", message: `${pending.tenant.name} is now active.`, severity: "success", module: "super-admin" });
            toast({ title: "Trial converted", description: `${pending.tenant.name} is now an active tenant.` });
          } else if (pending.action === "expire") {
            const now = new Date().toISOString();
            const updated: TenantContext = {
              ...pending.tenant,
              status: "invited",
              trialEndsAt: now,
              statusHistory: [...(pending.tenant.statusHistory ?? []), { status: "invited", at: now, by: user.name, reason: reason || "Trial expired" }],
            };
            updateTenant(pending.tenant.id, updated);
            recordAudit({ actor: user.name, action: "console.operator_action", target: "tenant.expire_trial", tenantId: pending.tenant.id, severity: "warning", detail: `Expired trial for ${pending.tenant.name} — ${reason}` });
            pushNotification({ title: "Trial expired", message: `${pending.tenant.name} trial has ended.`, severity: "warning", module: "super-admin" });
            toast({ title: "Trial expired", description: `${pending.tenant.name} trial has ended — tenant is now in invited state.` });
          } else {
            const verb =
              pending.action === "suspend" ? "suspended" : pending.action === "terminate" ? "terminated" : "reactivated";
            const status: TenantContext["status"] =
              pending.action === "suspend" ? "suspended" : pending.action === "terminate" ? "terminated" : "active";
            applyStatus(pending.tenant, status, verb, reason);
          }
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
  onResume,
  onReattach,
  onDeleteDraft,
  onTrialAction,
  onStartTrial,
  onResendInvite,
}: {
  tenant: TenantContext;
  onAction: (action: LifecycleAction) => void;
  onView: () => void;
  /** TM-06 — retry the blocked step of this tenant's live saga. */
  onResume: () => void;
  /** TM-06 — restart a stale/failed provisioning from step 1. */
  onReattach: () => void;
  /** TM-06 — remove a stuck draft tenant + its saga jobs. */
  onDeleteDraft: () => void;
  /** TM-08 — trial lifecycle actions (convert/extend/expire). */
  onTrialAction: (action: "convert" | "extend" | "expire") => void;
  /** TM-08 — start trial for invited tenant */
  onStartTrial: (t: TenantContext) => void;
  /** TM-08 — resend invite for invited tenant */
  onResendInvite: (t: TenantContext) => void;
}) {
  const isActive = tenant.status === "active" || tenant.status === "trial";
  const isTrial = tenant.status === "trial";
  const isInvited = tenant.status === "invited";
  const isSuspended = tenant.status === "suspended";
  const isTerminated = tenant.status === "terminated";
  const isRolledBack = tenant.status === "rolled_back";
  const isFailed = tenant.status === "provisioning_failed";
  const isProvisioning = tenant.status === "provisioning";
  const provisioning = useProvisioningStore();
  const consoleStore = useConsoleStore();
  const liveJob = provisioning.jobs.find(
    (j) => j.tenantId === tenant.id && isLiveJob(j),
  );
  const canReattach = isProvisioning || isFailed || isRolledBack;
  const canDeleteDraft = isFailed || isRolledBack;
  const pendingApproval = consoleStore.approvals.find(
    (a) => a.tenantId === tenant.id && a.status === "pending_approval"
  );

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

      {/* TM-06 — blocked saga: retry the failed step in place (idempotent). */}
      {liveJob?.state === "blocked" ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-sky-600 hover:text-sky-700"
          onClick={(e) => {
            e.stopPropagation();
            onResume();
          }}
        >
          <Play className="h-3 w-3" />Resume
        </Button>
      ) : null}

      {/* TM-06 — failed / rolled back / orphaned: start a fresh saga. */}
      {canReattach ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-amber-600 hover:text-amber-700"
          onClick={(e) => {
            e.stopPropagation();
            onReattach();
          }}
        >
          <Upload className="h-3 w-3" />Re-attach
        </Button>
      ) : null}

      {/* TM-06 — a stuck draft can be discarded instead of recovered. */}
      {canDeleteDraft ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteDraft();
          }}
        >
          <X className="h-3 w-3" />Delete
        </Button>
      ) : null}

      {/* TM-08 — trial lifecycle actions. */}
      {isTrial ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
            onClick={(e) => {
              e.stopPropagation();
              onTrialAction("convert");
            }}
          >
            <CheckCircle2 className="h-3 w-3" />Convert
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-sky-600 hover:text-sky-700"
            onClick={(e) => {
              e.stopPropagation();
              onTrialAction("extend");
            }}
          >
            <Clock className="h-3 w-3" />Extend
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-amber-600 hover:text-amber-700"
            onClick={(e) => {
              e.stopPropagation();
              onTrialAction("expire");
            }}
          >
            <Ban className="h-3 w-3" />Expire
          </Button>
        </>
      ) : null}

      {isInvited ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-emerald-600 hover:text-emerald-700"
            onClick={(e) => {
              e.stopPropagation();
              onStartTrial(tenant);
            }}
          >
            <Clock className="h-3 w-3" />Start trial
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-sky-600 hover:text-sky-700"
            onClick={(e) => {
              e.stopPropagation();
              onResendInvite(tenant);
            }}
          >
            <Redo className="h-3 w-3" />Resend invite
          </Button>
        </>
      ) : null}

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
