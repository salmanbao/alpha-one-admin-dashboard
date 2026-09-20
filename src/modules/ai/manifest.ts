/**
 * AI / LLM Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec: AI is an optional advanced module surfacing AI-generated insights,
 * an assistant chat, and model configuration. Depends on Trading + Analytics.
 */

import { Brain, Sparkles, Bot, Settings2 } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { AiOverviewWidget, AiInsightsWidget, AiConfidenceWidget } from "./widgets/ai-widgets";

const navigation: NavigationItem[] = [
  {
    id: "ai",
    label: "AI / LLM",
    icon: Brain,
    order: 85,
    children: [
      { id: "ai.overview", label: "Overview", href: "ai", icon: Brain, permission: "ai.read" },
      { id: "ai.insights", label: "Insights", href: "ai-insights", icon: Sparkles, permission: "ai.read" },
      { id: "ai.assistant", label: "Assistant", href: "ai-assistant", icon: Bot, permission: "ai.read" },
      { id: "ai.configure", label: "Configure", href: "ai-configure", icon: Settings2, permission: "ai.read" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "ai", viewId: "ai", label: "AI Overview", permission: "ai.read", module: "ai" },
  { path: "ai-insights", viewId: "ai-insights", label: "AI Insights", permission: "ai.read", module: "ai" },
  { path: "ai-assistant", viewId: "ai-assistant", label: "AI Assistant", permission: "ai.read", module: "ai" },
  { path: "ai-configure", viewId: "ai-configure", label: "AI Configuration", permission: "ai.read", module: "ai" },
];

const widgets: WidgetDefinition[] = [
  { id: "ai-overview", title: "AI Overview", module: "ai", category: "metric", component: AiOverviewWidget, permission: "ai.read", defaultSize: { w: 12, h: 1 } },
  { id: "ai-insights", title: "AI Insights", module: "ai", category: "ai", component: AiInsightsWidget, permission: "ai.read", defaultSize: { w: 12, h: 2 } },
  { id: "ai-confidence", title: "AI Confidence", module: "ai", category: "chart", component: AiConfidenceWidget, permission: "ai.read", defaultSize: { w: 6, h: 2 } },
];

export const aiModule: FrontendModule = {
  manifest: {
    id: "ai",
    name: "AI / LLM",
    version: "1.0.0",
    description: "AI-generated insights, an assistant chat, and model configuration.",
    dependencies: ["trading", "analytics"],
    capabilities: ["ai.insights", "ai.assistant", "ai.predictions", "ai.anomaly"],
    category: "ai",
    optional: true,
    supportedApplications: ["prop-admin", "super-admin"],
    permissions: [
      { id: "ai.read", label: "View AI insights" },
      { id: "ai.configure", label: "Configure AI" },
    ],
    icon: Brain,
    accentColor: "#7c3aed",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "ai-settings", label: "AI / LLM", module: "ai", viewId: "settings-ai", icon: Settings2, order: 85 },
  ],
};
