"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * SessionExpiryBanner — warns users before their session expires so
 * they can renew it instead of losing progress on critical workflows.
 *
 * Audit finding: inconsistent session expiry handling across dashboards
 * creates friction, with some screens showing clear renewal options
 * while others abruptly terminate user activity without warning.
 *
 * Renewal never leaves the page: "Renew Session" rolls the countdown in
 * place. The "Keep me signed in while active" preference (persisted in
 * localStorage) enables auto-renewal — if the user interacted with the
 * page in the last 10 minutes, the session rolls silently and a short
 * confirmation bar replaces the warning. An idle user still gets the
 * explicit warning so a forgotten tab expires on schedule.
 *
 * Expiry is graceful (audit B #4): when the countdown reaches zero the
 * banner becomes an explicit expired dialog instead of disappearing, so
 * the user is never dropped into a silently dead session. Signing out
 * carries the current location along (`/login?next=…`) so the login flow
 * can return them to exactly where they were.
 */

const AUTO_RENEW_KEY = "pfaas:session:auto-renew";
/** Input within this window counts as "actively engaged". */
const ACTIVITY_WINDOW_MS = 10 * 60_000;
/** Session flags cleared on sign-out so the app re-runs its auth gate. */
const SESSION_KEYS = ["pfaas:session", "pfaas:booted"] as const;

/**
 * Terminate the session and hand off to login, preserving where the user
 * was. The `next` target is restricted to same-app absolute paths (a
 * protocol-relative `//evil.com` or an absolute URL is dropped).
 */
function signOutPreservingContext(): void {
  const here = `${window.location.pathname}${window.location.search}`;
  try {
    for (const key of SESSION_KEYS) window.sessionStorage.removeItem(key);
  } catch {
    // Storage unavailable — the auth gate still re-runs on next load.
  }
  const safe = here.startsWith("/") && !here.startsWith("//") && !here.startsWith("/login");
  window.location.href = safe ? `/login?next=${encodeURIComponent(here)}` : "/login";
}

export function SessionExpiryBanner({
  onRenew,
  warningMinutes = 5,
  sessionDurationMinutes = 60,
}: {
  onRenew?: () => void;
  warningMinutes?: number;
  sessionDurationMinutes?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(warningMinutes * 60);
  const [countdown, setCountdown] = useState(sessionDurationMinutes * 60);
  // Auto-renewal preference (audit: extend without losing work).
  const [autoRenew, setAutoRenew] = useState(false);
  const [autoRenewedAt, setAutoRenewedAt] = useState<string | null>(null);
  const lastActivityRef = useRef(Date.now());

  // Load the persisted preference once on mount.
  useEffect(() => {
    try {
      setAutoRenew(window.localStorage.getItem(AUTO_RENEW_KEY) === "1");
    } catch {
      // Storage unavailable — preference just won't persist.
    }
  }, []);

  // Track engagement — any pointer or key input counts as activity.
  useEffect(() => {
    const touch = () => {
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 1;
        if (next <= warningMinutes * 60) {
          setIsVisible(true);
          setTimeLeft(next);
        }
        if (next <= 0) {
          clearInterval(interval);
          // Session expired — the expired dialog below takes over rather
          // than the banner vanishing into an unusable page.
          setTimeLeft(0);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [warningMinutes]);

  // Auto-renewal — when the warning hits and the preference is on AND
  // the user was active in the last 10 minutes, roll the session
  // silently instead of warning (no navigation, no lost work).
  useEffect(() => {
    if (!autoRenew || !isVisible) return;
    if (lastActivityRef.current < Date.now() - ACTIVITY_WINDOW_MS) return;
    setCountdown(sessionDurationMinutes * 60);
    setTimeLeft(warningMinutes * 60);
    setIsVisible(false);
    setAutoRenewedAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );
    onRenew?.();
  }, [autoRenew, isVisible, sessionDurationMinutes, warningMinutes, onRenew]);

  // Confirmation bar is transient — retire it after a few seconds.
  useEffect(() => {
    if (!autoRenewedAt) return;
    const t = setTimeout(() => setAutoRenewedAt(null), 10_000);
    return () => clearTimeout(t);
  }, [autoRenewedAt]);

  const handleRenew = useCallback(() => {
    setCountdown(sessionDurationMinutes * 60);
    // Reset the warning window too, otherwise a renew issued from the
    // expired dialog would leave `timeLeft` at 0 and stay stuck there.
    setTimeLeft(warningMinutes * 60);
    setIsVisible(false);
    onRenew?.();
  }, [onRenew, sessionDurationMinutes, warningMinutes]);

  const setPreference = (on: boolean) => {
    setAutoRenew(on);
    try {
      window.localStorage.setItem(AUTO_RENEW_KEY, on ? "1" : "0");
    } catch {
      // Storage unavailable — session-only preference.
    }
  };

  const preferenceToggle = (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        checked={autoRenew}
        onChange={(e) => setPreference(e.target.checked)}
        className="h-4 w-4 rounded"
        aria-label="Keep me signed in while active"
      />
      Keep me signed in while active
    </label>
  );

  // Expired — an explicit dialog, not a silent disappearance. Work in the
  // tab is untouched; the user chooses to resume or to sign out (and is
  // returned here after logging in again).
  if (timeLeft <= 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="session-expired-title"
          aria-describedby="session-expired-desc"
          className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">⏳</span>
            <h2 id="session-expired-title" className="text-lg font-semibold text-on-surface">
              Your session has expired
            </h2>
          </div>
          <p id="session-expired-desc" className="text-sm text-on-surface-variant">
            For security, the session timed out. Nothing in this tab was lost — renew to
            pick up exactly where you left off, or sign out and we&apos;ll bring you back
            to this page once you sign in again.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => signOutPreservingContext()}>
              Sign out
            </Button>
            <Button autoFocus onClick={handleRenew}>
              Renew session &amp; continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 60;

  // Warning banner hidden — show the transient auto-renew confirmation.
  if (!isVisible) {
    if (!autoRenewedAt) return null;
    return (
      <div
        role="status"
        className="fixed top-0 left-0 right-0 z-50 bg-primary px-4 py-2 text-primary-foreground shadow-lg"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            ✓ Session auto-renewed at {autoRenewedAt} — you were active, no
            work was lost.
          </p>
          {preferenceToggle}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 shadow-lg ${
        isUrgent ? "bg-rose-600 text-white" : "bg-amber-500 text-black"
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">⚠️</span>
          <div>
            <p className="font-semibold">
              Your session expires in {minutes}:{seconds.toString().padStart(2, "0")}
            </p>
            <p className="text-sm opacity-90">
              {isUrgent
                ? "Renew now to continue working without interruption."
                : "Renew now to continue working without losing progress."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {preferenceToggle}
          <Button
            size="sm"
            onClick={handleRenew}
            className={isUrgent
              ? "bg-white text-rose-600 hover:bg-gray-100"
              : "bg-black text-white hover:bg-gray-800"}
          >
            Renew Session
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => signOutPreservingContext()}
            className={isUrgent ? "text-white hover:bg-rose-700" : "text-black hover:bg-amber-600"}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
