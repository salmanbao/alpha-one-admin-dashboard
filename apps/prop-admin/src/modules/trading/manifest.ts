/**
 * Trading Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec section 14, 70. Self-contained module owning its domain UI.
 * Registered into the platform module registry at app boot.
 */

import {
  CandlestickChart,
  LineChart,
  Users,
  CreditCard,
  Activity,
  UserPlus,
  Archive,
  User,
  ShoppingCart,
  Server,
  RefreshCw,
  ClipboardCheck,
} from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
// Eager-load the evaluation store at boot so the sidebar "Evaluation
// Queue" count badge (PRD §4.6.2 pending_evaluations) is seeded before
// the user ever opens the queue.
import "@/modules/trading/evaluation-store";
import { TradingOverviewWidget } from "./widgets/trading-overview-widget";
import { OpenPositionsWidget } from "./widgets/trading-overview-widget";
import { TraderPerformanceWidget } from "./widgets/trading-overview-widget";
import { AccountBalanceWidget } from "./widgets/trading-overview-widget";
import { RecentActivityWidget } from "./widgets/trading-overview-widget";

const navigation: NavigationItem[] = [
  {
    id: "trading",
    label: "Trading",
    icon: CandlestickChart,
    order: 10,
    children: [
      { id: "trading.overview", label: "Overview", href: "trading", icon: LineChart, permission: "trader.read" },
      { id: "trading.traders", label: "Traders", href: "trading-traders", icon: Users, permission: "trader.read" },
      { id: "trading.accounts", label: "Accounts", href: "trading-accounts", icon: CreditCard, permission: "account.read" },
      { id: "trading.positions", label: "Open Positions", href: "trading-positions", icon: Activity, permission: "account.read" },
      { id: "trading.add-account", label: "Add Account", href: "trading-add-account", icon: UserPlus, permission: "account.write" },
      { id: "trading.closed-positions", label: "Closed Positions", href: "closed-positions", icon: Archive, permission: "account.read" },
      { id: "trading.orders", label: "Orders", href: "orders", icon: ShoppingCart, permission: "account.read" },
      { id: "trading.evaluation-queue", label: "Evaluation Queue", href: "evaluation-queue", icon: ClipboardCheck, permission: "evaluation.read" },

      // ───────── Operations (M13 — bulk ops + trading server connections) ─────────
      { id: "trading.bulk-operations", label: "Bulk Operations", href: "bulk-account-operations", icon: Users, permission: "account.write", group: "Operations" },
      { id: "trading.server-catalog", label: "Server Catalog", href: "server-catalog", icon: Server, permission: "account.read", group: "Operations" },
      { id: "trading.bridge-sync-log", label: "Bridge Sync Log", href: "bridge-sync-log", icon: RefreshCw, permission: "account.read", group: "Operations" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "trading", viewId: "trading", label: "Trading Overview", permission: "trader.read", module: "trading" },
  { path: "trading-traders", viewId: "trading-traders", label: "Traders", permission: "trader.read", module: "trading" },
  { path: "trading-accounts", viewId: "trading-accounts", label: "Accounts", permission: "account.read", module: "trading" },
  { path: "trading-positions", viewId: "trading-positions", label: "Open Positions", permission: "account.read", module: "trading" },
  { path: "trader-detail", viewId: "trader-detail", label: "Trader Detail", permission: "trader.read", module: "trading" },
  { path: "trading-add-account", viewId: "trading-add-account", label: "Add Account", permission: "account.write", module: "trading" },
  { path: "closed-positions", viewId: "closed-positions", label: "Closed Positions", permission: "account.read", module: "trading" },
  { path: "account-broker-details", viewId: "account-broker-details", label: "Account Broker Details", permission: "account.read", module: "trading" },
  { path: "account-kyc-statuses", viewId: "account-kyc-statuses", label: "Account KYC Statuses", permission: "account.read", module: "trading" },
  { path: "account-related-accounts", viewId: "account-related-accounts", label: "Related Accounts", permission: "account.read", module: "trading" },
  { path: "account-configuration", viewId: "account-configuration", label: "Account Configuration", permission: "account.read", module: "trading" },
  { path: "account-workspace", viewId: "account-workspace", label: "Account Workspace", permission: "account.read", module: "trading" },
  { path: "account-events", viewId: "account-events", label: "Account Events", permission: "account.read", module: "trading" },
  { path: "account-version-history", viewId: "account-version-history", label: "Account Version History", permission: "account.read", module: "trading" },
  { path: "closed-position-detail", viewId: "closed-position-detail", label: "Closed Position Detail", permission: "account.read", module: "trading" },
  { path: "trading-credentials", viewId: "trading-credentials", label: "Trading Credentials", permission: "trader.read", module: "trading" },
  { path: "orders", viewId: "orders", label: "Orders", permission: "account.read", module: "trading" },
  { path: "order-detail", viewId: "order-detail", label: "Order Detail", permission: "account.read", module: "trading" },
  { path: "account-provisioning", viewId: "account-provisioning", label: "Account Provisioning", permission: "trader.read", module: "trading" },
  { path: "evaluation-queue", viewId: "evaluation-queue", label: "Evaluation Queue", permission: "evaluation.read", module: "trading" },
  // Operations (M13)
  { path: "bulk-account-operations", viewId: "bulk-account-operations", label: "Bulk Account Operations", permission: "account.write", module: "trading" },
  { path: "server-catalog", viewId: "server-catalog", label: "Trading Server Catalog", permission: "account.read", module: "trading" },
  { path: "bridge-sync-log", viewId: "bridge-sync-log", label: "Bridge Sync Log", permission: "account.read", module: "trading" },
];

const widgets: WidgetDefinition[] = [
  {
    id: "trading-overview",
    title: "Trading Overview",
    module: "trading",
    category: "metric",
    component: TradingOverviewWidget,
    permission: "trader.read",
    defaultSize: { w: 12, h: 1 },
    description: "Aggregate trading KPIs across all traders.",
  },
  {
    id: "account-balance",
    title: "Account Balances",
    module: "trading",
    category: "chart",
    component: AccountBalanceWidget,
    permission: "account.read",
    defaultSize: { w: 6, h: 2 },
    description: "Distribution of account balances.",
  },
  {
    id: "trader-performance",
    title: "Trader Performance",
    module: "trading",
    category: "leaderboard",
    component: TraderPerformanceWidget,
    permission: "trader.read",
    defaultSize: { w: 6, h: 2 },
    description: "Top trader performance leaderboard.",
  },
  {
    id: "open-positions",
    title: "Open Positions",
    module: "trading",
    category: "table",
    component: OpenPositionsWidget,
    permission: "account.read",
    defaultSize: { w: 12, h: 3 },
    description: "Currently open positions across all accounts.",
  },
  {
    id: "recent-activity",
    title: "Recent Trading Activity",
    module: "trading",
    category: "feed",
    component: RecentActivityWidget,
    permission: "trader.read",
    defaultSize: { w: 6, h: 2 },
    description: "Latest trades and position changes.",
  },
];

export const tradingModule: FrontendModule = {
  manifest: {
    id: "trading",
    name: "Trading",
    version: "1.0.0",
    description: "Core trading module — traders, accounts, positions.",
    capabilities: ["trading.accounts", "trading.positions", "trading.performance"],
    category: "core",
    supportedApplications: ["prop-admin"],
    permissions: [
      { id: "trader.read", label: "View traders" },
      { id: "trader.update", label: "Update traders" },
      { id: "account.read", label: "View accounts" },
      { id: "account.write", label: "Manage accounts" },
    ],
    icon: CandlestickChart,
    accentColor: "#0f766e",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "trading-settings", label: "Trading", module: "trading", viewId: "settings-trading", icon: CandlestickChart, order: 30 },
  ],
};
