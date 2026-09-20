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
  const toneClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
      ? "text-rose-600"
      : tone === "warning"
      ? "text-amber-600"
      : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold", toneClass)}>{value}</div>
      {delta !== undefined ? (
        <div className="mt-1 flex items-center gap-1 text-xs">
          <span className={cn("font-medium", delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {delta >= 0 ? "+" : ""}
            {delta}%
          </span>
          {deltaLabel ? (
            <span className="text-muted-foreground">{deltaLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
