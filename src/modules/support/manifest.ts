/**
 * Support Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec: Support is an optional core module providing ticket management,
 * a knowledge base, and SLA metrics. Depends on Trading (trader context).
 */

import { LifeBuoy, MessageSquare, BookOpen, Inbox } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { SupportOverviewWidget, RecentTicketsWidget, TicketPriorityWidget } from "./widgets/support-widgets";

const navigation: NavigationItem[] = [
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    order: 80,
    children: [
      { id: "support.overview", label: "Overview", href: "support", icon: LifeBuoy, permission: "support.read" },
      { id: "support.tickets", label: "Tickets", href: "support-tickets", icon: Inbox, permission: "support.read" },
      { id: "support.knowledge", label: "Knowledge", href: "support-knowledge", icon: BookOpen, permission: "support.read" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "support", viewId: "support", label: "Support Overview", permission: "support.read", module: "support" },
  { path: "support-tickets", viewId: "support-tickets", label: "Support Tickets", permission: "support.read", module: "support" },
  { path: "support-knowledge", viewId: "support-knowledge", label: "Knowledge Base", permission: "support.read", module: "support" },
];

const widgets: WidgetDefinition[] = [
  { id: "support-overview", title: "Support Overview", module: "support", category: "metric", component: SupportOverviewWidget, permission: "support.read", defaultSize: { w: 12, h: 1 } },
  { id: "support-recent-tickets", title: "Recent Tickets", module: "support", category: "table", component: RecentTicketsWidget, permission: "support.read", defaultSize: { w: 12, h: 2 } },
  { id: "support-priority", title: "Ticket Priority", module: "support", category: "chart", component: TicketPriorityWidget, permission: "support.read", defaultSize: { w: 6, h: 2 } },
];

export const supportModule: FrontendModule = {
  manifest: {
    id: "support",
    name: "Support",
    version: "1.0.0",
    description: "Ticketing, knowledge base, and SLA metrics for trader support.",
    dependencies: ["trading"],
    capabilities: ["support.tickets", "support.knowledge", "support.sla"],
    category: "core",
    optional: true,
    supportedApplications: ["prop-admin", "super-admin", "trader"],
    permissions: [
      { id: "support.read", label: "View support" },
      { id: "support.configure", label: "Configure support" },
    ],
    icon: LifeBuoy,
    accentColor: "#c2410c",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "support-settings", label: "Support", module: "support", viewId: "settings-support", icon: MessageSquare, order: 80 },
  ],
};
