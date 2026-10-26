"use client";

/**
 * PFaaS Platform — Countdown Hook
 *
 * Millisecond countdown to a deadline (approval windows, impersonation
 * timers, session expiry). Hydration-safe: the first paint renders `null`
 * (server and client agree on the placeholder), the live value is
 * computed in an effect after mount — absolute deadlines can't match
 * between server and client render passes.
 */

import { useEffect, useState } from "react";

export function useCountdown(
  expiresAt: number | null | undefined,
  intervalMs = 1000,
): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(Math.max(0, expiresAt - Date.now()));
    tick();
    const t = setInterval(tick, intervalMs);
    return () => clearInterval(t);
  }, [expiresAt, intervalMs]);

  return remaining;
}

/** `9:59` while ticking, `—:—` before mount / without a deadline, `0:00` once passed. */
export function formatCountdown(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—:—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Relative-time label for timestamps: `3m ago`, `2h ago`, `3d ago`. */
export function timeAgo(at: number, nowMs: number = Date.now()): string {
  const diff = Math.max(0, nowMs - at);
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
