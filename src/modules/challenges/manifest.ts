/**
 * Challenges Module — manifest, navigation, routes, widgets, settings.
 */

import { Target, Trophy, Clock, AlertCircle, Flame, Plus, Settings2, Layers, GitBranch } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { ChallengeOverviewWidget, ChallengeProgressWidget, ChallengePhasesWidget } from "./widgets/challenge-widgets";

const navigation: NavigationItem[] = [
  {
    id: "challenges",
    label: "Challenges",
    termKey: "challenge",
    icon: Target,
    order: 20,
    children: [
      { id: "challenges.overview", label: "Overview", href: "challenges", icon: Target, permission: "challenge.read" },
      { id: "challenges.active", label: "Active", href: "challenges-active", icon: Flame, permission: "challenge.read" },
      { id: "challenges.passed", label: "Passed", href: "challenges-passed", icon: Trophy, permission: "challenge.read" },
      { id: "challenges.failed", label: "Failed", href: "challenges-failed", icon: AlertCircle, permission: "challenge.read" },
      { id: "challenges.wizard", label: "Create Challenge", href: "challenge-wizard", icon: Plus, permission: "challenge.create" },
      { id: "challenges.types", label: "Challenge Types", href: "challenge-types", icon: Layers, permission: "challenge.read" },
      { id: "challenges.config", label: "Configuration", href: "challenge-config", icon: Settings2, permission: "challenge.update" },
      { id: "challenges.phases", label: "Phase Management", href: "phase-management", icon: GitBranch, permission: "challenge.read" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "challenges", viewId: "challenges", label: "Challenges Overview", permission: "challenge.read", module: "challenges" },
  { path: "challenges-active", viewId: "challenges-active", label: "Active Challenges", permission: "challenge.read", module: "challenges" },
  { path: "challenges-passed", viewId: "challenges-passed", label: "Passed Challenges", permission: "challenge.read", module: "challenges" },
  { path: "challenges-failed", viewId: "challenges-failed", label: "Failed Challenges", permission: "challenge.read", module: "challenges" },
  { path: "challenge-wizard", viewId: "challenge-wizard", label: "Create Challenge", permission: "challenge.create", module: "challenges" },
  { path: "challenge-types", viewId: "challenge-types", label: "Challenge Types", permission: "challenge.read", module: "challenges" },
  { path: "challenge-config", viewId: "challenge-config", label: "Challenge Configuration", permission: "challenge.update", module: "challenges" },
  { path: "phase-management", viewId: "phase-management", label: "Phase Management", permission: "challenge.read", module: "challenges" },
];

const widgets: WidgetDefinition[] = [
  { id: "challenge-overview", title: "Challenge Overview", module: "challenges", category: "metric", component: ChallengeOverviewWidget, permission: "challenge.read", defaultSize: { w: 12, h: 1 } },
  { id: "challenge-progress", title: "Challenge Progress", module: "challenges", category: "progress", component: ChallengeProgressWidget, permission: "challenge.read", defaultSize: { w: 6, h: 2 } },
  { id: "challenge-phases", title: "Phase Distribution", module: "challenges", category: "chart", component: ChallengePhasesWidget, permission: "challenge.read", defaultSize: { w: 6, h: 2 } },
];

export const challengesModule: FrontendModule = {
  manifest: {
    id: "challenges",
    name: "Challenges",
    version: "1.0.0",
    description: "Trader evaluation challenges and phases.",
    capabilities: ["challenges.phases", "challenges.tracking"],
    category: "core",
    supportedApplications: ["prop-admin", "super-admin", "trader"],
    permissions: [
      { id: "challenge.read", label: "View challenges" },
      { id: "challenge.create", label: "Create challenges" },
      { id: "challenge.update", label: "Update challenges" },
      { id: "challenge.delete", label: "Delete challenges" },
    ],
    icon: Target,
    accentColor: "#15803d",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "challenges-settings", label: "Challenges", module: "challenges", viewId: "settings-challenges", icon: Target, order: 40 },
  ],
};
