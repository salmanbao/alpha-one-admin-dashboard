#!/usr/bin/env node
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
  "create-role": dynamic(
    () =>
      import("@/modules/super-admin/create-role-page").then((m) => ({
        default: m.CreateRolePage,
      })),
    { loading: ViewSkeleton },
  ),
  "manage-permissions": dynamic(
    () =>
      import("@/modules/super-admin/manage-permissions-page").then((m) => ({
        default: m.ManagePermissionsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "sla-monitoring": dynamic(
    () =>
      import("@/modules/super-admin/sla-monitoring-page").then((m) => ({
        default: m.SlaMonitoringPage,
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
  "abuse-signals": dynamic(
    () =>
      import("@/modules/super-admin/abuse-signals-page").then((m) => ({
        default: m.AbuseSignalsPage,
      })),
    { loading: ViewSkeleton },
  ),
  "tenant-benchmarking": dynamic(
    () =>
      import("@/modules/super-admin/tenant-benchmarking-page").then((m) => ({
        default: m.TenantBenchmarkingPage,
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
};