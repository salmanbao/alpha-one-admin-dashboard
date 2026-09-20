"use client";

/**
 * PFaaS Platform — Application Shell
 *
 * Spec section 9. Reusable shell that composes Sidebar + Topbar +
 * Breadcrumbs + Command Menu + Mobile Nav + page content area.
 * Independent of business modules.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Breadcrumbs, MobileNav } from "./breadcrumbs";
import { CommandMenu } from "./command-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { commandOpen, setCommandOpen } = usePlatform();
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMobileMenu={() => {}} />
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
              <span className="font-medium text-foreground">v1.0.0</span>
            </span>
            <span className="text-muted-foreground/70">
              Modular dashboard · Dynamic navigation · Widget-based
            </span>
          </div>
        </footer>
      </div>
      <CommandMenu />
    </div>
  );
}
