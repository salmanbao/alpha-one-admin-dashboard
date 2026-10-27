/**
 * Tenant Module Catalog — the platform's sellable module set.
 *
 * The console (platform-admin) manages entitlements for tenant modules that
 * physically live in the prop-admin app bundle. Those manifests cannot be
 * imported across apps, so this file mirrors the prop-admin registry
 * (`apps/prop-admin/src/lib/platform/module-bootstrap.ts`) as manifest-only
 * stubs: id, name, description, category, accent, version.
 *
 * Deliberately NO navigation / routes / widgets / settings — those belong to
 * the prop-admin runtime. Registering these stubs makes every console
 * catalog surface work against the real module set:
 *  - create-tenant wizard module picker (ids match tenant.enabledModules)
 *  - tenant-detail module adoption + entitlements tab
 *  - Service Catalog / module detail / module settings pages
 *  - platform overview adoption metrics, onboarding wizard
 *
 * `supportedApplications: ["prop-admin"]` keeps them out of the platform
 * shell's own navigation resolution (getEnabledModules filters by app).
 *
 * When prop-admin adds or renames a module, update this catalog too.
 */

import type { FrontendModule, ModuleManifest, WidgetCategory } from "@/lib/platform/types";
import {
  BarChart3,
  Brain,
  Calculator,
  CandlestickChart,
  Contact,
  LifeBuoy,
  Megaphone,
  Monitor,
  Settings,
  ShieldCheck,
  Target,
  Wallet,
} from "lucide-react";

interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: ModuleManifest["category"];
  accentColor: string;
  optional?: boolean;
  icon: ModuleManifest["icon"];
  /** Module ids this module depends on (mirrors prop-admin). */
  dependencies?: string[];
  /** Widget definitions (metadata only; components are in prop-admin bundle). */
  widgets?: Array<{
    id: string;
    title: string;
    module: string;
    category: WidgetCategory;
    component?: never;
    permission: string;
    feature?: string;
    defaultSize: { w: number; h: number };
    description?: string;
  }>;
}

/** Keep in lockstep with prop-admin's module-bootstrap registration list. */
const CATALOG: CatalogEntry[] = [
  // Core — the baseline every prop firm runs.
  {
    id: "settings",
    name: "Settings",
    description: "Platform and tenant settings.",
    category: "core",
    accentColor: "#404040",
    icon: Settings,
    widgets: [],
  },
  {
    id: "trading",
    name: "Trading",
    description: "Core trading module — traders, accounts, positions.",
    category: "core",
    accentColor: "#0f766e",
    icon: CandlestickChart,
    widgets: [
      { id: "trading-overview", title: "Trading Overview", module: "trading", category: "metric", permission: "trader.read", defaultSize: { w: 12, h: 1 }, description: "Aggregate trading KPIs across all traders." },
      { id: "account-balance", title: "Account Balances", module: "trading", category: "chart", permission: "account.read", defaultSize: { w: 6, h: 2 }, description: "Distribution of account balances." },
      { id: "trader-performance", title: "Trader Performance", module: "trading", category: "leaderboard", permission: "trader.read", defaultSize: { w: 6, h: 2 }, description: "Top trader performance leaderboard." },
      { id: "open-positions", title: "Open Positions", module: "trading", category: "table", permission: "trader.read", defaultSize: { w: 12, h: 3 }, description: "Active position summary across all traders." },
      { id: "position-pnl", title: "Position P&L", module: "trading", category: "chart", permission: "trader.read", defaultSize: { w: 6, h: 2 }, description: "Aggregate P&L by symbol and P&L %." },
    ],
  },
  {
    id: "challenges",
    name: "Challenges",
    description: "Trader evaluation challenges and phases.",
    category: "core",
    accentColor: "#15803d",
    icon: Target,
    widgets: [
      { id: "challenge-overview", title: "Challenge Overview", module: "challenges", category: "metric", permission: "challenge.read", defaultSize: { w: 12, h: 1 } },
      { id: "challenge-progress", title: "Challenge Progress", module: "challenges", category: "progress", permission: "challenge.read", defaultSize: { w: 6, h: 2 } },
      { id: "challenge-phases", title: "Phase Distribution", module: "challenges", category: "chart", permission: "challenge.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
  {
    id: "risk",
    name: "Risk Management",
    description: "Drawdown monitoring, risk scoring, and breach tracking.",
    category: "core",
    accentColor: "#b91c1c",
    icon: ShieldCheck,
    widgets: [
      { id: "risk-overview", title: "Risk Overview", module: "risk", category: "metric", permission: "risk.read", defaultSize: { w: 12, h: 1 } },
      { id: "risk-distribution", title: "Risk Distribution", module: "risk", category: "chart", permission: "risk.read", defaultSize: { w: 6, h: 2 } },
      { id: "breach-trend", title: "Breach Trend (30d)", module: "risk", category: "chart", permission: "breach.read", defaultSize: { w: 6, h: 2 } },
      { id: "open-breaches", title: "Open Breaches", module: "risk", category: "alert", permission: "breach.read", defaultSize: { w: 12, h: 2 } },
    ],
  },
  {
    id: "payouts",
    name: "Payouts",
    description: "Trader withdrawal requests, approvals, and history.",
    category: "core",
    accentColor: "#15803d",
    icon: Wallet,
    widgets: [
      { id: "payout-overview", title: "Payout Overview", module: "payouts", category: "metric", permission: "payout.read", defaultSize: { w: 12, h: 1 } },
      { id: "payout-queue", title: "Pending Approvals", module: "payouts", category: "table", permission: "payout.approve", defaultSize: { w: 6, h: 3 } },
      { id: "payout-trend", title: "Payout Trend (30d)", module: "payouts", category: "chart", permission: "payout.read", defaultSize: { w: 6, h: 2 } },
      { id: "payout-method", title: "By Method", module: "payouts", category: "chart", permission: "payout.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
  {
    id: "support",
    name: "Support",
    description: "Ticketing, knowledge base, and SLA metrics for trader support.",
    category: "core",
    accentColor: "#c2410c",
    optional: true,
    dependencies: ["trading"],
    icon: LifeBuoy,
    widgets: [
      { id: "support-overview", title: "Support Overview", module: "support", category: "metric", permission: "support.read", defaultSize: { w: 12, h: 1 } },
      { id: "support-recent-tickets", title: "Recent Tickets", module: "support", category: "table", permission: "support.read", defaultSize: { w: 12, h: 2 } },
      { id: "support-priority", title: "Ticket Priority", module: "support", category: "chart", permission: "support.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
  {
    id: "stitch",
    name: "Stitch",
    description: "Screens converted from stitch_screens reference renders.",
    category: "core",
    accentColor: "#0a0a0a",
    optional: true,
    dependencies: ["trading"],
    icon: Monitor,
    widgets: [
      { id: "stitch-overview", title: "Stitch Overview", module: "stitch", category: "metric", permission: "stitch.read", defaultSize: { w: 12, h: 1 } },
      { id: "stitch-positions", title: "Positions", module: "stitch", category: "table", permission: "stitch.read", defaultSize: { w: 12, h: 3 } },
      { id: "stitch-orders", title: "Order History", module: "stitch", category: "table", permission: "stitch.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
  // Growth — opt-in modules that expand the tenant's business surface.
  {
    id: "analytics",
    name: "Analytics",
    description: "Business intelligence and reporting. First optional plug-and-play module.",
    category: "growth",
    accentColor: "#0d9488",
    optional: true,
    dependencies: ["trading", "challenges"],
    icon: BarChart3,
    widgets: [
      { id: "analytics-overview", title: "Analytics Overview", module: "analytics", category: "metric", permission: "analytics.read", defaultSize: { w: 12, h: 1 } },
      { id: "revenue", title: "Revenue (30d)", module: "analytics", category: "chart", permission: "analytics.read", defaultSize: { w: 6, h: 2 } },
      { id: "trader-growth", title: "Trader Growth", module: "analytics", category: "chart", permission: "analytics.read", defaultSize: { w: 6, h: 2 } },
      { id: "analytics-risk-distribution", title: "Risk Distribution", module: "analytics", category: "chart", permission: "analytics.read", defaultSize: { w: 6, h: 2 } },
      { id: "analytics-breach-trend", title: "Breach Trend", module: "analytics", category: "chart", permission: "analytics.read", defaultSize: { w: 6, h: 2 } },
      { id: "advanced-analytics", title: "Advanced Analytics", module: "analytics", category: "ai", permission: "analytics.advanced.read", feature: "analytics.advanced", defaultSize: { w: 12, h: 2 } },
    ],
  },
  {
    id: "affiliates",
    name: "Affiliates",
    description: "Affiliate partner management, campaigns, and commission tracking.",
    category: "growth",
    accentColor: "#b45309",
    optional: true,
    dependencies: ["trading"],
    icon: Megaphone,
    widgets: [
      { id: "affiliate-overview", title: "Affiliate Overview", module: "affiliates", category: "metric", permission: "affiliate.read", defaultSize: { w: 12, h: 1 } },
      { id: "top-affiliates", title: "Top Affiliates", module: "affiliates", category: "leaderboard", permission: "affiliate.read", defaultSize: { w: 6, h: 2 } },
      { id: "affiliate-revenue", title: "Affiliate Revenue", module: "affiliates", category: "chart", permission: "affiliate.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    description: "Campaigns, spend, channel performance and ROI tracking.",
    category: "growth",
    accentColor: "#b45309",
    optional: true,
    dependencies: ["trading"],
    icon: Megaphone,
    widgets: [
      { id: "marketing-overview", title: "Marketing Overview", module: "marketing", category: "metric", permission: "marketing.read", defaultSize: { w: 12, h: 1 } },
      { id: "campaign-performance", title: "Campaign Performance", module: "marketing", category: "chart", permission: "marketing.read", defaultSize: { w: 6, h: 2 } },
      { id: "channel-breakdown", title: "Channel Breakdown", module: "marketing", category: "chart", permission: "marketing.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
  {
    id: "crm",
    name: "CRM",
    description: "Contacts, pipeline stages, and lead tracking.",
    category: "growth",
    accentColor: "#0f766e",
    optional: true,
    dependencies: ["trading"],
    icon: Contact,
    widgets: [
      { id: "crm-overview", title: "CRM Overview", module: "crm", category: "metric", permission: "crm.read", defaultSize: { w: 12, h: 1 } },
      { id: "crm-pipeline", title: "Pipeline", module: "crm", category: "chart", permission: "crm.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
  // Advanced / compliance / AI.
  {
    id: "accounting",
    name: "Accounting",
    description: "Financial ledger, transactions, and bank reconciliation.",
    category: "advanced",
    accentColor: "#b45309",
    optional: true,
    dependencies: ["trading"],
    icon: Calculator,
    widgets: [
      { id: "accounting-overview", title: "Accounting Overview", module: "accounting", category: "metric", permission: "accounting.read", defaultSize: { w: 12, h: 1 } },
      { id: "revenue-by-type", title: "Revenue by Type", module: "accounting", category: "chart", permission: "accounting.read", defaultSize: { w: 6, h: 2 } },
      { id: "transaction-flow", title: "Transaction Flow", module: "accounting", category: "chart", permission: "accounting.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
  {
    id: "kyc",
    name: "KYC / AML",
    description: "Identity verification, document reviews, and AML risk scoring.",
    category: "compliance",
    accentColor: "#475569",
    optional: true,
    dependencies: ["trading"],
    icon: ShieldCheck,
    widgets: [
      { id: "kyc-overview", title: "KYC Overview", module: "kyc", category: "metric", permission: "kyc.read", defaultSize: { w: 12, h: 1 } },
      { id: "kyc-queue", title: "KYC Queue", module: "kyc", category: "alert", permission: "kyc.read", defaultSize: { w: 12, h: 2 } },
    ],
  },
  {
    id: "audit",
    name: "Audit & Compliance",
    description:
      "Comprehensive audit log, user events, change history, and compliance reporting.",
    category: "compliance",
    accentColor: "#475569",
    optional: true,
    dependencies: ["settings"],
    icon: ShieldCheck,
    widgets: [],
  },
  {
    id: "ai",
    name: "AI / LLM",
    description: "AI-generated insights, an assistant chat, and model configuration.",
    category: "ai",
    accentColor: "#0d9488",
    optional: true,
    dependencies: ["trading", "analytics"],
    icon: Brain,
    widgets: [
      { id: "ai-overview", title: "AI Overview", module: "ai", category: "metric", permission: "ai.read", defaultSize: { w: 12, h: 1 } },
      { id: "ai-insights", title: "AI Insights", module: "ai", category: "ai", permission: "ai.read", defaultSize: { w: 12, h: 2 } },
      { id: "ai-confidence", title: "AI Confidence", module: "ai", category: "chart", permission: "ai.read", defaultSize: { w: 6, h: 2 } },
    ],
  },
];

/** Manifest-only modules for every tenant-facing module the platform ships. */
export const tenantModuleCatalog: FrontendModule[] = CATALOG.map((e) => ({
  manifest: {
    id: e.id,
    name: e.name,
    version: "1.0.0",
    description: e.description,
    category: e.category,
    accentColor: e.accentColor,
    optional: e.optional,
    icon: e.icon,
    supportedApplications: ["prop-admin"],
    dependencies: e.dependencies,
  },
  widgets: e.widgets as FrontendModule["widgets"],
}));

/** Catalog lookup for a single module id (e.g. provisioning step 6 refs). */
export function catalogEntry(id: string): ModuleManifest | undefined {
  return tenantModuleCatalog.find((m) => m.manifest.id === id)?.manifest;
}
