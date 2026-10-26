/** 
 * PFaaS Prop Admin — Trader Module Manifest  
 * Provides the Trader management dashboard view.
 */

import type { FrontendModule, NavigationItem, RouteDefinition } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "traders",
    label: "Traders",
    termKey: "traders",
    icon: "Users",
    order: 1,
  },
];

const routes: RouteDefinition[] = [
  {
    path: "",
    viewId: "traders",
    label: "Traders",
    permission: [],
    module: "traders",
  },
  {
    path: ":traderId",
    viewId: "trader-detail",
    label: "Trader Detail",
    permission: [],
    module: "traders",
  },
];

export const tradersModule: FrontendModule = {
  manifest: {
    id: "traders",
    name: "Traders",
    version: "1.0.0",
    description: "Prop firm admin trader management dashboard.",
    category: "core",
    supportedApplications: ["prop-admin"],
    icon: "Users",
    accentColor: "#e53e3e",
  },
  navigation,
  routes,
};