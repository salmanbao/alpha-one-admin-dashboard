"use client";

/**
 * Platform Operations Home — the main Platform Admin dashboard.
 *
 * Research item #3. This is NOT a generic analytics dashboard — it's an
 * operational console with:
 *   - Platform service health from the one shared catalog in
 *     `lib/platform/operations-signals.ts` (also rendered by System Health)
 *   - Operational signals derived from the owning stores (failed jobs from
 *     the jobs store, provider degradation from the provider catalog)
 *   - Tenant overview (active / suspended counts)
 *   - Infrastructure facts from the shared `PLATFORM_FACTS` (version,
 *     deployment age, backup age, RPO) so no page holds a private copy
 *   - Attention Center (derived + severity-ranked from the upstream stores)
 *
 * Every attention item links directly to the workspace that can resolve it.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import {
  tenants as allTenants,
  getTenantPayouts,
  getTenantKyc,
  getTenantTickets,
  getTenantBreaches,
} from "@/lib/platform/mock-data";
import {
  PLATFORM_FACTS,
  PLATFORM_SERVICES,
  deriveAttention,
  type AttentionItem,
  type PlatformService,
  type QueueCounts,
} from "@/lib/platform/operations-signals";
import { useJobOverrides, effectiveJobs } from "@/lib/platform/jobs-store";
import { readIncidents } from "@/lib/platform/incident-center-store";
import { useConsoleStore, type ControlKey } from "@/lib/platform/console-store";
import { useApprovalRequests, pendingApprovals } from "@/components/platform/approval-flow";
import {
  Activity,
  Server,
  Database,
  Zap,
  Globe,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  HardDrive,
  GitBranch,
  ArrowRight,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

const serviceIcon: Record<string, ComponentType<{ className?: string }>> = {
  "api-gateway": Globe,
  database: Database,
  "database-replica": Database,
  "mt5-bridge": Zap,
  "ctrader-gateway": Zap,
  "payment-processor": Globe,
  "kyc-provider": ShieldCheck,
  "ai-engine": Cpu,
  "notification-service": Bell,
  cache: Zap,
  "event-bus": Activity,
  "worker-pool": Cpu,
  "identity-provider": ShieldCheck,
  "document-generator": HardDrive,
  queue: Server,
  cdn: Globe,
};

const statusWord: Record<PlatformService["status"], string> = {
  operational: "OK",
  degraded: "DEGRADED",
  down: "DOWN",
};

const severityTone = (s: AttentionItem["severity"]) =>
  s === "critical" ? "danger" : s === "warning" ? "warning" : "info";

const severityIcon: Record<AttentionItem["severity"], ComponentType<{ className?: string }>> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Bell,
};

const HOUR_MS = 3_600_000;

export function PlatformOperationsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; store-driven
  // state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { navigate } = usePlatform();

  const activeTenants = allTenants.filter((t) => t.status === "active").length;
  const suspendedTenants = allTenants.filter((t) => t.status === "suspended").length;
  const pendingPayoutsAll = allTenants.reduce((s, t) => s + getTenantPayouts(t.id).filter((p) => p.status === "pending").length, 0);
  const pendingKycAll = allTenants.reduce((s, t) => s + getTenantKyc(t.id).filter((k) => k.status === "pending" || k.status === "review").length, 0);
  const openBreachesAll = allTenants.reduce((s, t) => s + getTenantBreaches(t.id).filter((b) => b.status === "open").length, 0);
  const openTicketsAll = allTenants.reduce((s, t) => s + getTenantTickets(t.id).filter((tk) => tk.status === "open").length, 0);

  const operationalCount = PLATFORM_SERVICES.filter((s) => s.status === "operational").length;
  const degradedCount = PLATFORM_SERVICES.filter((s) => s.status === "degraded").length;
  const downCount = PLATFORM_SERVICES.filter((s) => s.status === "down").length;

  // Degraded-first ordering so an operator sees what's broken without
  // eyeballing the grid (P2-4).
  const sortedServices = useMemo(
    () =>
      [...PLATFORM_SERVICES].sort((a, b) => {
        const rank = (s: PlatformService["status"]) =>
          s === "down" ? 0 : s === "degraded" ? 1 : 2;
        return rank(a.status) - rank(b.status) || a.name.localeCompare(b.name);
      }),
    [],
  );

  // Upstream store reads — attention is derived from these, never hardcoded.
  const jobOverrides = useJobOverrides();
  const jobs = effectiveJobs(jobOverrides);
  const incidents = readIncidents();
  const approvals = useApprovalRequests();
  const pendingApprovalCount = pendingApprovals(approvals).length;

  const queueCounts: QueueCounts = {
    payouts: pendingPayoutsAll,
    kyc: pendingKycAll,
    breaches: openBreachesAll,
    support: openTicketsAll,
  };

  const consoleStore = useConsoleStore();
  const emergencyControls: ControlKey[] = ['platform_halt', 'relay_pause', 'maintenance_mode', 'flag_kill_switches'];
  const activeEmergencyControlKeys = emergencyControls.filter(controlKey => {
    const state = consoleStore.controls[controlKey];
    return state === 'pending_approval' || state === 'engaged';
  });

  const attentionItems: AttentionItem[] = useMemo(() => {
    const derived = deriveAttention({
      services: PLATFORM_SERVICES,
      incidents,
      jobs,
      queueCounts,
      facts: PLATFORM_FACTS,
    });
    // Pending approvals are a real operator obligation, routed to their
    // workspace when any exist.
    if (pendingApprovalCount > 0) {
      derived.unshift({
        id: "pending-approvals",
        severity: "warning",
        title: `${pendingApprovalCount} approval${pendingApprovalCount > 1 ? "s" : ""} awaiting a second operator`,
        detail: "Two-operator actions expire after the 10-minute window.",
        cta: "Open approval center",
        navigateTo: "approval-center",
        navigateParams: {},
      });
    }
    // Emergency controls attention items (R0 attention rule)
    activeEmergencyControlKeys.forEach(controlKey => {
      const controlState = consoleStore.controls[controlKey];
      const controlName = controlKey.replace('_', ' ');
      
      derived.unshift({
        id: `emergency-${controlKey}`,
        severity: controlState === "pending_approval" ? "warning" : "critical",
        title: `${controlName} ${controlState === "pending_approval" ? "pending approval" : "engaged"}`,
        detail: `Control "${controlKey}" is ${controlState === "pending_approval" ? "pending" : "active"}`,
        cta: "View details",
        navigateTo: "emergency-controls",
        navigateParams: {},
      });
    });
    
    // Re-sort after the unshift — severity order is the policy (§4.3).
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    return derived.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [incidents, jobs, pendingPayoutsAll, pendingKycAll, openBreachesAll, openTicketsAll, pendingApprovalCount, consoleStore.controls, activeEmergencyControlKeys]);

  // Operational signals — each row declares its owning store; no row
  // without a data source + threshold may exist here (AGENTS §67).
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const failedJobFailures = failedJobs.reduce((s, j) => s + j.failureCount, 0);
  const degradedServices = PLATFORM_SERVICES.filter((s) => s.status !== "operational").length;

  const signals: { label: string; value: string; tone: "positive" | "warning" | "negative" }[] = [
    {
      label: "Failed jobs",
      value: failedJobs.length > 0 ? `${failedJobs.length} job (${failedJobFailures} failures)` : "0 jobs",
      tone: failedJobs.length > 0 ? "warning" : "positive",
    },
    {
      label: "Degraded services",
      value: `${degradedServices}/${PLATFORM_SERVICES.length}`,
      tone: degradedServices > 0 ? "warning" : "positive",
    },
    {
      label: "Pending approvals",
      value: String(pendingApprovalCount),
      tone: pendingApprovalCount > 0 ? "warning" : "positive",
    },
  ];

  // Infrastructure facts from the shared module — formatted at render.
  const deployAgeH = Math.floor((Date.now() - Date.parse(PLATFORM_FACTS.lastDeploymentAt)) / HOUR_MS);
  const backupAgeH = Math.floor((Date.now() - Date.parse(PLATFORM_FACTS.lastBackupAt)) / HOUR_MS);
  const rpoOk = backupAgeH <= PLATFORM_FACTS.rpoWindowHours;

  // Current time for the Live badge
  const [platformTime, setPlatformTime] = useState(new Date());

  return (
    <Page>
      <PageHeader
        title="Operations Home"
        description="Platform operations console — service health, operational signals, and attention items."
        icon={Activity}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-600">
                {platformTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <Button size="sm" variant="outline" onClick={() => setPlatformTime(new Date())}>
                Refresh
              </Button>
            </Badge>
            <Button size="sm" variant="outline" onClick={() => navigate("bridge-sync-log")}>
              <GitBranch className="mr-1 h-4 w-4" /> Bridge sync
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("emergency-controls")}>
              <ShieldCheck className="mr-1 h-4 w-4" /> Emergency
            </Button>
          </div>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading operations…"
        >
        {/* Attention Center — derived items, or an explicit all-clear */}
        {attentionItems.length > 0 && attentionItems[0].id !== "all-clear" ? (
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold">{attentionItems.length} item{attentionItems.length === 1 ? "" : "s"} need attention</span>
            </CardHeader>
            <CardContent className="space-y-2">
              {attentionItems.map((item) => {
                const Icon = severityIcon[item.severity];
                const tone = severityTone(item.severity);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.navigateTo, item.navigateParams)}
                    className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:bg-accent/40"
                  >
                    <Icon className={cn(
                      "h-4 w-4 shrink-0",
                      tone === "danger" ? "text-rose-600" : tone === "warning" ? "text-amber-600" : "text-slate-500",
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className={cn(
                        "text-[10px] capitalize",
                        tone === "danger" ? "border-rose-500/30 text-rose-700 dark:text-rose-400" : "",
                        tone === "warning" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : "",
                      )}>{item.severity}</Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold">All clear</span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No payouts, queues, services or backups need attention right now.
                Attention items appear here when an SLA or health threshold is
                crossed, and link straight to the workspace that can resolve them.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Platform health KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Services Operational" value={`${operationalCount}/${PLATFORM_SERVICES.length}`} icon={CheckCircle2} tone={downCount > 0 ? "negative" : degradedCount > 0 ? "warning" : "positive"} />
          <MetricCard label="Degraded Services" value={degradedCount} icon={AlertTriangle} tone={degradedCount > 0 ? "warning" : "positive"} />
          <MetricCard label="Active Tenants" value={activeTenants} icon={Activity} tone="positive" onClick={() => navigate("tenants", { status: "active" })} />
          <MetricCard label="Suspended" value={suspendedTenants} icon={XCircle} tone={suspendedTenants > 0 ? "negative" : "positive"} onClick={() => navigate("tenants", { status: "suspended" })} />
        </div>

        {/* Service health grid */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium">Platform service health</span>
            <Button size="sm" variant="ghost" onClick={() => navigate("system-health")}>
              View details <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortedServices.map((s) => {
                const Icon = serviceIcon[s.id] ?? Server;
                return (
                  <div key={s.id} className="flex items-center gap-2 rounded-md border p-2">
                    <div className="rounded-md bg-muted p-1.5"><Icon className="h-3.5 w-3.5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.latencyMs !== null ? `${s.latencyMs}ms` : "—"} · {s.lastHeartbeatAt}
                      </p>
                    </div>
                    <span className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      s.status === "operational" ? "bg-emerald-500" : s.status === "degraded" ? "bg-amber-500" : "bg-rose-500",
                    )} />
                    <span className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide",
                      s.status === "operational" ? "text-emerald-600" : s.status === "degraded" ? "text-amber-600" : "text-rose-600",
                    )}>{statusWord[s.status]}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Operational signals */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Operational signals</span></CardHeader>
            <CardContent className="space-y-2">
              {signals.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <Badge variant="outline" className={cn(
                    "text-[10px]",
                    s.tone === "positive" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400" : "",
                    s.tone === "warning" ? "border-amber-500/30 text-amber-700 dark:text-amber-400" : "",
                    s.tone === "negative" ? "border-rose-500/30 text-rose-700 dark:text-rose-400" : "",
                  )}>{s.value}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Cross-tenant queues</span></CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pending KYC reviews</span>
                <button onClick={() => navigate("cross-tenant-queues", { queue: "kyc" })} className="font-medium text-foreground hover:underline">{pendingKycAll}</button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pending payouts</span>
                <button onClick={() => navigate("cross-tenant-queues", { queue: "payouts" })} className="font-medium text-foreground hover:underline">{pendingPayoutsAll}</button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Open breaches</span>
                <button onClick={() => navigate("cross-tenant-queues", { queue: "risk" })} className="font-medium text-foreground hover:underline">{openBreachesAll}</button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Open support tickets</span>
                <button onClick={() => navigate("cross-tenant-queues", { queue: "support" })} className="font-medium text-foreground hover:underline">{openTicketsAll}</button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Infrastructure — shared PLATFORM_FACTS, formatted at render */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-sm font-medium">Infrastructure</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => navigate("deployments")}>
                <GitBranch className="mr-1 h-3 w-3" /> Deployments
              </Button>
              <Button size="sm" variant="ghost" onClick={() => navigate("backups-dr")}>
                <Database className="mr-1 h-3 w-3" /> Backups
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current version</p>
                <p className="text-sm font-semibold tabular-nums">{PLATFORM_FACTS.platformVersion}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last deployment</p>
                <p className="text-sm font-semibold">{deployAgeH}h ago</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last backup</p>
                <p className="text-sm font-semibold">{backupAgeH}h ago</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">RPO status</p>
                <StatusBadge tone={rpoOk ? "success" : "warning"}>
                  {rpoOk ? "Within target" : "Overdue"}
                </StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}