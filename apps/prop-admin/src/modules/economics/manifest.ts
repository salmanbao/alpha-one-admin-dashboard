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

/* Economics has no nav children (the nav-child cap is at 150/150), so the
 * section parent itself carries the link and the gate (R11 F3): without
 * them it rendered as a dead leaf that went nowhere on click. The routes
 * below keep the views resolvable at /prop-admin/economics-cockpit and
 * /prop-admin/firm-exposure. */

const navigation: NavigationItem[] = [
  {
    id: "economics",
    label: "Economics",
    icon: Calculator,
    order: 65,
    href: "economics-cockpit",
    permission: "economics.read",
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
  // R10 W1 — add-on entitlements (route-only; nav cap is 150/150)
  { path: "add-on-entitlements", viewId: "add-on-entitlements", label: "Add-On Entitlements", permission: "economics.read", module: "economics" },
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