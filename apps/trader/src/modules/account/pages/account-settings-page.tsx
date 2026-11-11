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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { deleteCurrentAccount, useSession } from "@/lib/session-store";

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
    id: "recovery-codes",
    title: "Recovery Codes",
    note: "View, download, or regenerate backup codes",
    href: "/recovery-codes",
    icon: "🔑",
    status: "12 active",
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();
  // R5-H5: label the identity honestly (demo persona vs real account).
  const session = useSession();
  const isDemo = !!session?.isDemo;

  // R5 Wave 0.5 — deletion actually removes the account record, ends the
  // session and clears every account-scoped storage slot.
  const performDelete = () => {
    const ok = deleteCurrentAccount();
    toast(
      ok
        ? {
            title: "Account deleted",
            description:
              "Your account, session and local data were removed from this device — you've been signed out.",
          }
        : {
            title: "Deletion incomplete",
            description:
              "Browser storage was unavailable, so some data may remain on this device.",
            variant: "destructive" as const,
          },
    );
    setTimeout(() => router.push("/login"), 500);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Settings"
        description="Manage your TerraTrader account and security"
        actions={
          <TerraBadge tone={isDemo ? "neutral" : "primary"}>
            {isDemo ? "Demo mode" : "Pro Trader"}
          </TerraBadge>
        }
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
          <div className="flex items-center gap-2">
            <TerraBadge tone="neutral">2 active sessions</TerraBadge>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="rounded-xl bg-error px-4 py-2 text-xs font-bold text-on-error hover:bg-error/90"
                aria-label="Delete account"
              >
                Delete
              </button>
            </AlertDialogTrigger>
          </div>
        </div>

        {/* Delete Account AlertDialog */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently removes your data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={performDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogPortal>
        </AlertDialog>
      </TerraCard>
    </div>
  );
}
