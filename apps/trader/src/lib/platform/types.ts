/**
 * Trader App — Types
 *
 * Minimal type definitions for the trader app.
 * Only includes what the three trader views need.
 */

export type ApplicationId = "trader";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  application: ApplicationId;
  roles: string[];
  traderId?: string;
}

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  application: ApplicationId;
  branding: {
    name: string;
    tagline: string;
    initials: string;
    primaryColor: string;
    accentColor: string;
    surfaceColor: string;
    radius: string;
  };
  locale: string;
  timezone: string;
  currency: string;
  enabledModules: string[];
  enabledFeatures: string[];
  terminology: {
    challenge: string;
    trader: string;
    payout: string;
  };
  plan: string;
  status: string;
  createdAt: string;
}

export interface RoleDefinition {
  id: string;
  label: string;
  permissions: string[];
}

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
  application?: ApplicationId[];
}

export interface RouteDefinition {
  path: string;
  viewId: string;
  label: string;
  permission: string | string[];
  module: string;
}

export interface WidgetDefinition {
  id: string;
  title: string;
  module: string;
  category: "metric" | "chart" | "table" | "feed" | "leaderboard";
  component: React.ComponentType;
  permission: string;
  defaultSize: { w: number; h: number };
  description: string;
}

export interface FrontendModule {
  manifest: {
    id: string;
    name: string;
    version: string;
    description: string;
    capabilities: string[];
    category: string;
    supportedApplications: ApplicationId[];
    permissions: { id: string; label: string }[];
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  };
  navigation: NavigationItem[];
  routes: RouteDefinition[];
  widgets: WidgetDefinition[];
  settings: { id: string; label: string; module: string; viewId: string; icon: React.ComponentType<{ className?: string }>; order: number }[];
}