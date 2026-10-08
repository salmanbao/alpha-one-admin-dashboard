"use client";

/**
 * Trader App Shell — Sidebar
 *
 * Simple sidebar with three nav entries for the three trader views
 * (My Workspace, My Open Positions, My Closed Positions)
 */

import Link from "next/link";
import { cn } from "@pfaas/ui";
import { LayoutGrid, Archive, Package } from "lucide-react";

const navItems = [
  {
    href: "/trader-detail",
    icon: LayoutGrid,
    label: "My Workspace",
    description: "View your trading profile and active positions",
  },
  {
    href: "/trading-positions",
    icon: Package,
    label: "My Open Positions",
    description: "View and manage your currently open trading positions",
  },
  {
    href: "/closed-positions",
    icon: Archive,
    label: "My Closed Positions",
    description: "View your trading history and closed positions",
  },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-muted/30 p-4 hidden md:block">
      <div className="space-y-2">
        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Trader Dashboard
        </div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            <div className="flex flex-col">
              <span>{item.label}</span>
              <span className="text-xs text-muted-foreground/70 hidden lg:block">
                {item.description}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </aside>
  );
}