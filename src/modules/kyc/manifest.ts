/**
 * KYC / AML Module — manifest, navigation, routes, widgets, settings.
 *
 * Spec phase 9: KYC is an optional compliance module covering identity
 * verification, document reviews, and risk assessment. Depends on Trading.
 */

import { ShieldCheck, FileSearch, AlertTriangle, FileCheck } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition, WidgetDefinition } from "@/lib/platform/types";
import { KycOverviewWidget, KycQueueWidget } from "./widgets/kyc-widgets";

const navigation: NavigationItem[] = [
  {
    id: "kyc",
    label: "KYC / AML",
    icon: ShieldCheck,
    order: 75,
    children: [
      { id: "kyc.overview", label: "Overview", href: "kyc", icon: ShieldCheck, permission: "kyc.read" },
      { id: "kyc.reviews", label: "Reviews", href: "kyc-reviews", icon: FileSearch, permission: "kyc.read" },
      { id: "kyc.risk", label: "Risk", href: "kyc-risk", icon: AlertTriangle, permission: "kyc.read" },
    ],
  },
  { path: "kyc-onboarding", viewId: "kyc-onboarding", label: "KYC Onboarding", permission: "kyc.read", module: "kyc" },
  { path: "kyc-status", viewId: "kyc-status", label: "KYC Status", permission: "kyc.read", module: "kyc" },
];

const routes: RouteDefinition[] = [
  { path: "kyc", viewId: "kyc", label: "KYC Overview", permission: "kyc.read", module: "kyc" },
  { path: "kyc-reviews", viewId: "kyc-reviews", label: "KYC Reviews", permission: "kyc.read", module: "kyc" },
  { path: "kyc-risk", viewId: "kyc-risk", label: "KYC Risk", permission: "kyc.read", module: "kyc" },
  { path: "kyc-document-requests", viewId: "kyc-document-requests", label: "Document Requests", permission: "kyc.read", module: "kyc" },
  { path: "kyc-onboarding", viewId: "kyc-onboarding", label: "KYC Onboarding", permission: "kyc.read", module: "kyc" },
  { path: "kyc-status", viewId: "kyc-status", label: "KYC Status", permission: "kyc.read", module: "kyc" },
];

const widgets: WidgetDefinition[] = [
  { id: "kyc-overview", title: "KYC Overview", module: "kyc", category: "metric", component: KycOverviewWidget, permission: "kyc.read", defaultSize: { w: 12, h: 1 } },
  { id: "kyc-queue", title: "KYC Queue", module: "kyc", category: "alert", component: KycQueueWidget, permission: "kyc.read", defaultSize: { w: 12, h: 2 } },
  { path: "kyc-onboarding", viewId: "kyc-onboarding", label: "KYC Onboarding", permission: "kyc.read", module: "kyc" },
  { path: "kyc-status", viewId: "kyc-status", label: "KYC Status", permission: "kyc.read", module: "kyc" },
];

export const kycModule: FrontendModule = {
  manifest: {
    id: "kyc",
    name: "KYC / AML",
    version: "1.0.0",
    description: "Identity verification, document reviews, and AML risk scoring.",
    dependencies: ["trading"],
    capabilities: ["kyc.documents", "kyc.reviews", "kyc.risk", "kyc.aml"],
    category: "compliance",
    optional: true,
    supportedApplications: ["prop-admin", "super-admin"],
    permissions: [
      { id: "kyc.read", label: "View KYC" },
      { id: "kyc.approve", label: "Approve / reject KYC" },
    ],
    icon: FileCheck,
    accentColor: "#475569",
  },
  navigation,
  routes,
  widgets,
  settings: [
    { id: "kyc-settings", label: "KYC / AML", module: "kyc", viewId: "settings-kyc", icon: ShieldCheck, order: 90 },
  ],
};
