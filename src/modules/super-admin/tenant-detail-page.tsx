"use client";

/**
 * Tenant Detail Page — comprehensive tenant workspace (spec §6, §41, §43).
 *
 * Super Admin's view into a single tenant: header + KPI row + 7 tabs that
 * cover the full tenant lifecycle surface:
 *   1. Overview       — summary + module adoption progress
 *   2. Modules        — toggle which modules this tenant can access (KEY feature)
 *   3. Users          — tenant's admin/support users
 *   4. Billing        — subscription + invoice history
 *   5. Activity       — recent audit timeline
 *   6. Configuration  — edit tenant settings (name, currency, branding, etc.)
 *   7. Risk           — risk summary + quick nav to tenant risk workspace
 *
 * Destructive actions (Suspend, Terminate) use AlertDialog with explicit
 * consequence explanations (UX §24). One primary action per surface (§22).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantBreaches,
  getTenantPayouts,
  getTenantKyc,
  getTenantAudit,
  users as allUsers,
} from "@/lib/platform/mock-data";
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
import { toast } from "@/hooks/use-toast";
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
  AlertTriangle,
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const PLAN_COST: Record<TenantContext["plan"], number | string> = {
  starter: 890,
  growth: 1900,
  scale: 4900,
  enterprise: "Custom",
};

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
            : "warning";

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export function TenantDetailPage() {
  const { router, navigate, availableTenants, setTenant, pushNotification, user } = usePlatform();
  const tenantId = router.params.id;

  const foundTenant = useMemo(
    () => availableTenants.find((t) => t.id === tenantId && t.id !== "platform"),
    [availableTenants, tenantId],
  );

  // Local working copy so module toggles / config edits are reflected
  // immediately in this surface and also pushed to global context.
  const [localTenant, setLocalTenant] = useState<TenantContext | null>(foundTenant ?? null);
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
  const [activeTab, setActiveTab] = useState<string>("overview");

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
  const openBreaches = tenantBreaches.filter((b) => b.status === "open");
  const pendingPayouts = tenantPayouts.filter((p) => p.status === "pending");
  const pendingKyc = tenantKyc.filter((k) => k.status === "pending" || k.status === "review");
  const activeAccounts = tenantAccounts.filter((a) => a.status === "active");
  const monthlyRevenue =
    typeof PLAN_COST[localTenant.plan] === "number"
      ? (PLAN_COST[localTenant.plan] as number)
      : 4900;

  /* ---- Apply status change with toast + notification ---- */
  const applyStatus = (status: TenantContext["status"], verb: string) => {
    const updated: TenantContext = { ...localTenant, status };
    setLocalTenant(updated);
    setTenant(updated);
    pushNotification({
      title: `Tenant ${verb}`,
      message: `${localTenant.name} is now ${status}.`,
      severity:
        status === "suspended" || status === "terminated" ? "warning" : "success",
      module: "super-admin",
    });
    toast({
      title: `Tenant ${verb}`,
      description: `${localTenant.name} is now ${status}.`,
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
                <Button size="sm" variant="outline">
                  <LogIn className="mr-1 h-4 w-4" />Login as
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Impersonate this tenant?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will be switched into the <strong>{localTenant.name}</strong> workspace with their branding, modules, and permissions. All actions you take will be logged with an “impersonated by” flag in the audit trail. To return to the platform admin view, use the tenant switcher in the topbar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/20">
                  <div className="flex items-start gap-2">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <div className="font-medium text-amber-900 dark:text-amber-100">Audit-trail notice</div>
                      <div className="mt-0.5 text-amber-800 dark:text-amber-200">
                        Your session is being impersonated by platform admin <strong>{user.name}</strong>. All actions are attributed to <strong>{localTenant.name}</strong> but flagged as impersonated.
                      </div>
                    </div>
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      setTenant(localTenant);
                      pushNotification({
                        title: `Impersonating ${localTenant.name}`,
                        message: `Platform admin ${user.name} switched into ${localTenant.name}. Use the tenant switcher in the topbar to return.`,
                        severity: "warning",
                        module: "super-admin",
                      });
                      toast({
                        title: `Now viewing as ${localTenant.name}`,
                        description: "Use the tenant switcher in topbar to return to platform admin view.",
                      });
                    }}
                  >
                    <LogIn className="mr-1 h-4 w-4" />Switch to {localTenant.name}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab("configuration")}
            >
              <SettingsIcon className="mr-1 h-4 w-4" />Edit Configuration
            </Button>

            {localTenant.status === "active" || localTenant.status === "trial" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Pause className="mr-1 h-4 w-4" />Suspend
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Suspend {localTenant.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The tenant will lose all platform access immediately. Trader logins,
                      open positions, and payout processing are paused. Admin users can still
                      log in to manage suspended-state tasks. This is reversible — you can
                      reactivate the tenant at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={cn("bg-destructive text-white hover:bg-destructive/90")}
                      onClick={() => applyStatus("suspended", "suspended")}
                    >
                      Suspend tenant
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}

            {localTenant.status === "suspended" ? (
              <Button
                size="sm"
                onClick={() => applyStatus("active", "reactivated")}
              >
                <Play className="mr-1 h-4 w-4" />Reactivate
              </Button>
            ) : null}

            {localTenant.status !== "terminated" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Ban className="mr-1 h-4 w-4" />Terminate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Terminate {localTenant.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All trader data, accounts, payouts, and audit logs for this tenant will be
                      permanently archived. The tenant will lose all platform access immediately.
                      This action cannot be reversed from the standard admin UI — recovery
                      requires a platform-level data restoration request.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className={cn("bg-destructive text-white hover:bg-destructive/90")}
                      onClick={() => applyStatus("terminated", "terminated")}
                    >
                      Terminate tenant
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </>
        }
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap justify-start">
          <TabsTrigger value="overview" className="gap-1"><Activity className="h-3 w-3" />Overview</TabsTrigger>
          <TabsTrigger value="modules" className="gap-1"><Package className="h-3 w-3" />Modules</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users className="h-3 w-3" />Users</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1"><DollarSign className="h-3 w-3" />Billing</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1"><Clock className="h-3 w-3" />Activity</TabsTrigger>
          <TabsTrigger value="configuration" className="gap-1"><SettingsIcon className="h-3 w-3" />Configuration</TabsTrigger>
          <TabsTrigger value="risk" className="gap-1"><ShieldAlert className="h-3 w-3" />Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab tenant={localTenant} />
        </TabsContent>
        <TabsContent value="modules">
          <ModulesTab tenant={localTenant} onChange={setLocalTenant} onPersist={setTenant} />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab tenantId={localTenant.id} />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab tenant={localTenant} />
        </TabsContent>
        <TabsContent value="activity">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Recent activity</p>
            <ActivityTimeline entries={tenantAudit} max={12} />
          </div>
        </TabsContent>
        <TabsContent value="configuration">
          <ConfigurationTab tenant={localTenant} onChange={setLocalTenant} onPersist={setTenant} />
        </TabsContent>
        <TabsContent value="risk">
          <RiskTab tenant={localTenant} breaches={tenantBreaches} accountsCount={tenantAccounts.length} />
        </TabsContent>
      </Tabs>
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
  const allModules = moduleRegistry.getAll();
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

  return (
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
  const allModules = moduleRegistry.getAll();

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
  const tenantUsers = allUsers.filter((u) => u.tenantId === tenantId);

  const columns: Column<AuthUser>[] = [
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
            onClick={() => toast({ title: "Edit role", description: `Opening role editor for ${u.name}. (demo)` })}
          >
            <Pencil className="h-3 w-3" /> Edit role
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={() => toast({ title: "User removed", description: `${u.name} removed from tenant. (demo)` })}
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
          onClick={() => toast({ title: "Invite user", description: "Invitation form would open here. (demo)" })}
        >
          <UserPlus className="mr-1 h-4 w-4" /> Invite user
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={tenantUsers}
        rowKey={(u) => u.id}
        searchableText={(u) => `${u.name} ${u.email} ${u.roles.join(" ")}`}
        searchPlaceholder="Search tenant users…"
        pageSize={6}
        emptyTitle="No users in this tenant"
        emptyDescription="Invite a tenant administrator to manage their prop firm."
      />
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
  const cost = PLAN_COST[tenant.plan];
  const costLabel = typeof cost === "number" ? formatCurrency(cost, tenant.currency) : "Custom";

  // Mock billing history — 6 deterministic entries
  const history: InvoiceRow[] = useMemo(() => {
    const base = typeof cost === "number" ? cost : 4900;
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
              {costLabel} / month · billed monthly
            </p>
          </div>
          <StatusBadge tone="success">active</StatusBadge>
        </div>
        <Separator className="my-3" />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Billing cycle</dt>
            <dd className="mt-0.5">Monthly</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Next billing</dt>
            <dd className="mt-0.5">1st of next month</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Payment method</dt>
            {/* Round 4 fix: previously hardcoded "Visa ··4242" for every
                tenant — deterministic per-tenant card brand + last 4 so
                each tenant shows a different (but stable) card. */}
            <dd className="mt-0.5">{paymentMethodFor(localTenant ?? tenant)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
            <dd className="mt-0.5">In good standing</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                Change plan <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={() => toast({ title: "Plan change requested", description: "Switching to Starter plan." })}
              >
                Starter — $890/mo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast({ title: "Plan change requested", description: "Switching to Growth plan." })}
              >
                Growth — $1,900/mo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast({ title: "Plan change requested", description: "Switching to Scale plan." })}
              >
                Scale — $4,900/mo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast({ title: "Plan change requested", description: "An account executive will reach out for Enterprise pricing." })}
              >
                Enterprise — Custom
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        <p className="mb-2 text-sm font-medium">Spending summary</p>
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
        <p className="mb-2 text-sm font-medium">Billing history</p>
        <DataTable
          columns={columns}
          data={history}
          rowKey={(r) => r.id}
          pageSize={6}
          emptyTitle="No invoices yet"
          emptyDescription="Invoices will appear here after the first billing cycle."
        />
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
            <FieldRow label="Initials">
              <Input
                value={initials}
                maxLength={3}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
              />
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
        <p className="mb-2 text-sm font-medium">Live preview</p>
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
/* Tab 7 — Risk                                                       */
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
        <p className="mb-2 text-sm font-medium">Quick actions</p>
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-1.5"
            onClick={() => toast({ title: "Opening risk workspace", description: `Navigating to ${tenant.name}'s risk workspace. (demo)` })}
          >
            <ShieldAlert className="h-3.5 w-3.5" />Open risk workspace
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-1.5"
            onClick={() => toast({ title: "Opening breaches", description: `Showing ${open.length} open breaches. (demo)` })}
          >
            <AlertTriangle className="h-3.5 w-3.5" />View open breaches
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start gap-1.5"
            onClick={() => toast({ title: "Export queued", description: "Risk report will be downloaded. (demo)" })}
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
