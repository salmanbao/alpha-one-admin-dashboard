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
  const [booted, setBooted] = useState(false);
  if (!booted) {
    return <BootScreen onDone={() => setBooted(true)} />;
  }
  return (
    <PlatformProvider>
      {children}
      <Toaster />
    </PlatformProvider>
  );
}
