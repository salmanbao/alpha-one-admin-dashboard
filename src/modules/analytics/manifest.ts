/**
 * Analytics Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec section 66, 72: Analytics is the FIRST optional module used to
 * prove plug-and-play behavior. It depends on Trading + Accounts.
 */

import { BarChart3, TrendingUp, Users, DollarSign, Activity, Brain, Building2, CalendarClock, Repeat, CreditCard, ShoppingBag, CandlestickChart } from "lucide-react";
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
      { id: "analytics.firm-stats", label: "Firm Statistics", href: "analytics-firm-statistics", icon: Building2, permission: "analytics.read" },
      { id: "analytics.daily-highlights", label: "Daily Highlights", href: "analytics-daily-highlights", icon: CalendarClock, permission: "analytics.read" },
      { id: "analytics.retention", label: "Retention", href: "analytics-retention", icon: Repeat, permission: "analytics.read" },
      { id: "analytics.accounts", label: "Dashboard: Accounts", href: "dashboard-accounts", icon: CreditCard, permission: "analytics.read" },
      { id: "analytics.payouts", label: "Dashboard: Payouts", href: "dashboard-payouts", icon: DollarSign, permission: "analytics.read" },
      { id: "analytics.orders", label: "Dashboard: Orders", href: "dashboard-orders", icon: ShoppingBag, permission: "analytics.read" },
      { id: "analytics.positions", label: "Dashboard: Positions", href: "dashboard-positions", icon: CandlestickChart, permission: "analytics.read" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "analytics", viewId: "analytics", label: "Analytics Overview", permission: "analytics.read", module: "analytics" },
  { path: "analytics-traders", viewId: "analytics-traders", label: "Trader Analytics", permission: "analytics.read", module: "analytics" },
  { path: "analytics-performance", viewId: "analytics-performance", label: "Performance Analytics", permission: "analytics.read", module: "analytics" },
  { path: "analytics-risk", viewId: "analytics-risk", label: "Risk Analytics", permission: "analytics.read", module: "analytics" },
  { path: "analytics-advanced", viewId: "analytics-advanced", label: "Advanced Analytics", permission: "analytics.advanced.read", module: "analytics", feature: "analytics.advanced" },
  { path: "analytics-firm-statistics", viewId: "analytics-firm-statistics", label: "Firm Statistics", permission: "analytics.read", module: "analytics" },
  { path: "analytics-daily-highlights", viewId: "analytics-daily-highlights", label: "Daily Highlights", permission: "analytics.read", module: "analytics" },
  { path: "analytics-retention", viewId: "analytics-retention", label: "Retention Analytics", permission: "analytics.read", module: "analytics" },
  { path: "dashboard-accounts", viewId: "dashboard-accounts", label: "Dashboard: Accounts", permission: "analytics.read", module: "analytics" },
  { path: "dashboard-payouts", viewId: "dashboard-payouts", label: "Dashboard: Payouts", permission: "analytics.read", module: "analytics" },
  { path: "dashboard-orders", viewId: "dashboard-orders", label: "Dashboard: Orders", permission: "analytics.read", module: "analytics" },
  { path: "dashboard-positions", viewId: "dashboard-positions", label: "Dashboard: Positions", permission: "analytics.read", module: "analytics" },
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
