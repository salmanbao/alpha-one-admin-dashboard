/**
 * Accounting Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec section 72 Phase 9: Accounting is an optional advanced module that
 * depends on Trading. Manages tenant financial transactions and bank
 * reconciliation.
 */

import { Calculator, Receipt, BookOpen, ArrowLeftRight, ListChecks, FileText, TrendingUp, CreditCard, Landmark, Banknote, Coins, Undo2, Webhook, Plug, Percent, Library, FileSpreadsheet, NotebookPen, Repeat, History, Upload } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { AccountingOverviewWidget, RevenueByTypeWidget, TransactionFlowWidget } from "./widgets/accounting-widgets";

const navigation: NavigationItem[] = [
  {
    id: "accounting",
    label: "Accounting",
    icon: Calculator,
    order: 60,
    children: [
      // ───────── Ledger ─────────
      { id: "accounting.overview", label: "Overview", href: "accounting", icon: BookOpen, permission: "accounting.read", group: "Ledger" },
      { id: "accounting.transactions", label: "Transactions", href: "accounting-transactions", icon: Receipt, permission: "accounting.read", group: "Ledger" },
      { id: "accounting.reconciliation", label: "Reconciliation", href: "accounting-reconciliation", icon: ArrowLeftRight, permission: "accounting.read", group: "Ledger" },
      { id: "accounting.invoices", label: "Invoices", href: "accounting-invoices", icon: FileText, permission: "accounting.read", order: 73, group: "Ledger" },
      { id: "accounting.pl", label: "P&L Statement", href: "accounting-pl", icon: TrendingUp, permission: "accounting.read", order: 74, group: "Ledger" },

      // ───────── Payments & Billing (M7/M13 — checkout + tax) ─────────
      { id: "accounting.checkout-providers", label: "Payment Gateways", href: "checkout-providers", icon: CreditCard, permission: "accounting.read", group: "Payments & Billing" },
      { id: "accounting.psp-onboarding", label: "PSP Onboarding", href: "checkout-psp-onboarding", icon: Landmark, permission: "accounting.read", group: "Payments & Billing" },
      { id: "accounting.checkout-transactions", label: "Checkout Transactions", href: "checkout-transactions", icon: Banknote, permission: "accounting.read", group: "Payments & Billing" },
      { id: "accounting.settlement", label: "Settlement", href: "checkout-settlement", icon: Coins, permission: "accounting.read", group: "Payments & Billing" },
      { id: "accounting.refund-dispute", label: "Refunds & Disputes", href: "checkout-refund-dispute", icon: Undo2, permission: "accounting.read", group: "Payments & Billing" },
      { id: "accounting.checkout-webhooks", label: "Checkout Webhook Log", href: "checkout-webhook-log", icon: Webhook, permission: "accounting.read", group: "Payments & Billing" },
      { id: "accounting.checkout-external", label: "External Payments", href: "checkout-external", icon: Plug, permission: "accounting.read", group: "Payments & Billing" },
      { id: "accounting.tax-vat", label: "Tax & VAT", href: "tax-vat-config", icon: Percent, permission: "accounting.read", group: "Payments & Billing" },

      // ───────── Financial Reports (M13) ─────────
      { id: "accounting.reports-library", label: "Reports Library", href: "financial-reports-library", icon: Library, permission: "accounting.read", group: "Financial Reports" },
      { id: "accounting.refunds-credit-notes", label: "Refunds & Credit Notes", href: "refunds-credit-notes", icon: FileSpreadsheet, permission: "accounting.read", group: "Financial Reports" },
      { id: "accounting.chart-of-accounts", label: "Chart of Accounts", href: "chart-of-accounts", icon: BookOpen, permission: "accounting.read", group: "Financial Reports" },
      { id: "accounting.journal-entries", label: "Journal Entries", href: "journal-entries", icon: NotebookPen, permission: "accounting.read", group: "Financial Reports" },
      { id: "accounting.recurring-invoices", label: "Recurring Invoices", href: "recurring-invoices", icon: Repeat, permission: "accounting.read", group: "Financial Reports" },
      { id: "accounting.reconciled-transactions", label: "Reconciled Transactions", href: "reconciled-transactions", icon: History, permission: "accounting.read", group: "Financial Reports" },
      { id: "accounting.bank-statement-import", label: "Bank Statement Import", href: "bank-statement-import", icon: Upload, permission: "accounting.read", group: "Financial Reports" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "accounting", viewId: "accounting", label: "Accounting Overview", permission: "accounting.read", module: "accounting" },
  { path: "accounting-transactions", viewId: "accounting-transactions", label: "Transactions", permission: "accounting.read", module: "accounting" },
  { path: "accounting-reconciliation", viewId: "accounting-reconciliation", label: "Reconciliation", permission: "accounting.read", module: "accounting" },
  { path: "accounting-invoices", viewId: "accounting-invoices", label: "Invoices", permission: "accounting.read", module: "accounting" },
  { path: "accounting-pl", viewId: "accounting-pl", label: "P&L Statement", permission: "accounting.read", module: "accounting" },
  { path: "documents", viewId: "documents", label: "Documents", permission: ["payout.read", "payout.self"], module: "accounting" },
  // Payments & Billing (M7/M13) — guarded variants of the stitch routes;
  // registered here so module/permission guards apply (this module is
  // registered before stitch, so these definitions win).
  { path: "checkout-providers", viewId: "checkout-providers", label: "Payment Gateways", permission: "accounting.read", module: "accounting" },
  { path: "checkout-psp-onboarding", viewId: "checkout-psp-onboarding", label: "PSP Onboarding", permission: "accounting.read", module: "accounting" },
  { path: "checkout-transactions", viewId: "checkout-transactions", label: "Checkout Transactions", permission: "accounting.read", module: "accounting" },
  { path: "checkout-settlement", viewId: "checkout-settlement", label: "Settlement", permission: "accounting.read", module: "accounting" },
  { path: "checkout-refund-dispute", viewId: "checkout-refund-dispute", label: "Refunds & Disputes", permission: "accounting.read", module: "accounting" },
  { path: "checkout-webhook-log", viewId: "checkout-webhook-log", label: "Checkout Webhook Log", permission: "accounting.read", module: "accounting" },
  { path: "checkout-external", viewId: "checkout-external", label: "External Payments", permission: "accounting.read", module: "accounting" },
  { path: "tax-vat-config", viewId: "tax-vat-config", label: "Tax & VAT Config", permission: "accounting.read", module: "accounting" },
  // Financial Reports (M13)
  { path: "financial-reports-library", viewId: "financial-reports-library", label: "Financial Reports Library", permission: "accounting.read", module: "accounting" },
  { path: "refunds-credit-notes", viewId: "refunds-credit-notes", label: "Refunds & Credit Notes", permission: "accounting.read", module: "accounting" },
  { path: "chart-of-accounts", viewId: "chart-of-accounts", label: "Chart of Accounts", permission: "accounting.read", module: "accounting" },
  { path: "journal-entries", viewId: "journal-entries", label: "Journal Entries", permission: "accounting.read", module: "accounting" },
  { path: "recurring-invoices", viewId: "recurring-invoices", label: "Recurring Invoices", permission: "accounting.read", module: "accounting" },
  { path: "reconciled-transactions", viewId: "reconciled-transactions", label: "Reconciled Transactions", permission: "accounting.read", module: "accounting" },
  { path: "bank-statement-import", viewId: "bank-statement-import", label: "Bank Statement Import", permission: "accounting.read", module: "accounting" },
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
    supportedApplications: ["prop-admin"],
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
