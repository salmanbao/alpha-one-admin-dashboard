"use client";
/**
 * PFaaS Platform — Root Providers
 *
 * Mounts the platform context and toaster. Shows boot screen while
 * platform initializes, then gates on an authenticated console session
 * (CON-01): without `pfaas:session` the operator must sign in with
 * credentials + mandatory 2FA before the console mounts.
 */
import { useState, useEffect } from "react";
import { PlatformProvider } from "@/lib/platform/platform-context";
import { bootstrapModules } from "@/lib/platform/module-bootstrap";
import { applyThemeMode } from "@/lib/platform/theme-engine";
import { Toaster } from "@/components/ui/toaster";
import { BootScreen } from "@/components/shell/boot-screen";
import { ConsoleLogin } from "@/components/shell/console-login";

bootstrapModules();

const BOOTED_KEY = "pfaas:booted";
const SESSION_KEY = "pfaas:session";

export function Providers({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      applyThemeMode("light");
    } catch { /* ignore */ }
    try {
      if (window.sessionStorage.getItem(BOOTED_KEY) === "1") setBooted(true);
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") setSessionOk(true);
    } catch { /* ignore */ }
  }, []);

  if (!booted) {
    return (
      <BootScreen
        onDone={() => {
          setBooted(true);
          if (typeof window !== "undefined") {
            try { window.sessionStorage.setItem(BOOTED_KEY, "1"); } catch { /* ignore */ }
          }
        }}
      />
    );
  }

  // CON-01 — no authenticated session: credentials + mandatory 2FA first.
  if (!sessionOk) {
    return (
      <ConsoleLogin
        onLogin={() => {
          if (typeof window !== "undefined") {
            try { window.sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
          }
          setSessionOk(true);
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
