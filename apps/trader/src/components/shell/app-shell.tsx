"use client";

/**
 * Trader App Shell — App Shell
 *
 * Simple shell: Sidebar + Topbar + content area.
 * No command menu, no global search — trader view is focused on their own
 * three views only.
 */

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}