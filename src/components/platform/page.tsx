"use client";

/**
 * PFaaS Platform — Page primitives
 *
 * Spec section 41, 42. Standardized Page / PageHeader / PageToolbar /
 * PageContent + EntityHeader / EntityTabs for detail pages.
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4 p-4 md:p-6", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  term,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
  term?: string;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="rounded-lg border bg-muted p-2">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
        ) : null}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
          {term ? (
            <p className="mt-0.5 text-xs text-muted-foreground/70">{term}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      {children}
    </div>
  );
}

export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

export function EntityHeader({
  title,
  subtitle,
  avatar,
  badges,
  actions,
}: {
  title: string;
  subtitle?: string;
  avatar?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        {avatar}
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/* Stat / metric card (spec section 24 — Metric category) */
export function MetricCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const toneColor =
    tone === "positive" ? "#059669" : tone === "negative" ? "#e11d48" : tone === "warning" ? "#d97706" : "var(--brand-primary)";
  const deltaClass = delta === undefined ? "" : delta >= 0 ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      {/* Accent strip on the left */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: toneColor }} />
      <div className="flex items-start justify-between pl-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {delta !== undefined || deltaLabel ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              {delta !== undefined ? (
                <span className={`inline-flex items-center gap-0.5 font-semibold ${deltaClass}`}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
                </span>
              ) : null}
              {deltaLabel ? (
                <span className="text-muted-foreground/80">{deltaLabel}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div className="ml-2 shrink-0 rounded-md bg-muted/50 p-1.5 transition-colors group-hover:bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" style={{ color: toneColor }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

