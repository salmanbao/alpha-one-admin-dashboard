"use client";

/**
 * Roving-tabindex ARIA tabs helper — finding #3 (keyboard navigation).
 *
 * Two trader screens (account detail, open positions) render custom
 * `role="tablist"` strips as plain buttons. That made every tab its own
 * Tab stop and gave keyboard users no way to move between tabs without
 * cycling through the whole page — an incomplete ARIA tabs pattern.
 *
 * This hook implements the missing keyboard contract (WAI-ARIA Authoring
 * Practices — Tabs):
 *
 *   • Roving tabindex — the selected tab is the only Tab stop (tabIndex
 *     0); the rest are -1. Tab moves INTO the tablist once, then OUT
 *     into the active panel.
 *   • ArrowLeft / ArrowRight move selection and move focus with it
 *     (wrapping at both ends). Home / End jump to first / last.
 *   • Full ids + aria-controls so each tab is programmatically tied to
 *     its `role="tabpanel"` region.
 *
 * Usage:
 *
 *   const tabs = useRovingTabs(detailTabs, tab, setTab, "account");
 *   <div role="tablist" aria-label="…" onKeyDown={tabs.onKeyDown}>
 *     {detailTabs.map((t) => (
 *       <button {...tabs.tabProps(t)} className={…}>{t}</button>
 *     ))}
 *   </div>
 *   <div {...tabs.panelProps(t)} className="space-y-6">…</div>
 */

import * as React from "react";

export function useRovingTabs<T extends string>(
  tabs: readonly T[],
  active: T,
  onSelect: (t: T) => void,
  /** Stable id prefix — unique per tablist on the page. */
  baseId: string,
) {
  const refs = React.useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = tabs.indexOf(active);
    if (i < 0) return;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    const t = tabs[next];
    onSelect(t);
    // Focus follows selection — without this the arrow keys would move
    // the highlight but leave focus behind on the old tab.
    refs.current[t]?.focus();
  };

  const tabId = (t: T) => `${baseId}-tab-${tabs.indexOf(t)}`;
  const panelId = (t: T) => `${baseId}-panel-${tabs.indexOf(t)}`;

  const tabProps = (t: T) =>
    ({
      ref: (el: HTMLButtonElement | null) => {
        refs.current[t] = el;
      },
      id: tabId(t),
      type: "button" as const,
      role: "tab" as const,
      "aria-selected": t === active,
      "aria-controls": panelId(t),
      tabIndex: t === active ? 0 : -1,
      onClick: () => onSelect(t),
    }) as const;

  const panelProps = (t: T) =>
    ({
      id: panelId(t),
      role: "tabpanel" as const,
      "aria-labelledby": tabId(t),
      // The panel is a composite widget region — make it focus-reachable
      // so keyboard users land inside it after the tab strip (panels here
      // may render static text with no focusable children).
      tabIndex: 0,
    }) as const;

  return { onKeyDown, tabProps, panelProps };
}
