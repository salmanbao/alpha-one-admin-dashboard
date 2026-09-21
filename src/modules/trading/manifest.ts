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
} from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { TradingOverviewWidget } from "./widgets/trading-overview-widget";
import { OpenPositionsWidget } from "./widgets/trading-overview-widget";
import { TraderPerformanceWidget } from "./widgets/trading-overview-widget";
import { AccountBalanceWidget } from "./widgets/trading-overview-widget";
import { RecentActivityWidget } from "./widgets/trading-overview-widget";

const navigation: NavigationItem[] = [
  {
    id: "trading",
    label: "Trading",
    termKey: "trading",
    icon: CandlestickChart,
    order: 10,
    children: [
      { id: "trading.overview", label: "Overview", href: "trading", icon: LineChart, permission: "trader.read" },
      { id: "trading.traders", label: "Traders", href: "trading-traders", icon: Users, permission: "trader.read" },
      { id: "trading.accounts", label: "Accounts", href: "trading-accounts", icon: CreditCard, permission: "account.read" },
      { id: "trading.positions", label: "Open Positions", href: "trading-positions", icon: Activity, permission: "account.read" },
      { id: "trading.add-account", label: "Add Account", href: "trading-add-account", icon: UserPlus, permission: "account.write" },
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
    supportedApplications: ["prop-admin", "super-admin", "trader"],
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
