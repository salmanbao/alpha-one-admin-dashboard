"use client";

/**
 * PFaaS Platform — What's New / Changelog Panel
 *
 * Shows recent platform updates, new features, and improvements.
 * Accessible from the topbar via a gift/sparkle icon. Shows a badge
 * for unread updates. Persists "last seen" version to localStorage.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Gift,
  Sparkles,
  Rocket,
  Bell,
  Zap,
  Shield,
  Palette,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  category: "feature" | "improvement" | "security" | "branding";
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.8.0",
    date: "2026-09-21",
    title: "Live data + notification center",
    category: "feature",
    items: [
      "Real-time price feed widget with 6 trading symbols",
      "Live equity curve chart with delta indicators",
      "Notification center consolidating alerts + activity",
      "Price alert system with threshold triggers",
      "Onboarding wizard for new tenants",
      "Multi-currency conversion in analytics",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-09-21",
    title: "Dashboard customization + saved views",
    category: "feature",
    items: [
      "Dashboard layout presets (Risk, Finance, Trading, Minimal)",
      "Saved views/filters with localStorage persistence",
      "Live activity feed with auto-updating events",
      "Keyboard shortcuts help (? key)",
      "CSV export from Analytics + Accounting",
      "Dashboard layout sharing (export/import JSON)",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-09-20",
    title: "Integrations + white-labeling",
    category: "feature",
    items: [
      "Integrations tab with 14 provider connections",
      "Per-module notification preferences",
      "Enhanced profile page with avatar upload",
      "Audit log filtering (severity, module, actor, date range)",
      "Tenant branding with color presets + live preview",
      "Terminology customization (challenge → evaluation)",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-09-20",
    title: "Accessibility + ARIA labels",
    category: "security",
    items: [
      "ARIA labels on all color-only indicators",
      "Chart axis label rotation for long names",
      "Dark mode color variants across all widgets",
      "Custom thin scrollbar with themed colors",
      "Focus-visible rings for keyboard navigation",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-09-20",
    title: "Modular architecture",
    category: "feature",
    items: [
      "14 registered modules with dynamic navigation",
      "Widget-based dashboard with module grouping",
      "Permission-driven visibility (RBAC)",
      "Multi-tenant white-labeling",
      "Global search across 8 entity types",
      "Command menu (⌘K) with fuzzy search",
    ],
  },
];

const categoryIcon = {
  feature: Rocket,
  improvement: Zap,
  security: Shield,
  branding: Palette,
};

const categoryColor = {
  feature: "#0f766e",
  improvement: "#0d9488",
  security: "#be123c",
  branding: "#0f766e",
};

const STORAGE_KEY = "pfaas:lastSeenVersion";

export function WhatsNewButton() {
  const [open, setOpen] = useState(false);
  const [hasNew, setHasNew] = useState(() => {
    if (typeof window === "undefined") return false;
    const lastSeen = window.localStorage.getItem(STORAGE_KEY);
    const latest = CHANGELOG[0]?.version;
    return lastSeen !== latest;
  });

  const handleOpen = () => {
    setOpen(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, CHANGELOG[0]?.version ?? "");
    }
    setHasNew(false);
  };

  // Expose a global opener so other entry points (Help dropdown, ⌘K) can
  // open the real dialog instead of a "would open here" placeholder toast.
  useEffect(() => {
    (window as unknown as { __openWhatsNew?: () => void }).__openWhatsNew = handleOpen;
    return () => { delete (window as unknown as { __openWhatsNew?: () => void }).__openWhatsNew; };
  });

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={handleOpen}
        aria-label="What's new"
        title="What's new"
      >
        <Gift className="h-4 w-4" />
        {hasNew ? (
          <span className="absolute right-0.5 top-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        ) : null}
      </Button>
      <WhatsNewDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function WhatsNewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            What's New
          </DialogTitle>
          <DialogDescription>
            Recent updates and improvements to the PFaaS Platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {CHANGELOG.map((entry) => {
            const Icon = categoryIcon[entry.category];
            const color = categoryColor[entry.category];
            return (
              <div key={entry.version} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md"
                    style={{ background: `${color}1a`, color }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{entry.title}</span>
                      <Badge variant="outline" className="text-[9px]">v{entry.version}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{entry.date}</p>
                  </div>
                </div>
                <ul className="ml-1 space-y-1">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span
                        className="mt-1 h-1 w-1 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border bg-primary/5 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Stay tuned for more updates. The platform is actively developed.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
