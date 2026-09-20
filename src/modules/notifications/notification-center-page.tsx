"use client";

/**
 * PFaaS Platform — Notification Center
 *
 * Consolidated view of all notifications: platform notifications,
 * triggered price alerts, and recent live activity. Accessible from
 * the topbar bell icon and as a dedicated view.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { usePriceAlerts, type PriceAlert } from "@/components/platform/price-alerts";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import {
  Bell,
  BellRing,
  Trash2,
  CheckCheck,
  AlertTriangle,
  Activity,
  Filter,
  Users,
  ShieldAlert,
  Brain,
  Wallet,
  Target,
  Settings as SettingsIcon,
} from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

const moduleIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  payouts: Wallet,
  risk: ShieldAlert,
  kyc: Users,
  settings: SettingsIcon,
  ai: Brain,
  challenges: Target,
};

export function NotificationCenterPage() {
  const { notifications, markRead, markAllRead } = usePlatform();
  // Pull triggered price alerts from localStorage
  const { alerts, clearTriggered } = usePriceAlerts({});

  const [filter, setFilter] = useState<"all" | "unread" | "alerts" | "activity">("all");

  const triggeredAlerts = alerts.filter((a) => a.triggered);

  const allItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: "notification" | "alert" | "activity";
      title: string;
      message: string;
      timestamp: number;
      read: boolean;
      severity: "info" | "success" | "warning" | "critical";
      module?: string;
    }> = [];

    for (const n of notifications) {
      items.push({
        id: n.id,
        type: "notification",
        title: n.title,
        message: n.message,
        timestamp: new Date(n.createdAt).getTime(),
        read: n.read,
        severity: n.severity,
        module: n.module,
      });
    }

    for (const a of triggeredAlerts) {
      items.push({
        id: a.id,
        type: "alert",
        title: `Price alert: ${a.symbol}`,
        message: `${a.symbol} went ${a.direction} ${a.threshold}`,
        timestamp: a.triggeredAt ?? a.createdAt,
        read: false,
        severity: a.direction === "below" ? "critical" : "info",
        module: "trading",
      });
    }

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [notifications, triggeredAlerts]);

  const filtered = useMemo(() => {
    if (filter === "all") return allItems;
    if (filter === "unread") return allItems.filter((i) => !i.read);
    if (filter === "alerts") return allItems.filter((i) => i.type === "alert");
    if (filter === "activity") return allItems.filter((i) => i.type === "notification");
    return allItems;
  }, [allItems, filter]);

  const unreadCount = allItems.filter((i) => !i.read).length;
  const alertCount = triggeredAlerts.length;

  return (
    <Page>
      <PageHeader
        title="Notification Center"
        description={`${unreadCount} unread · ${alertCount} triggered alerts`}
        icon={Bell}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={markAllRead} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
            {triggeredAlerts.length > 0 ? (
              <Button size="sm" variant="outline" onClick={clearTriggered} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Clear alerts
              </Button>
            ) : null}
          </div>
        }
      />
      <PageContent>
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="Unread" value={unreadCount} icon={Bell} tone={unreadCount > 0 ? "warning" : "positive"} />
          <MetricCard label="Triggered Alerts" value={alertCount} icon={BellRing} tone={alertCount > 0 ? "warning" : "positive"} />
          <MetricCard label="Total Items" value={allItems.length} icon={Activity} />
          <MetricCard label="Critical" value={allItems.filter((i) => i.severity === "critical").length} icon={AlertTriangle} tone={allItems.filter((i) => i.severity === "critical").length > 0 ? "negative" : "positive"} />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {(["all", "unread", "alerts", "activity"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {f === "all" ? "All" : f}
              {f === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
              {f === "alerts" && alertCount > 0 ? ` (${alertCount})` : ""}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Bell className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">No notifications</p>
                  <p className="text-xs text-muted-foreground">
                    {filter === "all" ? "You're all caught up." : `No ${filter} items.`}
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-[60vh] divide-y">
                {filtered.map((item) => {
                  const Icon = item.type === "alert" ? BellRing : item.module ? (moduleIcon[item.module] ?? Bell) : Bell;
                  const severityColor =
                    item.severity === "critical" ? "bg-rose-500" :
                    item.severity === "warning" ? "bg-amber-500" :
                    item.severity === "success" ? "bg-emerald-500" : "bg-sky-500";
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.type === "notification") markRead(item.id);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                        !item.read && "bg-primary/5"
                      )}
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                          {!item.read ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", severityColor)} /> : null}
                          {item.type === "alert" ? <Badge variant="outline" className="text-[9px]">alert</Badge> : null}
                          {item.module ? <Badge variant="outline" className="text-[9px]">{item.module}</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground/70">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge tone={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : item.severity === "success" ? "success" : "info"}>
                        {item.severity}
                      </StatusBadge>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
