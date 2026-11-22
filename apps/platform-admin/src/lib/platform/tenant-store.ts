import type { TenantContext } from "./types";

/* ------------------------------------------------------------------ */
/* Seed data                                                             */
/* ------------------------------------------------------------------ */

const DEMO_TENANTS: TenantContext[] = [
  {
    id: "tenant-alpha",
    slug: "alpha-capital",
    name: "Alpha Capital",
    application: "prop-admin",
    branding: {
      name: "Alpha Capital",
      initials: "AC",
      primaryColor: "#4a7c59",
      accentColor: "#2d5a3c",
      surfaceColor: "#e5e7eb",
      radius: "0.5rem",
    },
    locale: "en-US",
    timezone: "America/New_York",
    currency: "USD",
    domain: "alpha.alpha1.io",
    subdomain: "alpha",
    enabledModules: ["billing", "users", "analytics", "api-keys"],
    enabledFeatures: ["api-rate-limits", "payouts"],
    plan: "growth",
    status: "active",
    createdAt: "2023-01-15T10:30:00Z",
    liveAt: "2023-02-01T14:00:00Z",
    billingCycleAnchor: "2023-01-15T10:30:00Z",
    billingCycle: "monthly",
    owner: "Sarah Mitchell",
    ownerEmail: "sarah.mitchell@alpha-capital.com",
    region: "us-east",
    terminology: {},
    kycProvider: undefined,
  },
  {
    id: "tenant-beta",
    slug: "beta-trading",
    name: "Beta Trading",
    application: "prop-admin",
    branding: {
      name: "Beta Trading",
      initials: "BT",
      primaryColor: "#dc2626",
      accentColor: "#b91c1c",
      surfaceColor: "#fee2e2",
      radius: "0.5rem",
    },
    locale: "en-US",
    timezone: "Europe/London",
    currency: "GBP",
    domain: "beta.beta1.io",
    subdomain: "beta",
    enabledModules: ["billing", "users", "analytics", "api-keys"],
    enabledFeatures: ["api-rate-limits", "payouts"],
    plan: "scale",
    status: "active",
    createdAt: "2023-03-10T08:00:00Z",
    liveAt: "2023-04-01T12:00:00Z",
    billingCycleAnchor: "2023-03-10T08:00:00Z",
    billingCycle: "weekly",
    region: "eu-west",
    owner: "James Carter",
    ownerEmail: "james.carter@beta-trading.io",
    terminology: {},
    kycProvider: undefined,
  },
  {
    id: "tenant-gamma",
    slug: "gamma-futures",
    name: "Gamma Futures",
    application: "prop-admin",
    branding: {
      name: "Gamma Futures",
      initials: "GF",
      primaryColor: "#7c3aed",
      accentColor: "#5b21b6",
      surfaceColor: "#ede9fe",
      radius: "0.5rem",
    },
    locale: "en-US",
    timezone: "Asia/Singapore",
    currency: "SGD",
    domain: "gamma.gamma1.io",
    subdomain: "gamma",
    enabledModules: ["billing", "users", "analytics", "api-keys", "functions"],
    enabledFeatures: ["api-rate-limits", "payouts", "functions"],
    plan: "enterprise",
    status: "active",
    createdAt: "2022-11-20T16:00:00Z",
    liveAt: "2022-12-01T09:00:00Z",
    billingCycleAnchor: "2022-11-20T16:00:00Z",
    billingCycle: "annually",
    region: "ap-southeast",
    owner: "Dr. Wei Chen",
    ownerEmail: "wei.chen@gamma-futures.sg",
    terminology: {},
    kycProvider: undefined,
  },
];

let tenantState: TenantContext[] = DEMO_TENANTS;

/* ------------------------------------------------------------------ */
/* Public API                                                            */
/* ------------------------------------------------------------------ */

export function readTenants(): TenantContext[] {
  return tenantState;
}

export function updateTenant(id: string, partial: Partial<TenantContext>) {
  tenantState = tenantState.map((t) => (t.id === id ? { ...t, ...partial } : t));
}

export function removeTenant(id: string) {
  tenantState = tenantState.filter((t) => t.id !== id);
}

export function useTenants(): TenantContext[] {
  return tenantState;
}

export function applyDueScheduledPlans(): TenantContext[] {
  const now = new Date();
  tenantState = tenantState.map((t) => {
    if (t.scheduledPlan && new Date(t.scheduledPlan.scheduledFor) <= now) {
      return { ...t, plan: t.scheduledPlan.plan, scheduledPlan: undefined };
    }
    return t;
  });
  return tenantState;
}

/* ------------------------------------------------------------------ */
/* Data residency types (from residency report)                          */
/* ------------------------------------------------------------------ */

export type DataClass =
  | "core"
  | "billing"
  | "kyc"
  | "payouts"
  | "analytics"
  | "audit"
  | "backups";

export const DATA_CLASSES: DataClass[] = [
  "core",
  "billing",
  "kyc",
  "payouts",
  "analytics",
  "audit",
  "backups",
];

export const DATA_CLASS_MAP: Record<DataClass, { label: string; description: string }> = {
  core: { label: "Core tenant data", description: "Identity, branding, settings, plan" },
  billing: { label: "Billing & invoices", description: "Subscription records, payment methods" },
  kyc: { label: "KYC documents", description: "Identity verification, compliance docs" },
  payouts: { label: "Payout records", description: "Funded trader payouts, settlements" },
  analytics: { label: "Analytics events", description: "Usage, performance, conversion data" },
  audit: { label: "Audit log", description: "Operator actions, consent records" },
  backups: { label: "Backups & DR", description: "Point-in-time snapshots, recovery points" },
};

export function dataLocationFor(tenant: TenantContext, cls: DataClass): { location: string; pinned: boolean } {
  const pin = tenant.region?.toLowerCase();
  const defaults: Record<DataClass, string> = {
    core: "us-east",
    billing: "us-east",
    kyc: "eu-west",
    payouts: "us-east",
    analytics: "us-east",
    audit: "us-east",
    backups: "eu-west",
  };
  return { location: pin || defaults[cls] || "us-east", pinned: !!pin };
}