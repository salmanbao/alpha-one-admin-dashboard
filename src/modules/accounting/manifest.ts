/**
 * Accounting Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec section 72 Phase 9: Accounting is an optional advanced module that
 * depends on Trading. Manages tenant financial transactions and bank
 * reconciliation.
 */

import { Calculator, Receipt, BookOpen, ArrowLeftRight, ListChecks, FileText, TrendingUp } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { AccountingOverviewWidget, RevenueByTypeWidget, TransactionFlowWidget } from "./widgets/accounting-widgets";

const navigation: NavigationItem[] = [
  {
    id: "accounting",
    label: "Accounting",
    icon: Calculator,
    order: 60,
    children: [
      { id: "accounting.overview", label: "Overview", href: "accounting", icon: BookOpen, permission: "accounting.read" },
      { id: "accounting.transactions", label: "Transactions", href: "accounting-transactions", icon: Receipt, permission: "accounting.read" },
      { id: "accounting.reconciliation", label: "Reconciliation", href: "accounting-reconciliation", icon: ArrowLeftRight, permission: "accounting.read" },
      { id: "accounting.invoices", label: "Invoices", href: "accounting-invoices", icon: FileText, permission: "accounting.read", order: 73 },
      { id: "accounting.pl", label: "P&L Statement", href: "accounting-pl", icon: TrendingUp, permission: "accounting.read", order: 74 },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "accounting", viewId: "accounting", label: "Accounting Overview", permission: "accounting.read", module: "accounting" },
  { path: "accounting-transactions", viewId: "accounting-transactions", label: "Transactions", permission: "accounting.read", module: "accounting" },
  { path: "accounting-reconciliation", viewId: "accounting-reconciliation", label: "Reconciliation", permission: "accounting.read", module: "accounting" },
  { path: "accounting-invoices", viewId: "accounting-invoices", label: "Invoices", permission: "accounting.read", module: "accounting" },
  { path: "accounting-pl", viewId: "accounting-pl", label: "P&L Statement", permission: "accounting.read", module: "accounting" },
];

const widgets: WidgetDefinition[] = [
  { id: "accounting-overview", title: "Accounting Overview", module: "accounting", category: "metric", component: AccountingOverviewWidget, permission: "accounting.read", defaultSize: { w: 12, h: 1 } },
  { id: "revenue-by-type", title: "Revenue by Type", module: "accounting", category: "chart", component: RevenueByTypeWidget, permission: "accounting.read", defaultSize: { w: 6, h: 2 } },
  { id: "transaction-flow", title: "Transaction Flow", module: "accounting", category: "chart", component: TransactionFlowWidget, permission: "accounting.read", defaultSize: { w: 6, h: 2 } },
];

export const accountingModule: FrontendModule = {
  manifest: {
    id: "accounting",
    name: "Accounting",
    version: "1.0.0",
    description: "Financial ledger, transactions, and bank reconciliation.",
    dependencies: ["trading"],
    capabilities: ["accounting.ledger", "accounting.reconciliation"],
    category: "advanced",
    optional: true,
    supportedApplications: ["prop-admin", "super-admin"],
    permissions: [
      { id: "accounting.read", label: "View accounting" },
      { id: "accounting.configure", label: "Configure accounting" },
    ],
    icon: Calculator,
    accentColor: "#b45309",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "accounting-settings", label: "Accounting", module: "accounting", viewId: "settings-accounting", icon: ListChecks, order: 80 },
  ],
};
