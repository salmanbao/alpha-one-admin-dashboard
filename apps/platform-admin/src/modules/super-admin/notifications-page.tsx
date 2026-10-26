"use client";

/**
 * Notifications Page — console notification centre (docs/21 CON-33).
 *
 * The full-page centre behind the topbar bell: every platform event the
 * operator has been notified about, with severity/read filters, deep-link
 * actions into the owning console view, and read-state management that
 * shares state with the topbar dropdown (both read from `usePlatform()`).
 */

import { useMemo, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { EmptyState } from "@/components/platform/guards";
import {
  Bell,
  CheckCheck,
  Check,
  Inbox,
  AlertTriangle,
  Info,
  XCircle,
} from "lucide-react";
import { usePlatform } from "@/lib/platform/platform-context";
import type { AppNotification } from "@/lib/platform/types";

type Filter = "all" | "unread" | "critical";

const sevTone = (s: AppNotification["severity"]) =>
  s === "critical" ? "danger" : s === "warning" ? "warning" : s === "success" ? "success" : "info";

const sevIcon = (s: AppNotification["severity"]) =>
  s === "critical" ? XCircle : s === "warning" ? AlertTriangle : s === "success" ? Check : Info;

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "critical", label: "Critical" },
];

export function NotificationsPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; local
  // interactive state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { notifications, markRead, markAllRead, navigate } = usePlatform();
  const [filter, setFilter] = useState<Filter>("all");

  const unread = notifications.filter((n) => !n.read);
  const critical = notifications.filter((n) => n.severity === "critical");
  const warnings = notifications.filter((n) => n.severity === "warning");

  const visible = useMemo(() => {
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (filter === "unread") return sorted.filter((n) => !n.read);
    if (filter === "critical") return sorted.filter((n) => n.severity === "critical");
    return sorted;
  }, [notifications, filter]);

  return (
    <Page>
      <PageHeader
        title="Notifications"
        description="Platform events that need an operator's attention. Unread items stay in sync with the topbar bell."
        icon={Bell}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={markAllRead}
            disabled={unread.length === 0}
          >
            <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading notifications…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Unread" value={unread.length} icon={Inbox} tone={unread.length > 0 ? "warning" : "positive"} />
          <MetricCard label="Critical" value={critical.length} icon={XCircle} tone={critical.length > 0 ? "negative" : "positive"} />
          <MetricCard label="Warnings" value={warnings.length} icon={AlertTriangle} />
          <MetricCard label="Total" value={notifications.length} icon={Bell} />
        </div>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? "default" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={filter === "unread" ? "You're all caught up" : "No notifications here"}
            description={
              filter === "unread"
                ? "Every notification has been read."
                : filter === "critical"
                  ? "No critical events. The platform is quiet."
                  : "New platform events will appear here as they happen."
            }
            icon={Bell}
          />
        ) : (
          <div className="space-y-2">
            {visible.map((n) => {
              const SevIcon = sevIcon(n.severity);
              const canOpen = Boolean(n.actionHref);
              return (
                <Card key={n.id} className={n.read ? undefined : "border-l-2 border-l-primary"}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <SevIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{n.title}</h3>
                          <StatusBadge tone={sevTone(n.severity)}>{n.severity}</StatusBadge>
                          {n.module ? (
                            <StatusBadge tone="muted">{n.module}</StatusBadge>
                          ) : null}
                          {!n.read ? (
                            <span className="text-[10px] font-medium text-primary">UNREAD</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!n.read ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => markRead(n.id)}
                          >
                            <Check className="mr-1 h-3 w-3" /> Mark read
                          </Button>
                        ) : null}
                        {canOpen ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              markRead(n.id);
                              navigate(n.actionHref!);
                            }}
                          >
                            {n.actionLabel ?? "Open"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
