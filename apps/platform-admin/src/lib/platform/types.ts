/**
 * PFaaS Platform — Core Types
 *
 * Defines the module SDK contract, manifest types, navigation, widgets,
 * tenant, auth, permissions, feature flags, dashboard layouts.
 *
 * See spec sections: 10, 11, 12, 13, 15, 17, 18, 20, 22, 45, 61.
 */

import type { ComponentType } from "react";
import type { TermKey } from "./terminology";

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export type ApplicationId = "super-admin" | "prop-admin" | "trader";

/* ------------------------------------------------------------------ */
/* Tenant                                                              */
/* ------------------------------------------------------------------ */

export interface TenantBranding {
  /** Brand name shown in shell */
  name: string;
  /** Short tagline */
  tagline?: string;
  /** Logo URL or initials fallback */
  logoUrl?: string;
  /** Initials when no logo */
  initials: string;
  /** Primary brand color (any CSS color, applied as --brand-primary) */
  primaryColor: string;
  /** Secondary / accent color */
  accentColor: string;
  /** Surface tint used for sidebar */
  surfaceColor: string;
  /** Border radius token (e.g. "0.5rem") */
  radius: string;
}

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  /** Which application experience this tenant renders (prop-admin by default) */
  application: ApplicationId;
  branding: TenantBranding;
  locale: string;
  timezone: string;
  currency: string;
  /** Domain name (subdomain + domain) */
  domain: string;
  /** Subdomain part of the domain (slug) */
  subdomain: string;
  /** Module IDs this tenant is entitled to */
  enabledModules: string[];
  /** Feature flags enabled for this tenant */
  enabledFeatures: string[];
  /** Rollout percentage for each module (0-100) */
  moduleRollout: Record<string, number>;
  /** Custom terminology overrides */
  terminology: Record<string, string>;
  /** Plan tier */
  plan: "starter" | "growth" | "scale" | "enterprise";
  /**
   * R3-04 — a plan change confirmed for the next billing cycle (the
   * workflows' "Schedule transition" / "next billing cycle" choice).
   * Persisted here instead of toasting only; `applyDueScheduledPlans`
   * (tenant-store) moves it into `plan` once `scheduledFor` passes.
   */
  scheduledPlan?: { plan: TenantContext["plan"]; scheduledFor: string };
  /**
   * Lifecycle per docs/03 §3.5 + docs/21 CON-06: provisioning saga runs
   * `provisioning → onboarding` (steps 2 and 9); terminal failure lands
   * `provisioning_failed` until an operator resumes from the console.
   */
  status:
    | "active"
    | "trial"
    | "suspended"
    | "invited"
    | "terminated"
    | "provisioning"
    | "provisioning_failed"
    | "onboarding"
    /**
     * R13 TM-02: a provisioning saga that was compensated (rolled back
     * in reverse order) no longer reuses `invited` — no invitation was
     * ever sent for it. Distinct state: restart provisioning or delete
     * the draft.
     */
    | "rolled_back";
  /**
   * KYC provider driving verification for this tenant (e.g. "persona",
   * "sumsub"). Set by the go-live wizard's KYC step (R2-W3-04); absent
   * until configured.
   */
  kycProvider?: string;
  createdAt: string;
  /**
   * When the firm went live — set the first time the go-live wizard
   * flips `status` to `active`. `createdAt → liveAt` is the tenant
   * onboarding time-to-value reported by the platform-analytics
   * "Onboarding time to value" panel (R9 W6 UC-P3); absent until live.
   */
  liveAt?: string;
  /**
   * Billing cycle anchor — when the tenant's first billing cycle started.
   * Used to compute proration at every plan change; persisting across reloads.
   * Defaults to `createdAt` when absent.
   */
  billingCycleAnchor?: string;
  /**
   * Invoicing schedule — persisted across reloads so the selector value
   * does not vanish after a refresh (B-08).
   */
  billingCycle?: "weekly" | "monthly" | "quarterly" | "annually";
  /**
   * Data-residency pin (R9 W6 UC-P6) — the region this tenant's
   * payments/KYC data is pinned to. Absent until pinned; the residency
   * report shows such tenants honestly as "Unpinned".
   */
  region?: string;
  /**
   * R13 TM-11 — owner / primary contact for this tenant. Set at creation
   * via the create/go-live wizard, surfaced on the detail header and
   * Configuration tab.
   */
  owner?: string;
  /** Owner's email address — paired with owner for contact/permission
   * communications (invites, billing notices, breach alerts). */
  ownerEmail?: string;
   /**
   * Price override — per-tenant custom price (0 = disabled).
   * This overrides the plan's base price for billing purposes.
   */
   priceOverride?: number;
   /**
   * Discount percentage (0-100) to apply on top of the base price.
   * When priceOverride is set, this is applied to the overridden price.
   * When priceOverride is 0 (disabled), this field is ignored.
   */
   discountPct?: number;
}

/* ------------------------------------------------------------------ */
/* Auth & Permissions                                                  */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string;
  tenantId?: string;
  /** For trader-application users, the linked Trader record id. Optional
   * because prop-admin/super-admin users don't map to a Trader. Round 7
   * addition — drives trader-personal KPIs on the overview page. */
  traderId?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  roles: string[];
  permissions: string[];
  /** Application this user primarily belongs to */
  application: ApplicationId;
  lastActiveAt: string;
  /**
   * Per-operator MFA enrollment (gap S-02) — real status instead of the
   * directory's hardcoded "Enabled". Lifecycle patches persist under
   * `pfaas:userOverrides` and merge over the seed.
   */
  mfa?: "enabled" | "pending" | "disabled";
  /** Lifecycle status (gap S-01) — `suspended` loses console access. */
  status?: "active" | "suspended";
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  /** Which application this role is scoped to */
  application: ApplicationId;
  color?: string;
}

export type PermissionCheck = string | string[];

/* ------------------------------------------------------------------ */
/* Module SDK                                                          */
/* ------------------------------------------------------------------ */

export interface PermissionDefinition {
  id: string;
  label: string;
  description?: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  /** Term key for white-label terminology, falls back to label */
  termKey?: TermKey;
  href?: string;
  icon?: ComponentType<{ className?: string }>;
  children?: NavigationItem[];
  /** Required permission(s). Single = any-of, array = any-of */
  permission?: PermissionCheck;
  /** Required module ID */
  module?: string;
  /** Required feature flag */
  feature?: string;
  /** Required application scope */
  application?: ApplicationId[];
  /** Sort order */
  order?: number;
  /** Badge label (e.g. "New") */
  badge?: string;
  /**
   * Optional sub-group label rendered as a small uppercase muted header
   * inside the parent section's children list. When two adjacent children
   * have different `group` values, the Sidebar inserts a divider header
   * above the second one. Leave undefined for legacy / single-group lists
   * (renders exactly as before — backward compatible).
   */
  group?: string;
}

export interface RouteDefinition {
  path: string;
  /** A registered view id resolved by the dashboard router */
  viewId: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  permission?: PermissionCheck;
  module?: string;
  feature?: string;
  application?: ApplicationId[];
}

export type WidgetCategory =
  | "metric"
  | "chart"
  | "table"
  | "feed"
  | "progress"
  | "status"
  | "heatmap"
  | "leaderboard"
  | "ai"
  | "alert"
  | "action";

export interface WidgetSize {
  w: number; // grid columns (1-12)
  h: number; // grid rows
  minW?: number;
  minH?: number;
}

export interface WidgetDefinition {
  id: string;
  title: string;
  termKey?: string;
  module: string;
  category: WidgetCategory;
  component: ComponentType<WidgetProps>;
  permission?: PermissionCheck;
  feature?: string;
  application?: ApplicationId[];
  defaultSize: WidgetSize;
  description?: string;
}

export interface SettingDefinition {
  id: string;
  label: string;
  module: string;
  viewId: string;
  icon?: ComponentType<{ className?: string }>;
  order?: number;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Module IDs this module depends on */
  dependencies?: string[];
  /** Logical capability tags */
  capabilities?: string[];
  permissions?: PermissionDefinition[];
  supportedApplications?: ApplicationId[];
  /** Category for catalog UI */
  category?: "core" | "growth" | "advanced" | "compliance" | "ai";
  /** Whether this module is opt-in (not enabled by default) */
  optional?: boolean;
  /** Icon for catalog */
  icon?: ComponentType<{ className?: string }>;
  /** Accent color for catalog card */
  accentColor?: string;
}

export interface FrontendModule {
  manifest: ModuleManifest;
  navigation?: NavigationItem[];
  routes?: RouteDefinition[];
  widgets?: WidgetDefinition[];
  settings?: SettingDefinition[];
  initialize?: () => Promise<void> | void;
}

/* ------------------------------------------------------------------ */
/* Dashboard Layout                                                    */
/* ------------------------------------------------------------------ */

export interface DashboardWidgetPlacement {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardLayout {
  id: string;
  label: string;
  /** Tenant ID if tenant-specific, undefined for platform default */
  tenantId?: string;
  /** Role ID if role-specific */
  roleId?: string;
  /** User ID if user-customized */
  userId?: string;
  widgets: DashboardWidgetPlacement[];
}

/* ------------------------------------------------------------------ */
/* Runtime context                                                     */
/* ------------------------------------------------------------------ */

export interface FrontendRuntimeContext {
  application: ApplicationId;
  user: AuthUser;
  tenant?: TenantContext;
  permissions: string[];
  enabledModules: string[];
  enabledFeatures: string[];
}

export interface ModuleRuntimeContext {
  application: ApplicationId;
  tenant?: TenantContext;
  user: AuthUser;
  permissions: string[];
  enabledModules: string[];
  enabledFeatures: string[];
}

/* ------------------------------------------------------------------ */
/* Widget runtime props                                                */
/* ------------------------------------------------------------------ */

export interface WidgetProps {
  /** Stable instance id for the placed widget */
  instanceId: string;
  /** The widget definition id */
  widgetId: string;
  /** Optional config set by user (reserved for future) */
  config?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  module?: string;
  read: boolean;
  createdAt: string;
  actionLabel?: string;
  actionHref?: string;
}

/* ------------------------------------------------------------------ */
/* Command menu                                                        */
/* ------------------------------------------------------------------ */

export interface CommandAction {
  id: string;
  label: string;
  group?: string;
  icon?: ComponentType<{ className?: string }>;
  keywords?: string[];
  /** Performs the action; navigate via router if needed */
  run: () => void;
  /** Shortcut display (e.g. ⌘K) */
  shortcut?: string;
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  module?: string;
  /**
   * Tenant scope of this audit entry. Tenant entries carry their own
   * `tenantId`; entries that should only be visible to platform operators
   * carry `"platform"`. Entries without a `tenantId` are legacy unscoped
   * entries (visible to everyone). The Activity Ticker uses this to filter
   * out platform-scoped entries from tenant admins — previously every
   * tenant admin saw the full cross-tenant stream.
   */
  tenantId?: string;
}
