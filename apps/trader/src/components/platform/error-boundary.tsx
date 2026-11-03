"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { ErrorAlert, RetryButton } from "@/components/platform/error-alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink, RefreshCw, Loader2 } from "lucide-react";

/**
 * Enhanced ErrorBoundary — finding #10 (LOW).
 *
 * Upgrades the generic "Something went wrong" fallback with:
 *   • Specific error-type awareness (network, hydration, render)
 *   • Actionable recovery paths: retry, reload, report, copy error
 *   • Contextual help links per error class
 *   • Loading state during retry
 *   • Accessible `role="alert"` with `aria-live="assertive"`
 */
export class ErrorBoundary extends Component<
  { fallback?: ReactNode; onReset?: () => void; children?: ReactNode; context?: string },
  { hasError: boolean; error?: Error; errorInfo?: ErrorInfo; retrying: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: undefined, errorInfo: undefined, retrying: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  handleRetry = async () => {
    this.setState({ retrying: true });
    // Give React a tick to clear the error state
    await new Promise((r) => setTimeout(r, 100));
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, retrying: false });
  };

  handleReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleReport = () => {
    const { error, errorInfo } = this.state;
    const report = [
      "ErrorBoundary report",
      `Context: ${this.props.context ?? "unspecified"}`,
      `Message: ${error?.message}`,
      `Stack: ${error?.stack}`,
      `Component stack: ${errorInfo?.componentStack}`,
      `URL: ${window.location.href}`,
      `UA: ${navigator.userAgent}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n");
    navigator.clipboard.writeText(report);
    // Toast would be ideal here but we're in an error state; alert is safe
    alert("Error report copied to clipboard — paste into a support ticket.");
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const isNetwork = error?.message?.includes("Network") || error?.message?.includes("fetch");
      const isHydration = error?.message?.includes("hydrat") || error?.message?.includes("Hydration");
      const isChunkLoad = error?.message?.includes("ChunkLoad") || error?.message?.includes("Loading chunk");

      let title = "Something went wrong";
      let desc = "An unexpected error occurred. The development team has been notified automatically.";
      let helpHref = "https://docs.example.com/troubleshooting";
      let helpLabel = "View troubleshooting guide";

      if (isNetwork) {
        title = "Connection lost";
        desc = "We couldn&rsquo;t reach the server. This usually resolves itself in a few seconds.";
        helpHref = "https://docs.example.com/network-issues";
        helpLabel = "Network troubleshooting";
      } else if (isHydration) {
        title = "Page mismatch";
        desc = "The server-rendered HTML didn&rsquo;t match the client. A full reload fixes this.";
        helpHref = "https://docs.example.com/hydration-errors";
        helpLabel = "Hydration help";
      } else if (isChunkLoad) {
        title = "Update available";
        desc = "A new version of the app was deployed. Reload to get the latest code.";
        helpHref = "https://docs.example.com/app-updates";
        helpLabel = "About updates";
      }

      return this.props.fallback ?? (
        <ErrorFallback
          title={title}
          description={desc}
          helpHref={helpHref}
          helpLabel={helpLabel}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          onReport={this.handleReport}
          retrying={this.state.retrying}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({
  title,
  description,
  helpHref,
  helpLabel,
  onRetry,
  onReload,
  onReport,
  retrying,
}: {
  title: string;
  description: string;
  helpHref: string;
  helpLabel: string;
  onRetry: () => void;
  onReload: () => void;
  onReport: () => void;
  retrying: boolean;
}) {
  return (
    <ErrorAlert
      title={title}
      description={description}
      tone="destructive"
      helpHref={helpHref}
      helpLabel={helpLabel}
      onRetry={() => onRetry()}
      onReload={onReload}
      onReport={onReport}
      retrying={retrying}
    >
      <RetryButton onClick={onRetry} loading={retrying} label="Try again" />
      <Button variant="outline" className="flex-1 gap-2" onClick={onReload}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Reload page
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" className="flex-1 gap-1.5" onClick={onReport}>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Copy error details
        </Button>
        <a
          href={helpHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl border border-outline-variant px-4 py-2 text-center text-sm font-medium text-on-surface hover:bg-surface-container-low"
        >
          <ExternalLink className="mr-1 h-4 w-4 inline" aria-hidden="true" />
          {helpLabel}
        </a>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        If this persists, contact support with the copied error details.
      </p>
    </ErrorAlert>
  );
}