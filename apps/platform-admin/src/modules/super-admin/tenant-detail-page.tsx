"use client";

/**
 * Tenant Detail Page — comprehensive tenant workspace (spec §6, §41, §43).
 *
 * Super Admin's view into a single tenant: header + KPI row + 8 tabs that
 * cover the full tenant lifecycle surface:
 *   1. Overview       — summary + module adoption progress
 *   2. Analytics      — per-tenant revenue, adoption & growth vs portfolio
 *   3. Modules        — toggle which modules this tenant can access (KEY feature)
 *   4. Users          — tenant's admin/support users
 *   5. Billing        — subscription + invoice history
 *   6. Activity       — recent audit timeline
 *   7. Configuration  — edit tenant settings (name, currency, branding, etc.)
 *   8. Risk           — risk summary + quick nav to tenant risk workspace
 *
 * Destructive actions (Suspend, Terminate) route through
 * SensitiveActionDialog (Phase C, CON-06): consequence-first review with
 * blast radius + required reason, then a 2FA step-up, then — for the
 * nuclear set — a two-operator approval request (10-min window, decided
 * in the Approval Center) before the status change applies. Reactivate is
 * a recovery action: 2FA + reason, no second operator. One primary
 * action per surface (§22).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants, updateTenant } from "@/lib/platform/tenant-store";
import { usePlans, readPlans } from "@/lib/platform/plan-catalog-store";
import { useDunningForTenant, escalateDunning, suspendTenant, reinstateTenant, type DunningRecord } from "@/lib/platform/dunning-store";
import {
  useTenantUsers,
  useTenantUsersForTenant,
  inviteTenantUser,
  removeTenantUser,
  updateTenantUserRole,
  suspendTenantUser,
  reactivateTenantUser,
  type TenantUser,
} from "@/lib/platform/tenant-users-store";
import { makeTermResolver, plural, type TermKey } from "@/lib/platform/terminology";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantBreaches,
  getTenantPayouts,
  getTenantKyc,
  getTenantAudit,
  tenants as allTenants,
  hashStr,
} from "@/lib/platform/mock-data";
import { PayoutsTab } from "@/modules/super-admin/tenant-payouts-tab";
import type { AuthUser, TenantContext } from "@/lib/platform/types";
import { moduleRegistry } from "@/lib/platform/module-registry";
import {
  Page,
  PageContent,
  EntityHeader,
  MetricCard,
} from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { AreaSeries, BarSeries } from "@/components/platform/charts";
import { ActivityTimeline } from "@/components/platform/audit";
import { EmptyState } from "@/components/platform/guards";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { TwoFactorDialog } from "@/components/platform/two-factor-dialog";
import { impersonationDenyReason } from "@/lib/platform/impersonation-policy";
import { markApprovalExecuted, recordAudit, useConsoleStore } from "@/lib/platform/console-store";
import { runLifecycleCascade, formatCascadeSummary } from "@/lib/platform/lifecycle-cascade";
import {
  reattachProvisioning,
  deleteProvisioningDraft,
  resumeJob,
  useProvisioningStore,
  isStaleProvisioning,
} from "@/lib/platform/provisioning-saga";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { tenantHealthScore } from "@/lib/platform/tenant-health";
import {
  readIncidents,
  useIncidentCenter,
  correlationsFor,
  acknowledgeCorrelation,
  effectiveSeverity,
  effectiveOwner,
  type Incident,
  type IncidentSeverity,
} from "@/lib/platform/incident-center-store";
import { providerName } from "@/lib/platform/provider-catalog";
import {
  useSlaCreditRows,
  adjustSlaCredit,
  SLA_CREDIT_RATES,
  type SlaCreditRow,
} from "@/lib/platform/sla-credits-store";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Settings as SettingsIcon,
  Pause,
  Play,
  Ban,
  Users,
  Package,
  DollarSign,
  Banknote,
  AlertTriangle,
  Upload,
  CreditCard,
  Plus,
  Clock,
  Activity,
  Palette,
  ShieldAlert,
  FileText,
  ChevronDown,
  UserPlus,
  Pencil,
  Trash2,
  Building2,
  CheckCircle2,
  TrendingUp,
  LogIn,
  Shield,
  GitBranch,
  ArrowRight,
  Server,
  ScrollText,
  Wallet,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Catalog-first plan price (R4-06) — readPlans() falls back to
 *  DEFAULT_PLANS when storage is empty, so a price is always found. */
function getPlanPrice(plan: TenantContext["plan"]): number {
  return readPlans().find(p => p.id === plan)?.priceMonthly ?? 0;
}

const tenantStatusTone = (s: string) =>
  s === "active"
    ? "success"
    : s === "trial"
      ? "info"
      : s === "suspended"
        ? "danger"
        : s === "terminated"
          ? "muted"
          : s === "invited"
            ? "info"
            : s === "provisioning"
              ? "info"
              : s === "provisioning_failed"
                ? "danger"
                : s === "onboarding"
                  ? "info"
                  : s === "rolled_back"
                    ? "warning"
                    : "warning";

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

/** Tab ids honored by this page — `?tab=` deep-links validate against it. */
const TENANT_TABS = [
  "overview",
  "analytics",
  "modules",
  "users",
  "billing",
  "activity",
  "incidents",
  "configuration",
  "risk",
  "payouts",
] as const;

function initialTab(tab: string | undefined): string {
  return tab && (TENANT_TABS as readonly string[]).includes(tab) ? tab : "overview";
}

export function TenantDetailPage() {
  const { router, navigate, pushNotification, user, startImpersonation, setTenant, isImpersonating } = usePlatform();
  const tenants = useTenants();
  const tenantId = router.params.id;
  const provisioning = useProvisioningStore();
  const provJob = useMemo(
    () => provisioning.jobs.find((j) => j.tenantId === tenantId),
    [provisioning.jobs, tenantId],
  );

  const foundTenant = useMemo(
    () => tenants.find((t) => t.id === tenantId && t.id !== "platform"),
    [tenants, tenantId],
  );

  // Local working copy so module toggles / config edits are reflected
  // immediately in this surface and also pushed to global context.
  const [localDraft, setLocalDraft] = useState<Partial<TenantContext> | null>(null);
  const [editBase, setEditBase] = useState<{ status: TenantContext["status"]; plan: TenantContext["plan"] } | null>(null);

  const localTenant: TenantContext | null = useMemo(() => {
    if (!foundTenant) return null;
    if (!localDraft) return foundTenant;
    return { ...foundTenant, ...localDraft };
  }, [foundTenant, localDraft]);

  /* TM-06 — recovery for an orphaned/stuck provisioning. */
  const isStale = useMemo(
    () =>
      !!foundTenant &&
      isStaleProvisioning({ id: foundTenant.id, status: foundTenant.status }),
    [foundTenant],
  );

  const reattach = () => {
    if (!foundTenant) return;
    const job = reattachProvisioning({
      tenantId: foundTenant.id,
      tenantName: foundTenant.name,
      slug: foundTenant.slug,
      plan: foundTenant.plan,
      createdBy: user.name,
    });
    pushNotification({
      title: "Provisioning re-attached",
      message: `${foundTenant.name} — new saga ${job.id} is running from step 1.`,
      severity: "info",
      module: "super-admin",
    });
    toast({
      title: "Saga re-attached",
      description: `${foundTenant.name} is provisioning again — follow it on the live view.`,
    });
  };

  const resumeBlocked = () => {
    if (!provJob || !resumeJob(provJob.id)) return;
    pushNotification({
      title: "Provisioning resumed",
      message: `${foundTenant?.name ?? tenantId} — saga ${provJob.id} retries the blocked step.`,
      severity: "info",
      module: "super-admin",
    });
    toast({ title: "Job resumed", description: "Retrying the blocked step (idempotent)." });
  };

  const deleteDraft = () => {
    if (!foundTenant || !deleteProvisioningDraft(foundTenant.id, user.name)) return;
    pushNotification({
      title: "Provisioning draft deleted",
      message: `${foundTenant.name} — stuck draft removed with its saga jobs.`,
      severity: "warning",
      module: "super-admin",
    });
    toast({ title: "Draft deleted", description: `${foundTenant.name} and its saga jobs were removed.` });
    navigate("tenant-lifecycle");
  };

  // Sync local draft with store when store changes, preserving only edited fields.
  useEffect(() => {
    if (!foundTenant) {
      setLocalDraft(null);
      setEditBase(null);
    } else if (localDraft === null) {
      setLocalDraft({});
      setEditBase({ status: foundTenant.status, plan: foundTenant.plan });
    }
  }, [foundTenant]);
  /* Login-as 2FA step-up — the session starts only after the code
   * verifies (parity with the View-As page, CON-01). */
  const [impersonateOtpOpen, setImpersonateOtpOpen] = useState(false);
  
  const plans = usePlans();

  const persistTenant = (draft: Partial<TenantContext> | TenantContext) => {
    if (!foundTenant) return;
    const isFullObject = "id" in draft;
    const changes: Partial<TenantContext> = isFullObject ? draft : draft;

    if (editBase && (foundTenant.status !== editBase.status || foundTenant.plan !== editBase.plan)) {
      pushNotification({
        severity: "warning",
        title: "Concurrency conflict",
        message: "This tenant's status or plan was changed by another operator. Please refresh and re-apply your changes.",
      });
      return;
    }

    const merged: TenantContext = { ...foundTenant, ...changes };
    updateTenant(foundTenant.id, merged);
    setEditBase({ status: merged.status, plan: merged.plan });
  };

  // Async seam (frontend-first): detail hydration resolves via the mock
  // layer (loading skeleton + error/retry) while header state stays live.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const term = makeTermResolver(localTenant ?? undefined);

  // KPI data — pulled from mock domain functions
  const tenantTraders = useMemo(
    () => (localTenant ? getTenantTraders(localTenant.id) : []),
    [localTenant],
  );
  const tenantAccounts = useMemo(
    () => (localTenant ? getTenantAccounts(localTenant.id) : []),
    [localTenant],
  );
  const tenantBreaches = useMemo(
    () => (localTenant ? getTenantBreaches(localTenant.id) : []),
    [localTenant],
  );
  const tenantPayouts = useMemo(
    () => (localTenant ? getTenantPayouts(localTenant.id) : []),
    [localTenant],
  );
  const tenantKyc = useMemo(
    () => (localTenant ? getTenantKyc(localTenant.id) : []),
    [localTenant],
  );
  const tenantAudit = useMemo(
    () => (localTenant ? getTenantAudit(localTenant.id).slice(0, 12) : []),
    [localTenant],
  );

  // Controlled tab state so the "Edit Configuration" header button can
  // programmatically switch to the Configuration tab (previously the
  // button called `navigate("tenant-config", { id })` — a viewId that
  // doesn't exist in the view-router, producing a "View not found"
  // fallback. The Configuration tab IS on this page; switching the
  // active tab is the correct action.)
  //
  // Deep-linkable (R9 W6 UC-P4): the Incident Center correlation banner
  // links here with ?tab=incidents — only known tab ids are honored,
  // anything else falls back to overview.
  const [activeTab, setActiveTab] = useState<string>(initialTab(router.params.tab));
  type LifecycleAction = "suspend" | "reactivate" | "terminate";
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);

  /* ---- Two-operator closure (CON-06): when operator B approves a
   * `tenant.*` request in the Approval Center, apply the status change
   * here. Each approval id is applied exactly once.
   *
   * TM-02: Fail-open approval mapping — only known, explicit action keys
   * are accepted. This prevents an unknown/rogue actionKey from silently
   * defaulting to "active" and inadvertently reactivating a tenant.
   * Any unrecognized key is silently skipped. */
  const TENANT_APPROVAL_ALLOWLIST = new Set([
    "tenant.suspend",
    "tenant.terminate",
    "tenant.reactivate",
  ]);
  const consoleStore = useConsoleStore();
  const appliedApprovals = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!localTenant) return;
    for (const a of consoleStore.approvals) {
      if (a.tenantId !== localTenant.id) continue;
      if (!a.actionKey.startsWith("tenant.")) continue;
      if (!TENANT_APPROVAL_ALLOWLIST.has(a.actionKey)) continue;
      if (a.status !== "approved" && a.status !== "executed") continue;
      if (appliedApprovals.current.has(a.id)) continue;
      appliedApprovals.current.add(a.id);
      const status: TenantContext["status"] =
        a.actionKey === "tenant.suspend" ? "suspended"
          : a.actionKey === "tenant.terminate" ? "terminated"
          : "active";
      const verb =
        status === "suspended" ? "suspended" : status === "terminated" ? "terminated" : "reactivated";
      setLocalDraft({ status });
      updateTenant(localTenant.id, { status });
      pushNotification({
        title: `Tenant ${verb}`,
        message: `${localTenant.name} is now ${status} — two-operator approval satisfied.`,
        severity: status === "active" ? "success" : "warning",
        module: "super-admin",
      });
      recordAudit({
        actor: a.approver?.name ?? "System",
        action: "console.escalation_approved",
        target: `tenant.${status}`,
        tenantId: localTenant.id,
        severity: status === "active" ? "info" : "critical",
        detail: `${verb} ${localTenant.name} (approved by ${a.approver?.name ?? "unknown"}; initiated by ${a.initiator.name})`,
      });
      markApprovalExecuted(a.id);
      toast({
        title: `Tenant ${verb}`,
        description: `Approved by ${a.approver?.name ?? "second operator"} — ${localTenant.name} is now ${status}.`,
      });
    }
  }, [consoleStore.approvals, localTenant, pushNotification]);

  if (!localTenant) {
    return (
      <Page>
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("tenants")}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back to tenants
        </Button>
        <EmptyState
          title="Tenant not found"
          description="This tenant may have been removed, or you followed a stale link."
          icon={Building2}
          hint="Return to the tenants list and pick a tenant to view."
        />
      </Page>
    );
  }

  const currency = localTenant.currency;
  /* Shared impersonation policy (P0-1): the same deny-list + terminal
   * status gate as View-As, and no second session while one is active. */
  const impersonateDeny = impersonationDenyReason(localTenant);
  const impersonateBlocked = impersonateDeny !== null || isImpersonating;
  const openBreaches = tenantBreaches.filter((b) => b.status === "open");
  const pendingPayouts = tenantPayouts.filter((p) => p.status === "pending");
  const pendingKyc = tenantKyc.filter((k) => k.status === "pending" || k.status === "review");
  const activeAccounts = tenantAccounts.filter((a) => a.status === "active");
  const monthlyRevenue = getPlanPrice(localTenant.plan);

  /* ---- Apply status change with toast + notification + audit ---- */
  const applyStatus = (status: TenantContext["status"], verb: string, reason: string) => {
    setLocalDraft({ status });
    updateTenant(localTenant.id, { status });

    // TM-05: Run lifecycle cascade for restricted statuses.
    let cascadeSummary = "";
    if (status === "suspended" || status === "terminated") {
      const cascadeResult = runLifecycleCascade(
        localTenant.id,
        localTenant.name,
        status,
        consoleStore,
      );
      cascadeSummary = formatCascadeSummary(cascadeResult);
    }

    pushNotification({
      title: `Tenant ${verb}`,
      message: `${localTenant.name} is now ${status}.${cascadeSummary ? ` ${cascadeSummary}` : ""}`,
      severity:
        status === "suspended" || status === "terminated" ? "warning" : "success",
      module: "super-admin",
    });
    recordAudit({
      actor: user.name,
      action: "console.operator_action",
      target: `tenant.${status}`,
      tenantId: localTenant.id,
      severity: status === "active" ? "info" : "critical",
      detail: `${verb} ${localTenant.name} (2FA verified) — reason: ${reason}${cascadeSummary ? ` — ${cascadeSummary}` : ""}`,
    });
    toast({
      title: `Tenant ${verb}`,
      description: `${localTenant.name} is now ${status}.${cascadeSummary ? ` ${cascadeSummary}` : ""} Recorded in the audit trail.`,
    });
  };

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate("tenants")}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />Back to tenants
      </Button>

      {/* Header */}
      <EntityHeader
        title={localTenant.name}
        subtitle={`${localTenant.branding.tagline ?? "—"} · ${localTenant.slug}`}
        avatar={
          <span
            className="flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
            style={{ background: localTenant.branding.primaryColor }}
          >
            {localTenant.branding.initials}
          </span>
        }
        badges={
          <>
            <Badge variant="outline" className="text-[10px] capitalize">{localTenant.plan}</Badge>
            <StatusBadge tone={tenantStatusTone(localTenant.status)}>{localTenant.status}</StatusBadge>
          </>
        }
        actions={
          <>
            {/* Quick jump to this tenant's API usage analytics (audit #1) */}
            <Button size="sm" variant="outline" onClick={() => navigate("tenant-api-usage")}>
              <Server className="mr-1 h-4 w-4" />API usage
            </Button>
            {/* Tenant-scoped audit trail — same platform events, pre-filtered */}
            <Button size="sm" variant="outline" onClick={() => navigate("audit-log", { tenant: tenantId })}>
              <ScrollText className="mr-1 h-4 w-4" />Audit log
            </Button>
            {/* Login-as / impersonate — privileged action with audit-trail
             * notice (§22 Contextual Actions + §24 friction proportional
             * to consequences). The AlertDialog spells out exactly what
             * changes: the operator's session switches into this tenant's
             * workspace, all subsequent actions are flagged as
             * impersonated in the audit trail, and the return path is
             * the topbar tenant switcher.
             */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={impersonateBlocked}
                  title={
                    impersonateDeny ??
                    (isImpersonating ? "A View-As session is already active — end it first" : undefined)
                  }
                >
                  <LogIn className="mr-1 h-4 w-4" />Login as
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Open a View-As session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will be switched into the <strong>{localTenant.name}</strong> workspace with their branding and data — in a <strong>read-only</strong> session: every control in the console is disabled for 15 minutes. Start, renew, end and this 2FA confirmation are all recorded in the platform audit log. To return to the platform admin view, use <strong>End session</strong> on the View-As banner.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <div className="font-medium text-amber-900 dark:text-amber-100">Audit-trail notice</div>
                      <div className="mt-0.5 text-amber-800 dark:text-amber-200">
                        Platform admin <strong>{user.name}</strong> opens a read-only session on <strong>{localTenant.name}</strong> — the start row (<code>console.impersonation_started</code>) names both identities, and the session auto-ends at the 15-minute deadline.
                      </div>
                    </div>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => setImpersonateOtpOpen(true)}>
                    <LogIn className="mr-1 h-4 w-4" />Continue to 2FA
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* ── 2FA step-up — the session starts only after the code
                verifies (CON-01, parity with the View-As page) ── */}
            <TwoFactorDialog
              open={impersonateOtpOpen}
              onOpenChange={setImpersonateOtpOpen}
              title={`Switch to ${localTenant.name}?`}
              description="Confirm with 2FA. The 15-minute read-only session and this verification are audited."
              submitLabel="Verify & switch"
              onVerify={(code) => {
                if (code === "000000") return Promise.reject(new Error("Invalid code. Please try again."));
                startImpersonation({ tenantId: localTenant.id, tenantName: localTenant.name, operator: { id: user.id, name: user.name } });
                setTenant(localTenant);
                pushNotification({
                  title: `Impersonating ${localTenant.name}`,
                  message: `Platform admin ${user.name} opened a read-only View-As session on ${localTenant.name}. Use End session on the banner to return.`,
                  severity: "warning",
                  module: "super-admin",
                });
                toast({
                  title: `Now viewing as ${localTenant.name} (read-only)`,
                  description: "Controls are disabled for 15 minutes — use End session on the banner to return.",
                });
                return undefined;
              }}
            />

            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab("configuration")}
            >
              <SettingsIcon className="mr-1 h-4 w-4" />Edit Configuration
            </Button>

            {localTenant.status === "active" || localTenant.status === "trial" ? (
              <Button size="sm" variant="outline" onClick={() => setPendingAction("suspend")}>
                <Pause className="mr-1 h-4 w-4" />Suspend
              </Button>
            ) : null}

            {localTenant.status === "suspended" ? (
              <Button size="sm" onClick={() => setPendingAction("reactivate")}>
                <Play className="mr-1 h-4 w-4" />Reactivate
              </Button>
            ) : null}

            {localTenant.status !== "terminated" ? (
              <Button size="sm" variant="destructive" onClick={() => setPendingAction("terminate")}>
                <Ban className="mr-1 h-4 w-4" />Terminate
              </Button>
            ) : null}
          </>
        }
      />

      {/* ── Sensitive lifecycle action: consequence → reason → 2FA →
           (terminate: two-operator approval) → execute ───────────── */}
      <SensitiveActionDialog
        open={pendingAction !== null}
        onOpenChange={(o) => { if (!o) setPendingAction(null); }}
        actionKey={`tenant.${pendingAction ?? "unknown"}`}
        title={
          pendingAction === "suspend"
            ? `Suspend ${localTenant.name}`
            : pendingAction === "terminate"
              ? `Terminate ${localTenant.name}`
              : `Reactivate ${localTenant.name}`
        }
        consequence={
          pendingAction === "suspend"
            ? `Suspending ${localTenant.name} takes effect immediately once approved: trader logins, new positions, and payouts stop. Admins keep console access for suspended-state tasks. Reversible.`
            : pendingAction === "terminate"
              ? `Terminating ${localTenant.name} is irreversible from this console: all trader data, accounts, payouts, and audit logs are archived, and platform access ends immediately.`
              : `Reactivating ${localTenant.name} restores trader logins, purchases, and payout processing immediately.`
        }
        blastRadius={
          pendingAction === "suspend"
            ? [
                "All traders lose console access; open positions cannot be closed manually",
                "Payout queue freezes until reactivation",
                "Purchases, evaluations, and account transitions stop",
                "Admin users retain access for suspended-state management",
              ]
            : pendingAction === "terminate"
              ? [
                  "All traders permanently lose access",
                  "Accounts are closed out; payouts are voided",
                  "Data is archived — recovery needs a platform-level restore request",
                  "Cannot be reversed from the admin console",
                ]
              : [
                  "Trading, purchases, and payouts resume",
                  "Any suspended-state restrictions are lifted",
                ]
        }
        confirmPhrase={pendingAction === "terminate" ? localTenant.name : undefined}
        twoOperator={pendingAction === "terminate"}
        requireReason
        tenantId={localTenant.id}
        detail={
          pendingAction === "terminate"
            ? "Runbook TEN-09 · termination requires a second operator"
            : pendingAction === "suspend"
              ? "Runbook TEN-04 · suspension requires a second operator"
              : "Recovery action · 2FA only"
        }
        onExecute={(reason) =>
          pendingAction === "suspend"
            ? applyStatus("suspended", "suspended", reason)
            : pendingAction === "terminate"
              ? applyStatus("terminated", "terminated", reason)
              : applyStatus("active", "reactivated", reason)
        }
        onApprovalInitiated={(request) => {
          setPendingAction(null);
          toast({
            title: "Approval requested",
            description: `${request.actionLabel} — a second operator must approve within 10 minutes.`,
          });
        }}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label={plural(term("trader"))} value={tenantTraders.length} icon={Users} />
        <MetricCard label="Active Accounts" value={activeAccounts.length} icon={Package} tone="positive" />
        <MetricCard
          label="MRR"
          value={formatCurrency(monthlyRevenue, currency)}
          icon={DollarSign}
          tone="positive"
        />
        <MetricCard
          label="Open Breaches"
          value={openBreaches.length}
          icon={AlertTriangle}
          tone={openBreaches.length > 0 ? "negative" : "default"}
        />
        <MetricCard
          label={`Pending ${plural(term("payout"))}`}
          value={pendingPayouts.length}
          icon={Clock}
          tone={pendingPayouts.length > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="KYC Pending"
          value={pendingKyc.length}
          icon={ShieldAlert}
          tone={pendingKyc.length > 0 ? "warning" : "default"}
        />
      </div>

      {provJob && (provJob.state === "running" || provJob.state === "blocked") ? (
        (() => {
          const doneOrSkipped = provJob.steps.filter(
            (s) => s.state === "completed" || s.state === "skipped" || s.state === "compensated",
          ).length;
          const currentStep = provJob.steps.find(
            (s) => s.state === "running" || s.state === "pending" || s.state === "failed",
          );
          return (
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
                provJob.state === "blocked"
                  ? "border-amber-500/50 bg-amber-50/60 dark:bg-amber-950/20"
                  : "border-sky-500/40 bg-sky-50/50 dark:bg-sky-950/20",
              )}
            >
              <div className="flex items-center gap-2">
                <GitBranch
                  className={cn(
                    "h-4 w-4 shrink-0",
                    provJob.state === "blocked" ? "text-amber-600" : "text-sky-600",
                  )}
                />
                <span>
                  Provisioning in progress — step {currentStep?.num ?? "…"} of{" "}
                  {provJob.steps.length} ({doneOrSkipped} done).{" "}
                  {provJob.state === "blocked" ? (
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      Blocked: {provJob.blocker?.message}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* TM-06 — blocked jobs resume in place (idempotent retry,
                    job context preserved — never a silent re-run). */}
                {provJob.state === "blocked" ? (
                  <Button size="sm" variant="outline" onClick={resumeBlocked}>
                    <Play className="mr-1 h-3.5 w-3.5" /> Resume
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("provisioning-saga", { job: provJob.id })}
                >
                  View saga <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })()
      ) : null}

      {/* TM-06 — stale-provisioning callout: status says provisioning but
          nothing is driving it. One-click re-attach (or delete the draft). */}
      {isStale && localTenant ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/50 bg-amber-50/60 px-4 py-3 text-sm dark:bg-amber-950/20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <span className="font-medium text-amber-700 dark:text-amber-400">
                Stale provisioning —{" "}
              </span>
              this tenant is <code>{localTenant.status}</code> with no live saga behind it (the
              job did not survive a reload). Re-attach restarts it from step 1.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={reattach}>
              <Upload className="mr-1 h-3.5 w-3.5" /> Re-attach
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={deleteDraft}
            >
              Delete draft
            </Button>
          </div>
        </div>
      ) : null}

      <PageAsyncBoundary
        loading={loading}
        error={error}
        onRetry={retry}
        hasData={hydrated !== undefined}
        loadingLabel="Loading tenant…"
      >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap justify-start">
          <TabsTrigger value="overview" className="gap-1"><Activity className="h-3 w-3" />Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1"><TrendingUp className="h-3 w-3" />Analytics</TabsTrigger>
          <TabsTrigger value="modules" className="gap-1"><Package className="h-3 w-3" />Modules</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-3 w-3" />Users</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1"><DollarSign className="h-3 w-3" />Billing</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1"><Clock className="h-3 w-3" />Activity</TabsTrigger>
          <TabsTrigger value="incidents" className="gap-1"><AlertTriangle className="h-3 w-3" />Incidents</TabsTrigger>
          <TabsTrigger value="configuration" className="gap-1"><SettingsIcon className="h-3 w-3" />Configuration</TabsTrigger>
          <TabsTrigger value="risk" className="gap-1"><ShieldAlert className="h-3 w-3" />Risk</TabsTrigger>
          <TabsTrigger value="payouts" className="gap-1"><Wallet className="h-3 w-3" />Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab tenant={localTenant} />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab tenant={localTenant} />
        </TabsContent>
        <TabsContent value="modules">
          <ModulesTab tenant={localTenant} onChange={(draft: Partial<TenantContext>) => setLocalDraft(draft)} onPersist={persistTenant} />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab tenantId={localTenant.id} />
        </TabsContent>
        <TabsContent value="billing">
          {/* key: remount per tenant so the tab's session-scoped billing
              state (schedule, methods, disputes) resets with the tenant. */}
          <BillingTab key={localTenant.id} tenant={localTenant} />
        </TabsContent>
        <TabsContent value="activity">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Recent activity</p>
            <ActivityTimeline entries={tenantAudit} max={12} />
          </div>
        </TabsContent>
        <TabsContent value="incidents">
          <TenantIncidentsPanel tenantId={localTenant.id} />
        </TabsContent>
        <TabsContent value="configuration">
          <ConfigurationTab tenant={localTenant} onChange={(draft: Partial<TenantContext>) => setLocalDraft(draft)} onPersist={persistTenant} />
        </TabsContent>
        <TabsContent value="risk">
          <RiskTab tenant={localTenant} breaches={tenantBreaches} accountsCount={tenantAccounts.length} />
        </TabsContent>
        <TabsContent value="payouts">
          <PayoutsTab tenantId={localTenant.id} />
        </TabsContent>
      </Tabs>
      </PageAsyncBoundary>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 1 — Overview                                                    */
/* ------------------------------------------------------------------ */

/** Deterministic per-tenant payment method so each tenant shows a
 * different (but stable) card brand + last 4 instead of the previous
 * hardcoded "Visa ··4242" for every tenant. Round 4 fix. */
function paymentMethodFor(tenant: TenantContext): string {
  const brands = ["Visa", "Mastercard", "Amex", "Discover"];
  const seed = tenant.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const brand = brands[seed % brands.length];
  const last4 = String(1000 + (seed % 9000));
  return `${brand} ··${last4}`;
}

function OverviewTab({ tenant }: { tenant: TenantContext }) {
  // Only tenant-facing modules belong in a per-tenant adoption metric — the
  // console's own super-admin module is not a tenant entitlement.
  const allModules = moduleRegistry
    .getAll()
    .filter((m) => m.manifest.id !== "super-admin");
  const summary = [
    { label: "Tenant ID", value: tenant.id, mono: true },
    { label: "Slug", value: tenant.slug },
    { label: "Plan", value: <Badge variant="outline" className="text-[10px] capitalize">{tenant.plan}</Badge> },
    { label: "Status", value: <StatusBadge tone={tenantStatusTone(tenant.status)}>{tenant.status}</StatusBadge> },
    { label: "Currency", value: tenant.currency },
    { label: "Timezone", value: tenant.timezone },
    { label: "Locale", value: tenant.locale },
    { label: "Created", value: new Date(tenant.createdAt).toLocaleDateString() },
    // Derive "Last active" from the most recent audit entry for this
    // tenant — was hardcoded "2 hours ago" for every tenant. Round 4 fix.
    {
      label: "Last active",
      value: (() => {
        const audit = getTenantAudit(tenant.id);
        if (audit.length === 0) return "—";
        const last = audit[0].timestamp;
        const diffMs = Date.now() - new Date(last).getTime();
        const min = Math.floor(diffMs / 60000);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const d = Math.floor(hr / 24);
        return `${d}d ago`;
      })(),
    },
    { label: "Application", value: tenant.application },
  ];

  // Health band + numeric score + next steps — same derivation as the
  // Tenant Health dashboard and the lifecycle list (audit V #7).
  const { score, band, recommendations } = tenantHealthScore(tenant);
  const bandTone = band === "healthy" ? "success" : band === "watch" ? "warning" : "danger";
  const bandLabel = band === "healthy" ? "Healthy" : band === "watch" ? "Watch" : "Needs attention";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-lg border bg-card p-4 lg:col-span-2">
        <p className="mb-3 text-sm font-medium">Tenant summary</p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
          {summary.map((row) => (
            <div key={row.label}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</dt>
              <dd className={cn("mt-0.5", row.mono ? "font-mono text-xs" : "text-sm")}>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-medium">
          <LabelWithHelp help="Modules currently enabled for this tenant. Use the Modules tab to toggle entitlements.">
            Module adoption
          </LabelWithHelp>
        </p>
        <div className="space-y-2">
          {allModules.map((m) => {
            const enabled = tenant.enabledModules.includes(m.manifest.id);
            const Icon = m.manifest.icon;
            return (
              <div key={m.manifest.id} className="flex items-center gap-2">
                {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                <span className="flex-1 truncate text-xs">{m.manifest.name}</span>
                {enabled ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted" />
                )}
              </div>
            );
          })}
        </div>
        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">
          {tenant.enabledModules.length} of {allModules.length} modules enabled
        </p>
        <Progress value={(tenant.enabledModules.length / allModules.length) * 100} className="mt-1.5 h-1.5" />
      </div>
      </div>

      {/* Health score (audit V #7) — numeric score, band, and concrete
          next steps, from the one shared derivation in
          lib/platform/tenant-health. */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              <LabelWithHelp help="Deterministic health score (0–100) from lifecycle status, module adoption, support-ticket load and open breaches. The score always sits inside its band's range, and every signal that cost points lists a concrete next step below.">
                Tenant health score
              </LabelWithHelp>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Higher is healthier — same score shown on the Tenant Health dashboard and lifecycle list.
            </p>
          </div>
          <StatusBadge tone={bandTone}>{bandLabel}</StatusBadge>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-3xl font-semibold tabular-nums">{score}</span>
          <span className="text-sm text-muted-foreground">/100</span>
          <Progress value={score} className="h-2 flex-1" />
        </div>
        <ul className="mt-3 space-y-1.5">
          {recommendations.map((rec) => (
            <li key={rec} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 2 — Modules (KEY feature: toggle tenant entitlements)         */
/* ------------------------------------------------------------------ */

function ModulesTab({
  tenant,
  onChange,
  onPersist,
}: {
  tenant: TenantContext;
  onChange: (t: TenantContext) => void;
  onPersist: (t: TenantContext) => void;
}) {
  // Entitlements are tenant modules only — super-admin is the console's own
  // module and must never appear as a toggleable tenant entitlement.
  const allModules = moduleRegistry
    .getAll()
    .filter((m) => m.manifest.id !== "super-admin");

  const toggle = (moduleId: string) => {
    const enabled = new Set(tenant.enabledModules);
    const willEnable = !enabled.has(moduleId);
    if (willEnable) enabled.add(moduleId);
    else enabled.delete(moduleId);
    const updated: TenantContext = {
      ...tenant,
      enabledModules: Array.from(enabled),
    };
    onChange(updated);
    onPersist(updated);
    const mod = allModules.find((m) => m.manifest.id === moduleId);
    toast({
      title: willEnable ? "Module enabled" : "Module disabled",
      description: `${mod?.manifest.name ?? moduleId} is now ${willEnable ? "accessible" : "hidden"} for ${tenant.name}.`,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border bg-card p-3">
        <div>
          <p className="text-sm font-medium">
            <LabelWithHelp help="Toggle modules to control which features this tenant can access. Disabled modules disappear from the tenant's sidebar and dashboard instantly.">
              Module entitlements
            </LabelWithHelp>
          </p>
          <p className="text-xs text-muted-foreground">
            {tenant.enabledModules.length} of {allModules.length} modules enabled
          </p>
        </div>
        <Progress
          value={(tenant.enabledModules.length / allModules.length) * 100}
          className="h-2 w-32"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {allModules.map((m) => {
          const enabled = tenant.enabledModules.includes(m.manifest.id);
          const Icon = m.manifest.icon;
          const accent = m.manifest.accentColor ?? tenant.branding.primaryColor;
          return (
            <Card key={m.manifest.id} className={cn("gap-4 py-4", enabled && "ring-1 ring-primary/20")}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="rounded-md p-2" style={{ background: `${accent}1a`, color: accent }}>
                      {Icon ? <Icon className="h-4 w-4" /> : null}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">{m.manifest.name}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {m.manifest.category ?? "module"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggle(m.manifest.id)}
                    aria-label={`Toggle ${m.manifest.name}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {m.manifest.description ?? "No description available."}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[9px]">{m.manifest.version}</Badge>
                  {m.manifest.supportedApplications?.map((a) => (
                    <Badge key={a} variant="secondary" className="text-[9px]">{a}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 3 — Users                                                      */
/* ------------------------------------------------------------------ */

function UsersTab({ tenantId }: { tenantId: string }) {
  const tenant = useTenants().find((t) => t.id === tenantId);
  const tenantName = tenant?.name ?? tenantId;
  const tenantUsers = useTenantUsersForTenant(tenantId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"invite" | "roles" | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoles, setInviteRoles] = useState<string[]>([]);
  const [inviteApp, setInviteApp] = useState<"prop-admin" | "trader">("prop-admin");
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const userStatusTone = (s: string) =>
    s === "active" ? "success" : s === "suspended" ? "danger" : s === "invited" ? "warning" : "default";

  const columns: Column<TenantUser>[] = [
    {
      key: "name",
      header: "User",
      cell: (u) => (
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[10px] font-semibold">
            {u.initials}
          </span>
          <div>
            <p className="font-medium text-foreground">{u.name}</p>
            <p className="text-[10px] text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
      sortValue: (u) => u.name,
    },
    {
      key: "role",
      header: "Role",
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
          ))}
        </div>
      ),
      sortValue: (u) => u.roles.join(","),
    },
    {
      key: "application",
      header: "Application",
      cell: (u) => <Badge variant="outline" className="text-[10px]">{u.application}</Badge>,
      sortValue: (u) => u.application,
    },
    {
      key: "status",
      header: "Status",
      cell: (u) => (
        <span className="flex items-center gap-1">
          <Badge variant={u.status === "active" ? "default" : u.status === "suspended" ? "destructive" : "outline"} className="text-[10px]">
            {u.status}
          </Badge>
          {u.status === "invited" && <span className="text-[10px] text-muted-foreground">· invited {u.invitedAt ? new Date(u.invitedAt).toLocaleDateString() : ""}</span>}
        </span>
      ),
      sortValue: (u) => u.status,
    },
    {
      key: "lastActive",
      header: "Last active",
      cell: (u) => {
        const diff = Date.now() - new Date(u.lastActiveAt).getTime();
        const hours = Math.round(diff / (1000 * 60 * 60));
        const label = hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
        return <span className="text-xs text-muted-foreground">{label}</span>;
      },
      sortValue: (u) => u.lastActiveAt,
    },
    {
      key: "actions",
      header: "",
      cell: (u) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => { setEditUserId(u.id); setEditRoles([...u.roles]); setDialogMode("roles"); setDialogOpen(true); }}
          >
            <Pencil className="h-3 w-3" /> Manage roles
          </Button>
          {u.status === "active" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
              onClick={() => {
                setDialogMode(null);
                setDialogOpen(true);
                setEditUserId(null);
                const result = suspendTenantUser(u.id, tenantId, tenantName);
                toast({ title: result.title, description: result.description });
              }}
            >
              <Ban className="h-3 w-3" /> Suspend
            </Button>
          ) : null}
          {u.status === "suspended" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                setDialogMode(null);
                setDialogOpen(true);
                setEditUserId(null);
                const result = reactivateTenantUser(u.id, tenantId, tenantName);
                toast({ title: result.title, description: result.description });
              }}
            >
              <Play className="h-3 w-3" /> Reactivate
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={() => {
              setDialogMode(null);
              setDialogOpen(true);
              setEditUserId(null);
              const result = removeTenantUser(u.id, tenantId, tenantName);
              toast({ title: result.title, description: result.description });
            }}
          >
            <Trash2 className="h-3 w-3" /> Remove
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{tenantUsers.length} users in this tenant</p>
        <Button
          size="sm"
          onClick={() => { setInviteName(""); setInviteEmail(""); setInviteRoles([]); setInviteApp("prop-admin"); setDialogMode("invite"); setDialogOpen(true); }}
        >
          <UserPlus className="mr-1 h-4 w-4" /> Invite user
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={tenantUsers}
        rowKey={(u) => u.id}
        searchableText={(u) => `${u.name} ${u.email} ${u.roles.join(" ")} ${u.status}`}
        searchPlaceholder="Search tenant users…"
        pageSize={6}
        emptyTitle="No users in this tenant"
        emptyDescription="Invite a tenant administrator to manage their prop firm."
      />

      {/* Invite / role dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogMode === "invite" ? "Invite user" : "Manage roles"}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            {dialogMode === "invite"
              ? `Invite a new operator to ${tenantName}. The invite is stored and appears in this list immediately (demo).`
              : `Update roles for this tenant user (demo).`}
          </AlertDialogDescription>
          {dialogMode === "invite" && (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault();
              const roles = inviteRoles.filter((r) => r);
              if (!roles.length) return;
              const result = inviteTenantUser(tenantId, tenantName, inviteName, inviteEmail, roles, inviteApp);
              toast({ title: result.title, description: result.description });
              setDialogOpen(false);
              setDialogMode(null);
              setEditUserId(null);
            }}>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Full name</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="e.g. Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Email</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="e.g. jane@example.com" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Roles</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteRoles(inviteRoles.includes("admin") ? inviteRoles.filter((r) => r !== "admin") : [...inviteRoles, "admin"])}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${inviteRoles.includes("admin") ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRoles(inviteRoles.includes("support") ? inviteRoles.filter((r) => r !== "support") : [...inviteRoles, "support"])}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${inviteRoles.includes("support") ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                  >
                    Support
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRoles(inviteRoles.includes("compliance") ? inviteRoles.filter((r) => r !== "compliance") : [...inviteRoles, "compliance"])}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${inviteRoles.includes("compliance") ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                  >
                    Compliance
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">Select one or more roles</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Application</Label>
                <Select value={inviteApp} onValueChange={(v) => setInviteApp(v as "prop-admin" | "trader")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prop-admin">Prop Admin</SelectItem>
                    <SelectItem value="trader">Trader</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">Invite</Button>
              </div>
            </form>
          )}
          {dialogMode === "roles" && editUserId && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                The user's roles determine which console sections and actions they can access.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditRoles(editRoles.includes("admin") ? editRoles.filter((r) => r !== "admin") : [...editRoles, "admin"])}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${editRoles.includes("admin") ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => setEditRoles(editRoles.includes("support") ? editRoles.filter((r) => r !== "support") : [...editRoles, "support"])}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${editRoles.includes("support") ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                >
                  Support
                </button>
                <button
                  type="button"
                  onClick={() => setEditRoles(editRoles.includes("compliance") ? editRoles.filter((r) => r !== "compliance") : [...editRoles, "compliance"])}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${editRoles.includes("compliance") ? "border-primary bg-primary/10" : "hover:bg-muted/40"}`}
                >
                  Compliance
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">Select one or more roles</p>
            </div>
          )}
          <AlertDialogFooter>
            {dialogMode === "roles" && editUserId && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => {
                  const result = updateTenantUserRole(editUserId!, tenantId, tenantName, editRoles);
                  toast({ title: result.title, description: result.description });
                  setDialogOpen(false);
                  setDialogMode(null);
                  setEditUserId(null);
                }}
                >
                  Save roles
                </Button>
              </div>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 4 — Billing                                                    */
/* ------------------------------------------------------------------ */

interface InvoiceRow {
  id: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
}

function BillingTab({ tenant }: { tenant: TenantContext }) {
  const { user, navigate } = usePlatform();
  const cost = getPlanPrice(tenant.plan);
  const costLabel = formatCurrency(cost, tenant.currency);

  /* ── Invoicing configuration, payment methods, disputes (audit X #2)
     Session-scoped demo state — the tab remounts per tenant (key below),
     so each tenant starts from its own deterministic baseline. ── */
  const seed = tenant.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const [schedule, setSchedule] = useState((tenant.billingCycle ?? "monthly").charAt(0).toUpperCase() + (tenant.billingCycle ?? "monthly").slice(1));
  const [methods, setMethods] = useState<Array<{ id: string; label: string; detail: string }>>(
    () => {
      const list = [
        {
          id: "pm-primary",
          label: paymentMethodFor(tenant),
          detail: `Expires ${String((seed % 12) + 1).padStart(2, "0")}/${27 + (seed % 3)}`,
        },
      ];
      if (seed % 2 === 0) {
        list.push({
          id: "pm-backup",
          label: `ACH ··${String(1000 + (seed % 9000))}`,
          detail: "Business checking",
        });
      }
      return list;
    },
  );
  const [defaultMethod, setDefaultMethod] = useState("pm-primary");
  /* ── Dunning state: live from the dunning store (persists across reloads) ── */
  const dunningRecord: DunningRecord | undefined = useDunningForTenant(tenant.id);

  const [disputes, setDisputes] = useState<
    Array<{
      id: string;
      invoice: string;
      reason: string;
      amount: number;
      openedDays: number;
      status: "open" | "contested";
    }>
  >(() => {
    const reasons = ["Usage overage contested", "Plan proration disputed", "Seat count mismatch"];
    return Array.from({ length: seed % 3 }, (_, i) => ({
      id: `DSP-${4100 + ((seed + i * 7) % 800)}`,
      invoice: `INV-2026-${String(((seed + i) % 12) + 1).padStart(2, "0")}-${String(((seed + i * 3) % 90) + 10).padStart(3, "0")}`,
      reason: reasons[(seed + i) % reasons.length],
      amount: cost,
      openedDays: 3 + ((seed + i * 5) % 18),
      status: "open" as const,
    }));
  });

  const changeSchedule = (next: string) => {
    if (next === schedule) return;
    setSchedule(next);
    const cycle = next.toLowerCase() as TenantContext["billingCycle"];
    updateTenant(tenant.id, { billingCycle: cycle });
    toast({
      title: "Billing schedule updated",
      description: `${tenant.name} now invoices ${next.toLowerCase()}.`,
    });
    recordAudit({
      actor: user.name,
      action: "console.billing_schedule_changed",
      target: tenant.id,
      tenantId: tenant.id,
      severity: "info",
      detail: `${tenant.name}: invoicing schedule ${schedule} → ${next}`,
    });
  };

  const makeDefault = (m: { id: string; label: string }) => {
    setDefaultMethod(m.id);
    toast({ title: "Default method updated", description: `${m.label} is now the default.` });
    recordAudit({
      actor: user.name,
      action: "console.billing_method_default_changed",
      target: tenant.id,
      tenantId: tenant.id,
      severity: "info",
      detail: `${tenant.name}: default payment method → ${m.label}`,
    });
  };

  const removeMethod = (m: { id: string; label: string }) => {
    setMethods((prev) => {
      const next = prev.filter((x) => x.id !== m.id);
      if (defaultMethod === m.id) setDefaultMethod(next[0]?.id ?? "");
      return next;
    });
    toast({ title: "Payment method removed", description: `${m.label} removed from ${tenant.name}.` });
    recordAudit({
      actor: user.name,
      action: "console.billing_method_removed",
      target: tenant.id,
      tenantId: tenant.id,
      severity: "warning",
      detail: `${tenant.name}: removed payment method ${m.label}`,
    });
  };

  const resolveDispute = (d: { id: string; invoice: string }) => {
    setDisputes((prev) => prev.filter((x) => x.id !== d.id));
    toast({ title: "Dispute resolved", description: `${d.id} (${d.invoice}) resolved and credited.` });
    recordAudit({
      actor: user.name,
      action: "console.billing_dispute_resolved",
      target: d.id,
      tenantId: tenant.id,
      severity: "info",
      detail: `${tenant.name}: dispute ${d.id} on ${d.invoice} resolved`,
    });
  };

  const contestDispute = (d: { id: string; invoice: string }) => {
    setDisputes((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, status: "contested" as const } : x)),
    );
    toast({ title: "Dispute contested", description: `${d.id} contested — processor response pending.` });
    recordAudit({
      actor: user.name,
      action: "console.billing_dispute_contested",
      target: d.id,
      tenantId: tenant.id,
      severity: "warning",
      detail: `${tenant.name}: dispute ${d.id} on ${d.invoice} contested with processor`,
    });
  };

  // Mock billing history — 6 deterministic entries
  const history: InvoiceRow[] = useMemo(() => {
    const base = typeof cost === "number" ? cost : getPlanPrice(tenant.plan);
    const now = Date.now();
    const monthMs = 30 * 24 * 60 * 60 * 1000;
    return Array.from({ length: 6 }).map((_, i) => ({
      id: `inv-${i}`,
      date: new Date(now - i * monthMs).toISOString(),
      amount: base,
      status: i === 0 ? "paid" : i === 1 ? "pending" : "paid",
    }));
  }, [cost]);

  const columns: Column<InvoiceRow>[] = [
    {
      key: "id",
      header: "Invoice",
      cell: (r) => <span className="font-mono text-xs">{r.id.toUpperCase()}</span>,
      sortValue: (r) => r.id,
    },
    {
      key: "date",
      header: "Date",
      cell: (r) => <span className="text-xs">{new Date(r.date).toLocaleDateString()}</span>,
      sortValue: (r) => r.date,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (r) => formatCurrency(r.amount, tenant.currency),
      sortValue: (r) => r.amount,
      numeric: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => {
        const tone =
          r.status === "paid" ? "success" : r.status === "pending" ? "warning" : "danger";
        return <StatusBadge tone={tone}>{r.status}</StatusBadge>;
      },
      sortValue: (r) => r.status,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Subscription card */}
      <div className="rounded-lg border bg-card p-4 lg:col-span-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</p>
            <p className="mt-1 text-lg font-semibold capitalize">{tenant.plan}</p>
            <p className="text-sm text-muted-foreground">
              {costLabel} / month · billed {schedule.toLowerCase()}
            </p>
          </div>
          <StatusBadge tone="success">active</StatusBadge>
        </div>
        <Separator className="my-3" />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Billing cycle</dt>
            <dd className="mt-0.5">
              {/* Invoicing schedule config (audit X #2) — cycle is a
                  real selector, not static text; changes are toasted +
                  recorded in the audit trail. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="-ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Invoicing schedule: ${schedule}. Change schedule`}
                  >
                    {schedule} <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {["Weekly", "Monthly", "Quarterly", "Annually"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => changeSchedule(s)}>
                      {s}
                      {s === schedule ? <CheckCircle2 className="ml-auto h-3.5 w-3.5" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Next billing</dt>
            <dd className="mt-0.5">1st of next month</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Payment method</dt>
            {/* Round 4 fix: previously hardcoded "Visa ··4242" for every
                tenant — deterministic per-tenant card brand + last 4 so
                each tenant shows a different (but stable) card. Now bound
                to the managed methods list below (audit X #2). */}
            <dd className="mt-0.5">
              {methods.find((m) => m.id === defaultMethod)?.label ?? "No method on file"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-0.5">
                {dunningRecord ? (
                  dunningRecord.status === "normal" ? <span className="text-emerald-600 font-medium">Active</span> : dunningRecord.status === "suspended" ? <span className="text-red-600 font-medium">Suspended</span> : dunningRecord.status === "overdue" ? <span className="text-orange-600 font-medium">Overdue</span> : <span className="text-amber-600 font-medium">Past due</span>
                ) : <span className="text-emerald-600 font-medium">Active</span>}
              </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate("plan-transition", { tenant: tenant.id })}>
            Change plan <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => toast({ title: "Invoice generated", description: `Invoice for ${tenant.name} downloaded. (demo)` })}
          >
            <FileText className="h-3.5 w-3.5" /> Generate invoice
          </Button>
        </div>
      </div>

      {/* Spending summary */}
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Spending summary</p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">This month</span>
            <span className="font-medium">{costLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">YTD</span>
            <span className="font-medium">
              {typeof cost === "number" ? formatCurrency(cost * 6, tenant.currency) : "Custom"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">All-time</span>
            <span className="font-medium">
              {typeof cost === "number" ? formatCurrency(cost * 18, tenant.currency) : "Custom"}
            </span>
          </div>
        </div>
        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">
          <TrendingUp className="mr-1 inline h-3 w-3" />
          Spending tracked since tenant creation.
        </p>
      </div>

      {/* Billing history */}
      <div className="lg:col-span-3">
        <p className="mb-2 text-sm font-medium text-foreground">Billing history</p>
        <DataTable
          columns={columns}
          data={history}
          rowKey={(r) => r.id}
          pageSize={6}
          emptyTitle="No invoices yet"
          emptyDescription="Invoices will appear here after the first billing cycle."
        />
  {/* Dunning / failed payments */}
        {dunningRecord ? (
          <div className="rounded-lg border border-rose-500/10 bg-rose-50/40 p-3 text-xs text-rose-800 dark:text-rose-200 dark:bg-rose-950/20">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Dunning</div>
            <div className="mt-2 space-y-1.5">
              <div className="flex flex-col gap-1">
                <p className="font-medium truncate">{dunningRecord.tenantName}</p>
                <p className="text-[10px] opacity-70">{dunningRecord.daysOverdue} days overdue</p>
                {dunningRecord.status === "overdue" && (
                  <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => {
                    const result = escalateDunning(dunningRecord.id);
                    toast({ title: result.title, description: result.description });
                  }}>
                    Escalate
                  </Button>
                )}
                {dunningRecord.status !== "normal" && dunningRecord.status !== "cancelled" && (
                  <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => {
                    const result = suspendTenant(dunningRecord.id, "Non-payment");
                    toast({ title: result.title, description: result.description });
                  }}>
                    Suspend
                  </Button>
                )}
                {dunningRecord.status === "suspended" && (
                  <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => {
                    const result = reinstateTenant(dunningRecord.id);
                    toast({ title: result.title, description: result.description });
                  }}>
                    Reinstate
                  </Button>
                )}
                {dunningRecord.status === "normal" && (
                  <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => {
                    toast({ title: "Invoice PDF", description: `${dunningRecord.invoiceNumber} for ${dunningRecord.tenantName} — PDF download (demo).` });
                  }}>
                    PDF
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-rose-500/10 bg-rose-50/40 p-3 text-xs text-rose-800 dark:text-rose-200 dark:bg-rose-950/20">
            <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Dunning</div>
            <p className="text-muted-foreground">No overdue invoices</p>
          </div>
        )}

        {/* Payment method management + dispute handling (audit X #2) —
            the two billing workflows that previously had no surface at
            all: methods are managed (add/default/remove) and disputes
            are resolved or contested with audit-trail entries. */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Payment methods</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() =>
                  toast({
                    title: "Add payment method",
                    description: "The card verification form would open here. (demo)",
                  })
                }
              >
                <Plus className="h-3 w-3" /> Add method
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {methods.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No payment methods on file — the next invoice will enter dunning.
                </p>
              ) : (
                methods.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border p-2.5 text-sm"
                  >
                    <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{m.label}</p>
                      <p className="text-[11px] text-muted-foreground">{m.detail}</p>
                    </div>
                    {defaultMethod === m.id ? (
                      <StatusBadge tone="success">default</StatusBadge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => makeDefault(m)}
                      >
                        Set default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                      onClick={() => removeMethod(m)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium">Billing disputes</p>
            <div className="mt-3 space-y-2">
              {disputes.length === 0 ? (
                <p className="text-xs text-muted-foreground">No open disputes for this tenant.</p>
              ) : (
                disputes.map((d) => (
                  <div key={d.id} className="rounded-md border p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{d.id}</span>
                      <StatusBadge tone={d.status === "contested" ? "warning" : "danger"}>
                        {d.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{d.reason}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.invoice} · {formatCurrency(d.amount, tenant.currency)} · {d.openedDays}d open
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        disabled={d.status === "contested"}
                        onClick={() => resolveDispute(d)}
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px]"
                        disabled={d.status === "contested"}
                        onClick={() => contestDispute(d)}
                      >
                        Contest
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Provider SLA credits — R9 W6 UC-P5 (derived from Incident
          Control Center provider incidents × plan-tier rate). */}
      <SlaCreditsCard tenant={tenant} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Provider SLA credits — R9 W6 UC-P5                                  */
/* ------------------------------------------------------------------ */

/**
 * Credit rows derived from Incident Control Center provider incidents
 * (high/critical — Demo policy) priced at the tenant's plan-tier rate.
 * Adjusting a row requires a reason and writes the audit row in the
 * same step (adjustSlaCredit).
 */
function SlaCreditsCard({ tenant }: { tenant: TenantContext }) {
  const { user } = usePlatform();
  const rows = useSlaCreditRows(tenant.id);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");

  const pendingTotal = rows
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount, 0);
  const appliedTotal = rows
    .filter((r) => r.status === "applied")
    .reduce((s, r) => s + r.amount, 0);

  const startAdjust = (row: SlaCreditRow) => {
    setAdjusting(row.id);
    setAmountDraft(String(row.amount));
    setReasonDraft("");
  };

  const amount = Number(amountDraft);
  const canSave =
    adjusting !== null &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    reasonDraft.trim().length > 0;

  const saveAdjust = (row: SlaCreditRow) => {
    if (!canSave) return;
    adjustSlaCredit(row, amount, reasonDraft.trim(), user.name);
    toast({
      title: "SLA credit adjusted",
      description: `${row.incidentId} · ${row.tenantName} → ${formatCurrency(amount, tenant.currency)} — audit row recorded.`,
    });
    setAdjusting(null);
  };

  const rateSummary = (
    Object.keys(SLA_CREDIT_RATES) as TenantContext["plan"][]
  )
    .map((p) => `${p} $${SLA_CREDIT_RATES[p]}`)
    .join(" · ");

  return (
    <div className="rounded-lg border bg-card p-4 lg:col-span-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Provider SLA credits</p>
        <Badge variant="outline" className="text-[10px]">
          (Demo)
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Credits derive from Incident Control Center provider incidents rated
        high or critical, at the plan-tier rate ({rateSummary}) — one credit
        per qualifying incident. Resolved incidents stay listed as applied.
        Simulated aggregates (Demo).
      </p>

      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <span>
          Pending:{" "}
          <span className="font-semibold">
            {formatCurrency(pendingTotal, tenant.currency)}
          </span>
        </span>
        <span>
          Applied:{" "}
          <span className="font-semibold">
            {formatCurrency(appliedTotal, tenant.currency)}
          </span>
        </span>
        <span className="text-muted-foreground">
          {rows.length} credit row{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No qualifying SLA credits — credits accrue once a provider
            incident for this tenant is rated high or critical.
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-md border p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {row.incidentId} · {row.incidentTitle}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge
                    tone={row.status === "pending" ? "warning" : "success"}
                  >
                    {row.status}
                  </StatusBadge>
                  <span className="font-semibold">
                    {formatCurrency(row.amount, tenant.currency)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px]"
                    onClick={() =>
                      adjusting === row.id
                        ? setAdjusting(null)
                        : startAdjust(row)
                    }
                  >
                    {adjusting === row.id ? "Cancel" : "Adjust"}
                  </Button>
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {row.providerName} · plan {row.plan} · rate{" "}
                {formatCurrency(row.baseAmount, tenant.currency)}
                {row.adjustment
                  ? ` · adjusted from ${formatCurrency(row.baseAmount, tenant.currency)} by ${row.adjustment.by} — ${row.adjustment.reason}`
                  : ""}
              </p>

              {adjusting === row.id ? (
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div>
                    <Label className="text-[10px]">Amount</Label>
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={amountDraft}
                      onChange={(e) => setAmountDraft(e.target.value)}
                      className="h-7 w-24 text-xs"
                    />
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <Label className="text-[10px]">Reason (required)</Label>
                    <Input
                      value={reasonDraft}
                      placeholder="Why this amount differs from the rate"
                      onChange={(e) => setReasonDraft(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={!canSave}
                    onClick={() => saveAdjust(row)}
                  >
                    Save adjustment
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 6 — Configuration                                              */
/* ------------------------------------------------------------------ */

function ConfigurationTab({
  tenant,
  onChange,
  onPersist,
}: {
  tenant: TenantContext;
  onChange: (t: TenantContext) => void;
  onPersist: (t: TenantContext) => void;
}) {
  const [name, setName] = useState(tenant.name);
  const [tagline, setTagline] = useState(tenant.branding.tagline ?? "");
  const [currency, setCurrency] = useState(tenant.currency);
  const [timezone, setTimezone] = useState(tenant.timezone);
  const [locale, setLocale] = useState(tenant.locale);
  const [primaryColor, setPrimaryColor] = useState(tenant.branding.primaryColor);
  const [accentColor, setAccentColor] = useState(tenant.branding.accentColor);
  const [radius, setRadius] = useState(tenant.branding.radius);
  const [initials, setInitials] = useState(tenant.branding.initials);
const [domain, setDomain] = useState(tenant.domain || "");
const [subdomain, setSubdomain] = useState(tenant.subdomain || "");
const [region, setRegion] = useState(tenant.region || "");
const [terminology, setTerminology] = useState<Record<TermKey, string>>(tenant.terminology as Record<TermKey, string>);
const [newTermKey, setNewTermKey] = useState('');
const [newTermValue, setNewTermValue] = useState('');
const addCustomTerm = () => {
  if (!newTermKey || !newTermValue) return;
  setTerminology(prev => ({ ...prev, [newTermKey as TermKey]: newTermValue }));
  setNewTermKey('');
  setNewTermValue('');
};
const [owner, setOwner] = useState(tenant.owner || "");
const [ownerEmail, setOwnerEmail] = useState(tenant.ownerEmail || "");

  const presets = [
    { name: "Forest", primary: "#4a7c59", accent: "#705c30", surface: "#f5efe6" },
    { name: "Sage", primary: "#5a7c4a", accent: "#8a6d30", surface: "#f5efe6" },
    { name: "Deep Green", primary: "#4a6c59", accent: "#705c30", surface: "#f5efe6" },
    { name: "Golden Brown", primary: "#705c30", accent: "#4a7c59", surface: "#f5efe6" },
    { name: "Warm Taupe", primary: "#8a7560", accent: "#4a7c59", surface: "#f5efe6" },
    { name: "Slate Green", primary: "#5a7060", accent: "#705c30", surface: "#f5efe6" },
  ];

  const save = () => {
    const updated: TenantContext = {
      ...tenant,
      name,
      currency,
      timezone,
      locale,
      region,
      domain,
      subdomain,
      owner,
      ownerEmail,
      terminology,
      branding: {
        ...tenant.branding,
        name,
        tagline,
        primaryColor,
        accentColor,
        radius,
        initials: initials.toUpperCase(),
      },
    };
    onChange(updated);
    onPersist(updated);
    toast({
      title: "Configuration saved",
      description: `${name} updated successfully.`,
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-lg border bg-card p-4 lg:col-span-2">
        <p className="mb-3 text-sm font-medium">Tenant configuration</p>

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block text-xs">Color presets</Label>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    setPrimaryColor(p.primary);
                    setAccentColor(p.accent);
                  }}
                  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
                  style={{ borderColor: primaryColor === p.primary ? p.primary : undefined }}
                >
                  <span className="h-3 w-3 rounded-sm" style={{ background: p.primary }} />
                  <span className="h-3 w-3 rounded-sm" style={{ background: p.accent }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <FieldRow label="Tenant name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FieldRow>
            <FieldRow label="Tagline">
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </FieldRow>
            <FieldRow label="Currency">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="AED">AED</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Timezone">
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </FieldRow>
            <FieldRow label="Locale">
              <Input value={locale} onChange={(e) => setLocale(e.target.value)} />
            </FieldRow>
            <FieldRow label="Region">
              <Input value={region} onChange={(e) => setRegion(e.target.value)} />
            </FieldRow>
            <FieldRow label="Initials">
              <Input
                value={initials}
                maxLength={3}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
              />
            </FieldRow>
            <FieldRow label="Domain">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
            </FieldRow>
            <FieldRow label="Subdomain">
              <Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
            </FieldRow>
            <FieldRow label="Owner">
              <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner name" />
            </FieldRow>
            <FieldRow label="Owner Email">
              <Input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="owner@tenant.com" type="email" />
            </FieldRow>
            <FieldRow label="Terminology overrides">
              <div className="space-y-2">
                {Object.entries(terminology).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Input
                      value={value}
                      onChange={(e) => setTerminology(prev => ({ ...prev, [key as TermKey]: e.target.value }))}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTerminology(prev => {
                        const next = { ...prev };
                        delete next[key as TermKey];
                        return next;
                      })}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newTermKey}
                    onChange={(e) => setNewTermKey(e.target.value)}
                    placeholder="Term key (e.g., challenge)"
                    className="w-40"
                  />
                  <Input
                    value={newTermValue}
                    onChange={(e) => setNewTermValue(e.target.value)}
                    placeholder="Value"
                    className="flex-1"
                  />
                  <Button onClick={addCustomTerm} disabled={!newTermKey || !newTermValue}>
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Override default business terms. Use standard keys (challenge, trader, payout, etc.)
                  or custom keys for tenant-specific terminology.
                </p>
              </div>
            </FieldRow>
            <FieldRow label="Primary color">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-9 w-12 rounded-md border"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </FieldRow>
            <FieldRow label="Accent color">
              <div className="flex gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-9 w-12 rounded-md border"
                />
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
              </div>
            </FieldRow>
            <FieldRow label="Border radius">
              <Select value={radius} onValueChange={setRadius}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.25rem">Sharp (0.25rem)</SelectItem>
                  <SelectItem value="0.5rem">Subtle (0.5rem)</SelectItem>
                  <SelectItem value="0.625rem">Default (0.625rem)</SelectItem>
                  <SelectItem value="0.75rem">Rounded (0.75rem)</SelectItem>
                  <SelectItem value="1rem">Pill (1rem)</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
          <Button size="sm" onClick={save} className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> Save changes
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Live preview</p>
        <div
          className="rounded-lg border p-4"
          style={{ background: tenant.branding.surfaceColor }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
              style={{ background: primaryColor }}
            >
              {initials || "TN"}
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: primaryColor }}>{name}</p>
              <p className="text-xs text-muted-foreground">{tagline || "Tagline preview"}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="text-white"
              style={{ background: primaryColor, borderColor: primaryColor }}
            >
              Primary button
            </Button>
            <Button
              size="sm"
              variant="outline"
              style={{ color: accentColor, borderColor: accentColor }}
            >
              Accent button
            </Button>
          </div>
        </div>
        <Separator className="my-3" />
        <p className="text-xs text-muted-foreground">
          <Palette className="mr-1 inline h-3 w-3" />
          White-label changes apply instantly across the tenant's dashboard.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab — Analytics (audit U #5): per-tenant revenue, adoption, growth  */
/* ------------------------------------------------------------------ */

function AnalyticsTab({ tenant }: { tenant: TenantContext }) {
  const seed = hashStr(tenant.id);
  const traders = getTenantTraders(tenant.id);
  const accounts = getTenantAccounts(tenant.id);
  const payouts = getTenantPayouts(tenant.id);
  const allModules = moduleRegistry
    .getAll()
    .filter((m) => m.manifest.id !== "super-admin");
  const enabledCount = allModules.filter((m) =>
    tenant.enabledModules.includes(m.manifest.id),
  ).length;
  const adoptionPct =
    allModules.length > 0 ? Math.round((enabledCount / allModules.length) * 100) : 0;

  const cost = getPlanPrice(tenant.plan);

  // Deterministic 12-month revenue trend — plan-cost anchored with a
  // tenant-seeded jitter (no Math.random: stable across reloads).
  const revenue = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }).map((_, i) => {
      const back = 11 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const growth = 1 - back * 0.045;
      const jitter = ((seed >>> (i % 12)) % 7) - 3; // -3..+3 %
      return {
        date: d.toLocaleDateString("en-US", { month: "short" }),
        value: Math.max(1, Math.round(cost * (growth + jitter / 100))),
      };
    });
  }, [seed, cost]);

  // Traders added per month over the last 6 months — seeded per tenant.
  const signups = useMemo(() => {
    const now = new Date();
    const base =
      tenant.plan === "enterprise"
        ? 8
        : tenant.plan === "scale"
          ? 6
          : tenant.plan === "growth"
            ? 4
            : 2;
    return Array.from({ length: 6 }).map((_, i) => {
      const back = 5 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      return {
        month: d.toLocaleDateString("en-US", { month: "short" }),
        value: base + ((seed >>> i) % 5),
      };
    });
  }, [seed, tenant.plan]);

  const thisMonth = revenue[revenue.length - 1].value;
  const prevMonth = revenue[revenue.length - 2].value;
  const momDelta =
    prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : 0;

  // Last 30 days — payout volume and pending exposure.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentPayouts = payouts.filter((p) => Date.parse(p.createdAt) >= cutoff);
  const payoutVolume = recentPayouts.reduce((s, p) => s + p.amount, 0);
  const pendingCount = payouts.filter((p) => p.status === "pending").length;

  // Portfolio benchmarks — how this tenant compares to every other tenant.
  const avgTraders =
    allTenants.length > 0
      ? allTenants.reduce((s, t) => s + getTenantTraders(t.id).length, 0) /
        allTenants.length
      : 0;
  const avgAdoption =
    allTenants.length > 0 && allModules.length > 0
      ? (allTenants.reduce((s, t) => {
          const n = allModules.filter((m) =>
            t.enabledModules.includes(m.manifest.id),
          ).length;
          return s + n / allModules.length;
        }, 0) /
          allTenants.length) *
        100
      : 0;
  const avgPayoutVolume =
    allTenants.length > 0
      ? allTenants.reduce((s, t) => {
          const v = getTenantPayouts(t.id)
            .filter((p) => Date.parse(p.createdAt) >= cutoff)
            .reduce((a, p) => a + p.amount, 0);
          return s + v;
        }, 0) / allTenants.length
      : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Monthly revenue"
          value={formatCurrency(thisMonth, tenant.currency)}
          icon={DollarSign}
          tone="positive"
          delta={momDelta}
          deltaLabel="vs last month"
        />
        <MetricCard
          label="Active traders"
          value={traders.filter((t) => t.status === "active").length}
          icon={Users}
          deltaLabel={`${traders.length} total · ${accounts.length} accounts`}
        />
        <MetricCard
          label="30-day payout volume"
          value={formatCurrency(payoutVolume, tenant.currency)}
          icon={Banknote}
          tone={pendingCount > 0 ? "warning" : "default"}
          deltaLabel={`${pendingCount} pending review`}
        />
        <MetricCard
          label="Module adoption"
          value={`${adoptionPct}%`}
          icon={Package}
          tone={adoptionPct >= 70 ? "positive" : adoptionPct >= 40 ? "warning" : "negative"}
          deltaLabel={`${enabledCount}/${allModules.length} modules enabled`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Monthly revenue (12 months)</p>
          <AreaSeries
            data={revenue}
            xKey="date"
            yKey="value"
            color="#0f766e"
            height={200}
            formatValue={(v) => formatCurrency(v, tenant.currency)}
            label={`Monthly revenue for ${tenant.name} over 12 months, ending at ${formatCurrency(thisMonth, tenant.currency)}.`}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">Traders added (6 months)</p>
          <BarSeries
            data={signups}
            xKey="month"
            yKey="value"
            color="#b45309"
            height={200}
            label={`Traders added per month for ${tenant.name} — ${signups
              .map((s) => `${s.month}: ${s.value}`)
              .join(", ")}.`}
          />
        </div>
      </div>

      {/* Benchmarks — tenant performance in portfolio context (audit U #5) */}
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-medium">Benchmarks vs portfolio</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Traders per tenant
            </p>
            <p className="mt-1 text-2xl font-bold">{traders.length}</p>
            <p className="text-[11px] text-muted-foreground">
              portfolio avg {avgTraders.toFixed(1)} —{" "}
              {traders.length >= avgTraders ? "above" : "below"} average
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Module adoption
            </p>
            <p className="mt-1 text-2xl font-bold">{adoptionPct}%</p>
            <p className="text-[11px] text-muted-foreground">
              portfolio avg {Math.round(avgAdoption)}% —{" "}
              {adoptionPct >= avgAdoption ? "above" : "below"} average
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              30-day payout volume
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatCurrency(payoutVolume, tenant.currency)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              portfolio avg {formatCurrency(avgPayoutVolume, tenant.currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab 8 — Risk summary + quick nav (audit #2 fix)                    */
/* ------------------------------------------------------------------ */

function RiskTab({
  tenant,
  breaches,
  accountsCount,
}: {
  tenant: TenantContext;
  breaches: ReturnType<typeof getTenantBreaches>;
  accountsCount: number;
}) {
  const { navigate } = usePlatform();
  const open = breaches.filter((b) => b.status === "open");
  const critical = open.filter((b) => b.severity === "critical");
  // Mock risk score: weighted by open / critical / total accounts
  const riskScore = Math.min(
    100,
    open.length * 8 + critical.length * 14 + Math.max(0, accountsCount - 5),
  );
  const riskTone =
    riskScore >= 50 ? "danger" : riskScore >= 25 ? "warning" : "success";
  const riskColor =
    riskScore >= 50 ? "#e11d48" : riskScore >= 25 ? "#d97706" : "#059669";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-lg border bg-card p-4 lg:col-span-2">
        <p className="mb-3 text-sm font-medium">Risk summary</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Open breaches</p>
            <p className="mt-1 text-2xl font-bold">{open.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Critical</p>
            <p className="mt-1 text-2xl font-bold text-rose-600">{critical.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Accounts at risk</p>
            <p className="mt-1 text-2xl font-bold">{Math.min(accountsCount, open.length * 2)}</p>
          </div>
        </div>
        <Separator className="my-3" />
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium">
              <LabelWithHelp help="Composite risk score based on open breaches, critical violations, and accounts at risk. Lower is better.">
                Risk score
              </LabelWithHelp>
            </span>
            <span className="text-xs font-semibold" style={{ color: riskColor }}>
              {riskScore} / 100
            </span>
          </div>
          <Progress value={riskScore} className="h-2" style={{ color: riskColor }} />
          <p className="mt-1 text-[10px] text-muted-foreground">
            <StatusBadge tone={riskTone}>{riskScore >= 50 ? "high" : riskScore >= 25 ? "moderate" : "low"}</StatusBadge>
          </p>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-2 text-sm font-medium text-foreground">Quick actions</p>
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-1.5"
            onClick={() => {
              // Round 7 fix: actually navigate to the risk workspace
              // (previously toast-only — "Navigating to X (demo)" but no nav).
              // The console's cross-tenant risk workspace is the queues view.
              navigate("cross-tenant-queues");
            }}
          >
            <ShieldAlert className="h-3.5 w-3.5" />Open risk workspace
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-1.5"
            onClick={() => {
              navigate("abuse-signals");
            }}
          >
            <AlertTriangle className="h-3.5 w-3.5" />View open breaches
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-1.5"
            onClick={() => {
              // Round 7 fix: real CSV export of the tenant's open breaches
              // (previously toast-only — "Risk report will be downloaded (demo)"
              // but no file was written).
              exportToCsv(
                open,
                [
                  { key: "id", header: "Breach ID", value: (b: typeof open[number]) => b.id },
                  { key: "traderName", header: "Trader", value: (b) => b.traderName },
                  { key: "rule", header: "Rule", value: (b) => b.rule },
                  { key: "severity", header: "Severity", value: (b) => b.severity },
                  { key: "status", header: "Status", value: (b) => b.status },
                  { key: "triggeredAt", header: "Triggered At", value: (b) => b.triggeredAt },
                ],
                `risk-report-${tenant.slug}-${Date.now()}.csv`,
              );
              toast({
                title: "Risk report exported",
                description: `${open.length} open breaches for ${tenant.name} written to CSV.`,
              });
            }}
          >
            <FileText className="h-3.5 w-3.5" />Export risk report
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared form helpers                                                */
/* ------------------------------------------------------------------ */

function FieldRow({
  label,
  children,
  hint,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[10px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tenant Incidents panel — R9 W6 UC-P4                                 */
/* ------------------------------------------------------------------ */

function TenantIncidentsPanel({ tenantId }: { tenantId: string }) {
  const { user } = usePlatform();
  const center = useIncidentCenter();
  const incidents = readIncidents();
  const correlations = correlationsFor(incidents, center);
  const correlatedIds = new Set(
    correlations.flatMap((c) => c.incidents.map((i) => i.id)),
  );

  const severityTone = (s: IncidentSeverity) =>
    s === "critical" ? "danger" : s === "high" ? "warning" : s === "medium" ? "info" : "muted";

  const openIncidents = incidents.filter(
    (i) =>
      i.affectedTenantIds.includes(tenantId) &&
      effectiveSeverity(i, center.overrides) !== "resolved",
  );

  const handledIds = new Set(Object.keys(center.overrides));

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-3 text-sm font-medium">Incidents for {tenantId}</p>
      {openIncidents.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No open incidents for this tenant.
        </p>
      ) : (
        <div className="space-y-2">
          {openIncidents.map((inc) => {
            const hits = correlations.filter((c) =>
              c.incidents.some((i) => i.id === inc.id),
            );
            const hit = hits[0];
            return (
              <div key={inc.id} className="border rounded p-3 bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge
                    tone={severityTone(
                      effectiveSeverity(inc, center.overrides),
                    )}
                  >
                    {inc.severity}
                  </StatusBadge>
                  <span className="text-[10px] text-muted-foreground">
                    {inc.title}
                  </span>
                  {hit ? (
                    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-500/60">
                      correlated
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  Provider root cause:{providerName(inc.providerId || "")} ({inc.providerId || "—"})
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Started: {inc.started} · Owner:{effectiveOwner(
                    inc,
                    center.overrides,
                  )}
                </div>
                {handledIds.has(inc.id) ? (
                  <>
                    <div className="mt-1 text-xs">
                      Owner override:
                      <input
                        value=""
                        className="bg-input border rounded w-full px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="mt-1 text-xs">
                      Severity override:
                      <select
                        className="bg-input border rounded w-full px-2 py-1 text-xs"
                      >
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="critical">critical</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-xs text-muted-foreground">
                    No overrides yet
                  </div>
                )}
                {hit && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Tenants affected by{hit.providerName}:
                    {hit.tenantIds.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
          {correlations.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-muted-foreground">
                Correlated groups (provider root cause):
              </p>
              {correlations.map((c) => (
                <div
                  key={c.providerId}
                  className="border rounded p-2 bg-amber-500/10 mb-2"
                >
                  <div className="flex items-center gap-2 text-xs text-amber-700 mb-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="font-medium">
                      {c.providerName} — {c.tenantIds.length} tenants affected
                    </span>
                    {c.ack ? (
                      <span className="text-xs text-amber-600">
                        acknowledged by {c.ack.by}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-5 px-1 text-xs"
                        onClick={() =>
                          acknowledgeCorrelation(
                            {
                              providerId: c.providerId,
                              providerName: c.providerName,
                              incidentIds: c.incidents.map((i) => i.id),
                              tenantCount: c.tenantIds.length,
                            },
                            user.name,
                          )
                        }
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Incidents: {c.incidents.map((i) => i.id).join(", ")} ·
                    Tenants: {c.tenantIds.join(", ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
