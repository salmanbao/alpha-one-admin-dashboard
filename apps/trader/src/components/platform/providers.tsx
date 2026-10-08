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
import { terraTenant, terraUser } from "@/lib/fixtures/terra-fixtures";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PlatformProvider
      platformTenant={terraTenant}
      initialTenants={[]}
      users={[terraUser]}
    >
      {children}
      <Toaster />
    </PlatformProvider>
  );
}
