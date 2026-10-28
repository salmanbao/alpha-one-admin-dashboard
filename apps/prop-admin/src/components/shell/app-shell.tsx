"use client";

/**
 * PFaaS Platform — Application Shell
 *
 * Spec section 9. Reusable shell that composes Sidebar + Topbar +
 * Breadcrumbs + Command Menu + Global Search + Mobile Nav + page
 * content area. Independent of business modules.
 */

import { useEffect } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Breadcrumbs, MobileNav } from "./breadcrumbs";
import { CommandMenu } from "./command-menu";
import { GlobalSearchDialog } from "./global-search";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
import { OnboardingWizard } from "./onboarding-wizard";
import { useImpersonation, endImpersonation } from "@/lib/platform/impersonation";
import { Button } from "@/components/ui/button";
import { DemoDataBanner } from "@/components/platform/demo-data";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { setSearchOpen } = usePlatform();
  // PRD L5494 impersonation service — while a session is active the shell
  // shows a persistent banner; only Exit (impersonation_ended) closes it.
  const impersonation = useImpersonation();

  // "/" opens global search when not typing in an input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setSearchOpen]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* Demo-environment provenance banner — states once, globally, that
            all figures are simulated fixtures (gap-analysis Phase 0: never let
            demo data read as production fact). Not dismissible. */}
        <DemoDataBanner />
        {/* Impersonation banner — persistent until the session is exited. */}
        {impersonation ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400 md:px-6"
          >
            <span className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
              Impersonating <span className="font-bold">{impersonation.name}</span>
              <span className="font-normal opacity-70">
                · all actions audited under {impersonation.impersonator} · started{" "}
                {new Date(impersonation.startedAt).toLocaleTimeString()}
              </span>
            </span>
            <Button size="sm" variant="outline" className="h-7 border-amber-500/40 px-3 text-[11px] text-amber-700 hover:bg-amber-500/20 dark:text-amber-400" onClick={endImpersonation}>
              Exit Impersonation
            </Button>
          </div>
        ) : null}
        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
          <div className="md:hidden">
            <MobileNav />
          </div>
          <Breadcrumbs />
          {children}
        </main>
        <footer className="mt-auto border-t bg-muted/30 px-4 py-4 text-center text-xs text-muted-foreground md:px-6">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <span>
              PFaaS Platform · Multi-tenant white-label infrastructure ·{" "}
              <span className="font-medium text-foreground">v1.8.0</span>
            </span>
            <span className="text-muted-foreground/70">
              Press <kbd className="rounded border bg-background px-1 text-[10px]">/</kbd> to search ·{" "}
              <kbd className="rounded border bg-background px-1 text-[10px]">⌘K</kbd> for commands
            </span>
          </div>
        </footer>
      </div>
      <CommandMenu />
      <GlobalSearchDialog />
      <KeyboardShortcutsHelp />
      <OnboardingWizard />
    </div>
  );
}
