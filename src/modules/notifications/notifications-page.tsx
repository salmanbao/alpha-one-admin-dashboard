"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/platform/status";

export function NotificationsPage() {
  const { notifications, markAllRead, markRead, navigate } = usePlatform();
  return (
    <Page>
      <PageHeader
        title="Notifications"
        description={`${notifications.filter((n) => !n.read).length} unread`}
        icon={Bell}
        actions={<Button size="sm" variant="outline" onClick={markAllRead}><CheckCheck className="mr-1 h-4 w-4" /> Mark all read</Button>}
      />
      <PageContent>
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  markRead(n.id);
                  if (n.actionHref) navigate(n.actionHref);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40",
                  !n.read && "border-primary/40 bg-primary/5",
                )}
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      n.severity === "critical" ? "var(--destructive)" :
                      n.severity === "warning" ? "#ea580c" :
                      n.severity === "success" ? "#16a34a" : "var(--brand-primary)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.module ? <StatusBadge tone="muted" className="text-[10px]">{n.module}</StatusBadge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {!n.read ? <Check className="h-3 w-3 text-muted-foreground" /> : null}
              </button>
            ))
          )}
        </div>
      </PageContent>
    </Page>
  );
}
