"use client";

/**
 * PFaaS Platform — Root Providers
 *
 * Mounts the platform context (tenant + auth + router + module runtime)
 * and the toaster. Shows a boot screen while the platform initializes,
 * then transitions to the dashboard.
 */

import { useState, useEffect } from "react";
import { PlatformProvider } from "@/lib/platform/platform-context";
import { bootstrapModules } from "@/lib/platform/module-bootstrap";
import { Toaster } from "@/components/ui/toaster";
import { BootScreen } from "@/components/shell/boot-screen";

// Bootstrap modules at import time so the registry is populated
// before any component renders. This is idempotent.
bootstrapModules();

export function Providers({ children }: { children: React.ReactNode }) {
  // Always start with booted=false so the server and client render the
  // same initial HTML (the boot screen). After hydration, check
  // sessionStorage and skip the animation if the flag is set. This
  // prevents the hydration mismatch that occurred when the server
  // rendered the boot screen but the client immediately rendered the
  // app (because sessionStorage was available on the client only).
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem("pfaas:booted") === "1") {
        // Already booted in this session — skip the animation.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setBooted(true);
      }
    } catch { /* ignore */ }
  }, []);

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
