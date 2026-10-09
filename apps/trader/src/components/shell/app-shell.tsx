"use client";

/**
 * Terra App Shell — sidebar + header + content + footer.
 *
 * Styled to mirror the prop-admin shell (Rooted Warmth theme):
 * • wrapper: warm cream background, no heavy font tokens (now global)
 * • header: h-14, border-b, bg-background/95, backdrop-blur
 *   (prop-admin topbar styling — no heavy shadow, clean border)
 * • main: prop-admin content padding (px-4 py-4 md:px-6 md:py-6),
 *   no max-w wrapper — pages self-center when needed
 * • footer: prop-admin footer styling (border-t bg-muted/30, text-xs
 *   text-muted-foreground, md:px-6)
 *
 * The header doubles as the topbar (mobile hamburger + brand + markets
 * pill + bell + profile dropdown). The trader app is simpler than
 * prop-admin's topbar, so we keep an inline header rather than a
 * separate Topbar component.
 */

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { terraTenant } from "@/lib/fixtures/terra-fixtures";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Login page renders without the shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Left: mobile menu toggle + brand (brand lives in sidebar on desktop) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMenuOpen(true)}
              className="rounded-md p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground lg:hidden"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
                {terraTenant.branding.initials}
              </span>
              <span className="font-headline text-base font-semibold tracking-tight text-sidebar-foreground hidden sm:inline">
                {terraTenant.branding.name}
              </span>
            </Link>
            <span className="hidden text-sm font-medium text-sidebar-foreground/70 lg:inline">
              {terraTenant.branding.tagline}
            </span>
          </div>

          {/* Right: status, notifications, profile */}
          <div className="ml-auto flex items-center gap-1">
            <div className="hidden items-center gap-2 rounded-full bg-sidebar-accent/60 px-3 py-1 text-xs font-semibold tracking-wide text-sidebar-primary-foreground md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary animate-pulse" />
              <span>Markets Open · 24/5</span>
            </div>
            <div className="hidden items-center gap-2 rounded-full bg-sidebar-primary/80 px-3 py-1.5 text-xs font-bold tracking-wide text-sidebar-primary-foreground sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary animate-pulse" />
              <span>Active</span>
            </div>
            <Link
              href="/notification-center"
              aria-label="Notifications"
              className="relative rounded-full p-2 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            >
              <svg
                className="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-sidebar-border" />
            </Link>
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-label="User menu"
                className="flex cursor-pointer items-center gap-2 rounded-md bg-sidebar-accent/40 p-1.5 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                  TA
                </span>
                <svg
                  className={cn(
                    "h-3.5 w-3.5 text-sidebar-foreground/70 transition-transform sm:block",
                    profileOpen && "rotate-180",
                  )}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-sidebar-border bg-popover p-1 shadow-terra">
                  <div className="border-b border-sidebar-border px-3 py-2 text-xs text-sidebar-foreground/70">
                    Signed in as tom.allen@terra.trader
                  </div>
                  <Link
                    href="/account-settings"
                    onClick={() => setProfileOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
                  >
                    Account Settings
                  </Link>
                  <Link
                    href="/profile-security"
                    onClick={() => setProfileOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
                  >
                    Profile &amp; Security
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setProfileOpen(false)}
                    className="block rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-[#b54848]/20"
                  >
                    Sign out
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 md:px-6 md:py-6">
          {children}
        </main>

        <footer className="mt-auto border-t bg-muted/30 px-4 py-4 text-center text-xs text-muted-foreground md:px-6">
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <span>© {new Date().getFullYear()} TerraTrader — Trade. Grow. Get funded.</span>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="hover:text-sidebar-foreground">
                Terms &amp; Policies
              </Link>
              <Link href="/help-center" className="hover:text-sidebar-foreground">
                Help Center
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function cn(...inputs: { toString: () => string }[]): string {
  return inputs.map((i) => i.toString()).filter(Boolean).join(" ");
}
