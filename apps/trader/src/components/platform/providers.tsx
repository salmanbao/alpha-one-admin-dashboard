"use client";

/**
 * Trader App — Root Providers
 *
 * Mounts the platform context (tenant + auth + router) with trader-only
 * demo data, plus the toaster. No boot screen — the trader shell is
 * intentionally minimal.
 */

import { PlatformProvider } from "@pfaas/platform-core";
import { Toaster } from "@/components/ui/toaster";
import { AccountProvider } from "@/lib/platform/account-context";
import { terraTenant, terraUser } from "@/lib/fixtures/terra-fixtures";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider
      platformTenant={terraTenant}
      initialTenants={[]}
      users={[terraUser]}
    >
      {/* Active trading account — one source of truth for every
          account-scoped trader screen (see lib/platform/account-context). */}
      <AccountProvider>{children}</AccountProvider>
      <Toaster />
    </PlatformProvider>
  );
}
