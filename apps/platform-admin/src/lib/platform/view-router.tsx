/**
 * PFaaS Platform — Dashboard View Router
 *
 * Resolves a view id (from router state) to a React component.
 * Only super-admin views for platform-admin app. Every view is loaded
 * lazily on first open so the initial route ships only the shell.
 */

import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@pfaas/ui";

const ViewSkeleton = () => (
  <div className="flex min-h-[60vh] w-full items-center justify-center p-8">
    <Skeleton className="h-48 w-full max-w-xl" />
  </div>
);

export type ViewComponent = ComponentType<{ params: Record<string, string> }>;

export const viewRegistry: Record<string, ViewComponent> = {
  /* super-admin — pages defined inside the barrel; the rest are deep imports */
  "super-overview": dynamic(
    () =>
      import("@/modules/super-admin/super-admin-pages").then((m) => ({
        default: m.SuperAdminOverviewPage,
      })),
    { loading: ViewSkeleton },
  ),
  tenants: dynamic(
    () =>
      import("@/modules/super-admin/super-admin-pages").then((m) => ({
        default: m.TenantsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "module-catalog": dynamic(
    () =>
      import("@/modules/super-admin/super-admin-pages").then((m) => ({
        default: m.ModuleCatalogPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-health": dynamic(
    () =>
      import("@/modules/super-admin/super-admin-pages").then((m) => ({
        default: m.PlatformHealthPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-operations": dynamic(
    () =>
      import("@/modules/super-admin/platform-operations-page").then((m) => ({
        default: m.PlatformOperationsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "emergency-controls": dynamic(
    () =>
      import("@/modules/super-admin/emergency-controls-page").then((m) => ({
        default: m.EmergencyControlsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "cross-tenant-queues": dynamic(
    () =>
      import("@/modules/super-admin/cross-tenant-queues-page").then((m) => ({
        default: m.CrossTenantQueuesPage,
      })),
    { loading: ViewSkeleton },
  ),
  "provider-registry": dynamic(
    () =>
      import("@/modules/super-admin/provider-registry-page").then((m) => ({
        default: m.ProviderRegistryPage,
      })),
    { loading: ViewSkeleton },
  ),
  "jobs-dashboard": dynamic(
    () =>
      import("@/modules/super-admin/jobs-dashboard-page").then((m) => ({
        default: m.JobsDashboardPage,
      })),
    { loading: ViewSkeleton },
  ),
  deployments: dynamic(
    () =>
      import("@/modules/super-admin/deployments-page").then((m) => ({
        default: m.DeploymentsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "backups-dr": dynamic(
    () =>
      import("@/modules/super-admin/backups-dr-page").then((m) => ({
        default: m.BackupsDrPage,
      })),
    { loading: ViewSkeleton },
  ),
  "approval-center": dynamic(
    () =>
      import("@/modules/super-admin/approval-center-page").then((m) => ({
        default: m.ApprovalCenterPage,
      })),
    { loading: ViewSkeleton },
  ),
  "incident-center": dynamic(
    () =>
      import("@/modules/super-admin/incident-center-page").then((m) => ({
        default: m.IncidentCenterPage,
      })),
    { loading: ViewSkeleton },
  ),
  "feature-flags": dynamic(
    () =>
      import("@/modules/super-admin/feature-flags-page").then((m) => ({
        default: m.FeatureFlagsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "my-sessions": dynamic(
    () =>
      import("@/modules/super-admin/my-sessions-page").then((m) => ({
        default: m.MySessionsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "security-overview": dynamic(
    () =>
      import("@/modules/super-admin/security-overview-page").then((m) => ({
        default: m.SecurityOverviewPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-financials": dynamic(
    () =>
      import("@/modules/super-admin/platform-financials-page").then((m) => ({
        default: m.PlatformFinancialsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "global-defaults": dynamic(
    () =>
      import("@/modules/super-admin/global-defaults-page").then((m) => ({
        default: m.GlobalDefaultsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "reference-data": dynamic(
    () =>
      import("@/modules/super-admin/reference-data-page").then((m) => ({
        default: m.ReferenceDataPage,
      })),
    { loading: ViewSkeleton },
  ),
  "operator-directory": dynamic(
    () =>
      import("@/modules/super-admin/operator-directory-page").then((m) => ({
        default: m.OperatorDirectoryPage,
      })),
    { loading: ViewSkeleton },
  ),
  "role-management": dynamic(
    () =>
      import("@/modules/super-admin/role-management-page").then((m) => ({
        default: m.RoleManagementPage,
      })),
    { loading: ViewSkeleton },
  ),
  "tenant-view-as": dynamic(
    () =>
      import("@/modules/super-admin/tenant-view-as-page").then((m) => ({
        default: m.TenantViewAsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "abuse-signals": dynamic(
    () =>
      import("@/modules/super-admin/abuse-signals-page").then((m) => ({
        default: m.AbuseSignalsPage,
      })),
    { loading: ViewSkeleton },
  ),
  announcements: dynamic(
    () =>
      import("@/modules/super-admin/announcements-page").then((m) => ({
        default: m.AnnouncementsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-analytics": dynamic(
    () =>
      import("@/modules/super-admin/platform-analytics-page").then((m) => ({
        default: m.PlatformAnalyticsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "tenant-detail": dynamic(
    () =>
      import("@/modules/super-admin/tenant-detail-page").then((m) => ({
        default: m.TenantDetailPage,
      })),
    { loading: ViewSkeleton },
  ),
  "create-tenant": dynamic(
    () =>
      import("@/modules/super-admin/create-tenant-page").then((m) => ({
        default: m.CreateTenantPage,
      })),
    { loading: ViewSkeleton },
  ),
  "tenant-lifecycle": dynamic(
    () =>
      import("@/modules/super-admin/tenant-lifecycle-page").then((m) => ({
        default: m.TenantLifecyclePage,
      })),
    { loading: ViewSkeleton },
  ),
  "dashboard-manager": dynamic(
    () =>
      import("@/modules/super-admin/dashboard-manager-page").then((m) => ({
        default: m.DashboardManagerPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-audit": dynamic(
    () =>
      import("@/modules/super-admin/platform-audit-page").then((m) => ({
        default: m.PlatformAuditPage,
      })),
    { loading: ViewSkeleton },
  ),
  "knowledge-base": dynamic(
    () =>
      import("@/modules/super-admin/knowledge-base-page").then((m) => ({
        default: m.KnowledgeBasePage,
      })),
    { loading: ViewSkeleton },
  ),
  "changelog": dynamic(
    () =>
      import("@/modules/super-admin/changelog-page").then((m) => ({
        default: m.ChangelogPage,
      })),
    { loading: ViewSkeleton },
  ),
  "module-detail": dynamic(
    () =>
      import("@/modules/super-admin/module-detail-page").then((m) => ({
        default: m.ModuleDetailPage,
      })),
    { loading: ViewSkeleton },
  ),
  "module-settings": dynamic(
    () =>
      import("@/modules/super-admin/module-settings-page").then((m) => ({
        default: m.ModuleSettingsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "model-audit-log": dynamic(
    () =>
      import("@/modules/super-admin/model-audit-log-page").then((m) => ({
        default: m.ModelAuditLogPage,
      })),
    { loading: ViewSkeleton },
  ),
  "impersonation-audit": dynamic(
    () =>
      import("@/modules/super-admin/impersonation-audit-page").then((m) => ({
        default: m.ImpersonationAuditPage,
      })),
    { loading: ViewSkeleton },
  ),
  "ai-usage-quota": dynamic(
    () =>
      import("@/modules/super-admin/ai-usage-quota-page").then((m) => ({
        default: m.AiUsageQuotaPage,
      })),
    { loading: ViewSkeleton },
  ),
  "bridge-sync-log": dynamic(
    () =>
      import("@/modules/super-admin/bridge-sync-log-page").then((m) => ({
        default: m.BridgeSyncLogPage,
      })),
    { loading: ViewSkeleton },
  ),
  "getting-started": dynamic(
    () =>
      import("@/modules/super-admin/getting-started-page").then((m) => ({
        default: m.GettingStartedPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-architecture": dynamic(
    () =>
      import("@/modules/super-admin/platform-architecture-page").then((m) => ({
        default: m.PlatformArchitecturePage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-overview": dynamic(
    () =>
      import("@/modules/super-admin/platform-overview-page").then((m) => ({
        default: m.PlatformOverviewPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-roles": dynamic(
    () =>
      import("@/modules/super-admin/platform-roles-page").then((m) => ({
        default: m.PlatformRolesPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-staff": dynamic(
    () =>
      import("@/modules/super-admin/platform-staff-page").then((m) => ({
        default: m.PlatformStaffPage,
      })),
    { loading: ViewSkeleton },
  ),
  "platform-transactions": dynamic(
    () =>
      import("@/modules/super-admin/platform-transactions-page").then((m) => ({
        default: m.PlatformTransactionsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "system-health": dynamic(
    () =>
      import("@/modules/super-admin/system-health-page").then((m) => ({
        default: m.SystemHealthPage,
      })),
    { loading: ViewSkeleton },
  ),
  "audit-log": dynamic(
    () =>
      import("@/modules/super-admin/audit-log-page").then((m) => ({
        default: m.AuditLogPage,
      })),
    { loading: ViewSkeleton },
  ),
};

const dynamicViews = new Map<string, ViewComponent>();

export function registerModuleView(viewId: string, component: ViewComponent) {
  dynamicViews.set(viewId, component);
}

export function resolveView(viewId: string): ViewComponent | undefined {
  return viewRegistry[viewId] ?? dynamicViews.get(viewId);
}
