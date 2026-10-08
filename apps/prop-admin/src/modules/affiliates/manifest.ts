/**
 * Affiliates Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec section 72 Phase 9: Affiliates is an optional growth module that
 * depends on Trading. Manages affiliates, campaigns, and commissions.
 */

import { Megaphone, Users, BarChart3, DollarSign, ListChecks, Tag, Settings2, Ticket, Link } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { AffiliateOverviewWidget, TopAffiliatesWidget, AffiliateRevenueWidget } from "./widgets/affiliate-widgets";

const navigation: NavigationItem[] = [
  {
    id: "affiliates",
    label: "Affiliates",
    icon: Megaphone,
    order: 55,
    children: [
      // ───────── Management ─────────
      { id: "affiliates.overview", label: "Overview", href: "affiliates", icon: BarChart3, permission: "affiliate.read", group: "Management" },
      { id: "affiliates.list", label: "Affiliates", href: "affiliates-list", icon: Users, permission: "affiliate.read", group: "Management" },
      { id: "affiliates.campaigns", label: "Campaigns", href: "affiliates-campaigns", icon: Megaphone, permission: "affiliate.read", group: "Management" },
      { id: "affiliates.commissions", label: "Commissions", href: "affiliates-commissions", icon: DollarSign, permission: "affiliate.read", group: "Management" },

      // ───────── Promotion & Offers ─────────
      { id: "affiliates.coupons", label: "Coupons", href: "affiliate-coupons", icon: Ticket, permission: "affiliate.read", group: "Promotion & Offers" },
      { id: "affiliates.link-tracking", label: "Link Tracking", href: "affiliate-link-tracking", icon: Link, permission: "affiliate.read", group: "Promotion & Offers" },
      { id: "affiliates.offers", label: "Offers", href: "offer-management", icon: Tag, permission: "affiliate.read", group: "Promotion & Offers" },
      { id: "affiliates.offer-edit", label: "Edit Offer", href: "offer-edit", icon: Settings2, permission: "affiliate.configure", group: "Promotion & Offers" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "affiliates", viewId: "affiliates", label: "Affiliates Overview", permission: "affiliate.read", module: "affiliates" },
  { path: "affiliates-list", viewId: "affiliates-list", label: "Affiliates List", permission: "affiliate.read", module: "affiliates" },
  { path: "affiliates-campaigns", viewId: "affiliates-campaigns", label: "Affiliate Campaigns", permission: "affiliate.read", module: "affiliates" },
  { path: "affiliates-commissions", viewId: "affiliates-commissions", label: "Affiliate Commissions", permission: "affiliate.read", module: "affiliates" },
  { path: "affiliate-coupons", viewId: "affiliate-coupons", label: "Coupon Codes", permission: "affiliate.read", module: "affiliates" },
  { path: "affiliate-link-tracking", viewId: "affiliate-link-tracking", label: "Link Tracking", permission: "affiliate.read", module: "affiliates" },
  { path: "offer-management", viewId: "offer-management", label: "Offer Management", permission: "affiliate.read", module: "affiliates" },
  { path: "offer-edit", viewId: "offer-edit", label: "Offer Edit", permission: "affiliate.configure", module: "affiliates" },
  { path: "offer-matching-users", viewId: "offer-matching-users", label: "Matching Users", permission: "affiliate.read", module: "affiliates" },
  { path: "offer-change-history", viewId: "offer-change-history", label: "Offer Change History", permission: "affiliate.read", module: "affiliates" },
];

const widgets: WidgetDefinition[] = [
  { id: "affiliate-overview", title: "Affiliate Overview", module: "affiliates", category: "metric", component: AffiliateOverviewWidget, permission: "affiliate.read", defaultSize: { w: 12, h: 1 } },
  { id: "top-affiliates", title: "Top Affiliates", module: "affiliates", category: "leaderboard", component: TopAffiliatesWidget, permission: "affiliate.read", defaultSize: { w: 6, h: 2 } },
  { id: "affiliate-revenue", title: "Affiliate Revenue", module: "affiliates", category: "chart", component: AffiliateRevenueWidget, permission: "affiliate.read", defaultSize: { w: 6, h: 2 } },
];

export const affiliatesModule: FrontendModule = {
  manifest: {
    id: "affiliates",
    name: "Affiliates",
    version: "1.0.0",
    description: "Affiliate partner management, campaigns, and commission tracking.",
    dependencies: ["trading"],
    capabilities: ["affiliates.management", "affiliates.campaigns", "affiliates.commissions"],
    category: "growth",
    optional: true,
    supportedApplications: ["prop-admin"],
    permissions: [
      { id: "affiliate.read", label: "View affiliates" },
      { id: "affiliate.create", label: "Create affiliate" },
      { id: "affiliate.update", label: "Update affiliate" },
      { id: "affiliate.configure", label: "Configure affiliate settings" },
    ],
    icon: Megaphone,
    accentColor: "#b45309",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "affiliates-settings", label: "Affiliates", module: "affiliates", viewId: "settings-affiliates", icon: ListChecks, order: 75 },
  ],
};
