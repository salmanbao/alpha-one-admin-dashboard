/** 
 * PFaaS Platform — Overview Module Manifest
 * Provides the overview dashboard view for prop firm admins.
 */

import type { FrontendModule, NavigationItem, RouteDefinition } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    termKey: "overview",
    icon: "LayoutGrid",
    order: 0,
  },
];

const routes: RouteDefinition[] = [
  { path: "", viewId: "overview", label: "Overview", permission: [], module: "overview" },
];

export const overviewModule: FrontendModule = {
  manifest: {
    id: "overview",
    name: "Overview",
    version: "1.0.0",
    description: "Prop firm admin dashboard overview with KPI metrics and quick stats.",
    category: "core",
    supportedApplications: ["prop-admin"],
    icon: "LayoutGrid",
    accentColor: "#4a7c59",
  },
  navigation,
  routes,
};