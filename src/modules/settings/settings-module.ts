/**
 * Settings Module — manifest + navigation.
 *
 * Spec section 43. Settings are modular. This module registers the
 * settings navigation entry. The settings page itself owns tabs for
 * General, Branding, Terminology, Modules, Roles, Notifications.
 */

import { Settings as SettingsIcon, Palette, Users, Package, Bell, Type, Mail, Award, Image } from "lucide-react";
import type { FrontendModule, NavigationItem, RouteDefinition } from "@/lib/platform/types";

const navigation: NavigationItem[] = [
  {
    id: "settings",
    label: "Settings",
    icon: SettingsIcon,
    order: 999, // always last
    href: "settings",
    permission: "settings.manage",
    application: ["prop-admin", "super-admin"],
    children: [
      { id: "settings.general", label: "General", href: "settings", icon: SettingsIcon, permission: "settings.manage" },
      { id: "settings.branding", label: "Branding", href: "settings", icon: Palette, permission: "settings.manage" },
      { id: "settings.terminology", label: "Terminology", href: "settings", icon: Type, permission: "settings.manage" },
      { id: "settings.modules", label: "Modules", href: "settings", icon: Package, permission: "settings.manage" },
      { id: "settings.roles", label: "Roles & Permissions", href: "settings", icon: Users, permission: "settings.manage" },
      { id: "settings.notifications", label: "Notifications", href: "settings", icon: Bell, permission: "settings.manage" },
      { id: "settings.email-templates", label: "Email Templates", href: "email-templates", icon: Mail, permission: "settings.manage" },
      { id: "settings.certificates", label: "Certificates", href: "certificate-management", icon: Award, permission: "settings.manage" },
      { id: "settings.banners", label: "Banners", href: "banner-management", icon: Image, permission: "settings.manage" },
    ],
  },
];

const routes: RouteDefinition[] = [
  { path: "settings", viewId: "settings", label: "Settings", permission: "settings.manage", module: "settings" },
  { path: "email-templates", viewId: "email-templates", label: "Email Templates", permission: "settings.manage", module: "settings" },
  { path: "certificate-management", viewId: "certificate-management", label: "Certificate Management", permission: "settings.manage", module: "settings" },
  { path: "banner-management", viewId: "banner-management", label: "Banner Management", permission: "settings.manage", module: "settings" },
];

export const settingsModule: FrontendModule = {
  manifest: {
    id: "settings",
    name: "Settings",
    version: "1.0.0",
    description: "Platform and tenant settings.",
    category: "core",
    supportedApplications: ["prop-admin", "super-admin"],
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
