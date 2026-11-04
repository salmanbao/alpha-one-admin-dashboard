"use client";

/**
 * Terra Trader — Keyboard Shortcuts Help
 *
 * Opens with the `?` key (audit finding #1: the trader shell had a ⌘K
 * command palette but no discoverable list of the keyboard affordances
 * it does implement — tab strips, table row navigation, dialog escapes).
 *
 * This component is globally mounted via `AppShell`, so it owns the
 * global `?` listener. Every entry below documents a shortcut that
 * actually exists in this build — nothing aspirational.
 *
 * Mirrors platform-admin's KeyboardShortcutsHelp so both dashboards
 * teach the same interaction language.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  Keyboard,
  X,
  ArrowRight,
  ArrowUp,
  Home,
  CornerDownRight,
} from "lucide-react";

interface Shortcut {
  keys: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: "⌘ K", label: "Open the command palette (search pages, actions, accounts)", icon: Command, group: "Global" },
  { keys: "?", label: "Show this shortcut list", icon: Keyboard, group: "Global" },
  { keys: "Esc", label: "Close a dialog, menu, or palette", icon: X, group: "Global" },
  { keys: "Tab", label: "Move through controls — first stop skips to main content", icon: CornerDownRight, group: "Global" },
  { keys: "← →", label: "Switch tabs on analytics, positions, and account detail", icon: ArrowRight, group: "Tabs" },
  { keys: "Home End", label: "Jump to the first / last tab", icon: Home, group: "Tabs" },
  { keys: "↑ ↓", label: "Move between rows in trade history", icon: ArrowUp, group: "Tables" },
  { keys: "Home End", label: "Jump to the first / last row", icon: Home, group: "Tables" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      // Never steal modifier combos (browser shortcuts).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Expose a global so the command palette can open this dialog.
  useEffect(() => {
    const w = window as unknown as { __openShortcutsHelp?: () => void };
    w.__openShortcutsHelp = () => setOpen(true);
    return () => {
      delete w.__openShortcutsHelp;
    };
  }, []);

  const grouped = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" aria-hidden />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Every shortcut below is live in this build. Press{" "}
            <kbd className="rounded border bg-muted px-1 text-[10px]">Esc</kbd> to close.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {Object.entries(grouped).map(([group, shortcuts]) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="space-y-1.5" role="list" aria-label={`${group} shortcuts`}>
                {shortcuts.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.label}
                      role="listitem"
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
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
            <li>• The palette (⌘K) fuzzy-searches every page, quick action and trading account.</li>
            <li>• Press ? anywhere outside a text field to reopen this list.</li>
            <li>• Dialogs and menus are fully operable with the keyboard — Esc always closes.</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
