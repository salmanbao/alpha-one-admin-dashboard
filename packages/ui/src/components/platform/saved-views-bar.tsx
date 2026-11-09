"use client";

/**
 * Saved-views bar — R2-W3-05.
 *
 * The connector hub had a working saved-views UI; every other surface
 * either had none or a "Save View" button that toasted "Current filters
 * saved as a view." without saving anything. This is the shared bar:
 * optional preset chips + one pill per saved view (click to apply, × to
 * delete) + an inline save field.
 *
 * Storage stays in each app's `useSavedViews` hook (`lib/platform/
 * saved-views.ts` — one shared implementation, localStorage, per user
 * and per surface scope). This component is presentational, so a
 * surface only serializes its filter state and applies it back.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { BookmarkPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Structural twin of `SavedView` in `lib/platform/saved-views.ts`. */
export interface SavedViewLike {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: number;
}

export interface SavedViewsBarProps {
  views: SavedViewLike[];
  /** Serialized CURRENT filter state — what a save captures right now. */
  currentFilters: Record<string, string>;
  /** Apply a saved view's filters back to the page. */
  onApply: (view: SavedViewLike) => void;
  /** Persist `currentFilters` under `name`. */
  onSave: (name: string, filters: Record<string, string>) => void;
  onDelete: (id: string) => void;
  /** Quick preset chips rendered before the saved views. */
  presets?: { id: string; label: string; active: boolean; onPick: () => void; count?: number }[];
  className?: string;
}

export function SavedViewsBar({
  views,
  currentFilters,
  onApply,
  onSave,
  onDelete,
  presets,
  className,
}: SavedViewsBarProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, currentFilters);
    setName("");
    setSaving(false);
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-lg border bg-card px-3 py-2",
        className,
      )}
    >
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Views
      </span>
      {presets?.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={p.onPick}
          aria-pressed={p.active}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
            p.active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
          {typeof p.count === "number" ? <span className="ml-1 opacity-80">({p.count})</span> : null}
        </button>
      ))}
      {views.length > 0 ? <Separator orientation="vertical" className="mx-1 h-4" /> : null}
      {views.map((v) => (
        <span
          key={v.id}
          className="group inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs text-foreground"
        >
          <button type="button" onClick={() => onApply(v)} title={`Apply view “${v.name}”`}>
            {v.name}
          </button>
          <button
            type="button"
            aria-label={`Delete view ${v.name}`}
            onClick={() => onDelete(v.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {saving ? (
        <span className="ml-auto flex items-center gap-1.5">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setSaving(false);
                setName("");
              }
            }}
            placeholder="View name…"
            aria-label="Saved view name"
            className="h-7 w-40 text-xs"
          />
          <Button size="sm" className="h-7 text-xs" disabled={!name.trim()} onClick={submit}>
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              setSaving(false);
              setName("");
            }}
          >
            Cancel
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => setSaving(true)}>
          <BookmarkPlus className="mr-1 h-3.5 w-3.5" /> Save view
        </Button>
      )}
    </div>
  );
}
