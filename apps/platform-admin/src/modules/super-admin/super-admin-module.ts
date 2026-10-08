/**
 * Super Admin Module — manifest + navigation.
 *
 * Spec section 6. Super Admin controls the PFaaS platform itself:
 * tenants, subscriptions, service catalog, modules, integrations,
 * platform users, roles, global feature flags, billing, audit, health.
 *
 * Round 8: expanded navigation per the Platform Admin Dashboard research
 * inventory — added Operations, Emergency Controls, Cross-Tenant Queues,
 * Provider Registry, Jobs, Deployments, Backups/DR, Approval Center,
 * Incident Center, Feature Flags.
 */

import {
  Building2,
  Server,
  Package,
  BarChart3,
  ShieldCheck,
  Plus,
  GitBranch,
  UserCog,
  LayoutDashboard,
  ScrollText,
  Activity,
  AlertTriangle,
  Zap,
  Database,
  Layers,
  Flag,
  Bell,
  ShieldAlert,
  Globe,
  Users,
  DollarSign,
  Eye,
  BookOpen,
  Settings2,
  Lock,
  UserCheck,
} from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "super",
    label: "Platform",
    icon: Building2,
    order: 5,
    application: ["super-admin"],
    children: [
      // ───────── Tenant Management ─────────
      { id: "super.overview", label: "Overview", href: "super-overview", icon: BarChart3, application: ["super-admin"], group: "Tenant Management" },
      { id: "super.tenants", label: "Tenants", href: "tenants", icon: Building2, application: ["super-admin"], group: "Tenant Management" },
      { id: "super.create-tenant", label: "Create Tenant", href: "create-tenant", icon: Plus, application: ["super-admin"], group: "Tenant Management" },
      { id: "super.lifecycle", label: "Lifecycle", href: "tenant-lifecycle", icon: GitBranch, application: ["super-admin"], group: "Tenant Management" },

      // ───────── Operations ─────────
      { id: "super.operations", label: "Operations Home", href: "platform-operations", icon: Activity, application: ["super-admin"], group: "Operations" },
      { id: "super.emergency", label: "Emergency Controls", href: "emergency-controls", icon: ShieldAlert, application: ["super-admin"], group: "Operations" },
      { id: "super.incidents", label: "Incidents", href: "incident-center", icon: AlertTriangle, application: ["super-admin"], group: "Operations" },
      { id: "super.jobs", label: "Jobs", href: "jobs-dashboard", icon: Zap, application: ["super-admin"], group: "Operations" },
      { id: "super.approvals", label: "Approval Center", href: "approval-center", icon: ShieldCheck, application: ["super-admin"], group: "Operations" },

      // ───────── Observability ─────────
      { id: "super.health", label: "Platform Health", href: "platform-health", icon: Server, application: ["super-admin"], group: "Observability" },
      { id: "super.providers", label: "Provider Registry", href: "provider-registry", icon: Globe, application: ["super-admin"], group: "Observability" },
      { id: "super.queues", label: "Cross-Tenant Queues", href: "cross-tenant-queues", icon: Layers, application: ["super-admin"], group: "Observability" },
      { id: "super.platform-audit", label: "Platform Audit", href: "platform-audit", icon: ScrollText, application: ["super-admin"], permission: "platform.audit.read", order: 65, group: "Observability" },

      // ───────── Infrastructure ─────────
      { id: "super.deployments", label: "Deployments", href: "deployments", icon: GitBranch, application: ["super-admin"], group: "Infrastructure" },
      { id: "super.backups", label: "Backups & DR", href: "backups-dr", icon: Database, application: ["super-admin"], group: "Infrastructure" },

      // ───────── Platform Config ─────────
      { id: "super.catalog", label: "Service Catalog", href: "module-catalog", icon: Package, application: ["super-admin"], group: "Platform Config" },
      { id: "super.dashboard-manager", label: "Dashboard Manager", href: "dashboard-manager", icon: LayoutDashboard, application: ["super-admin"], group: "Platform Config" },
      { id: "super.feature-flags", label: "Feature Flags", href: "feature-flags", icon: Flag, application: ["super-admin"], group: "Platform Config" },
      { id: "super.global-defaults", label: "Global Defaults", href: "global-defaults", icon: Settings2, application: ["super-admin"], group: "Platform Config" },
      { id: "super.reference-data", label: "Reference Data", href: "reference-data", icon: BookOpen, application: ["super-admin"], group: "Platform Config" },
      { id: "super.announcements", label: "Announcements", href: "announcements", icon: Bell, application: ["super-admin"], group: "Platform Config" },

      // ───────── Security ─────────
      { id: "super.security", label: "Security Overview", href: "security-overview", icon: Lock, application: ["super-admin"], group: "Security" },
      { id: "super.sessions", label: "My Sessions", href: "my-sessions", icon: ShieldCheck, application: ["super-admin"], group: "Security" },
      { id: "super.operators", label: "Operator Directory", href: "operator-directory", icon: Users, application: ["super-admin"], group: "Security" },
      { id: "super.roles", label: "Role Management", href: "role-management", icon: UserCheck, application: ["super-admin"], group: "Security" },
      { id: "super.view-as", label: "Tenant View-As", href: "tenant-view-as", icon: Eye, application: ["super-admin"], group: "Security" },
      { id: "super.abuse", label: "Abuse Signals", href: "abuse-signals", icon: AlertTriangle, application: ["super-admin"], group: "Security" },

      // ───────── Finance ─────────
      { id: "super.financials", label: "Financial Overview", href: "platform-financials", icon: DollarSign, application: ["super-admin"], group: "Finance" },

      // ───────── Analytics ─────────
      { id: "super.analytics", label: "Platform Analytics", href: "platform-analytics", icon: BarChart3, application: ["super-admin"], group: "Analytics" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "super-overview", viewId: "super-overview", label: "Platform Overview", application: ["super-admin"] },
  { path: "tenants", viewId: "tenants", label: "Tenants", application: ["super-admin"] },
  { path: "create-tenant", viewId: "create-tenant", label: "Create Tenant", application: ["super-admin"] },
  { path: "tenant-detail", viewId: "tenant-detail", label: "Tenant Detail", application: ["super-admin"] },
  { path: "tenant-lifecycle", viewId: "tenant-lifecycle", label: "Tenant Lifecycle", application: ["super-admin"] },
  { path: "platform-operations", viewId: "platform-operations", label: "Operations Home", application: ["super-admin"] },
  { path: "emergency-controls", viewId: "emergency-controls", label: "Emergency Controls", application: ["super-admin"] },
  { path: "incident-center", viewId: "incident-center", label: "Incident Center", application: ["super-admin"] },
  { path: "jobs-dashboard", viewId: "jobs-dashboard", label: "Jobs Dashboard", application: ["super-admin"] },
  { path: "approval-center", viewId: "approval-center", label: "Approval Center", application: ["super-admin"] },
  { path: "platform-health", viewId: "platform-health", label: "Platform Health", application: ["super-admin"] },
  { path: "provider-registry", viewId: "provider-registry", label: "Provider Registry", application: ["super-admin"] },
  { path: "cross-tenant-queues", viewId: "cross-tenant-queues", label: "Cross-Tenant Queues", application: ["super-admin"] },
  { path: "deployments", viewId: "deployments", label: "Deployments", application: ["super-admin"] },
  { path: "backups-dr", viewId: "backups-dr", label: "Backups & DR", application: ["super-admin"] },
  { path: "module-catalog", viewId: "module-catalog", label: "Service Catalog", application: ["super-admin"] },
  { path: "dashboard-manager", viewId: "dashboard-manager", label: "Dashboard Manager", application: ["super-admin"] },
  { path: "feature-flags", viewId: "feature-flags", label: "Feature Flags", application: ["super-admin"] },
  { path: "global-defaults", viewId: "global-defaults", label: "Global Defaults", application: ["super-admin"] },
  { path: "reference-data", viewId: "reference-data", label: "Reference Data", application: ["super-admin"] },
  { path: "announcements", viewId: "announcements", label: "Announcements", application: ["super-admin"] },
  { path: "security-overview", viewId: "security-overview", label: "Security Overview", application: ["super-admin"] },
  { path: "my-sessions", viewId: "my-sessions", label: "My Sessions", application: ["super-admin"] },
  { path: "operator-directory", viewId: "operator-directory", label: "Operator Directory", application: ["super-admin"] },
  { path: "role-management", viewId: "role-management", label: "Role Management", application: ["super-admin"] },
  { path: "tenant-view-as", viewId: "tenant-view-as", label: "Tenant View-As", application: ["super-admin"] },
  { path: "abuse-signals", viewId: "abuse-signals", label: "Abuse Signals", application: ["super-admin"] },
  { path: "platform-financials", viewId: "platform-financials", label: "Platform Financials", application: ["super-admin"] },
  { path: "platform-analytics", viewId: "platform-analytics", label: "Platform Analytics", application: ["super-admin"] },
  { path: "platform-audit", viewId: "platform-audit", label: "Platform Audit Log", application: ["super-admin"], permission: "platform.audit.read" },
];

export const superAdminModule: FrontendModule = {
  manifest: {
    id: "super-admin",
    name: "Super Admin",
    version: "1.0.0",
    description: "Platform-wide administration for the PFaaS operator.",
    category: "core",
    supportedApplications: ["super-admin"],
    permissions: [
      { id: "platform.tenants.read", label: "View tenants" },
      { id: "platform.tenants.manage", label: "Manage tenants" },
      { id: "platform.tenants.impersonate", label: "Impersonate Tenant", description: "Login-as any tenant admin" },
      { id: "platform.tenants.export", label: "Export Tenant Data", description: "Bulk-export tenant configuration and data" },
      { id: "platform.modules.manage", label: "Manage module catalog" },
      { id: "platform.health.read", label: "View system health" },
      { id: "platform.audit.read", label: "Read Platform Audit", description: "Cross-tenant audit log access" },
      { id: "platform.billing.manage", label: "Manage Billing", description: "View invoices, update payment methods, manage plans" },
      { id: "platform.emergency.manage", label: "Emergency Controls", description: "Tenant halt, maintenance mode, relay pause, kill switches" },
    ],
    icon: ShieldCheck,
    accentColor: "#0a0a0a",
  },
  navigation,
  routes,
};
