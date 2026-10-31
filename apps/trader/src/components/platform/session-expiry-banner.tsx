"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

/**
 * SessionExpiryBanner — warns users before their session expires so
 * they can renew it instead of losing progress on critical workflows.
 * 
 * Audit finding: inconsistent session expiry handling across dashboards
 * creates friction, with some screens showing clear renewal options
 * while others abruptly terminate user activity without warning.
 */
export function SessionExpiryBanner({ 
  onRenew, 
  warningMinutes = 5,
  sessionDurationMinutes = 60 
}: {
  onRenew?: () => void;
  warningMinutes?: number;
  sessionDurationMinutes?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(warningMinutes * 60);
  const [countdown, setCountdown] = useState(sessionDurationMinutes * 60);

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

  const handleRenew = useCallback(() => {
    setCountdown(sessionDurationMinutes * 60);
    setIsVisible(false);
    onRenew?.();
  }, [onRenew, sessionDurationMinutes]);

  if (!isVisible || timeLeft <= 0) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isUrgent = timeLeft <= 60;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 shadow-lg ${
        isUrgent ? "bg-rose-600 text-white" : "bg-amber-500 text-black"
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
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
        <div className="flex items-center gap-2">
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
