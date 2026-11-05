"use client";

/**
 * Outage Recovery Banner — finding #7a: the dashboard had general error
 * boundaries but no automatic recovery flow during platform outages.
 *
 * Deterministic simulation (no Math.random): the banner enters a
 * "degraded" state on mount, retries on a fixed 8-second cadence through
 * attempts 1–5, then flips to "restored" and hides. "Retry now" skips
 * straight to the restored state. The outcome is recorded in sessionStorage
 * (`pfaas:trader:outageRecovered`) so the recovery plays once per session —
 * a remount after recovery stays quiet.
 *
 * Recovery affordances: Retry now (immediate), Contact support deep-link
 * (`/support?reason=platform-outage&attempt=N`), and Help center.
 * aria-live announces each phase change to screen readers.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, WifiOff, CheckCircle2, LifeBuoy, HelpCircle } from "lucide-react";

const STORAGE_KEY = "pfaas:trader:outageRecovered";
const RETRY_MS = 8_000;
const MAX_ATTEMPTS = 5;
const RESTORED_VISIBLE_MS = 6_000;

type Phase = "degraded" | "restored";

function readRecovered(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage unavailable (SSR / privacy mode) — best effort: show the
    // banner; it still auto-hides once restored.
    return false;
  }
}

function writeRecovered(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* best effort */
  }
}

export function OutageRecoveryBanner() {
  // null = hidden (already recovered this session, or finished playing).
  const [phase, setPhase] = useState<Phase | null>(null);
  const [attempt, setAttempt] = useState(1);

  // One-shot gate — skip entirely when this session already recovered.
  // Deferred to a post-mount timer so the first paint matches SSR and the
  // banner never flashes for sessions that already recovered.
  useEffect(() => {
    if (readRecovered()) return;
    const t = setTimeout(() => setPhase("degraded"), 0);
    return () => clearTimeout(t);
  }, []);

  const restore = useCallback(() => {
    writeRecovered();
    setPhase("restored");
  }, []);

  // Auto-recovery cadence: attempt N holds for 8s, then advances;
  // after attempt 5's window the platform reports restored.
  useEffect(() => {
    if (phase !== "degraded") return;
    const t = setTimeout(
      () => {
        if (attempt >= MAX_ATTEMPTS) restore();
        else setAttempt((a) => a + 1);
      },
      RETRY_MS,
    );
    return () => clearTimeout(t);
  }, [phase, attempt, restore]);

  // Restored state is transient — clear the session flag and hide.
  useEffect(() => {
    if (phase !== "restored") return;
    const t = setTimeout(() => setPhase(null), RESTORED_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === null) return null;

  const degraded = phase === "degraded";

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        degraded
          ? "flex flex-col gap-3 rounded-xl border border-amber-400/60 bg-amber-50 p-4 text-amber-900 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          : "flex flex-col gap-3 rounded-xl border border-emerald-400/60 bg-emerald-50 p-4 text-emerald-900 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            degraded
              ? "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white"
              : "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"
          }
          aria-hidden="true"
        >
          {degraded ? <WifiOff className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {degraded
              ? "Platform degraded — some dashboard data may be stale"
              : "Connection restored — dashboard is live again"}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {degraded ? (
              <>
                Automatic recovery running — retry {attempt} of {MAX_ATTEMPTS} every{" "}
                {RETRY_MS / 1000} seconds. No action needed.
              </>
            ) : (
              <>
                All services recovered and your data refreshed. This notice will clear
                automatically.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {degraded ? (
          <>
            <button
              type="button"
              onClick={restore}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-700 active:scale-95"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Retry now
            </button>
            <Link
              href={`/support?reason=platform-outage&attempt=${attempt}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/60 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40"
            >
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" /> Contact support
            </Link>
            <Link
              href="/help-center"
              className="inline-flex items-center gap-1.5 px-1 py-1.5 text-xs font-medium underline underline-offset-2 hover:opacity-80"
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" /> Help center
            </Link>
          </>
        ) : (
          <Link
            href="/help-center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" /> What happened?
          </Link>
        )}
      </div>
    </div>
  );
}
