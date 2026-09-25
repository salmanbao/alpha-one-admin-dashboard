"use client";

/**
 * PFaaS Platform — Root Providers
 *
 * Mounts the platform context (tenant + auth + router + module runtime)
 * and the toaster. Shows a boot screen while the platform initializes,
 * then transitions to the dashboard.
 */

import { useState } from "react";
import { PlatformProvider } from "@/lib/platform/platform-context";
import { bootstrapModules } from "@/lib/platform/module-bootstrap";
import { Toaster } from "@/components/ui/toaster";
import { BootScreen } from "@/components/shell/boot-screen";

// Bootstrap modules at import time so the registry is populated
// before any component renders. This is idempotent.
bootstrapModules();

export function Providers({ children }: { children: React.ReactNode }) {
  // Round 7 fix: skip the boot-screen animation on subsequent reloads
  // within the same browser session (was playing on every F5). The
  // sessionStorage flag is cleared when the tab closes, so a fresh
  // browser visit still sees the animation.
  const [booted, setBooted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem("pfaas:booted") === "1";
    } catch {
      return false;
    }
  });
  if (!booted) {
    return (
      <BootScreen
        onDone={() => {
          setBooted(true);
          if (typeof window !== "undefined") {
            try { window.sessionStorage.setItem("pfaas:booted", "1"); } catch { /* ignore */ }
          }
        }}
      />
    );
  }
  return (
    <PlatformProvider>
      {children}
      <Toaster />
    </PlatformProvider>
  );
}
