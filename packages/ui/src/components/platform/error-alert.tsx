"use client";

import React from "react";
import { Button } from "@pfaas/ui/button";
import { AlertTriangle, AlertCircle, RefreshCw, X, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@pfaas/ui/cn";

/**
 * ErrorAlert — standardized inline/standalone error display.
 *
 * Audit finding #4 (LOW): inconsistent error message formatting across
 * dashboards. This component ensures every error surface (boundary
 * fallbacks, inline form errors, dialog errors, destructive-dialog
 * feedback) follows the same format:
 *
 *   • Visual styling: destructive border / error container background,
 *     rounded-xl, consistent padding, icon + title + description.
 *   • Content rules: action-oriented title, clear explanation,
 *     next-step guidance, optional retry/reload links.
 *   • Accessibility: `role="alert"`, `aria-live="assertive"`,
 *     descriptive `id` links for described-by references.
 */

export interface ErrorAlertProps {
  title?: string;
  description?: React.ReactNode;
  tone?: "destructive" | "warning" | "info";
  icon?: React.ComponentType<{ className?: string }>; // override icon
  className?: string;
  children?: React.ReactNode; // extra actions / links
  id?: string;
  ariaLive?: "assertive" | "polite";
  /** Optional handlers wired into an inline action bar beneath the message. */
  onRetry?: () => void;
  onReload?: () => void;
  onReport?: () => void;
  retrying?: boolean;
  /** Help link rendered as a standard button beneath actions. */
  helpHref?: string;
  helpLabel?: string;
}

const ToneConfig = {
  destructive: {
    border: "border-destructive/40",
    bg: "bg-destructive/5",
    textTitle: "text-destructive",
    textDesc: "text-destructive/80",
    iconColor: "text-destructive",
    iconBg: "bg-destructive/10",
  },
  warning: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    textTitle: "text-amber-700 dark:text-amber-400",
    textDesc: "text-amber-700/80 dark:text-amber-400/80",
    iconColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  info: {
    border: "border-info/40",
    bg: "bg-info/5",
    textTitle: "text-info",
    textDesc: "text-info/80",
    iconColor: "text-info",
    iconBg: "bg-info/10",
  },
} as const;

export function ErrorAlert({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  tone = "destructive",
  className,
  children,
  id,
  ariaLive = "assertive",
  icon: IconOverride,
  onRetry,
  onReload,
  onReport,
  retrying,
  helpHref,
  helpLabel,
}: ErrorAlertProps) {
  const cfg = ToneConfig[tone];
  const Icon = IconOverride ?? AlertTriangle;
  const actions = (
    <>
      {onRetry ? (
        <RetryButton onClick={onRetry} loading={retrying} label="Try again" />
      ) : null}
      {onReload ? (
        <Button variant="outline" className="flex-1 gap-2" onClick={onReload}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reload page
        </Button>
      ) : null}
      {onReport ? (
        <Button variant="ghost" className="flex-1 gap-1.5" onClick={onReport}>
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          Copy error details
        </Button>
      ) : null}
      {helpHref ? (
        <a
          href={helpHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-xl border border-outline-variant px-4 py-2 text-center text-sm font-medium text-on-surface hover:bg-surface-container-low"
        >
          <ExternalLink className="mr-1 h-4 w-4 inline" aria-hidden="true" />
          {helpLabel ?? "View help guide"}
        </a>
      ) : null}
    </>
  );
  return (
    <div
      id={id}
      className={cn(
        "rounded-xl border p-4 text-sm flex flex-col sm:flex-row items-center",
        cfg.border,
        cfg.bg,
        className,
      )}
      role="alert"
      aria-live={ariaLive}
    >
      <div className="mt-0.5 h-9 w-9 shrink-0 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.iconBg }} aria-hidden="true">
        <Icon className={cn("h-5 w-5", cfg.iconColor)} />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h4 className={cn("font-headline text-base font-bold", cfg.textTitle)}>{title}</h4>
        <div className={cn("mt-1", cfg.textDesc)}>
          {description}
        </div>
      </div>
      <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto flex flex-wrap gap-2 justify-center sm:justify-end">
        {actions}
        {children ? <div className="mt-3">{children}</div> : null}
      </div>
    </div>
  );
}

/** Helper button for retry/reload actions with standard styling. */
export function RetryButton({
  onClick,
  label = "Try again",
  loading = false,
}: {
  onClick?: () => void;
  label?: string;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:bg-primary/90 transition",
        loading && "opacity-70 cursor-not-allowed",
      )}
      aria-busy={loading}
    >
      {loading ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span>Retrying…</span>
        </>
      ) : (
        <>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
