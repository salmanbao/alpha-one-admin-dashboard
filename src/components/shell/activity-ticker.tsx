"use client";

/**
 * PFaaS Platform — Activity Ticker
 *
 * A compact, auto-rotating strip in the topbar showing the latest
 * platform events. Aggregated across modules.
 *
 * Wired to the seeded `auditLog` so every ticker event corresponds to a
 * real audit entry — no fabricated names. Each item shows
 *   "<actor-first-name + last-initial> <verb> <entity> · <relative-time>"
 * and the tone is derived from the audit entry's `severity`.
 */

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  Wallet,
  UserPlus,
  ShieldCheck,
  Brain,
  Zap,
} from "lucide-react";
import { auditLog } from "@/lib/platform/mock-data";
import type { AuditEntry } from "@/lib/platform/types";

/** Render an actor name as "First L." (Tom Allen → "Tom A."). */
function shortActor(name: string): string {
  if (!name) return "System";
  if (name.toLowerCase() === "system") return "System";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/**
 * Compact the canonical "Approved payout" action into a present-tense
 * verb-led phrase that reads naturally in a ticker line.
 */
function describeAction(action: string, summary: string): string {
  // The seeded actions ("Approved payout", "Updated risk config", …) are
  // already past-tense; surface them as-is and let the relative-time
  // suffix carry the recency. If an audit entry's `summary` adds more
  // entity context (e.g. "Approved payout on payout"), prefer the action.
  return summary || action;
}

const ICON_FOR_ACTION: Record<string, React.ComponentType<{ className?: string }>> = {
  payout: Wallet,
  risk: AlertTriangle,
  challenge: TrendingUp,
  trader: UserPlus,
  settings: Zap,
  breach: AlertTriangle,
  kyc: ShieldCheck,
};

const TONE_FOR_SEVERITY: Record<AuditEntry["severity"], "info" | "success" | "warning"> = {
  info: "info",
  warning: "warning",
  critical: "warning",
};

const toneColor: Record<"info" | "success" | "warning", string> = {
  info: "text-emerald-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
};

/** Local relative-time helper — matches the pattern in support/ai pages. */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface TickerItem {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  tone: "info" | "success" | "warning";
}

/** Build ticker items from the most recent audit entries (across tenants). */
function buildTickerItems(limit = 8): TickerItem[] {
  // Take the most recent entries by timestamp (auditLog is seeded
  // chronologically ascending — newest first is `reverse()`).
  const recent = [...auditLog].reverse().slice(0, limit);
  return recent.map((a) => {
    const Icon = ICON_FOR_ACTION[a.entity ?? a.action] ?? TrendingUp;
    const text = `${shortActor(a.actor)} — ${describeAction(a.action, a.summary)} · ${relativeTime(a.timestamp)}`;
    return { icon: Icon, text, tone: TONE_FOR_SEVERITY[a.severity] };
  });
}

export function ActivityTicker() {
  const items = useMemo(() => buildTickerItems(8), []);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [items.length]);

  // Empty state — e.g. brand-new platform with no audit log yet.
  if (items.length === 0) {
    return (
      <div className="hidden h-9 items-center gap-2 overflow-hidden rounded-md border bg-muted/30 px-3 lg:flex lg:max-w-md xl:max-w-lg">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground/50" />
        </span>
        <span className="truncate text-xs text-muted-foreground">No recent activity</span>
      </div>
    );
  }

  const event = items[idx];
  const Icon = event.icon;

  return (
    <div className="hidden h-9 items-center gap-2 overflow-hidden rounded-md border bg-muted/30 px-3 lg:flex lg:max-w-md xl:max-w-lg">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneColor[event.tone]}`} />
      <span
        key={idx}
        className="truncate text-xs text-muted-foreground animate-in fade-in slide-in-from-left-2 duration-300"
      >
        {event.text}
      </span>
    </div>
  );
}
