"use client";

/**
 * Row selection + bulk-action bar — R2-W3-05.
 *
 * Every list surface used to hand-roll the same code: a
 * `useState<Set<string>>`, a toggleOne/toggleAll pair, an isAllSelected
 * derivation and an "N selected" toolbar. That is state management, not
 * page behaviour, so it lives here now:
 *
 *   useRowSelection(scope, rowIds)  the state — and, when `scope` is
 *                                   given, the persistence: selection
 *                                   survives a reload under
 *                                   `pfaas:selection:<scope>`, and ids
 *                                   whose rows disappeared (approved,
 *                                   filtered out) are pruned so the
 *                                   count never reports ghosts.
 *   BulkActionsBar                  the markup — count, the page's own
 *                                   action buttons (children) and a
 *                                   clear control, rendered only while
 *                                   something is selected. Pages
 *                                   declare WHAT can be done to the
 *                                   selection, never how it works.
 *
 * `scope` is the surface id ("payouts-pending", "trading-traders", …) so
 * two surfaces never share a selection. Without a scope the hook is
 * plain session state — useful for ephemeral pickers.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "pfaas:selection:";

function readSelection(scope: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + scope);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writeSelection(scope: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + scope, JSON.stringify(ids));
  } catch {
    /* quota / private mode — the selection just won't persist */
  }
}

export interface RowSelection {
  /** Ids currently selected, in the order they were selected. */
  selectedIds: string[];
  count: number;
  isSelected: (id: string) => boolean;
  /** Every id in `ids` selected? (False for an empty list.) */
  isAllSelected: (ids: string[]) => boolean;
  toggle: (id: string) => void;
  /**
   * Select exactly `ids` (replacing any previous selection), or clear
   * the selection when they are all already selected — the select-all
   * checkbox semantics both pilots used to implement by hand.
   */
  toggleAll: (ids: string[]) => void;
  replace: (ids: string[]) => void;
  clear: () => void;
}

export function useRowSelection(scope?: string, rowIds?: string[]): RowSelection {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(!scope);

  // Hydrate AFTER mount, not during the first render: SSR renders an
  // empty selection, so reading localStorage in the useState initializer
  // would mismatch the server HTML on hydration.
  useEffect(() => {
    if (!scope) return;
    const stored = readSelection(scope);
    setIds((prev) => (prev.length === 0 && stored.length > 0 ? stored : prev));
    setHydrated(true);
  }, [scope]);

  // Persist only once hydration has run — otherwise the mount write
  // would clobber the stored selection with the initial `[]`.
  useEffect(() => {
    if (!scope || !hydrated) return;
    writeSelection(scope, ids);
  }, [scope, hydrated, ids]);

  // Prune ids whose rows are gone (approved payout, filtered-out
  // trader) so "N selected" never counts ghosts. An empty `rowIds`
  // means "nothing on screen right now", not "nothing exists" — the
  // selection is left alone in that case.
  const rowKey = rowIds && rowIds.length > 0 ? rowIds.join("\u0000") : null;
  useEffect(() => {
    if (!hydrated || rowKey === null) return;
    const present = new Set(rowKey.split("\u0000"));
    setIds((prev) => {
      const next = prev.filter((id) => present.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [hydrated, rowKey]);

  const selectedSet = useMemo(() => new Set(ids), [ids]);

  return {
    selectedIds: ids,
    count: ids.length,
    isSelected: (id) => selectedSet.has(id),
    isAllSelected: (list) => list.length > 0 && list.every((id) => selectedSet.has(id)),
    toggle: (id) =>
      setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    toggleAll: (list) =>
      setIds((prev) =>
        list.length > 0 && list.every((id) => prev.includes(id)) ? [] : [...new Set(list)],
      ),
    replace: (list) => setIds(() => [...new Set(list)]),
    clear: () => setIds([]),
  };
}

export interface BulkActionsBarProps {
  /** Rows selected — renders nothing at 0. */
  count: number;
  /** Rows on screen, shown as "N of M selected" when provided. */
  total?: number;
  onClear: () => void;
  /** The surface's bulk actions (approve, suspend, export, …). */
  children: React.ReactNode;
  className?: string;
}

/**
 * Sticky-feeling bar above the list while a selection exists: count on
 * the left, the page's bulk actions in the middle, clear on the right.
 * Zero selection → nothing rendered, so the bar never occupies space
 * for single-row workflows.
 */
export function BulkActionsBar({ count, total, onClear, children, className }: BulkActionsBarProps) {
  if (count <= 0) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2",
        className,
      )}
    >
      <span className="text-sm font-medium text-foreground" aria-live="polite">
        {count} selected{typeof total === "number" ? ` of ${total}` : ""}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button type="button" variant="ghost" size="sm" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
}
