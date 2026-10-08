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
import { tradersTenant, traderUser } from "@/lib/fixtures/trader-fixtures";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider
      platformTenant={tradersTenant}
      initialTenants={[]}
      users={[traderUser]}
    >
      {children}
      <Toaster />
    </PlatformProvider>
  );
}
