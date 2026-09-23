/**
 * Super Admin Module — manifest + navigation.
 *
 * Spec section 6. Super Admin controls the PFaaS platform itself:
 * tenants, subscriptions, service catalog, modules, integrations,
 * platform users, roles, global feature flags, billing, audit, health.
 */

import { Building2, Server, Package, BarChart3, ShieldCheck, Plus, GitBranch, UserCog, LayoutDashboard } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "super",
    label: "Platform",
    icon: Building2,
    order: 5,
    application: ["super-admin"],
    children: [
      { id: "super.overview", label: "Overview", href: "super-overview", icon: BarChart3, application: ["super-admin"] },
      { id: "super.tenants", label: "Tenants", href: "tenants", icon: Building2, application: ["super-admin"] },
      { id: "super.create-tenant", label: "Create Tenant", href: "create-tenant", icon: Plus, application: ["super-admin"] },
      { id: "super.lifecycle", label: "Lifecycle", href: "tenant-lifecycle", icon: GitBranch, application: ["super-admin"] },
      { id: "super.catalog", label: "Service Catalog", href: "module-catalog", icon: Package, application: ["super-admin"] },
      { id: "super.health", label: "System Health", href: "platform-health", icon: Server, application: ["super-admin"] },
      { id: "super.dashboard-manager", label: "Dashboard Manager", href: "dashboard-manager", icon: LayoutDashboard, application: ["super-admin"] },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "super-overview", viewId: "super-overview", label: "Platform Overview", application: ["super-admin"] },
  { path: "tenants", viewId: "tenants", label: "Tenants", application: ["super-admin"] },
  { path: "create-tenant", viewId: "create-tenant", label: "Create Tenant", application: ["super-admin"] },
  { path: "tenant-detail", viewId: "tenant-detail", label: "Tenant Detail", application: ["super-admin"] },
  { path: "tenant-lifecycle", viewId: "tenant-lifecycle", label: "Tenant Lifecycle", application: ["super-admin"] },
  { path: "module-catalog", viewId: "module-catalog", label: "Service Catalog", application: ["super-admin"] },
  { path: "platform-health", viewId: "platform-health", label: "System Health", application: ["super-admin"] },
  { path: "dashboard-manager", viewId: "dashboard-manager", label: "Dashboard Manager", application: ["super-admin"] },
];

export const superAdminModule: FrontendModule = {
  manifest: {
    id: "super-admin",
    name: "Super Admin",
    version: "1.0.0",
    description: "Platform-wide administration for the PFaaS operator.",
    category: "core",
    supportedApplications: ["super-admin"],
    permissions: [
      { id: "platform.tenants.read", label: "View tenants" },
      { id: "platform.tenants.manage", label: "Manage tenants" },
      { id: "platform.modules.manage", label: "Manage module catalog" },
      { id: "platform.health.read", label: "View system health" },
    ],
    icon: ShieldCheck,
    accentColor: "#0a0a0a",
  },
  navigation,
  routes,
};
