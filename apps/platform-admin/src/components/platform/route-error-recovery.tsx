"use client";

import { useState, useCallback } from "react";
import { ErrorBoundary } from "./error-boundary";

/**
 * RouteErrorRecovery — wraps route-level pages with an ErrorBoundary
 * that provides a standardized recovery experience (retry + context).
 * Used in the root layout / shell of all 3 apps.
 */
export function RouteErrorRecovery({ children }: { children: React.ReactNode }) {
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    setResetKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <ErrorBoundary key={resetKey} onReset={handleReset}>
      {children}
    </ErrorBoundary>
  );
}