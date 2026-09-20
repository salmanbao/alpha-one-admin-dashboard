/**
 * Analytics Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec section 66, 72: Analytics is the FIRST optional module used to
 * prove plug-and-play behavior. It depends on Trading + Accounts.
 */

import { BarChart3, TrendingUp, Users, DollarSign, Activity, Brain } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { RevenueWidget, TraderGrowthWidget, RiskDistributionWidget, BreachTrendWidget, AnalyticsOverviewWidget, AdvancedAnalyticsWidget } from "./widgets/analytics-widgets";

const navigation: NavigationItem[] = [
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    order: 50,
    children: [
      { id: "analytics.overview", label: "Overview", href: "analytics", icon: BarChart3, permission: "analytics.read" },
      { id: "analytics.traders", label: "Traders", href: "analytics-traders", icon: Users, permission: "analytics.read" },
      { id: "analytics.performance", label: "Performance", href: "analytics-performance", icon: TrendingUp, permission: "analytics.read" },
      { id: "analytics.risk", label: "Risk", href: "analytics-risk", icon: Activity, permission: "analytics.read" },
      {
        id: "analytics.advanced",
        label: "Advanced",
        href: "analytics-advanced",
        icon: Brain,
        permission: "analytics.advanced.read",
        feature: "analytics.advanced",
        badge: "Pro",
      },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "analytics", viewId: "analytics", label: "Analytics Overview", permission: "analytics.read", module: "analytics" },
  { path: "analytics-traders", viewId: "analytics-traders", label: "Trader Analytics", permission: "analytics.read", module: "analytics" },
  { path: "analytics-performance", viewId: "analytics-performance", label: "Performance Analytics", permission: "analytics.read", module: "analytics" },
  { path: "analytics-risk", viewId: "analytics-risk", label: "Risk Analytics", permission: "analytics.read", module: "analytics" },
  { path: "analytics-advanced", viewId: "analytics-advanced", label: "Advanced Analytics", permission: "analytics.advanced.read", module: "analytics", feature: "analytics.advanced" },
];

const widgets: WidgetDefinition[] = [
  { id: "analytics-overview", title: "Analytics Overview", module: "analytics", category: "metric", component: AnalyticsOverviewWidget, permission: "analytics.read", defaultSize: { w: 12, h: 1 } },
  { id: "revenue", title: "Revenue (30d)", module: "analytics", category: "chart", component: RevenueWidget, permission: "analytics.read", defaultSize: { w: 6, h: 2 } },
  { id: "trader-growth", title: "Trader Growth", module: "analytics", category: "chart", component: TraderGrowthWidget, permission: "analytics.read", defaultSize: { w: 6, h: 2 } },
  { id: "risk-distribution", title: "Risk Distribution", module: "analytics", category: "chart", component: RiskDistributionWidget, permission: "analytics.read", defaultSize: { w: 6, h: 2 } },
  { id: "breach-trend", title: "Breach Trend", module: "analytics", category: "chart", component: BreachTrendWidget, permission: "analytics.read", defaultSize: { w: 6, h: 2 } },
  { id: "advanced-analytics", title: "Advanced Analytics", module: "analytics", category: "ai", component: AdvancedAnalyticsWidget, permission: "analytics.advanced.read", feature: "analytics.advanced", defaultSize: { w: 12, h: 2 } },
];

export const analyticsModule: FrontendModule = {
  manifest: {
    id: "analytics",
    name: "Analytics",
    version: "1.0.0",
    description: "Business intelligence and reporting. First optional plug-and-play module.",
    dependencies: ["trading", "challenges"],
    capabilities: ["analytics.basic", "analytics.advanced", "analytics.cohorts"],
    category: "growth",
    optional: true,
    supportedApplications: ["prop-admin", "super-admin"],
    permissions: [
      { id: "analytics.read", label: "View analytics" },
      { id: "analytics.advanced.read", label: "View advanced analytics" },
      { id: "analytics.export", label: "Export analytics" },
    ],
    icon: BarChart3,
    accentColor: "#7c3aed",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "analytics-settings", label: "Analytics", module: "analytics", viewId: "settings-analytics", icon: BarChart3, order: 70 },
  ],
};
