"use client";

/**
 * PFaaS Platform — Keyboard Shortcuts Help
 *
 * Opens with `?` key. Shows all available keyboard shortcuts in a
 * clean overlay. Spec section 9 (shell features).
 *
 * This component is globally mounted via `AppShell`, so it also owns
 * the wiring of the `g <next-key>` navigation shortcuts and the `b`
 * sidebar toggle. (Command-menu.tsx only implements `g d` and `g s`;
 * we wire the remainder here to fix the documentation drift between
 * the help list and the actual handlers.)
 */

import { useEffect, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Command, Search, Bell, Moon, Sun, ArrowLeft, Settings2, Keyboard } from "lucide-react";

interface Shortcut {
  keys: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: "⌘ K", label: "Open command menu", icon: Command, group: "Global" },
  { keys: "/", label: "Open global search", icon: Search, group: "Global" },
  { keys: "?", label: "Show this help", icon: Keyboard, group: "Global" },
  { keys: "Esc", label: "Close dialog / menu", icon: ArrowLeft, group: "Global" },
  { keys: "G D", label: "Go to dashboard", icon: Command, group: "Navigation" },
  { keys: "G S", label: "Go to settings", icon: Settings2, group: "Navigation" },
  { keys: "G T", label: "Go to traders", icon: Command, group: "Navigation" },
  { keys: "G A", label: "Go to analytics", icon: Command, group: "Navigation" },
  { keys: "G P", label: "Go to payouts", icon: Command, group: "Navigation" },
  { keys: "G R", label: "Go to risk", icon: Command, group: "Navigation" },
  { keys: "B", label: "Toggle sidebar (desktop)", icon: Command, group: "View" },
];

export function KeyboardShortcutsHelp() {
  const { setCommandOpen, setSearchOpen, navigate, sidebarCollapsed, setSidebarCollapsed } = usePlatform();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      // Don't trigger if any modifier is held (avoid conflicts with browser shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // `b` toggles the sidebar (desktop only — the listener is global,
      // but the collapsed-state visually affects only `md+` breakpoints).
      if (e.key === "b" || e.key === "B") {
        // Ignore when the user is in a form field (covered above) but
        // also when a Dialog/Sheet is open (the dialog owns Esc focus).
        const dialogOpen = document.querySelector("[role='dialog']");
        if (dialogOpen) return;
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
        return;
      }
      // `g <next-key>` navigation — listen for `g`, then the next key.
      // Command-menu.tsx handles `g d` and `g s`; we own `g t/a/p/r`.
      if (e.key === "g") {
        const onKey = (ev: KeyboardEvent) => {
          const next = ev.key.toLowerCase();
          if (next === "t") {
            ev.preventDefault();
            navigate("trading-traders");
          } else if (next === "a") {
            ev.preventDefault();
            navigate("analytics");
          } else if (next === "p") {
            ev.preventDefault();
            navigate("payouts");
          } else if (next === "r") {
            ev.preventDefault();
            navigate("risk");
          }
          // `g d` / `g s` are handled by command-menu.tsx's own listener
          // (which only reacts to `d` and `s`), so they fall through.
          window.removeEventListener("keydown", onKey);
        };
        window.addEventListener("keydown", onKey, { once: true });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, sidebarCollapsed, setSidebarCollapsed]);

  // Also expose a global to open it from the command menu
  useEffect(() => {
    (window as unknown as { __openShortcutsHelp?: () => void }).__openShortcutsHelp = () => setOpen(true);
    return () => { delete (window as unknown as { __openShortcutsHelp?: () => void }).__openShortcutsHelp; };
  }, []);

  const grouped = SHORTCUTS.reduce((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate the platform faster. Press <kbd className="rounded border bg-muted px-1 text-[10px]">Esc</kbd> to close.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {Object.entries(grouped).map(([group, shortcuts]) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              <div className="space-y-1.5">
                {shortcuts.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 text-sm text-foreground">{s.label}</span>
                      <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {s.keys}
                      </kbd>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Tips</p>
          <ul className="mt-1 space-y-0.5">
            <li>• The command menu (⌘K) also supports fuzzy search across pages, tenants, and users.</li>
            <li>• Global search (/) searches across traders, accounts, payouts, and more.</li>
            <li>• Switch tenants instantly from the top bar — the entire UI re-composes.</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
