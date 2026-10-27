/**
 * CRM Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec phase 9: CRM is an optional growth module covering contacts,
 * pipeline stages, and lead tracking. Depends on Trading.
 */

import { Contact, Users, GitBranch, BarChart3, History, UserPlus } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { CrmOverviewWidget, PipelineWidget } from "./widgets/crm-widgets";

const navigation: NavigationItem[] = [
  {
    id: "crm",
    label: "CRM",
    icon: Contact,
    order: 70,
    children: [
      { id: "crm.overview", label: "Overview", href: "crm", icon: BarChart3, permission: "crm.read" },
      { id: "crm.contacts", label: "Contacts", href: "crm-contacts", icon: Contact, permission: "crm.read" },
      { id: "crm.pipeline", label: "Pipeline", href: "crm-pipeline", icon: GitBranch, permission: "crm.read" },

      // ───────── Lead Operations (M11) ─────────
      { id: "crm.lead-scoring", label: "Lead Scoring", href: "crm-lead-scoring", icon: BarChart3, permission: "crm.read", group: "Lead Operations" },
      { id: "crm.activity-log", label: "Activity Log", href: "crm-activity-log", icon: History, permission: "crm.read", group: "Lead Operations" },
      { id: "crm.contact-create", label: "New Contact", href: "crm-contact-create", icon: UserPlus, permission: "crm.read", group: "Lead Operations" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "crm", viewId: "crm", label: "CRM Overview", permission: "crm.read", module: "crm" },
  { path: "crm-contacts", viewId: "crm-contacts", label: "Contacts", permission: "crm.read", module: "crm" },
  { path: "crm-pipeline", viewId: "crm-pipeline", label: "Pipeline", permission: "crm.read", module: "crm" },
  // Lead Operations (M11)
  { path: "crm-lead-scoring", viewId: "crm-lead-scoring", label: "Lead Scoring", permission: "crm.read", module: "crm" },
  { path: "crm-activity-log", viewId: "crm-activity-log", label: "CRM Activity Log", permission: "crm.read", module: "crm" },
  { path: "crm-contact-create", viewId: "crm-contact-create", label: "New Contact", permission: "crm.read", module: "crm" },
];

const widgets: WidgetDefinition[] = [
  { id: "crm-overview", title: "CRM Overview", module: "crm", category: "metric", component: CrmOverviewWidget, permission: "crm.read", defaultSize: { w: 12, h: 1 } },
  { id: "crm-pipeline", title: "Pipeline", module: "crm", category: "chart", component: PipelineWidget, permission: "crm.read", defaultSize: { w: 6, h: 2 } },
];

export const crmModule: FrontendModule = {
  manifest: {
    id: "crm",
    name: "CRM",
    version: "1.0.0",
    description: "Contacts, pipeline stages, and lead tracking.",
    dependencies: ["trading"],
    capabilities: ["crm.contacts", "crm.pipeline", "crm.attribution"],
    category: "growth",
    optional: true,
    supportedApplications: ["prop-admin"],
    permissions: [
      { id: "crm.read", label: "View CRM" },
      { id: "crm.update", label: "Update contacts" },
    ],
    icon: Users,
    accentColor: "#0f766e",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "crm-settings", label: "CRM", module: "crm", viewId: "settings-crm", icon: Contact, order: 85 },
  ],
};
