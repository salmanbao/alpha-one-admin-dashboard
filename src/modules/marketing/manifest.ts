/**
 * Marketing Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec phase 9: Marketing is an optional growth module covering campaigns,
 * spend, channel performance and ROI. Depends on Trading.
 */

import { Megaphone, LayoutList, TrendingUp, Target, BarChart3, Mail } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import {
  MarketingOverviewWidget,
  CampaignPerformanceWidget,
  ChannelBreakdownWidget,
} from "./widgets/marketing-widgets";

const navigation: NavigationItem[] = [
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    order: 65,
    children: [
      { id: "marketing.overview", label: "Overview", href: "marketing", icon: Megaphone, permission: "marketing.read" },
      { id: "marketing.campaigns", label: "Campaigns", href: "marketing-campaigns", icon: LayoutList, permission: "marketing.read" },
      { id: "marketing.email-campaigns", label: "Email Campaigns", href: "marketing-email-campaigns", icon: Mail, permission: "marketing.read" },
      { id: "marketing.ad-spend", label: "Ad Spend", href: "marketing-ad-spend", icon: Megaphone, permission: "marketing.read" },
      { id: "marketing.performance", label: "Performance", href: "marketing-performance", icon: TrendingUp, permission: "marketing.read" },
      { id: "marketing.dashboard", label: "Dashboard", href: "marketing-dashboard", icon: BarChart3, permission: "marketing.read" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "marketing", viewId: "marketing", label: "Marketing Overview", permission: "marketing.read", module: "marketing" },
  { path: "marketing-campaigns", viewId: "marketing-campaigns", label: "Campaigns", permission: "marketing.read", module: "marketing" },
  { path: "marketing-email-campaigns", viewId: "marketing-email-campaigns", label: "Email Campaigns", permission: "marketing.read", module: "marketing" },
  { path: "marketing-ad-spend", viewId: "marketing-ad-spend", label: "Ad Spend", permission: "marketing.read", module: "marketing" },
  { path: "marketing-performance", viewId: "marketing-performance", label: "Marketing Performance", permission: "marketing.read", module: "marketing" },
];

const widgets: WidgetDefinition[] = [
  { id: "marketing-overview", title: "Marketing Overview", module: "marketing", category: "metric", component: MarketingOverviewWidget, permission: "marketing.read", defaultSize: { w: 12, h: 1 } },
  { id: "campaign-performance", title: "Campaign Performance", module: "marketing", category: "chart", component: CampaignPerformanceWidget, permission: "marketing.read", defaultSize: { w: 6, h: 2 } },
  { id: "channel-breakdown", title: "Channel Breakdown", module: "marketing", category: "chart", component: ChannelBreakdownWidget, permission: "marketing.read", defaultSize: { w: 6, h: 2 } },
];

export const marketingModule: FrontendModule = {
  manifest: {
    id: "marketing",
    name: "Marketing",
    version: "1.0.0",
    description: "Campaigns, spend, channel performance and ROI tracking.",
    dependencies: ["trading"],
    capabilities: ["marketing.campaigns", "marketing.channels", "marketing.attribution"],
    category: "growth",
    optional: true,
    supportedApplications: ["prop-admin", "super-admin"],
    permissions: [
      { id: "marketing.read", label: "View marketing" },
      { id: "marketing.configure", label: "Configure campaigns" },
    ],
    icon: Target,
    accentColor: "#db2777",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "marketing-settings", label: "Marketing", module: "marketing", viewId: "settings-marketing", icon: Megaphone, order: 80 },
  ],
};
