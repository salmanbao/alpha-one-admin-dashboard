/**
 * PFaaS Platform — Core Types
 *
 * Defines the module SDK contract, manifest types, navigation, widgets,
 * tenant, auth, permissions, feature flags, dashboard layouts.
 *
 * See spec sections: 10, 11, 12, 13, 15, 17, 18, 20, 22, 45, 61.
 */

import type { ComponentType } from "react";

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
  /** Module IDs this tenant is entitled to */
  enabledModules: string[];
  /** Feature flags enabled for this tenant */
  enabledFeatures: string[];
  /** Custom terminology overrides */
  terminology: Record<string, string>;
  /** Plan tier */
  plan: "starter" | "growth" | "scale" | "enterprise";
  status: "active" | "trial" | "suspended" | "invited" | "terminated";
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Auth & Permissions                                                  */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string;
  tenantId?: string;
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  roles: string[];
  permissions: string[];
  /** Application this user primarily belongs to */
  application: ApplicationId;
  lastActiveAt: string;
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
  termKey?: string;
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
