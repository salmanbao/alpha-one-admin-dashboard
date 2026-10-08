"use client";

/**
 * Account Settings — converted from stitch_screens/account_settings
 * Settings hub linking to profile, security, 2FA, sessions, API tokens.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";

const sections = [
  {
    id: "profile",
    title: "Profile & Security",
    note: "Name, email, password, phone",
    href: "/profile-security",
    icon: "👤",
    status: "Verified",
  },
  {
    id: "2fa",
    title: "Two-Factor Authentication",
    note: "Authenticator app + backup codes",
    href: "/2fa-setup",
    icon: "🔐",
    status: "Enabled",
  },
  {
    id: "sessions",
    title: "Sessions & Login History",
    note: "Active devices and recent logins",
    href: "/sessions",
    icon: "💻",
    status: "3 devices",
  },
  {
    id: "tokens",
    title: "API Tokens",
    note: "Personal access tokens for integrations",
    href: "/api-tokens",
    icon: "🔑",
    status: "2 active",
  },
  {
    id: "notifications",
    title: "Notification Preferences",
    note: "Email, push and in-app channels",
    href: "/notification-preferences",
    icon: "🔔",
    status: "Email on",
  },
  {
    id: "credentials",
    title: "Trading Credentials",
    note: "Platform logins for your accounts",
    href: "/trading-credentials",
    icon: "🖥️",
    status: "2 accounts",
  },
];

export function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Settings"
        description="Manage your TerraTrader account and security"
        actions={<TerraBadge tone="primary">Pro Trader</TerraBadge>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.id} href={s.href}>
            <TerraCard className="flex h-full items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-low text-xl">
                  {s.icon}
                </span>
                <div>
                  <p className="text-sm font-bold text-on-surface">{s.title}</p>
                  <p className="text-xs text-on-surface-variant">{s.note}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TerraBadge tone="neutral">{s.status}</TerraBadge>
                <span className="text-on-surface-variant">→</span>
              </div>
            </TerraCard>
          </Link>
        ))}
      </div>

      <TerraCard>
        <TerraSectionTitle title="Danger zone" />
        <div className="flex items-center justify-between rounded-xl border border-error/30 bg-error-container/40 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-on-error-container">Delete account</p>
            <p className="text-xs text-on-error-container/80">
              Permanently removes your data. Active challenges must be settled first.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl bg-error px-4 py-2 text-xs font-bold text-on-error hover:bg-error/90"
          >
            Delete
          </button>
        </div>
      </TerraCard>
    </div>
  );
}
