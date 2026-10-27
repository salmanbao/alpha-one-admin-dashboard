"use client";

/**
 * PFaaS Platform — Dynamic Navigation Badges
 *
 * PRD §4.6.2 — the sidebar shows live count badges on nav items
 * (pending_evaluations, pending_payouts, pending_kyc, critical_risk_cases,
 * open_tickets). Navigation items themselves are static manifest data, so
 * modules push their live counts into this platform-level store instead of
 * the shell importing module stores directly (no shell → module coupling).
 *
 * Pattern mirrors the session stores (payout-store, kyc-store): a module
 * calls `setNavBadge(viewId, count)` whenever its pending count changes;
 * the sidebar subscribes via `useNavBadges()` and re-renders the badge.
 * A count of 0 removes the badge (no "0" clutter).
 */

import { useEffect, useState } from "react";

const badges = new Map<string, number>();
const listeners = new Set<() => void>();

/** Set (or clear, when 0) the live count badge for a nav href/view id. */
export function setNavBadge(key: string, count: number): void {
  const next = Math.max(0, Math.floor(count));
  const prev = badges.get(key) ?? 0;
  if (prev === next) return;
  if (next === 0) badges.delete(key);
  else badges.set(key, next);
  listeners.forEach((l) => l());
}

/** Current count for a key, if any (for one-off reads outside React). */
export function getNavBadge(key: string): number | undefined {
  return badges.get(key);
}

/**
 * Subscribe a component to badge changes. Returns a fresh map snapshot
 * on every mutation so `badges.get(href)` always reflects the latest.
 */
export function useNavBadges(): ReadonlyMap<string, number> {
  const [snapshot, setSnapshot] = useState<ReadonlyMap<string, number>>(
    () => new Map(badges),
  );
  useEffect(() => {
    const listener = () => setSnapshot(new Map(badges));
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot;
}
