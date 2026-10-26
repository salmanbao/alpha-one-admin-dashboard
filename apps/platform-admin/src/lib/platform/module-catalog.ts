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

import type { FrontendModule, ModuleManifest } from "@/lib/platform/types";
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
  },
  {
    id: "trading",
    name: "Trading",
    description: "Core trading module — traders, accounts, positions.",
    category: "core",
    accentColor: "#0f766e",
    icon: CandlestickChart,
  },
  {
    id: "challenges",
    name: "Challenges",
    description: "Trader evaluation challenges and phases.",
    category: "core",
    accentColor: "#15803d",
    icon: Target,
  },
  {
    id: "risk",
    name: "Risk Management",
    description: "Drawdown monitoring, risk scoring, and breach tracking.",
    category: "core",
    accentColor: "#b91c1c",
    icon: ShieldCheck,
  },
  {
    id: "payouts",
    name: "Payouts",
    description: "Trader withdrawal requests, approvals, and history.",
    category: "core",
    accentColor: "#15803d",
    icon: Wallet,
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
  // No navigation / routes / widgets — the prop-admin runtime owns those.
}));

/** Catalog lookup for a single module id (e.g. provisioning step 6 refs). */
export function catalogEntry(id: string): ModuleManifest | undefined {
  return tenantModuleCatalog.find((m) => m.manifest.id === id)?.manifest;
}
