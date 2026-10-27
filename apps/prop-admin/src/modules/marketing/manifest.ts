/**
 * Marketing Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec phase 9: Marketing is an optional growth module covering campaigns,
 * spend, channel performance and ROI. Depends on Trading.
 */

import { Megaphone, LayoutList, TrendingUp, Target, BarChart3, Mail, Users, PenTool, CreditCard } from "lucide-react";
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
      // ───────── Campaigns ─────────
      { id: "marketing.overview", label: "Overview", href: "marketing", icon: Megaphone, permission: "marketing.read", group: "Campaigns" },
      { id: "marketing.campaigns", label: "Campaigns", href: "marketing-campaigns", icon: LayoutList, permission: "marketing.read", group: "Campaigns" },
      { id: "marketing.email-campaigns", label: "Email Campaigns", href: "marketing-email-campaigns", icon: Mail, permission: "marketing.read", group: "Campaigns" },
      { id: "marketing.ad-spend", label: "Ad Spend", href: "marketing-ad-spend", icon: Megaphone, permission: "marketing.read", group: "Campaigns" },

      // ───────── Analytics ─────────
      { id: "marketing.performance", label: "Performance", href: "marketing-performance", icon: TrendingUp, permission: "marketing.read", group: "Analytics" },
      { id: "marketing.dashboard", label: "Dashboard", href: "marketing-dashboard", icon: BarChart3, permission: "marketing.read", group: "Analytics" },

      // ───────── Audiences & Creative (M11) ─────────
      { id: "marketing.audience-builder", label: "Audience Builder", href: "marketing-audience-builder", icon: Users, permission: "marketing.read", group: "Audiences & Creative" },
      { id: "marketing.template-editor", label: "Template Editor", href: "marketing-template-editor", icon: PenTool, permission: "marketing.read", group: "Audiences & Creative" },
      { id: "marketing.ad-accounts", label: "Ad Accounts", href: "marketing-ad-accounts", icon: CreditCard, permission: "marketing.read", group: "Audiences & Creative" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "marketing", viewId: "marketing", label: "Marketing Overview", permission: "marketing.read", module: "marketing" },
  { path: "marketing-campaigns", viewId: "marketing-campaigns", label: "Campaigns", permission: "marketing.read", module: "marketing" },
  { path: "marketing-email-campaigns", viewId: "marketing-email-campaigns", label: "Email Campaigns", permission: "marketing.read", module: "marketing" },
  { path: "marketing-ad-spend", viewId: "marketing-ad-spend", label: "Ad Spend", permission: "marketing.read", module: "marketing" },
  { path: "marketing-performance", viewId: "marketing-performance", label: "Marketing Performance", permission: "marketing.read", module: "marketing" },
  // Audiences & Creative (M11)
  { path: "marketing-audience-builder", viewId: "marketing-audience-builder", label: "Audience Builder", permission: "marketing.read", module: "marketing" },
  { path: "marketing-template-editor", viewId: "marketing-template-editor", label: "Marketing Template Editor", permission: "marketing.read", module: "marketing" },
  { path: "marketing-ad-accounts", viewId: "marketing-ad-accounts", label: "Ad Accounts", permission: "marketing.read", module: "marketing" },
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
    supportedApplications: ["prop-admin"],
    permissions: [
      { id: "marketing.read", label: "View marketing" },
      { id: "marketing.configure", label: "Configure campaigns" },
    ],
    icon: Target,
    accentColor: "#b45309",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "marketing-settings", label: "Marketing", module: "marketing", viewId: "settings-marketing", icon: Megaphone, order: 80 },
  ],
};
