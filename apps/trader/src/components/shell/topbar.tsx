"use client";

/**
 * Trader App Shell — Topbar
 *
 * Simple topbar with account menu (user info + logout)
 */

import { usePlatform } from "@pfaas/platform-core";
import { LogOut, User, ChevronDown } from "lucide-react";
import { cn } from "@pfaas/ui";
import { useState, useRef, useEffect } from "react";

export function Topbar() {
  const { runtime } = usePlatform();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const user = runtime?.user;
  const tenant = runtime?.tenant;

  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Trader Dashboard</h1>
          {tenant && (
            <span className="hidden sm:block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {tenant.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(!open)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
              )}
              aria-expanded={open}
              aria-haspopup="true"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:block">{user?.name ?? "Trader"}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-56 rounded-md border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                  Signed in as {user?.email ?? "trader@example.com"}
                </div>
                <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                  Role: {user?.roles?.[0] ?? "trader"}
                </div>
                <button
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-3 py-2 text-sm",
                    "hover:bg-accent hover:text-accent-foreground text-destructive"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}