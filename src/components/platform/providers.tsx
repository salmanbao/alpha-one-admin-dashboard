"use client";

/**
 * PFaaS Platform — Root Providers
 *
 * Mounts the platform context (tenant + auth + router + module runtime)
 * and the toaster. Bootstraps modules at first render.
 */

import { useEffect } from "react";
import { PlatformProvider } from "@/lib/platform/platform-context";
import { bootstrapModules } from "@/lib/platform/module-bootstrap";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    bootstrapModules();
  }, []);
  return (
    <PlatformProvider>
      {children}
      <Toaster />
    </PlatformProvider>
  );
}
