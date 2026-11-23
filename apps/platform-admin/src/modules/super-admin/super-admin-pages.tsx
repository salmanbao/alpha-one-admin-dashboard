"use client";

/**
 * Super Admin Pages — platform-level administration.
 *
 * Spec section 6. Overview, Tenants, Module Catalog, System Health.
 * Only visible when the current user's application is super-admin.
 */

// Re-export the new lifecycle / detail / create pages so the view router
// can wire them up via a single import source.
export { TenantDetailPage } from "./tenant-detail-page";
export { TenantsPage } from "./tenants-page";
export { CreateTenantPage } from "./create-tenant-page";
export { TenantLifecyclePage } from "./tenant-lifecycle-page";
export { AdoptionFunnelPage } from "./adoption-funnel-page";
export { TenantHealthPage } from "./tenant-health-page";
export { TenantApiUsagePage } from "./tenant-api-usage-page";
// Round 8: new platform operations screens
export { PlatformOperationsPage } from "./platform-operations-page";
export { EmergencyControlsPage } from "./emergency-controls-page";
export { CrossTenantQueuesPage } from "./cross-tenant-queues-page";
export { ProviderRegistryPage } from "./provider-registry-page";
export { JobsDashboardPage } from "./jobs-dashboard-page";
export { DeploymentsPage } from "./deployments-page";
export { BackupsDrPage } from "./backups-dr-page";
export { ApprovalCenterPage } from "./approval-center-page";
export { IncidentCenterPage } from "./incident-center-page";
export { FeatureFlagsPage } from "./feature-flags-page";
// Round 8b: deferred screens from the research inventory
export { MySessionsPage } from "./my-sessions-page";
export { TenantSessionsPage } from "./tenant-sessions-page";
export { SecurityOverviewPage } from "./security-overview-page";

// Stitch screens — platform admin scope
export { KnowledgeBasePage } from "./knowledge-base-page";
export { ChangelogPage } from "./changelog-page";
export { ModuleDetailPage } from "./module-detail-page";
export { ModuleSettingsPage } from "./module-settings-page";
export { ModelAuditLogPage } from "./model-audit-log-page";
export { ImpersonationAuditPage } from "./impersonation-audit-page";
export { AiUsageQuotaPage } from "./ai-usage-quota-page";
export { BridgeSyncLogPage } from "./bridge-sync-log-page";
export { GettingStartedPage } from "./getting-started-page";
export { PlatformArchitecturePage } from "./platform-architecture-page";
export { PlatformBillingPage } from "./platform-billing-page";
export { PlatformFinancialsPage } from "./platform-financials-page";
export { GlobalDefaultsPage } from "./global-defaults-page";
export { ReferenceDataPage } from "./reference-data-page";
export { OperatorDirectoryPage } from "./operator-directory-page";
export { RoleManagementPage } from "./role-management-page";
export { TenantViewAsPage } from "./tenant-view-as-page";
export { AbuseSignalsPage } from "./abuse-signals-page";
export { AnnouncementsPage } from "./announcements-page";
export { PlansPage } from "./plans-page";
export { PlatformAnalyticsPage } from "./platform-analytics-page";
export { DashboardManagerPage } from "./dashboard-manager-page";
export { PlatformAuditPage } from "./platform-audit-page";
export { SuperAdminOverviewPage } from "./super-overview";
export { SuperAdminOverviewPage as PlatformOverviewPage } from "./super-overview";
export { PlatformRolesPage } from "./platform-roles-page";
export { PlatformStaffPage } from "./platform-staff-page";
export { PlatformTransactionsPage } from "./platform-transactions-page";
export { SystemHealthPage } from "./system-health-page";
export { AuditLogPage } from "./audit-log-page";

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { readTenants } from "@/lib/platform/tenant-store";
import { moduleRegistry } from "@/lib/platform/module-registry";
import {
  Package,
  Server,
  ShieldCheck,
  Users,
  DollarSign,
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  Globe,
  Zap,
} from "lucide-react";

export function ModuleCatalogPage() {
  const allModules = moduleRegistry.getAll();
  const { navigate } = usePlatform();
  return (
    <Page>
      <PageHeader title="Service Catalog" description="All modules available on the platform." icon={Package} />
      <PageContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {allModules.map((m) => {
            const Icon = m.manifest.icon;
            const adopters = readTenants().filter((t) => t.enabledModules.includes(m.manifest.id)).length;
            return (
              <Card
                key={m.manifest.id}
                className="cursor-pointer transition-colors hover:border-primary/40"
                onClick={() => navigate("module-detail", { module: m.manifest.id })}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md p-2" style={{ background: `${m.manifest.accentColor}1a`, color: m.manifest.accentColor }}>
                      {Icon ? <Icon className="h-5 w-5" /> : null}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{m.manifest.name}</span>
                        <Badge variant="outline" className="text-[9px]">{m.manifest.version}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.manifest.category}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-2 text-xs text-muted-foreground">{m.manifest.description}</p>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{adopters} tenant{adopters !== 1 ? "s" : ""}</span>
                    <div className="flex flex-wrap gap-1">
                      {m.manifest.supportedApplications?.map((a) => (
                        <Badge key={a} variant="secondary" className="text-[9px]">{a}</Badge>
                      ))}
                    </div>
                  </div>
                  {m.manifest.permissions?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.manifest.permissions.slice(0, 4).map((p) => (
                        <Badge key={p.id} variant="outline" className="text-[9px]">{p.id}</Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("module-detail", { module: m.manifest.id });
                      }}
                    >
                      Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("module-settings", { module: m.manifest.id });
                      }}
                    >
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContent>
    </Page>
  );
}

export function PlatformHealthPage() {
  const services = [
    { name: "API Gateway", status: "operational", latency: "42ms", icon: Globe },
    { name: "Database", status: "operational", latency: "8ms", icon: Database },
    { name: "MT5 Bridge", status: "operational", latency: "120ms", icon: Zap },
    { name: "Payment Processor", status: "degraded", latency: "850ms", icon: DollarSign },
    { name: "KYC Provider", status: "operational", latency: "310ms", icon: ShieldCheck },
    { name: "AI Engine", status: "operational", latency: "1.2s", icon: Cpu },
  ];

  const statusTone = (s: string) => s === "operational" ? "success" : s === "degraded" ? "warning" : "danger";

  return (
    <Page>
      <PageHeader title="System Health" description="Platform service status and metrics." icon={Server} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Uptime (30d)" value="99.97%" icon={Activity} tone="positive" />
          <MetricCard label="Avg Latency" value="142ms" icon={Zap} />
          <MetricCard label="Error Rate" value="0.03%" icon={AlertTriangle} tone="positive" />
          <MetricCard label="Active Sessions" value="284" icon={Users} />
        </div>
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Service status</span></CardHeader>
          <CardContent className="space-y-2">
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.name} className="flex items-center gap-3 rounded-md border p-3">
                  <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">Latency: {s.latency}</p>
                  </div>
                  <StatusBadge tone={statusTone(s.status)}>{s.status}</StatusBadge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
