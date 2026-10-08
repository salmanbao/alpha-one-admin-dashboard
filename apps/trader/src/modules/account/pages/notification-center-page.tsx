"use client";

/**
 * Notification Center — converted from stitch_screens/notification_center
 * Notification feed grouped by type with read/unread state.
 */

import { useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
} from "@/components/terra/terra-ui";
import { notifications } from "@/lib/fixtures/terra-fixtures";

const filters = ["All", "Unread", "Milestones", "Payouts", "Risk"] as const;

const typeIcon = {
  milestone: "🎯",
  payout: "💸",
  risk: "⚠️",
  system: "🛠️",
} as const;

export function NotificationCenterPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [readIds, setReadIds] = useState<string[]>([]);

  const isUnread = (id: string) =>
    notifications.find((n) => n.id === id)?.unread && !readIds.includes(id);

  const visible = notifications.filter((n) => {
    if (filter === "All") return true;
    if (filter === "Unread") return isUnread(n.id);
    if (filter === "Milestones") return n.type === "milestone";
    if (filter === "Payouts") return n.type === "payout";
    return n.type === "risk";
  });

  const unreadCount = notifications.filter((n) => isUnread(n.id)).length;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Notification Center"
        description="Account activity, milestones and alerts"
        actions={
          <>
            {unreadCount > 0 && <TerraBadge tone="error">{unreadCount} unread</TerraBadge>}
            <button
              type="button"
              onClick={() => setReadIds(notifications.map((n) => n.id))}
              className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Mark all read
            </button>
          </>
        }
      />

      <div className="flex items-center gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
              filter === f
                ? "bg-primary font-bold text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((n) => (
          <TerraCard
            key={n.id}
            className={cn("flex items-start gap-3", isUnread(n.id) && "border-l-4 border-primary")}
          >
            <span className="mt-0.5 text-xl">{typeIcon[n.type as keyof typeof typeIcon] ?? "🔔"}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-on-surface">{n.title}</p>
                <span className="text-[11px] text-on-surface-variant">
                  {new Date(n.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">{n.body}</p>
            </div>
            {isUnread(n.id) && (
              <button
                type="button"
                aria-label="Mark read"
                onClick={() => setReadIds((ids) => [...ids, n.id])}
                className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container"
              >
                ✓
              </button>
            )}
          </TerraCard>
        ))}
        {visible.length === 0 && (
          <TerraCard className="text-center text-sm text-on-surface-variant">
            No notifications in this filter.
          </TerraCard>
        )}
      </div>
    </div>
  );
}
