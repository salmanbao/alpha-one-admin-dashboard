"use client";

/**
 * DetailDisclosure — one expandable detail section (audit C #4).
 *
 * Dense analytics screens gave headline charts and tertiary detail the
 * same visual weight, so there was no way to scan a page without
 * reading all of it. This component is the consistent home for that
 * deep detail:
 *
 *   • a real `<button>` with `aria-expanded` + `aria-controls` — the
 *     collapsed state is announced, and the chevron mirrors it;
 *   • the region uses the `hidden` attribute, so collapsed content is
 *     genuinely out of view (and out of the tab order) rather than
 *     visually shrunk;
 *   • the card keeps the title / subtitle visible in both states, with
 *     an optional hint ("24 hourly buckets") so a collapsed card never
 *     becomes a mystery.
 *
 * Matches ChartCard's card chrome (`rounded-lg border bg-card p-4`) so
 * a disclosure can take the place of a ChartCard in any grid without
 * changing the layout around it.
 */

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function DetailDisclosure({
  title,
  subtitle,
  hint,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode;
  subtitle?: string;
  /** What the hidden region holds — shown while collapsed. */
  hint?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>
          <span className="text-sm font-medium text-foreground">{title}</span>
          {subtitle ? (
            <span className="block text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {!open && hint ? <span className="hidden sm:inline">{hint}</span> : null}
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      <div id={regionId} hidden={!open} className="pt-3">
        {children}
      </div>
    </div>
  );
}
