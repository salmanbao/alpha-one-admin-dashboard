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
 */

const AUTO_RENEW_KEY = "pfaas:session:auto-renew";
/** Input within this window counts as "actively engaged". */
const ACTIVITY_WINDOW_MS = 10 * 60_000;

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
          // Session expired - would redirect to login in real app
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
    setIsVisible(false);
    setAutoRenewedAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    );
    onRenew?.();
  }, [autoRenew, isVisible, sessionDurationMinutes, onRenew]);

  // Confirmation bar is transient — retire it after a few seconds.
  useEffect(() => {
    if (!autoRenewedAt) return;
    const t = setTimeout(() => setAutoRenewedAt(null), 10_000);
    return () => clearTimeout(t);
  }, [autoRenewedAt]);

  const handleRenew = useCallback(() => {
    setCountdown(sessionDurationMinutes * 60);
    setIsVisible(false);
    onRenew?.();
  }, [onRenew, sessionDurationMinutes]);

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

  if (timeLeft <= 0) return null;

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
            onClick={() => {
              // In real app, redirect to logout
              window.location.href = "/login";
            }}
            className={isUrgent ? "text-white hover:bg-rose-700" : "text-black hover:bg-amber-600"}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
