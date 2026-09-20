/**
 * Risk Module — manifest, navigation, routes, widgets, settings.
 * Includes Breaches (spec section 7 — Breaches is a sub-area of Risk).
 */

import { ShieldAlert, ShieldCheck, Activity, AlertTriangle, TrendingDown } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { RiskOverviewWidget, RiskDistributionWidget, BreachTrendWidget, OpenBreachesWidget } from "./widgets/risk-widgets";

const navigation: NavigationItem[] = [
  {
    id: "risk",
    label: "Risk",
    icon: ShieldCheck,
    order: 30,
    children: [
      { id: "risk.overview", label: "Overview", href: "risk", icon: ShieldCheck, permission: "risk.read" },
      { id: "risk.breaches", label: "Breaches", href: "breaches", icon: ShieldAlert, permission: "breach.read" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "risk", viewId: "risk", label: "Risk Overview", permission: "risk.read", module: "risk" },
  { path: "breaches", viewId: "breaches", label: "Breaches", permission: "breach.read", module: "risk" },
];

const widgets: WidgetDefinition[] = [
  { id: "risk-overview", title: "Risk Overview", module: "risk", category: "metric", component: RiskOverviewWidget, permission: "risk.read", defaultSize: { w: 12, h: 1 } },
  { id: "risk-distribution", title: "Risk Distribution", module: "risk", category: "chart", component: RiskDistributionWidget, permission: "risk.read", defaultSize: { w: 6, h: 2 } },
  { id: "breach-trend", title: "Breach Trend (30d)", module: "risk", category: "chart", component: BreachTrendWidget, permission: "breach.read", defaultSize: { w: 6, h: 2 } },
  { id: "open-breaches", title: "Open Breaches", module: "risk", category: "alert", component: OpenBreachesWidget, permission: "breach.read", defaultSize: { w: 12, h: 2 } },
];

export const riskModule: FrontendModule = {
  manifest: {
    id: "risk",
    name: "Risk Management",
    version: "1.0.0",
    description: "Drawdown monitoring, risk scoring, and breach tracking.",
    capabilities: ["risk.scoring", "risk.breaches", "risk.config"],
    category: "core",
    supportedApplications: ["prop-admin", "super-admin", "trader"],
    permissions: [
      { id: "risk.read", label: "View risk" },
      { id: "risk.configure", label: "Configure risk rules" },
      { id: "breach.read", label: "View breaches" },
    ],
    icon: ShieldCheck,
    accentColor: "#b91c1c",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "risk-settings", label: "Risk", module: "risk", viewId: "settings-risk", icon: ShieldCheck, order: 50 },
  ],
};
