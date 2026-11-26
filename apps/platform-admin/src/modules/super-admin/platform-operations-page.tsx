"use client";

/**
 * Platform Operations Home — the main Platform Admin dashboard.
 *
 * Research item #3. This is NOT a generic analytics dashboard — it's an
 * operational console with:
 *   - Platform health signals (API / DB / Redis / event bus / workers / bridges)
 *   - Operational signals derived from the owning stores (failed jobs from
 *     the jobs store, provider degradation from the provider catalog)
 *   - Tenant overview (active / suspended counts)
 *   - Infrastructure (deployment version, backup status, RPO)
 *   - Attention Center (operational alerts that need operator action)
 *
 * Every attention item links directly to the relevant workspace.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { tenants as allTenants, getTenantPayouts, getTenantKyc, getTenantTickets, getTenantBreaches } from "@/lib/platform/mock-data";
import { PROVIDERS } from "@/lib/platform/provider-catalog";
import { useJobOverrides, effectiveJobs } from "@/lib/platform/jobs-store";
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

interface ServiceHealth {
  name: string;
  icon: ComponentType<{ className?: string }>;
  status: "operational" | "degraded" | "down";
  latency: string;
  lastHeartbeat: string;
}

const services: ServiceHealth[] = [
  { name: "API Gateway", icon: Globe, status: "operational", latency: "42ms", lastHeartbeat: "2s ago" },
  { name: "Core API", icon: Server, status: "operational", latency: "38ms", lastHeartbeat: "1s ago" },
  { name: "Database", icon: Database, status: "operational", latency: "8ms", lastHeartbeat: "1s ago" },
  { name: "Redis Cache", icon: Zap, status: "operational", latency: "2ms", lastHeartbeat: "1s ago" },
  { name: "Event Bus", icon: Activity, status: "operational", latency: "15ms", lastHeartbeat: "3s ago" },
  { name: "MT5 Bridge", icon: Zap, status: "degraded", latency: "320ms", lastHeartbeat: "8s ago" },
  { name: "Worker Pool", icon: Cpu, status: "operational", latency: "—", lastHeartbeat: "5s ago" },
  { name: "Identity Provider", icon: ShieldCheck, status: "operational", latency: "120ms", lastHeartbeat: "4s ago" },
  { name: "Payment Provider", icon: Globe, status: "operational", latency: "210ms", lastHeartbeat: "6s ago" },
  { name: "KYC Provider", icon: ShieldCheck, status: "operational", latency: "310ms", lastHeartbeat: "12s ago" },
  { name: "Notification Service", icon: Bell, status: "degraded", latency: "680ms", lastHeartbeat: "15s ago" },
  { name: "Document Generator", icon: HardDrive, status: "operational", latency: "180ms", lastHeartbeat: "9s ago" },
];

interface AttentionItem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  cta: string;
  navigateTo: string;
}

/**
 * Static attention items still pending derivation (their sources are
 * hardcoded service/fact rows until the shared operations-signals module
 * lands). The payout SLA item is derived in the component — it must
 * always equal the Queues card's pending-payout count on the same render.
 */
const staticAttentionItems: AttentionItem[] = [
  {
    id: "mt5-degraded",
    severity: "warning",
    title: "MT5 Bridge degraded",
    detail: "Latency 320ms (normal: <100ms). 2 tenants affected.",
    cta: "Investigate",
    navigateTo: "provider-registry",
  },
  {
    id: "notification-delay",
    severity: "warning",
    title: "Notification service degraded",
    detail: "Email delivery latency 680ms (normal: <200ms). Postmark API responding slowly.",
    cta: "Investigate",
    navigateTo: "provider-registry",
  },
  {
    id: "backup-stale",
    severity: "info",
    title: "Last backup 18h ago",
    detail: "WAL backup running within RPO (24h). Consider scheduling a drill.",
    cta: "View backups",
    navigateTo: "backups-dr",
  },
];

const statusTone = (s: ServiceHealth["status"]) =>
  s === "operational" ? "success" : s === "degraded" ? "warning" : "danger";

const severityTone = (s: AttentionItem["severity"]) =>
  s === "critical" ? "danger" : s === "warning" ? "warning" : "info";

const severityIcon: Record<AttentionItem["severity"], ComponentType<{ className?: string }>> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Bell,
};

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

  const operationalCount = services.filter((s) => s.status === "operational").length;
  const degradedCount = services.filter((s) => s.status === "degraded").length;
  const downCount = services.filter((s) => s.status === "down").length;

  // Payout SLA backlog — same pending filter as the Queues card above, so
  // the attention headline and the card count can never disagree.
  const MS_HOUR = 3_600_000;
  const pendingPayoutByTenant = allTenants
    .map((t) => ({ name: t.name, count: getTenantPayouts(t.id).filter((p) => p.status === "pending").length }))
    .filter((x) => x.count > 0);
  const pendingPayoutAgesMs = allTenants.flatMap((t) =>
    getTenantPayouts(t.id)
      .filter((p) => p.status === "pending")
      .map((p) => Date.now() - Date.parse(p.createdAt)),
  );
  const oldestPayoutDays = Math.floor(Math.max(...pendingPayoutAgesMs, 0) / 86_400_000);
  const allPayoutsOver24h = pendingPayoutAgesMs.length > 0 && Math.min(...pendingPayoutAgesMs) > 24 * MS_HOUR;

  // Attention Center — derived payout SLA item (critical) + the remaining
  // static items pending their signals-module derivation (Phase 2).
  const attentionItems: AttentionItem[] = [
    ...(pendingPayoutsAll > 0
      ? [{
          id: "payouts-stuck",
          severity: "critical" as const,
          title: `${pendingPayoutsAll} payouts stuck >24h`,
          detail: `${pendingPayoutByTenant.map((x) => `${x.name} ${x.count}`).join(" · ")} (oldest ${oldestPayoutDays}d${allPayoutsOver24h ? ", all >24h" : ""})`,
          cta: "Clear queue",
          navigateTo: "cross-tenant-queues",
        }]
      : []),
    ...staticAttentionItems,
  ];

  // Operational signals — each row declares its owning store; no row
  // without a data source + threshold may exist here (AGENTS §67).
  const jobOverrides = useJobOverrides();
  const failedJobs = effectiveJobs(jobOverrides).filter((j) => j.status === "failed");
  const failedJobFailures = failedJobs.reduce((s, j) => s + j.failureCount, 0);
  const degradedProviders = PROVIDERS.filter((p) => p.status !== "operational").length;

  const signals: { label: string; value: string; tone: "positive" | "warning" | "negative" }[] = [
    {
      label: "Failed jobs",
      value: failedJobs.length > 0 ? `${failedJobs.length} job (${failedJobFailures} failures)` : "0 jobs",
      tone: failedJobs.length > 0 ? "warning" : "positive",
    },
    {
      label: "Provider degradation",
      value: degradedProviders > 0 ? `${degradedProviders} providers` : "None",
      tone: degradedProviders > 0 ? "warning" : "positive",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Operations Home"
        description="Platform operations console — service health, operational signals, and attention items."
        icon={Activity}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
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
        {attentionItems.length > 0 ? (
          <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold">{attentionItems.length} items need attention</span>
            </CardHeader>
            <CardContent className="space-y-2">
              {attentionItems.map((item) => {
                const Icon = severityIcon[item.severity];
                const tone = severityTone(item.severity);
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.navigateTo)}
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
          <MetricCard label="Services Operational" value={`${operationalCount}/${services.length}`} icon={CheckCircle2} tone={downCount > 0 ? "negative" : degradedCount > 0 ? "warning" : "positive"} />
          <MetricCard label="Degraded Services" value={degradedCount} icon={AlertTriangle} tone={degradedCount > 0 ? "warning" : "positive"} />
          <MetricCard label="Active Tenants" value={activeTenants} icon={Activity} tone="positive" />
          <MetricCard label="Suspended" value={suspendedTenants} icon={XCircle} tone={suspendedTenants > 0 ? "negative" : "positive"} />
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
              {services.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.name} className="flex items-center gap-2 rounded-md border p-2">
                    <div className="rounded-md bg-muted p-1.5"><Icon className="h-3.5 w-3.5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.latency} · {s.lastHeartbeat}</p>
                    </div>
                    <span className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      s.status === "operational" ? "bg-emerald-500" : s.status === "degraded" ? "bg-amber-500" : "bg-rose-500",
                    )} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Real-time operational signals */}
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
                <button onClick={() => navigate("cross-tenant-queues")} className="font-medium text-foreground hover:underline">{pendingKycAll}</button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Pending payouts</span>
                <button onClick={() => navigate("cross-tenant-queues")} className="font-medium text-foreground hover:underline">{pendingPayoutsAll}</button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Open breaches</span>
                <button onClick={() => navigate("cross-tenant-queues")} className="font-medium text-foreground hover:underline">{openBreachesAll}</button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Open support tickets</span>
                <button onClick={() => navigate("cross-tenant-queues")} className="font-medium text-foreground hover:underline">{openTicketsAll}</button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Infrastructure */}
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
                <p className="text-sm font-semibold tabular-nums">v1.8.0</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last deployment</p>
                <p className="text-sm font-semibold">3h ago</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last backup</p>
                <p className="text-sm font-semibold">18h ago</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">RPO status</p>
                <StatusBadge tone="success">Within target</StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
