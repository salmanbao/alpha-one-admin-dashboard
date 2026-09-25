"use client";

/**
 * Notifications Management page (UX Constitution §25-27).
 *
 * Lists scheduled / targeted notifications shown in the trader dashboard.
 * Reached from the Settings → Notifications sidebar entry.
 *
 * Layout:
 *  - PageHeader with "Add Notification" primary action
 *  - KPI row: Total Notifications, Active, Scheduled, Expired
 *  - DataTable: Title, Start Time, End Time, Is Active (inline Switch),
 *    Priority (numeric, sortable), Target Audience (badge), Actions
 *    (Edit / Delete)
 *  - Search + filter by active status
 *  - Row click → opens notification-edit form
 *
 * Inline Switch toggles publish state with a confirmation toast (§13).
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { EmptyState } from "@/components/platform/guards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  Filter,
  CalendarClock,
  CheckCircle2,
  AlarmClock,
  XCircle,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & mock data                                                   */
/* ------------------------------------------------------------------ */

export interface ScheduledNotification {
  id: string;
  title: string;
  content: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  isActive: boolean;
  priority: number;
  targetAudience: "All Traders" | "Funded Only" | "New Users" | "Affiliates" | "Competition Users";
  /**
   * Optional saved segment rules (Round 7 addition). Loaded by
   * notification-edit-page so editing a notification that had targeting
   * rules doesn't silently reset to "any". Older notifications without
   * this field fall back to EMPTY_SEGMENT.
   */
  segment?: Partial<{
    accountPurchased: string;
    competitionUser: string;
    hasFundedAccounts: string;
    hasFailedAccounts: string;
    accountSizeMin: string;
    accountSizeMax: string;
  }>;
}

/** ISO date helper — N days from now (negative = past). */
function daysFromNowIso(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString();
}

export const NOTIFICATIONS: ScheduledNotification[] = [
  {
    id: "ntf-1",
    title: "EXPO2026 deal is live",
    content: "Get 40% off all challenge bundles for the next 72 hours.",
    startTime: daysFromNowIso(-2),
    endTime: daysFromNowIso(8),
    isActive: true,
    priority: 10,
    targetAudience: "All Traders",
  },
  {
    id: "ntf-2",
    title: "Payout processing maintenance",
    content: "Payouts may be delayed 24 hours during weekend maintenance.",
    startTime: daysFromNowIso(1),
    endTime: daysFromNowIso(3),
    isActive: true,
    priority: 8,
    targetAudience: "Funded Only",
  },
  {
    id: "ntf-3",
    title: "Welcome to YourFirm — start your first challenge",
    content: "Set up your trader profile and pick a challenge to begin.",
    startTime: daysFromNowIso(-15),
    endTime: daysFromNowIso(45),
    isActive: true,
    priority: 5,
    targetAudience: "New Users",
  },
  {
    id: "ntf-4",
    title: "Competition leaderboard updated",
    content: "Live leaderboard refreshes every 5 minutes during the competition.",
    startTime: daysFromNowIso(-5),
    endTime: daysFromNowIso(25),
    isActive: false,
    priority: 4,
    targetAudience: "Competition Users",
  },
  {
    id: "ntf-5",
    title: "Affiliate payout cycle closing",
    content: "Last day to claim this month's affiliate commission.",
    startTime: daysFromNowIso(2),
    endTime: daysFromNowIso(6),
    isActive: true,
    priority: 7,
    targetAudience: "Affiliates",
  },
  {
    id: "ntf-6",
    title: "Risk rule update — daily loss limits tightened",
    content: "Daily loss limit reduced from 5% to 4% on all Instant Standard accounts.",
    startTime: daysFromNowIso(-30),
    endTime: daysFromNowIso(-2),
    isActive: false,
    priority: 9,
    targetAudience: "All Traders",
  },
  {
    id: "ntf-7",
    title: "New challenge type: 3-Step Pro",
    content: "Try the new advanced 3-phase evaluation for serious traders.",
    startTime: daysFromNowIso(-1),
    endTime: daysFromNowIso(60),
    isActive: true,
    priority: 3,
    targetAudience: "All Traders",
  },
  {
    id: "ntf-8",
    title: "Holiday support hours",
    content: "Support desk will operate 8 AM – 6 PM UTC during the holidays.",
    startTime: daysFromNowIso(10),
    endTime: daysFromNowIso(20),
    isActive: false,
    priority: 2,
    targetAudience: "All Traders",
  },
];

/* ------------------------------------------------------------------ */
/* Tone helpers                                                         */
/* ------------------------------------------------------------------ */

function audienceBadgeClass(a: ScheduledNotification["targetAudience"]): string {
  switch (a) {
    case "All Traders":
      return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
    case "Funded Only":
      return "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300";
    case "New Users":
      return "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300";
    case "Affiliates":
    case "Competition Users":
    default:
      return "border-border text-muted-foreground";
  }
}

/** Returns the lifecycle state of a notification given its schedule + active flag. */
function lifecycleState(n: ScheduledNotification): "active" | "scheduled" | "expired" {
  const now = Date.now();
  const start = new Date(n.startTime).getTime();
  const end = new Date(n.endTime).getTime();
  if (!n.isActive) {
    if (now < start) return "scheduled";
    if (now > end) return "expired";
    return "scheduled"; // inactive but within window — treat as scheduled
  }
  if (now < start) return "scheduled";
  if (now > end) return "expired";
  return "active";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function NotificationsManagementPage() {
  const { navigate } = usePlatform();
  const [items, setItems] = useState<ScheduledNotification[]>(NOTIFICATIONS);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (statusFilter === "all") return items;
    return items.filter((n) => lifecycleState(n) === statusFilter);
  }, [items, statusFilter]);

  // KPIs derived from all items (regardless of filter).
  const kpis = useMemo(() => {
    const counts = { active: 0, scheduled: 0, expired: 0 };
    for (const n of items) counts[lifecycleState(n)] += 1;
    return { total: items.length, ...counts };
  }, [items]);

  const onToggleActive = (n: ScheduledNotification) => {
    setItems((list) =>
      list.map((x) => (x.id === n.id ? { ...x, isActive: !x.isActive } : x)),
    );
    toast({
      title: n.isActive ? "Notification paused" : "Notification activated",
      description: `“${n.title}” is now ${n.isActive ? "inactive" : "active"}.`,
    });
  };

  const onDelete = (n: ScheduledNotification) => {
    setItems((list) => list.filter((x) => x.id !== n.id));
    toast({
      title: "Notification deleted",
      description: `“${n.title}” was permanently deleted.`,
    });
  };

  const columns: Column<ScheduledNotification>[] = [
    {
      key: "title",
      header: "Title",
      cell: (n) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{n.title}</span>
          <span className="text-xs text-muted-foreground line-clamp-1">
            {n.content}
          </span>
        </div>
      ),
      sortValue: (n) => n.title,
    },
    {
      key: "startTime",
      header: "Start Time",
      cell: (n) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {formatDateTime(n.startTime)}
        </span>
      ),
      sortValue: (n) => n.startTime,
      width: "200px",
    },
    {
      key: "endTime",
      header: "End Time",
      cell: (n) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3 w-3" />
          {formatDateTime(n.endTime)}
        </span>
      ),
      sortValue: (n) => n.endTime,
      width: "200px",
    },
    {
      key: "isActive",
      header: "Active",
      cell: (n) => (
        <div className="flex items-center justify-center">
          <Switch
            checked={n.isActive}
            onCheckedChange={(checked) => {
              if (checked === n.isActive) return;
              onToggleActive(n);
            }}
            aria-label={`Toggle active state for ${n.title}`}
          />
        </div>
      ),
      width: "90px",
    },
    {
      key: "priority",
      header: "Priority",
      cell: (n) => (
        <span
          className={cn(
            "inline-flex h-6 min-w-8 items-center justify-center rounded px-2 text-xs font-semibold tabular-nums",
            n.priority >= 8
              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              : n.priority >= 5
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                : "bg-muted text-foreground",
          )}
        >
          {n.priority}
        </span>
      ),
      sortValue: (n) => n.priority,
      numeric: true,
      width: "100px",
    },
    {
      key: "targetAudience",
      header: "Audience",
      cell: (n) => (
        <Badge variant="outline" className={cn("text-[10px]", audienceBadgeClass(n.targetAudience))}>
          <Users className="mr-1 h-3 w-3" />
          {n.targetAudience}
        </Badge>
      ),
      sortValue: (n) => n.targetAudience,
      width: "170px",
    },
    {
      key: "actions",
      header: "",
      cell: (n) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              navigate("notification-edit", { id: n.id });
            }}
            aria-label={`Edit ${n.title}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Delete ${n.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this notification?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes <span className="font-medium text-foreground">“{n.title}”</span> from
                  the trader dashboard. Traders currently seeing the notification will no longer see it.
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={() => onDelete(n)}
                >
                  Delete notification
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ),
      width: "110px",
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Notifications"
        description="Schedule targeted in-dashboard notifications for trader audiences."
        icon={Bell}
        actions={
          <Button size="sm" onClick={() => navigate("notification-edit")}>
            <Plus className="h-4 w-4" />
            Add Notification
          </Button>
        }
      />

      <PageContent>
        {/* KPI row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Notifications"
            value={kpis.total}
            icon={Bell}
            tone="default"
          />
          <MetricCard
            label="Active"
            value={kpis.active}
            icon={CheckCircle2}
            tone="positive"
          />
          <MetricCard
            label="Scheduled"
            value={kpis.scheduled}
            icon={AlarmClock}
            tone="warning"
          />
          <MetricCard
            label="Expired"
            value={kpis.expired}
            icon={XCircle}
            tone="default"
          />
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              All Notifications
              <Badge variant="outline" className="ml-2 text-[10px]">
                {filtered.length}
              </Badge>
            </p>
            <span className="text-xs text-muted-foreground">
              Click a row to edit the notification
            </span>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications yet"
              description="Add a notification to broadcast a message to traders in the dashboard."
              hint="Tip: schedule notifications to start and end on specific dates so they don't run forever."
              action={
                <Button size="sm" onClick={() => navigate("notification-edit")}>
                  <Plus className="mr-1 h-4 w-4" /> Add Notification
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(n) => n.id}
              searchableText={(n) => `${n.title} ${n.content} ${n.targetAudience}`}
              searchPlaceholder="Search by title or content…"
              pageSize={10}
              onRowClick={(n) => navigate("notification-edit", { id: n.id })}
              toolbar={
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger size="sm" className="h-8 w-40 text-xs">
                      <SelectValue placeholder="All states" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All states</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
              emptyTitle="No notifications match"
              emptyDescription="Try a different search or filter."
            />
          )}
        </div>
      </PageContent>
    </Page>
  );
}
