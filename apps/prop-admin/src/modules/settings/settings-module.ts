/**
 * Settings Module — manifest + navigation.
 *
 * Spec section 43. Settings are modular. This module registers the
 * settings navigation entry. The settings page itself owns tabs for
 * General, Branding, Terminology, Modules, Roles, Notifications.
 *
 * Sidebar children are grouped by category (the order itself
 * communicates the grouping — Branding → Security → Communications
 * → Certificates → System). All 20 children point to live views
 * registered in `src/lib/platform/view-router.tsx` — there are no
 * dead-link entries in this manifest (verified 2026-09 by
 * `impl-shell-settings`). KYC Providers (added by
 * `impl-kyc-providers-config`) is the 20th child; its viewId
 * `kyc-providers` is registered in view-router.tsx by the lead
 * agent's batched edit.
 */

import {
  Settings as SettingsIcon,
  Palette,
  Users,
  Package,
  Bell,
  Type,
  Mail,
  Award,
  Image,
  UsersRound,
  KeyRound,
  Wrench,
  Plug,
  Share2,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "settings",
    label: "Settings",
    icon: SettingsIcon,
    order: 999, // always last
    href: "settings",
    permission: "settings.manage",
    application: ["prop-admin"],
    children: [
      // ───────── Branding & White-label ─────────
      { id: "settings.branding", label: "Branding", href: "settings?tab=branding", icon: Palette, permission: "settings.manage", group: "Branding & White-label" },
      { id: "settings.terminology", label: "Terminology", href: "settings?tab=terminology", icon: Type, permission: "settings.manage", group: "Branding & White-label" },
      { id: "settings.banners", label: "Banners", href: "banner-management", icon: Image, permission: "settings.manage", group: "Branding & White-label" },
      { id: "settings.mkt-integrations", label: "Marketing Integrations", href: "marketing-integrations", icon: Plug, permission: "settings.manage", group: "Branding & White-label" },
      { id: "settings.social-media", label: "Social Media Links", href: "social-media-links", icon: Share2, permission: "settings.manage", group: "Branding & White-label" },

      // ───────── Security & Access ─────────
      { id: "settings.users", label: "User Management", href: "user-management", icon: UsersRound, permission: "settings.manage", group: "Security & Access" },
      { id: "settings.groups", label: "Group Management", href: "group-management", icon: Users, permission: "settings.manage", group: "Security & Access" },
      { id: "settings.tokens", label: "API Tokens", href: "token-management", icon: KeyRound, permission: "settings.manage", group: "Security & Access" },
      { id: "settings.device-activities", label: "Device Activities", href: "device-activities", icon: Fingerprint, permission: "settings.manage", group: "Security & Access" },
      { id: "settings.kyc-providers", label: "KYC Providers", href: "kyc-providers", icon: ShieldCheck, permission: "settings.manage", order: 75, group: "Security & Access" },

      // ───────── Communications ─────────
      { id: "settings.email-templates", label: "Email Templates", href: "email-templates", icon: Mail, permission: "settings.manage", group: "Communications" },
      { id: "settings.notifications-mgmt", label: "Notifications Mgmt", href: "notifications-management", icon: Bell, permission: "settings.manage", group: "Communications" },

      // ───────── Certificates ─────────
      { id: "settings.certificates", label: "Certificates", href: "certificate-management", icon: Award, permission: "settings.manage", group: "Certificates" },
      { id: "settings.cert-designer", label: "Certificate Designer", href: "certificate-template-designer", icon: Palette, permission: "settings.manage", group: "Certificates" },
      { id: "settings.font-upload", label: "Font Upload", href: "certificate-font-upload", icon: Type, permission: "settings.manage", group: "Certificates" },
      { id: "settings.cert-issued", label: "Issued Certificates", href: "certificates-issued", icon: Award, permission: "settings.manage", group: "Certificates" },

      // ───────── System ─────────
      { id: "settings.general", label: "General", href: "settings?tab=general", icon: SettingsIcon, permission: "settings.manage", group: "System" },
      { id: "settings.modules", label: "Modules", href: "settings?tab=modules", icon: Package, permission: "settings.manage", group: "System" },
      { id: "settings.roles", label: "Roles & Permissions", href: "settings?tab=roles", icon: Users, permission: "settings.manage", group: "System" },
      { id: "settings.notifications", label: "Notifications Matrix", href: "settings?tab=notifications", icon: Bell, permission: "settings.manage", group: "System" },
      { id: "settings.utilities", label: "Utilities", href: "utilities", icon: Wrench, permission: "settings.manage", group: "System" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "settings", viewId: "settings", label: "Settings", permission: "settings.manage", module: "settings" },
  { path: "email-templates", viewId: "email-templates", label: "Email Templates", permission: "settings.manage", module: "settings" },
  { path: "certificate-management", viewId: "certificate-management", label: "Certificate Management", permission: "settings.manage", module: "settings" },
  { path: "banner-management", viewId: "banner-management", label: "Banner Management", permission: "settings.manage", module: "settings" },
  { path: "user-management", viewId: "user-management", label: "User Management", permission: "settings.manage", module: "settings" },
  { path: "group-management", viewId: "group-management", label: "Group Management", permission: "settings.manage", module: "settings" },
  { path: "token-management", viewId: "token-management", label: "Token Management", permission: "settings.manage", module: "settings" },
  { path: "certificates-issued", viewId: "certificates-issued", label: "Issued Certificates", permission: "settings.manage", module: "settings" },
  { path: "certificate-detail", viewId: "certificate-detail", label: "Certificate Detail", permission: "settings.manage", module: "settings" },
  { path: "notifications-management", viewId: "notifications-management", label: "Notifications Management", permission: "settings.manage", module: "settings" },
  { path: "notification-edit", viewId: "notification-edit", label: "Notification Edit", permission: "settings.manage", module: "settings" },
  { path: "utilities", viewId: "utilities", label: "Utilities", permission: "settings.manage", module: "settings" },
  { path: "email-template-edit", viewId: "email-template-edit", label: "Email Template Edit", permission: "settings.manage", module: "settings" },
  { path: "certificate-template-designer", viewId: "certificate-template-designer", label: "Certificate Template Designer", permission: "settings.manage", module: "settings" },
  { path: "certificate-font-upload", viewId: "certificate-font-upload", label: "Certificate Font Upload", permission: "settings.manage", module: "settings" },
  { path: "marketing-integrations", viewId: "marketing-integrations", label: "Marketing Integrations", permission: "settings.manage", module: "settings" },
  { path: "marketing-banner-edit", viewId: "marketing-banner-edit", label: "Marketing Banner Edit", permission: "settings.manage", module: "settings" },
  { path: "social-media-links", viewId: "social-media-links", label: "Social Media Links", permission: "settings.manage", module: "settings" },
  { path: "device-activities", viewId: "device-activities", label: "Device Activities", permission: "settings.manage", module: "settings" },
  { path: "kyc-providers", viewId: "kyc-providers", label: "KYC Providers", permission: "settings.manage", module: "settings" },
  { path: "token-detail", viewId: "token-detail", label: "Token Detail", permission: "settings.manage", module: "settings" },
  { path: "terms-policies", viewId: "terms-policies", label: "Terms & Policies", permission: "settings.manage", module: "settings" },
];

export const settingsModule: FrontendModule = {
  manifest: {
    id: "settings",
    name: "Settings",
    version: "1.0.0",
    description: "Platform and tenant settings.",
    category: "core",
    supportedApplications: ["prop-admin"],
    permissions: [
      { id: "settings.manage", label: "Manage settings" },
      { id: "users.manage", label: "Manage users" },
      { id: "audit.read", label: "View audit log" },
    ],
    icon: SettingsIcon,
    accentColor: "#404040",
  },
  navigation,
  routes,
};
