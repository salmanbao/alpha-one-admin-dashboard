"use client";

/**
 * PFaaS Platform — Help Dropdown
 *
 * Spec section 9 (topbar) + §27 (drawer vs page). Single point of
 * help entry from the topbar: Architecture Overview, Keyboard
 * Shortcuts, What's New, Documentation, Contact Support, About.
 *
 * Import this in `topbar.tsx` after subagent 1's fixes land.
 * Usage: `<HelpDropdown />` — renders a single ghost icon button
 * with a LifeBuoy icon. No props; reads everything from
 * `usePlatform()` at render time.
 */

import {
  LifeBuoy,
  Keyboard,
  Sparkles,
  Boxes,
  MessageSquare,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePlatform } from "@/lib/platform/platform-context";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { toast } from "@/hooks/use-toast";

const PLATFORM_VERSION = "v1.8.0";

export function HelpDropdown() {
  const { navigate, runtime } = usePlatform();
  // Round 7 fix: filter Contact Support by support-module-enabled so
  // tenants without the support module don't dead-end into a ForbiddenState.
  const supportEnabled = moduleRegistry
    .getEnabledModules(runtime)
    .some((m) => m.manifest.id === "support");

  const openArchitectureOverview = () => {
    // The standalone Help page IS the platform architecture overview —
    // navigate there instead of firing a phantom dialog event.
    navigate("help");
  };

  const openKeyboardShortcuts = () => {
    if (typeof window === "undefined") return;
    const open = (window as unknown as { __openShortcutsHelp?: () => void }).__openShortcutsHelp;
    if (open) {
      open();
    } else {
      toast({
        title: "Keyboard shortcuts",
        description: "Press ? anywhere to open the shortcuts reference.",
      });
    }
  };

  const openWhatsNew = () => {
    if (typeof window === "undefined") return;
    const open = (window as unknown as { __openWhatsNew?: () => void }).__openWhatsNew;
    if (open) {
      open();
    } else {
      // Fallback only if the topbar What's New button is not mounted.
      toast({
        title: "What's new",
        description: "Use the gift icon in the topbar to see recent updates.",
      });
    }
  };

  const openSupport = () => {
    if (!supportEnabled) {
      toast({
        title: "Support module not enabled",
        description: "This tenant doesn't have the Support module enabled. Contact your platform administrator.",
        variant: "destructive",
      });
      return;
    }
    navigate("support-tickets");
  };

  const showAbout = () => {
    toast({
      title: `PFaaS Platform ${PLATFORM_VERSION}`,
      description: "Multi-tenant Prop Firm as a Service dashboard. Built with Next.js + Terra palette.",
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help"
          title="Help"
        >
          <LifeBuoy className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
          Help
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={openArchitectureOverview}
          className="gap-2"
        >
          <Boxes className="h-4 w-4" />
          <span>Architecture Overview</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={openKeyboardShortcuts}
          className="gap-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openKeyboardShortcuts();
            }
          }}
        >
          <Keyboard className="h-4 w-4" />
          <span className="flex-1">Keyboard Shortcuts</span>
          <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-medium text-muted-foreground">
            ?
          </kbd>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openWhatsNew} className="gap-2">
          <Sparkles className="h-4 w-4" />
          <span>What&apos;s New</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openSupport} className="gap-2">
          <MessageSquare className="h-4 w-4" />
          <span>Contact Support</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={showAbout} className="gap-2">
          <Info className="h-4 w-4" />
          <span>About</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
