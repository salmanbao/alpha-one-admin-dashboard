/**
 * Audit & Compliance Module — manifest, navigation, routes.
 *
 * Spec section 40 / AGENTS.md §61 (Auditability). Audit is an optional
 * compliance module covering the cross-module audit log, user-event stream,
 * enhanced event stream with metric snapshots, and per-field change history
 * with rollback.
 *
 * NOTE: previously the audit pages were wired into `view-router.tsx` but the
 * module was never registered in `module-bootstrap.ts`. As a result 4 of 5
 * pages (`audit-user-events`, `audit-user-events-enhanced`,
 * `audit-change-history`, `audit-user-event-detail`) were completely orphaned
 * — reachable only via direct `navigate()` calls from inside the audit
 * module's own pages. This manifest fixes that platform-level inconsistency.
 *
 * The 4 navigable viewIds (Audit Log / User Events / Enhanced Events /
 * Change History) become sidebar children + Command Menu entries.
 * `audit-user-event-detail` is intentionally NOT a nav child — it is a
 * sub-page reached from the user-events list (per spec §27 Drawer vs Page).
 */

import {
  ShieldCheck,
  History,
  Users,
  Sparkles,
  GitBranch,
} from "lucide-react";
import type {
  FrontendModule,
  NavigationItem,
  RouteDefinition,
} from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "audit",
    label: "Audit & Compliance",
    icon: ShieldCheck,
    order: 90,
    children: [
      {
        id: "audit.log",
        label: "Audit Log",
        href: "audit",
        icon: History,
        permission: "audit.read",
      },
      {
        id: "audit.user-events",
        label: "User Events",
        href: "audit-user-events",
        icon: Users,
        permission: "audit.read",
      },
      {
        id: "audit.enhanced-events",
        label: "Enhanced Events",
        href: "audit-user-events-enhanced",
        icon: Sparkles,
        permission: "audit.read",
      },
      {
        id: "audit.change-history",
        label: "Change History",
        href: "audit-change-history",
        icon: GitBranch,
        permission: "audit.read",
      },
    ],
  },
];

const routes: RouteDefinition[] = [
  {
    path: "audit",
    viewId: "audit",
    label: "Audit Log",
    permission: "audit.read",
    module: "audit",
  },
  {
    path: "audit-user-events",
    viewId: "audit-user-events",
    label: "User Events",
    permission: "audit.read",
    module: "audit",
  },
  {
    path: "audit-user-events-enhanced",
    viewId: "audit-user-events-enhanced",
    label: "Enhanced Events",
    permission: "audit.read",
    module: "audit",
  },
  {
    path: "audit-change-history",
    viewId: "audit-change-history",
    label: "Change History",
    permission: "audit.read",
    module: "audit",
  },
];

export const auditModule: FrontendModule = {
  manifest: {
    id: "audit",
    name: "Audit & Compliance",
    version: "1.0.0",
    description:
      "Comprehensive audit log, user events, change history, and compliance reporting.",
    capabilities: [
      "audit.log",
      "audit.export",
      "audit.user-events",
      "audit.change-history",
    ],
    permissions: [
      {
        id: "audit.read",
        label: "View Audit Log",
        description:
          "Read audit log, user events, change history",
      },
      {
        id: "audit.export",
        label: "Export Audit Data",
        description:
          "Export audit log, user events, change history as CSV/JSON",
      },
      {
        id: "audit.manage",
        label: "Manage Audit Settings",
        description:
          "Configure retention, severity, export schedule",
      },
    ],
    supportedApplications: ["prop-admin", "super-admin"],
    category: "compliance",
    optional: true,
    dependencies: ["settings"],
    icon: ShieldCheck,
    accentColor: "#475569", // slate — Terra-allowed
  },
  navigation,
  routes,
};
