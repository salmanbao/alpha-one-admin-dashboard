"use client";

import { useState, useCallback } from "react";
import { ErrorBoundary } from "./error-boundary";

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
