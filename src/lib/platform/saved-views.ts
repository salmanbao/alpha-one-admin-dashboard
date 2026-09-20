"use client";

/**
 * PFaaS Platform — Saved Views System
 *
 * Spec section 52 (URL state), §23 (user customization). Persists
 * filter combinations per user to localStorage so they survive
 * page reloads. Each saved view has a name, a set of filters,
 * and optional URL params.
 */

import { useState, useCallback, useEffect } from "react";

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
  createdAt: number;
}

const STORAGE_PREFIX = "pfaas:savedViews:";

function getStorageKey(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

function loadViews(storageKey: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

/**
 * Hook to manage saved views for a given scope (e.g. "audit-log",
 * "traders", "transactions"). Views are persisted to localStorage
 * keyed by scope + user ID.
 */
export function useSavedViews(scope: string, userId: string) {
  const storageKey = getStorageKey(`${scope}:${userId}`);
  const [views, setViews] = useState<SavedView[]>(() => loadViews(storageKey));

  // Persist to localStorage whenever views change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(views));
    } catch { /* ignore quota */ }
  }, [views, storageKey]);

  const saveView = useCallback((name: string, filters: Record<string, string>) => {
    const view: SavedView = {
      id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      filters,
      createdAt: Date.now(),
    };
    setViews((prev) => [view, ...prev].slice(0, 20)); // max 20 saved views
    return view;
  }, []);

  const deleteView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const applyView = useCallback((view: SavedView): Record<string, string> => {
    return { ...view.filters };
  }, []);

  return { views, saveView, deleteView, applyView };
}
