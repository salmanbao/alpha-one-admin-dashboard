"use client";

/**
 * Notification Center — converted from stitch_screens/notification_center
 * Notification feed grouped by type with read/unread state.
 * Adds the M11 "Communication History Log": cross-channel
 * (email / SMS / push) delivery history for this trader.
 */

import { useState } from "react";
import { cn } from "@pfaas/ui";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  type TerraTone,
} from "@/components/terra/terra-ui";
import { communicationLog, notifications } from "@/lib/fixtures/terra-fixtures";
import { DetailDialog } from "@/components/terra/detail-dialog";

const filters = ["All", "Unread", "Milestones", "Payouts", "Risk"] as const;
const modes = ["In-App Feed", "Communication History"] as const;
const channels = ["All", "Email", "SMS", "Push"] as const;

/** Contextual deep link per notification type (preview → related screen). */
const notifAction: Record<string, { href: string; label: string }> = {
  milestone: { href: "/objectives", label: "View objectives →" },
  payout: { href: "/payout-history", label: "View payout history →" },
  risk: { href: "/risk-dashboard", label: "Open risk dashboard →" },
  system: { href: "/help-center", label: "Open help center →" },
};

const typeIcon = {
  milestone: "🎯",
  payout: "💸",
  risk: "⚠️",
  system: "🛠️",
} as const;

const channelIcon = {
  email: "✉️",
  sms: "💬",
  push: "📲",
} as const;

const statusTone: Record<string, TerraTone> = {
  opened: "success",
  delivered: "primary",
  sent: "tertiary",
};

export function NotificationCenterPage() {
  const [mode, setMode] = useState<(typeof modes)[number]>("In-App Feed");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [channel, setChannel] = useState<(typeof channels)[number]>("All");
  const [readIds, setReadIds] = useState<string[]>([]);
  // Quick-view overlay: a notification opens in a preview dialog on top
  // of the feed (read-and-dismiss with a contextual action).
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId
    ? (notifications.find((n) => n.id === detailId) ?? null)
    : null;

  const isUnread = (id: string) =>
    notifications.find((n) => n.id === id)?.unread && !readIds.includes(id);

  const visible = notifications.filter((n) => {
    if (filter === "All") return true;
    if (filter === "Unread") return isUnread(n.id);
    if (filter === "Milestones") return n.type === "milestone";
    if (filter === "Payouts") return n.type === "payout";
    return n.type === "risk";
  });

  const commsVisible = communicationLog.filter((c) =>
    channel === "All" ? true : c.channel === channel.toLowerCase(),
  );

  const unreadCount = notifications.filter((n) => isUnread(n.id)).length;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Notification Center"
        description="Account activity, milestones and alerts — plus every email, SMS and push we've sent you"
        actions={
          <>
            {mode === "In-App Feed" && unreadCount > 0 && (
              <TerraBadge tone="error">{unreadCount} unread</TerraBadge>
            )}
            {mode === "In-App Feed" && (
              <button
                type="button"
                onClick={() => setReadIds(notifications.map((n) => n.id))}
                className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Mark all read
              </button>
            )}
          </>
        }
      />

      {/* Mode: in-app feed vs cross-channel communication history (M11) */}
      <div className="flex items-center gap-1 rounded-lg bg-surface-container-low p-1">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md px-4 py-1.5 text-xs font-semibold transition-all",
              mode === m
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "In-App Feed" ? (
        <>
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
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => setDetailId(n.id)}
                      className="text-left text-sm font-bold text-on-surface hover:text-primary"
                    >
                      {n.title}
                    </button>
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
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {channels.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChannel(c)}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                    channel === c
                      ? "bg-primary font-bold text-on-primary shadow-sm"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs font-semibold text-on-surface-variant">
              {commsVisible.length} messages
            </span>
          </div>

          <TerraCard>
            <TerraSectionTitle
              title="Cross-channel delivery log"
              description="Transactional emails, SMS and push notifications triggered by your trading activity."
            />
            <div className="space-y-3">
              {commsVisible.map((c) => (
                <div
                  key={c.id}
                  className="flex items-start gap-3 rounded-xl bg-surface-container-low px-4 py-3"
                >
                  <span className="mt-0.5 text-xl">{channelIcon[c.channel]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-sm font-bold text-on-surface">{c.subject}</p>
                      <span className="text-[11px] text-on-surface-variant">
                        {new Date(c.at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{c.body}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <TerraBadge tone="neutral">{c.channel}</TerraBadge>
                      <TerraBadge tone={statusTone[c.status]} dot={c.status === "opened"}>
                        {c.status}
                      </TerraBadge>
                    </div>
                  </div>
                </div>
              ))}
              {commsVisible.length === 0 && (
                <p className="rounded-xl bg-surface-container-low px-4 py-6 text-center text-sm text-on-surface-variant">
                  No messages on this channel.
                </p>
              )}
            </div>
          </TerraCard>
        </>
      )}

      {/* Quick-view overlay — preview a notification in place */}
      <DetailDialog
        open={detail !== null}
        onOpenChange={(o) => {
          if (!o) setDetailId(null);
        }}
        title={detail ? detail.title : "Notification"}
        description={
          detail
            ? `${detail.type} • ${new Date(detail.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : undefined
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4">
              <span className="text-2xl">
                {typeIcon[detail.type as keyof typeof typeIcon] ?? "🔔"}
              </span>
              <div className="flex-1">
                <p className="text-sm text-on-surface">{detail.body}</p>
                {isUnread(detail.id) && (
                  <TerraBadge tone="primary" dot className="mt-2">
                    Unread
                  </TerraBadge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={notifAction[detail.type]?.href ?? "/notification-center"}
                onClick={() => setDetailId(null)}
                className="text-xs font-bold text-primary hover:underline"
              >
                {notifAction[detail.type]?.label ?? "Open related screen →"}
              </Link>
              {isUnread(detail.id) && (
                <button
                  type="button"
                  onClick={() => setReadIds((ids) => [...ids, detail.id])}
                  className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container"
                >
                  ✓ Mark read
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDialog>
    </div>
  );
}
