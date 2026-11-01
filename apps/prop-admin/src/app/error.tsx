"use client";

import { useState } from "react";

/**
 * Global error boundary — identical in all three dashboards (audit:
 * unified error handling). Recovery is always the same two actions
 * (Go Back / Try Again) plus "Report this issue", which records the
 * failure to a mock error-tracking store so support can correlate
 * reports across trader / prop-admin / platform-admin.
 */
function recordIssue(error?: Error) {
  try {
    const raw = window.localStorage.getItem("pfaas:error-reports");
    const log: unknown[] = raw ? JSON.parse(raw) : [];
    log.push({
      at: new Date().toISOString(),
      url: window.location.href,
      message: error?.message ?? "unknown",
      dashboard: window.location.pathname,
    });
    // Keep the last 50 reports — the mock "backend" has a bounded queue.
    window.localStorage.setItem("pfaas:error-reports", JSON.stringify(log.slice(-50)));
  } catch {
    // Storage unavailable (private mode / quota) — reporting is best-effort.
  }
}

export default function ErrorPage({ error }: { error?: Error }) {
  const [reported, setReported] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-2xl font-semibold">Something went wrong.</h1>
        <p className="text-muted-foreground">
          {error?.message
            ? `Error: ${error.message}`
            : "An unexpected error occurred in the console."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button onClick={() => window.history.back()} className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80">Go Back</button>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try Again</button>
          <button
            onClick={() => {
              recordIssue(error);
              setReported(true);
            }}
            disabled={reported}
            aria-live="polite"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            {reported ? "Reported ✓" : "Report this issue"}
          </button>
        </div>
        {reported && (
          <p className="pt-1 text-xs text-muted-foreground" role="status">
            Logged to the error report queue — our team will follow up.
          </p>
        )}
      </div>
    </div>
  );
}
