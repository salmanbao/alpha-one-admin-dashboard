/** 
 * PFaaS Prop Admin — Challenges Module Manifest  
 * Provides the challenge evaluation dashboard view.
 */

import type { FrontendModule, NavigationItem, RouteDefinition } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "challenges",
    label: "Challenges",
    termKey: "challenges",
    icon: "TrendingUp",
    order: 2,
  },
];

const routes: RouteDefinition[] = [
  {
    path: "",
    viewId: "challenges",
    label: "Challenges",
    permission: [],
    module: "challenges",
  },
  {
    path: "create",
    viewId: "challenge-create",
    label: "Create Challenge",
    permission: [],
    module: "challenges",
  },
  {
    path: ":challengeId",
    viewId: "challenge-detail",
    label: "Challenge Detail",
    permission: [],
    module: "challenges",
  },
];

export const challengesModule: FrontendModule = {
  manifest: {
    id: "challenges",
    name: "Challenges",
    version: "1.0.0",
    description: "Prop firm admin challenge evaluation dashboard.",
    category: "core",
    supportedApplications: ["prop-admin"],
    icon: "TrendingUp",
    accentColor: "#e53e3e",
  },
  navigation,
  routes,
};