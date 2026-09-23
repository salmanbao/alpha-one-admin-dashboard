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
  BookOpen,
  MessageSquare,
  Info,
  ExternalLink,
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
import { toast } from "@/hooks/use-toast";

const PLATFORM_VERSION = "v1.8.0";

export function HelpDropdown() {
  const { navigate } = usePlatform();

  const openArchitectureOverview = () => {
    // Dispatch a custom event the AppShell (or any listener) can hook
    // to open the architecture-overview dialog. Mirrors the pattern
    // used by `window.__openShortcutsHelp` for the keyboard-shortcuts
    // dialog. If no listener is wired, the toast gives actionable
    // feedback (§4 — clear, actionable error messages).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pfaas:open-help"));
    }
    toast({
      title: "Architecture overview",
      description: "Architecture overview dialog would open here.",
    });
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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pfaas:open-whats-new"));
    }
    toast({
      title: "What's new",
      description: "Changelog dialog would open here. Use the gift icon in the topbar as a fallback.",
    });
  };

  const openDocumentation = () => {
    if (typeof window !== "undefined") {
      window.open("https://docs.example.com", "_blank", "noopener,noreferrer");
    }
  };

  const openSupport = () => {
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
          <Sparkles className="h-4 w-4" />
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
        <DropdownMenuItem onClick={openDocumentation} className="gap-2">
          <BookOpen className="h-4 w-4" />
          <span className="flex-1">Documentation</span>
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
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
