"use client";

/**
 * PFaaS Platform — Status badge helpers
 *
 * Standardized status / tone badges used across modules for trader
 * states, payout states, breach severities, kyc, support, etc.
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "muted";

const toneClass: Record<Tone, string> = {
  default: "bg-muted text-foreground",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  muted: "bg-muted text-muted-foreground",
};

const toneLabel: Record<Tone, string> = {
  default: "neutral status",
  success: "success status",
  warning: "warning status",
  danger: "critical status",
  info: "informational status",
  muted: "muted status",
};

export function StatusBadge({
  tone = "default",
  children,
  className,
  label,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  /** Accessible label override; defaults to tone description + children */
  label?: string;
}) {
  const ariaLabel = label ?? `${toneLabel[tone]}: ${typeof children === "string" ? children : ""}`.trim();
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", toneClass[tone], className)}
      role="status"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {children}
    </Badge>
  );
}

export function traderStatusTone(status: string): Tone {
  switch (status) {
    case "active": return "success";
    case "invited": return "info";
    case "suspended": return "warning";
    case "breached": return "danger";
    default: return "muted";
  }
}

export function payoutStatusTone(status: string): Tone {
  switch (status) {
    case "paid": return "success";
    case "approved":
    case "processing": return "info";
    case "pending": return "warning";
    case "rejected": return "danger";
    default: return "muted";
  }
}

export function kycStatusTone(status: string): Tone {
  switch (status) {
    case "approved": return "success";
    case "review": return "info";
    case "pending": return "warning";
    case "rejected":
    case "expired": return "danger";
    default: return "muted";
  }
}

export function breachSeverityTone(sev: string): Tone {
  return sev === "critical" ? "danger" : "warning";
}

export function campaignStatusTone(status: string): Tone {
  switch (status) {
    case "active": return "success";
    case "paused": return "warning";
    case "draft": return "muted";
    case "completed": return "info";
    default: return "muted";
  }
}

export function ticketPriorityTone(p: string): Tone {
  switch (p) {
    case "urgent": return "danger";
    case "high": return "warning";
    case "medium": return "info";
    default: return "muted";
  }
}

export function ticketStatusTone(s: string): Tone {
  switch (s) {
    case "open": return "warning";
    case "in-progress": return "info";
    case "waiting": return "muted";
    case "resolved":
    case "closed": return "success";
    default: return "muted";
  }
}

/** Format currency compactly. */
export function formatCurrency(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 100 ? 2 : 0,
  }).format(value);
}

/** Format compact numbers like 12.4k */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
