"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

export class ErrorBoundary extends Component<
  { fallback?: ReactNode; onReset?: () => void; children?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === "production") {
      // TODO: integrate with error monitoring (Sentry, etc.)
      console.error("Error caught by ErrorBoundary:", error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <ErrorFallback onReset={this.props.onReset} />;
    }
    return this.props.children;
  }
};

/** Standardized error fallback UI shown when a boundary catches an error */
function ErrorFallback({ onReset }: { onReset?: () => void }) {
  return (
    <div className="rounded-2xl border bg-error-container/30 p-8 text-center" role="alert">
      <div className="mx-auto h-16 w-16 items-center justify-center rounded-full bg-error-container/20 text-error mb-6" aria-hidden="true">
        <svg
          className="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="font-headline text-xl font-bold text-error mb-2">Something went wrong</h3>
      <p className="text-on-error-container/80 mb-6">
        An unexpected error occurred. The development team has been notified.
      </p>
      <button
        onClick={onReset}
        className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
      >
        Try Again
      </button>
    </div>
  );
}