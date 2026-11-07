/**
 * Marketing Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec phase 9: Marketing is an optional growth module covering campaigns,
 * spend, channel performance and ROI. Depends on Trading.
 */

import { Megaphone, LayoutList, TrendingUp, Target, BarChart3, Mail, Users, PenTool, CreditCard, Crown, Plug, Rocket, CalendarDays, Workflow, LayoutTemplate, Layers, ShieldCheck, ArrowLeftRight, Activity, GitBranch, Server, MessageSquareText, Globe2, HeartPulse, AlertOctagon, CheckCircle, FlaskConical, FileText, Shield, KeyRound, Gauge, ScrollText, FileEdit, ClipboardList, AppWindow, Image, Archive, Siren, Link2, Languages, DollarSign } from "lucide-react";
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
      // R3-05 — Ad Budget Approvals (four-eyes queue; request via marketing.ads.manage)
      { id: "marketing.budget-approvals", label: "Budget Approvals", href: "ad-budget-approvals", icon: DollarSign, permission: ["marketing.ads.manage", "marketing.read"], group: "Campaigns" },
      // R3-03 — Campaign Localization Manager (read via marketing.read)
      { id: "marketing.locales", label: "Localization", href: "locales-manager", icon: Languages, permission: ["marketing.locales.manage", "marketing.read"], group: "Campaigns" },

      // ───────── Channel Infrastructure (N1-N3, Wave 1) ─────────
      { id: "marketing.channel-providers", label: "Channel Providers & Senders", href: "channel-providers", icon: Server, permission: ["marketing.configure", "settings.manage"], group: "Channels" },
      { id: "marketing.whatsapp-templates", label: "WhatsApp Template Manager", href: "whatsapp-templates", icon: MessageSquareText, permission: ["marketing.configure", "settings.manage"], group: "Channels" },
      { id: "marketing.sending-domains", label: "Sending Domains & Auth", href: "sending-domains", icon: Globe2, permission: ["marketing.configure", "settings.manage"], group: "Channels" },

      // R4-01 — Send Queue & Gateway Health (P0)
      { id: "marketing.send-queue", label: "Send Queue & Gateway Health", href: "send-queue", icon: Activity, permission: "marketing.gateway.operate", group: "Channels" },

      // ───────── Landing & Forms (R2-01, R2-02) ─────────
      { id: "marketing.landing-pages", label: "Landing Pages", href: "landing-pages", icon: FileEdit, permission: ["marketing.pages.manage", "marketing.configure", "settings.manage"], group: "Acquisition" },
      { id: "marketing.forms", label: "Forms & Lead Capture", href: "forms", icon: ClipboardList, permission: ["marketing.forms.manage", "marketing.configure", "settings.manage"], group: "Acquisition" },
      { id: "marketing.onsite", label: "On-Site Studio", href: "onsite-campaigns", icon: AppWindow, permission: ["marketing.onsite.manage", "marketing.configure", "settings.manage"], group: "Acquisition" },
      { id: "marketing.assets", label: "Asset Library", href: "asset-library", icon: Image, permission: ["marketing.assets.manage", "marketing.configure", "settings.manage"], group: "Creative" },
      { id: "marketing.surveys", label: "Surveys & NPS", href: "surveys", icon: ClipboardList, permission: ["marketing.surveys.manage", "marketing.configure", "settings.manage"], group: "Acquisition" },

      // ───────── Automation (M4 — Campaign Studio) ─────────
      { id: "marketing.automation-flows", label: "Flows", href: "automation-flows", icon: Workflow, permission: ["marketing.automation.manage", "settings.manage"], group: "Automation" },
      { id: "marketing.automation-templates", label: "Template Library", href: "marketing-templates", icon: LayoutTemplate, permission: "marketing.read", group: "Automation" },

      // ───────── Analytics & Operations (M5 + Wave 2) ─────────
      { id: "marketing.performance", label: "Performance", href: "marketing-performance", icon: TrendingUp, permission: "marketing.read", group: "Analytics" },
      { id: "marketing.dashboard", label: "Dashboard", href: "marketing-dashboard", icon: BarChart3, permission: "marketing.read", group: "Analytics" },
      { id: "marketing.events-manager", label: "Events Manager", href: "events-manager", icon: Activity, permission: ["marketing.ads.manage", "settings.manage"], group: "Analytics" },
      { id: "marketing.attribution", label: "Attribution", href: "attribution-settings", icon: GitBranch, permission: ["marketing.ads.manage", "settings.manage"], group: "Analytics" },
      { id: "marketing.deliverability", label: "Deliverability", href: "deliverability", icon: HeartPulse, permission: ["marketing.read", "settings.manage"], group: "Analytics" },
      { id: "marketing.bounces", label: "Bounce & Complaint Queue", href: "bounce-queue", icon: AlertOctagon, permission: ["marketing.configure", "settings.manage"], group: "Analytics" },
      { id: "marketing.approvals", label: "Campaign Approvals", href: "campaign-approvals", icon: CheckCircle, permission: ["marketing.configure", "settings.manage"], group: "Campaigns" },
      { id: "marketing.campaign-report", label: "Campaign Reports", href: "campaign-report", icon: FileText, permission: "marketing.read", group: "Analytics" },
      { id: "marketing.consent-receipts", label: "Consent Receipts & DSR", href: "consent-receipts", icon: Shield, permission: ["marketing.configure", "settings.manage"], group: "Analytics" },
      { id: "marketing.audit-log", label: "Marketing Audit Log", href: "marketing-audit-log", icon: ScrollText, permission: "marketing.read", group: "Analytics" },

      { id: "marketing.deliverability-incidents", label: "Deliverability Incidents", href: "deliverability-incidents", icon: Siren, permission: ["marketing.read", "marketing.configure", "settings.manage"], group: "Analytics" },
      { id: "marketing.message-archive", label: "Message Archive", href: "message-archive", icon: Archive, permission: ["compliance.archive.read", "marketing.configure", "settings.manage"], group: "Analytics" },
      { id: "marketing.link-tracking", label: "Link Tracking (UTM)", href: "link-tracking", icon: Link2, permission: ["marketing.links.manage", "marketing.configure", "settings.manage"], group: "Analytics" },

      // ───────── Audiences & Creative (M3 + M11) ─────────
      { id: "marketing.segments", label: "Segments", href: "segments", icon: Layers, permission: ["marketing.segments.manage", "settings.manage"], group: "Audiences & Creative" },
      { id: "marketing.audience-builder", label: "Segment Builder", href: "marketing-audience-builder", icon: Users, permission: ["marketing.segments.manage", "settings.manage"], group: "Audiences & Creative" },
      { id: "marketing.consent-center", label: "Consent & Suppression", href: "consent-center", icon: ShieldCheck, permission: ["marketing.segments.manage", "settings.manage"], group: "Audiences & Creative" },
      { id: "marketing.contact-sync", label: "Contact Sync", href: "contact-sync", icon: ArrowLeftRight, permission: ["marketing.segments.manage", "settings.manage"], group: "Audiences & Creative" },
      { id: "marketing.template-editor", label: "Template Editor", href: "marketing-template-editor", icon: PenTool, permission: "marketing.read", group: "Audiences & Creative" },
      { id: "marketing.ad-accounts", label: "Ad Accounts", href: "marketing-ad-accounts", icon: CreditCard, permission: ["marketing.ads.manage", "settings.manage"], group: "Audiences & Creative" },

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
  // R3-05 — Ad Budget Approvals (queue readable via ads.manage or read; decisions gated in-page)
  { path: "ad-budget-approvals", viewId: "ad-budget-approvals", label: "Ad Budget Approvals", permission: ["marketing.ads.manage", "marketing.read"], module: "marketing" },
  // R3-03 — Campaign Localization Manager (mutation gate marketing.locales.manage)
  { path: "locales-manager", viewId: "locales-manager", label: "Campaign Localization", permission: ["marketing.locales.manage", "marketing.read"], module: "marketing" },
  // M5 — Ads & Attribution (spec §9)
  { path: "events-manager", viewId: "events-manager", label: "Events Manager", permission: ["marketing.ads.manage", "settings.manage"], module: "marketing" },
  { path: "attribution-settings", viewId: "attribution-settings", label: "Attribution Settings", permission: ["marketing.ads.manage", "settings.manage"], module: "marketing" },
  // Wave 2 (P1)
  { path: "deliverability", viewId: "deliverability", label: "Deliverability Dashboard", permission: ["marketing.read", "settings.manage"], module: "marketing" },
  { path: "bounce-queue", viewId: "bounce-queue", label: "Bounce & Complaint Queue", permission: ["marketing.configure", "settings.manage"], module: "marketing" },
  { path: "campaign-approvals", viewId: "campaign-approvals", label: "Campaign Approvals", permission: ["marketing.configure", "settings.manage"], module: "marketing" },
  { path: "campaign-ab", viewId: "campaign-ab", label: "A/B Test Builder & Results", permission: ["marketing.configure", "settings.manage"], module: "marketing" },
  { path: "campaign-report", viewId: "campaign-report", label: "Campaign Report / Postmortem", permission: "marketing.read", module: "marketing" },
  { path: "consent-receipts", viewId: "consent-receipts", label: "Consent Receipts & DSR", permission: ["marketing.configure", "settings.manage"], module: "marketing" },
  { path: "marketing-audit-log", viewId: "marketing-audit-log", label: "Marketing Audit Log", permission: "marketing.read", module: "marketing" },
  // N1-N3 — Channel Infrastructure (Wave 1, P0)
  { path: "channel-providers", viewId: "channel-providers", label: "Channel Providers & Senders", permission: ["marketing.configure", "settings.manage"], module: "marketing" },
  { path: "whatsapp-templates", viewId: "whatsapp-templates", label: "WhatsApp Template Manager", permission: ["marketing.configure", "settings.manage"], module: "marketing" },
  { path: "sending-domains", viewId: "sending-domains", label: "Sending Domains & Auth", permission: ["marketing.configure", "settings.manage"], module: "marketing" },
  // R4-01 — Send Queue & Gateway Health (marketing.gateway.operate)
  { path: "send-queue", viewId: "send-queue", label: "Send Queue & Gateway Health", permission: "marketing.gateway.operate", module: "marketing" },
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
  { path: "marketing-ad-accounts", viewId: "marketing-ad-accounts", label: "Ad Accounts", permission: ["marketing.ads.manage", "settings.manage"], module: "marketing" },
  // R2-03,04,08,09
  { path: "onsite-campaigns", viewId: "onsite-campaigns", label: "On-Site Studio", permission: ["marketing.onsite.manage", "marketing.configure", "settings.manage"], module: "marketing" },
  { path: "onsite-designer", viewId: "onsite-designer", label: "On-Site Designer", permission: ["marketing.onsite.manage", "marketing.configure", "settings.manage"], module: "marketing" },
  { path: "asset-library", viewId: "asset-library", label: "Asset Library", permission: ["marketing.assets.manage", "marketing.configure", "settings.manage"], module: "marketing" },
  { path: "message-archive", viewId: "message-archive", label: "Message Archive", permission: ["compliance.archive.read", "marketing.configure", "settings.manage"], module: "marketing" },
  { path: "deliverability-incidents", viewId: "deliverability-incidents", label: "Deliverability Incidents", permission: ["marketing.read", "marketing.configure", "settings.manage"], module: "marketing" },
  // R2-05, R2-06
  { path: "surveys", viewId: "surveys", label: "Surveys & NPS", permission: ["marketing.surveys.manage", "marketing.configure", "settings.manage"], module: "marketing" },
  { path: "survey-builder", viewId: "survey-builder", label: "Survey Builder & Responses", permission: ["marketing.surveys.manage", "marketing.configure", "settings.manage"], module: "marketing" },
  { path: "link-tracking", viewId: "link-tracking", label: "Link Tracking & UTM Manager", permission: ["marketing.links.manage", "marketing.configure", "settings.manage"], module: "marketing" },
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
      { id: "marketing.pages.manage", label: "Manage landing pages", description: "Build and publish landing pages (R2-01)." },
      { id: "marketing.forms.manage", label: "Manage forms & lead capture", description: "Build forms and capture leads (R2-02)." },
      { id: "marketing.onsite.manage", label: "Manage on-site campaigns", description: "Popups/banners/slabs (R2-03)." },
      { id: "marketing.assets.manage", label: "Manage brand assets", description: "Asset library and brand kit (R2-04)." },
      { id: "compliance.archive.read", label: "Read message archive", description: "Search sent marketing messages (R2-08)." },
      { id: "marketing.surveys.manage", label: "Manage surveys", description: "Survey lifecycle, builder and responses (R2-05)." },
      { id: "marketing.links.manage", label: "Manage tracking links", description: "Governed UTM/short links (R2-06)." },
      { id: "marketing.locales.manage", label: "Manage locale variants", description: "Locale variants and translation workflow (R3-03)." },
      { id: "marketing.budget.approve", label: "Approve ad budget changes", description: "Four-eyes approval of budget raises above the auto-approval threshold (R3-05)." },
      { id: "compliance.archive.export", label: "Export message archive", description: "Export messages for regulators (R2-08)." },
      { id: "compliance.archive.purge", label: "Purge message archive", description: "Run the retention purge job; legal hold is enforced by the job (R2-08)." },
      { id: "marketing.gateway.operate", label: "Gateway operations", description: "Send queue, gateway health, dead-letter replay, kill-switch (R4-01)." },
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
