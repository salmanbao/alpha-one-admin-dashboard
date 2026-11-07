/**
 * Marketing Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec phase 9: Marketing is an optional growth module covering campaigns,
 * spend, channel performance and ROI. Depends on Trading.
 */

import { Megaphone, LayoutList, TrendingUp, Target, BarChart3, Mail, Users, PenTool, CreditCard, Crown, Plug, Rocket, CalendarDays, Workflow, LayoutTemplate, Layers, ShieldCheck, ArrowLeftRight } from "lucide-react";
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
      // M4.1 — Campaign Composer
      { id: "marketing.campaign-new", label: "New Campaign", href: "campaign-new", icon: Rocket, permission: ["marketing.configure", "settings.manage"], group: "Campaigns" },
      // M4.4 — Campaign Calendar
      { id: "marketing.calendar", label: "Calendar", href: "marketing-calendar", icon: CalendarDays, permission: "marketing.read", group: "Campaigns" },
      { id: "marketing.email-campaigns", label: "Email Campaigns", href: "marketing-email-campaigns", icon: Mail, permission: "marketing.read", group: "Campaigns" },
      { id: "marketing.vip-campaigns", label: "VIP Campaigns", href: "marketing-vip-campaigns", icon: Crown, permission: "marketing.read", group: "Campaigns" },
      { id: "marketing.ad-spend", label: "Ad Spend", href: "marketing-ad-spend", icon: Megaphone, permission: "marketing.read", group: "Campaigns" },

      // ───────── Automation (M4 — Campaign Studio) ─────────
      { id: "marketing.automation-flows", label: "Flows", href: "automation-flows", icon: Workflow, permission: ["marketing.automation.manage", "settings.manage"], group: "Automation" },
      { id: "marketing.automation-templates", label: "Template Library", href: "marketing-templates", icon: LayoutTemplate, permission: "marketing.read", group: "Automation" },

      // ───────── Analytics ─────────
      { id: "marketing.performance", label: "Performance", href: "marketing-performance", icon: TrendingUp, permission: "marketing.read", group: "Analytics" },
      { id: "marketing.dashboard", label: "Dashboard", href: "marketing-dashboard", icon: BarChart3, permission: "marketing.read", group: "Analytics" },

      // ───────── Audiences & Creative (M3 + M11) ─────────
      { id: "marketing.segments", label: "Segments", href: "segments", icon: Layers, permission: ["marketing.segments.manage", "settings.manage"], group: "Audiences & Creative" },
      { id: "marketing.audience-builder", label: "Segment Builder", href: "marketing-audience-builder", icon: Users, permission: ["marketing.segments.manage", "settings.manage"], group: "Audiences & Creative" },
      { id: "marketing.consent-center", label: "Consent & Suppression", href: "consent-center", icon: ShieldCheck, permission: ["marketing.segments.manage", "settings.manage"], group: "Audiences & Creative" },
      { id: "marketing.contact-sync", label: "Contact Sync", href: "contact-sync", icon: ArrowLeftRight, permission: ["marketing.segments.manage", "settings.manage"], group: "Audiences & Creative" },
      { id: "marketing.template-editor", label: "Template Editor", href: "marketing-template-editor", icon: PenTool, permission: "marketing.read", group: "Audiences & Creative" },
      { id: "marketing.ad-accounts", label: "Ad Accounts", href: "marketing-ad-accounts", icon: CreditCard, permission: "marketing.read", group: "Audiences & Creative" },

      // ───────── Integrations (M1 — Connector Registry) ─────────
      { id: "marketing.integrations", label: "Integrations", href: "marketing-integrations", icon: Plug, permission: ["marketing.connect", "settings.manage"], group: "Integrations" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "marketing", viewId: "marketing", label: "Marketing Overview", permission: "marketing.read", module: "marketing" },
  { path: "marketing-campaigns", viewId: "marketing-campaigns", label: "Campaigns", permission: "marketing.read", module: "marketing" },
  { path: "marketing-email-campaigns", viewId: "marketing-email-campaigns", label: "Email Campaigns", permission: "marketing.read", module: "marketing" },
  { path: "marketing-vip-campaigns", viewId: "marketing-vip-campaigns", label: "VIP Campaigns & Coupons", permission: "marketing.read", module: "marketing" },
  { path: "marketing-ad-spend", viewId: "marketing-ad-spend", label: "Ad Spend", permission: "marketing.read", module: "marketing" },
  // M4 — Campaign Studio & Automation Flows (spec §8)
  { path: "campaign-new", viewId: "campaign-new", label: "Campaign Composer", permission: ["marketing.configure", "settings.manage"], module: "marketing" },
  { path: "automation-flows", viewId: "automation-flows", label: "Automation Flows", permission: ["marketing.automation.manage", "settings.manage"], module: "marketing" },
  { path: "automation-flow-detail", viewId: "automation-flow-detail", label: "Flow Detail", permission: ["marketing.automation.manage", "marketing.read", "settings.manage"], module: "marketing" },
  { path: "marketing-calendar", viewId: "marketing-calendar", label: "Campaign Calendar", permission: "marketing.read", module: "marketing" },
  { path: "marketing-templates", viewId: "marketing-templates", label: "Template Library", permission: "marketing.read", module: "marketing" },
  // Integrations (M1 — Connector Registry)
  { path: "marketing-integrations", viewId: "marketing-integrations", label: "Marketing Integrations", permission: ["marketing.connect", "settings.manage"], module: "marketing" },
  { path: "connector-new", viewId: "connector-new", label: "Add Connector", permission: ["marketing.connect", "settings.manage"], module: "marketing" },
  { path: "marketing-performance", viewId: "marketing-performance", label: "Marketing Performance", permission: "marketing.read", module: "marketing" },
  // Audiences & Creative (M3 + M11)
  { path: "segments", viewId: "segments", label: "Segments", permission: ["marketing.segments.manage", "settings.manage"], module: "marketing" },
  { path: "marketing-audience-builder", viewId: "marketing-audience-builder", label: "Segment Builder", permission: ["marketing.segments.manage", "settings.manage"], module: "marketing" },
  { path: "consent-center", viewId: "consent-center", label: "Consent & Suppression", permission: ["marketing.segments.manage", "settings.manage"], module: "marketing" },
  { path: "contact-sync", viewId: "contact-sync", label: "Contact Sync", permission: ["marketing.segments.manage", "settings.manage"], module: "marketing" },
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
      { id: "marketing.connect", label: "Manage integrations", description: "Connect, configure and disconnect third-party platforms (falls back to settings.manage)." },
      { id: "marketing.segments.manage", label: "Manage segments & consent", description: "Build segments and manage consent and suppression (M3; falls back to marketing.configure)." },
      { id: "marketing.automation.manage", label: "Manage automation", description: "Author, publish and operate campaigns and flows (M4; falls back to marketing.configure)." },
      { id: "marketing.ads.manage", label: "Manage ad connections", description: "Connect ad accounts and manage conversion events (M5; falls back to marketing.configure)." },
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
