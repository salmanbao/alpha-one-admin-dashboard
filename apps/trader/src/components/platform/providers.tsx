"use client";

/**
 * Trader App — Root Providers
 *
 * Mounts the platform context (tenant + auth + router) with trader-only
 * demo data, plus the toaster. No boot screen — the trader shell is
 * intentionally minimal.
 */

import { useEffect } from "react";
import { PlatformProvider } from "@pfaas/platform-core";
import { Toaster } from "@/components/ui/toaster";
import { applyThemeMode } from "@/lib/platform/theme-engine";
import { AccountProvider } from "@/lib/platform/account-context";
import { TradingProvider } from "@/lib/trading/trading-context";
import { terraTenant, terraUser } from "@/lib/fixtures/terra-fixtures";

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialize theme mode consistently (light by default; dark toggled via
  // the same applyThemeMode mechanism used by prop-admin and platform-admin).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("pfaas:theme");
      applyThemeMode(stored === "dark" ? "dark" : "light");
    } catch { /* ignore */ }
  }, []);
  return (
    <PlatformProvider
      platformTenant={terraTenant}
      initialTenants={[]}
      users={[terraUser]}
    >
      {/* Active trading account — one source of truth for every
          account-scoped trader screen (see lib/platform/account-context).
          TradingProvider holds the mock live session (positions/orders)
          on top of the fixture data. */}
      <AccountProvider>
        <TradingProvider>{children}</TradingProvider>
      </AccountProvider>
      <Toaster />
    </PlatformProvider>
  );
}
