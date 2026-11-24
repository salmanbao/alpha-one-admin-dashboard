/**
 * Tenant setup templates — create-tenant report, P2-6 (Option A).
 *
 * The wizard used to keep its own private `TENANT_TEMPLATES` list next to
 * `COLOR_PRESETS` / `CORE_MODULE_IDS`, so any second surface wanting to
 * offer "create this kind of firm" had to duplicate the fixtures and
 * drift. This module is now the single source: the wizard imports from
 * here, and future entry points (segments, getting-started flows,
 * `?template=` deep links) resolve the same list.
 *
 * The Template Library admin page is a DIFFERENT thing — it manages
 * message/notification templates for tenants. These are tenant *setup*
 * presets (plan + branding + module set); do not merge the two.
 *
 * Module sets are derived from the module catalog — never hardcoded — so
 * adding a module to the catalog automatically reaches the "everything
 * on" template. Every patch stays partial and every field editable.
 */

import type { LucideIcon } from "lucide-react";
import { Megaphone, Package, ShieldCheck, Target } from "lucide-react";
import { tenantModuleCatalog } from "@/lib/platform/module-catalog";
import type { TenantContext } from "@/lib/platform/types";

/* ------------------------------------------------------------------ */
/* Branding presets + module sets                                      */
/* ------------------------------------------------------------------ */

export const COLOR_PRESETS = [
  { name: "Forest", primary: "#4a7c59", accent: "#705c30", surface: "#f5efe6" },
  { name: "Sage", primary: "#5a7c4a", accent: "#8a6d30", surface: "#f5efe6" },
  { name: "Deep Green", primary: "#4a6c59", accent: "#705c30", surface: "#f5efe6" },
  { name: "Golden Brown", primary: "#705c30", accent: "#4a7c59", surface: "#f5efe6" },
  { name: "Warm Taupe", primary: "#8a7560", accent: "#4a7c59", surface: "#f5efe6" },
  { name: "Slate Green", primary: "#5a7060", accent: "#705c30", surface: "#f5efe6" },
];

/** Core modules every firm needs to operate — locked on in the wizard. */
export const CORE_MODULE_IDS = ["trading", "challenges", "risk", "payouts", "settings"];

/** Core modules plus the growth stack for acquisition-led firms. */
export const GROWTH_MODULE_IDS = [
  ...CORE_MODULE_IDS,
  "analytics",
  "affiliates",
  "marketing",
  "crm",
  "support",
];

/** Every tenant-facing module the platform ships (from the catalog). */
export const ALL_MODULE_IDS = tenantModuleCatalog.map((m) => m.manifest.id);

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

/**
 * The subset of wizard state a template may prefill. Kept explicit (rather
 * than `Partial<WizardState>`) so this module stays importable by any
 * consumer without dragging the page's state type along.
 */
export interface TemplatePatch {
  name: string;
  slug: string;
  initials: string;
  plan: TenantContext["plan"];
  tagline: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  enabledModules: string[];
  contractSso?: boolean;
}

export interface TenantTemplate {
  id: string;
  label: string;
  /** One-line "who this is for" — shown under the chips. */
  blurb: string;
  icon: LucideIcon;
  patch: Partial<TemplatePatch>;
}

export const TENANT_TEMPLATES: TenantTemplate[] = [
  {
    id: "starter",
    label: "Starter firm",
    blurb: "Lean launch: core trading, challenges, risk, payouts and settings on the Starter plan.",
    icon: Target,
    patch: {
      name: "Acme Trading",
      slug: "acme-trading",
      initials: "AT",
      plan: "starter",
      tagline: "Trade smart, fund faster.",
      primaryColor: COLOR_PRESETS[1].primary,
      accentColor: COLOR_PRESETS[1].accent,
      surfaceColor: COLOR_PRESETS[1].surface,
      enabledModules: [...CORE_MODULE_IDS],
    },
  },
  {
    id: "growth",
    label: "Growth firm",
    blurb: "Adds analytics, affiliates, marketing, CRM and support — for firms actively acquiring traders.",
    icon: Megaphone,
    patch: {
      name: "Northwind Capital",
      slug: "northwind-capital",
      initials: "NC",
      plan: "growth",
      tagline: "Funded traders, faster.",
      primaryColor: COLOR_PRESETS[0].primary,
      accentColor: COLOR_PRESETS[0].accent,
      surfaceColor: COLOR_PRESETS[0].surface,
      enabledModules: [...GROWTH_MODULE_IDS],
    },
  },
  {
    id: "full",
    label: "Full platform",
    blurb: "Every module from the catalog enabled — enterprise-style operation with compliance and AI.",
    icon: Package,
    patch: {
      name: "Vertex Markets",
      slug: "vertex-markets",
      initials: "VM",
      plan: "scale",
      tagline: "Institutional-grade prop trading.",
      primaryColor: COLOR_PRESETS[3].primary,
      accentColor: COLOR_PRESETS[3].accent,
      surfaceColor: COLOR_PRESETS[3].surface,
      enabledModules: [...ALL_MODULE_IDS],
    },
  },
  {
    id: "enterprise",
    label: "Enterprise + SSO",
    blurb: "Full module set on the Enterprise plan with contracted SSO (provisioning sub-step 3a runs).",
    icon: ShieldCheck,
    patch: {
      name: "Meridian Global",
      slug: "meridian-global",
      initials: "MG",
      plan: "enterprise",
      tagline: "Global desk, single sign-on.",
      primaryColor: COLOR_PRESETS[5].primary,
      accentColor: COLOR_PRESETS[5].accent,
      surfaceColor: COLOR_PRESETS[5].surface,
      enabledModules: [...ALL_MODULE_IDS],
      contractSso: true,
    },
  },
];

/** Resolve a `?template=` deep-link id to its template (or undefined). */
export function tenantTemplateById(id?: string): TenantTemplate | undefined {
  if (!id) return undefined;
  return TENANT_TEMPLATES.find((t) => t.id === id);
}
