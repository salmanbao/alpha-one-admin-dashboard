"use client";

/**
 * PFaaS Platform — Async Mock Layer
 *
 * Frontend-first development: screens must demonstrate real async state
 * (loading → loaded / error + retry) even though no backend exists yet.
 * This module simulates network latency and transient failures so the
 * UX constitution's mandatory loading/empty/error states are exercised
 * rather than dead code. When the backend lands, swap `mockAsync` for
 * the real fetch — `useAsyncMock`'s contract (data/loading/error/retry)
 * is the seam.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface MockAsyncOptions {
  /** Simulated round-trip latency in ms (default 350–700ms jitter). */
  delayMs?: number;
  /**
   * Probability [0..1] that the call rejects (default 0 — deterministic
   * success so screens are demoable; pass e.g. 0.25 to exercise the
   * error + retry path).
   */
  failRate?: number;
}

const jitter = (base: number, spread: number) => base + (Math.random() - 0.5) * 2 * spread;

/**
 * Demo failure flag — read once at boot from `?mockFail=<rate>` so the
 * error + retry states are reviewable deterministically (a full page load
 * with `?mockFail=1` puts every data page into its error state; Retry then
 * re-runs the call and fails again, simulating an outage until the flag is
 * removed). Absent the flag, calls succeed deterministically.
 */
const DEMO_FAIL_RATE: number | undefined = (() => {
  if (typeof window === "undefined") return undefined;
  const raw = new URLSearchParams(window.location.search).get("mockFail");
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 1;
})();

/**
 * Demo latency override — `?mockDelay=<ms>` forces every call's round-trip
 * (overriding per-page delays) so the loading skeleton stays on screen long
 * enough to review or screenshot. Absent, each call uses its page's delay
 * (or the 350–700ms default jitter).
 */
const DEMO_DELAY_MS: number | undefined = (() => {
  if (typeof window === "undefined") return undefined;
  const raw = new URLSearchParams(window.location.search).get("mockDelay");
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
})();

/** Resolve `data` after a simulated network round-trip. */
export function mockAsync<T>(
  data: T | (() => T),
  options: MockAsyncOptions = {},
): Promise<T> {
  const { delayMs, failRate = DEMO_FAIL_RATE ?? 0 } = options;
  const ms =
    DEMO_DELAY_MS ?? (delayMs !== undefined ? delayMs : Math.round(jitter(525, 175)));
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failRate) {
        reject(new Error("Network error — the platform API did not respond."));
        return;
      }
      try {
        resolve(typeof data === "function" ? (data as () => T)() : data);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }, ms);
  });
}

export interface AsyncMockState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  /** Re-run the loader (keeps previous data visible while refetching). */
  retry: () => void;
}

/**
 * Run an async mock loader with full state handling.
 *
 * ```tsx
 * const { data, loading, error, retry } = useAsyncMock(
 *   () => mockAsync(() => getConsoleSessions(), { delayMs: 400 }),
 *   [],
 * );
 * if (loading) return <LoadingState />;
 * if (error) return <ErrorState description={error.message} onRetry={retry} />;
 * ```
 */
export function useAsyncMock<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  options: { keepPreviousData?: boolean } = {},
): AsyncMockState<T> {
  const { keepPreviousData = true } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    if (!keepPreviousData) setData(undefined);
    loaderRef
      .current()
      .then((value) => {
        if (cancelled || !mounted.current) return;
        setData(value);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled || !mounted.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { data, loading, error, retry };
}
