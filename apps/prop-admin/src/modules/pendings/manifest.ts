/**
 * Pendings Module — manifest, navigation, routes.
 *
 * Operational hub surfacing what needs admin attention right now.
 */

import { ClipboardList, AlertTriangle } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "pendings",
    label: "Pendings",
    icon: ClipboardList,
    order: 35,
    children: [
      {
        id: "pendings.tasks",
        label: "Pending Tasks",
        href: "pending-tasks",
        icon: AlertTriangle,
        permission: "payout.approve",
      },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "pending-tasks", viewId: "pending-tasks", label: "Pending Tasks", permission: "payout.approve", module: "pendings" },
];

export const pendingsModule: FrontendModule = {
  manifest: {
    id: "pendings",
    name: "Pendings",
    version: "1.0.0",
    description: "Operational hub for pending tasks requiring admin attention.",
    capabilities: ["pendings.tasks"],
    category: "core",
    supportedApplications: ["prop-admin"],
    permissions: [
      { id: "pendings.read", label: "View pending tasks" },
    ],
    icon: ClipboardList,
    accentColor: "#d97706",
  },
  navigation,
  routes,
  widgets: [],
  settings: [],
};