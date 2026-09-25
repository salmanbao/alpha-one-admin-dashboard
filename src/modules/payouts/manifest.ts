/**
 * Payouts Module — manifest, navigation, routes, widgets, settings.
 */

import { Wallet, Banknote, Clock, CheckCircle2, DollarSign, ListChecks } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { PayoutOverviewWidget, PayoutQueueWidget, PayoutTrendWidget, PayoutMethodWidget } from "./widgets/payout-widgets";

const navigation: NavigationItem[] = [
  {
    id: "payouts",
    label: "Payouts",
    termKey: "payout",
    icon: Wallet,
    order: 40,
    children: [
      { id: "payouts.overview", label: "Overview", href: "payouts", icon: Banknote, permission: ["payout.read", "payout.self"] },
      { id: "payouts.pending", label: "Pending Approval", href: "payouts-pending", icon: Clock, permission: "payout.approve" },
      { id: "payouts.history", label: "My Withdrawals", href: "payouts-history", icon: CheckCircle2, permission: ["payout.read", "payout.self"] },
      { id: "payouts.withdrawals", label: "Withdrawals", href: "payouts-enhanced-withdrawals", icon: ListChecks, permission: ["payout.read", "payout.self"] },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "payouts", viewId: "payouts", label: "Payouts Overview", permission: ["payout.read", "payout.self"], module: "payouts" },
  { path: "payouts-pending", viewId: "payouts-pending", label: "Pending Payouts", permission: "payout.approve", module: "payouts" },
  { path: "payouts-history", viewId: "payouts-history", label: "Payout History", permission: ["payout.read", "payout.self"], module: "payouts" },
  { path: "payouts-enhanced-withdrawals", viewId: "payouts-enhanced-withdrawals", label: "Enhanced Withdrawals", permission: ["payout.read", "payout.self"], module: "payouts" },
  { path: "payout-eligibility", viewId: "payout-eligibility", label: "Payout Eligibility", permission: ["payout.read", "payout.self"], module: "payouts" },
  { path: "payout-request", viewId: "payout-request", label: "Payout Request", permission: ["payout.read", "payout.self"], module: "payouts" },
  { path: "payout-provider-status", viewId: "payout-provider-status", label: "Provider Status", permission: "payout.read", module: "payouts" },
];

const widgets: WidgetDefinition[] = [
  { id: "payout-overview", title: "Payout Overview", module: "payouts", category: "metric", component: PayoutOverviewWidget, permission: "payout.read", defaultSize: { w: 12, h: 1 } },
  { id: "payout-queue", title: "Pending Approvals", module: "payouts", category: "table", component: PayoutQueueWidget, permission: "payout.approve", defaultSize: { w: 6, h: 3 } },
  { id: "payout-trend", title: "Payout Trend (30d)", module: "payouts", category: "chart", component: PayoutTrendWidget, permission: "payout.read", defaultSize: { w: 6, h: 2 } },
  { id: "payout-method", title: "By Method", module: "payouts", category: "chart", component: PayoutMethodWidget, permission: "payout.read", defaultSize: { w: 6, h: 2 } },
];

export const payoutsModule: FrontendModule = {
  manifest: {
    id: "payouts",
    name: "Payouts",
    version: "1.0.0",
    description: "Trader withdrawal requests, approvals, and history.",
    capabilities: ["payouts.requests", "payouts.approvals", "payouts.history"],
    category: "core",
    supportedApplications: ["prop-admin", "super-admin", "trader"],
    permissions: [
      { id: "payout.read", label: "View payouts" },
      { id: "payout.approve", label: "Approve payouts" },
    ],
    icon: Wallet,
    accentColor: "#15803d",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "payouts-settings", label: "Payouts", module: "payouts", viewId: "settings-payouts", icon: Wallet, order: 60 },
  ],
};
