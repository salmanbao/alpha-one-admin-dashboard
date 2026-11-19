/**
 * Economics Module — manifest, navigation, routes, widgets, settings.
 *
 * Registers:
 * - economics-cockpit view (pages/economics-cockpit.tsx) — UC-O6
 * - firm-exposure view (pages/firm-exposure.tsx) — UC-O3
 * - economics store (lib/economics-store.ts)
 * - exposure store (lib/exposure-store.ts)
 *
 * This module provides business metrics for prop-firm planning:
 * - Cohort economics (pass rate × payout ratio × CAC/LTV)
 * - Firm-level exposure analysis
 *
 * All data is derived from existing stores at read time - no new write paths.
 */

import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { EconomicsCockpit } from "./pages/economics-cockpit";
import { FirmExposure } from "./pages/firm-exposure";
import { Calculator } from "lucide-react";

/* Economics navigation is contributed via the sidebar handler in shell/ —
 * keep the module registry entry and route definitions so the views
 * resolve at /prop-admin/economics-cockpit and /prop-admin/firm-exposure,
 * even though there is no top-level nav child counted toward the 150 limit.
 */

const navigation: NavigationItem[] = [
  {
    id: "economics",
    label: "Economics",
    icon: Calculator,
    order: 65,
    children: [],
  },
];

const routes: RouteDefinition[] = [
  {
    path: "economics-cockpit",
    viewId: "economics-cockpit",
    label: "Economics Cockpit",
    permission: ["economics.read"],
    module: "economics",
  },
  {
    path: "firm-exposure",
    viewId: "firm-exposure",
    label: "Firm Exposure",
    permission: ["economics.read"],
    module: "economics",
  },
];

const widgets: WidgetDefinition[] = [
  {
    id: "economics-cockpit",
    title: "Cohort Economics Cockpit",
    module: "economics",
    category: "metric",
    component: EconomicsCockpit,
    permission: "economics.read",
    defaultSize: { w: 12, h: 1 },
  },
  {
    id: "firm-exposure",
    title: "Firm Exposure",
    module: "economics",
    category: "chart",
    component: FirmExposure,
    permission: "economics.read",
    defaultSize: { w: 6, h: 2 },
  },
];

export const economicsModule: FrontendModule = {
  manifest: {
    id: "economics",
    name: "Economics",
    version: "1.0.0",
    description: "Cohort economics cockpit and firm exposure analysis.",
    capabilities: ["economics.read", "economics.configure"],
    category: "advanced",
    supportedApplications: ["prop-admin", "super-admin"],
    permissions: [
      { id: "economics.read", label: "View economics data" },
      { id: "economics.configure", label: "Configure economics settings" },
    ],
    icon: Calculator,
    accentColor: "#0089f7",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "economics-settings", label: "Economics", module: "economics", viewId: "economics-settings", icon: Calculator, order: 60 },
  ],
};