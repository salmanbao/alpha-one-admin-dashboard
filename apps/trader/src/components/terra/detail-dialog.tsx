"use client";

/**
 * DetailDialog — shared shell for enterprise "quick view" overlays.
 *
 * List screens (trade history, payout history, documents, notifications)
 * drill into a detail screen. Instead of navigating away — and losing
 * sort, filters, scroll position and pagination — the parent opens this
 * dialog on top of itself and offers explicit escapes:
 *
 *   • "Open full page"  — same-tab navigation to the canonical route
 *   • "Open in new tab" — target=_blank for parallel/standalone reading
 *
 * The dialog is Radix-backed (focus trap, Escape, overlay dismiss,
 * aria-modal) via @pfaas/ui's Dialog. Content pages render with
 * `embedded` so their page chrome (TerraPageHeader / back links) is
 * hidden and the dialog header takes over.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DetailDialog({
  open,
  onOpenChange,
  title,
  description,
  fullPageHref,
  fullPageLabel = "Open full page",
  newTabHref,
  newTabLabel = "Open in new tab ↗",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visible dialog heading (the embedded content hides its own header). */
  title: string;
  description?: string;
  /** Canonical same-tab route for this record (omitted = no navigation). */
  fullPageHref?: string;
  fullPageLabel?: string;
  /** Standalone route to open in a browser tab (parallel task pattern). */
  newTabHref?: string;
  newTabLabel?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {children}

        {(fullPageHref || newTabHref) && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant/40 pt-4">
            {fullPageHref && (
              <Link
                href={fullPageHref}
                className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
              >
                {fullPageLabel}
              </Link>
            )}
            {newTabHref && (
              <Link
                href={newTabHref}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90"
              >
                {newTabLabel}
              </Link>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
