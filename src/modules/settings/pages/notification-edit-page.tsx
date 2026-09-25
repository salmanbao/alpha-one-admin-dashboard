"use client";

/**
 * Notification Edit / Create page (UX Constitution §12, §25-27).
 *
 * Create/edit form for a scheduled notification. Reached from the
 * Notifications Management page (row click or "Add Notification" button).
 *
 * Layout:
 *  - Basic Information: Title, Content, Is Active, Priority
 *  - Time Settings: Start Date/Time, End Date/Time
 *  - User Segment (collapsible §12): targeting rules — same shape as the
 *    offer edit form (account purchased, competition user, has approved
 *    payout, fund accounts only, has failed accounts, account size min/max)
 *  - Preview area: how the notification card will appear in the trader
 *    dashboard
 *  - Action buttons: Save / Save & add another / Save & continue editing /
 *    Delete (AlertDialog)
 *
 * Pre-fills from an existing notification when router.params.id resolves
 * to one; otherwise renders an empty "new notification" form. All form
 * state lives in local useState.
 *
 * Terra palette — emerald/amber/rose accents, no blue/indigo.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { StatusBadge } from "@/components/platform/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Bell,
  Save,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Settings2,
  Calendar,
  Eye,
} from "lucide-react";
import { NOTIFICATIONS, type ScheduledNotification } from "./notifications-management-page";

/* ------------------------------------------------------------------ */
/* Segment rules (shared shape with offer edit form)                   */
/* ------------------------------------------------------------------ */

const TRI_STATE = ["any", "yes", "no"] as const;
type TriState = (typeof TRI_STATE)[number];

interface SegmentRules {
  accountPurchased: TriState;
  competitionUser: TriState;
  hasApprovedPayout: TriState;
  fundAccountsOnly: TriState;
  hasFailedAccounts: TriState;
  accountSizeMin: string;
  accountSizeMax: string;
}

const EMPTY_SEGMENT: SegmentRules = {
  accountPurchased: "any",
  competitionUser: "any",
  hasApprovedPayout: "any",
  fundAccountsOnly: "any",
  hasFailedAccounts: "any",
  accountSizeMin: "",
  accountSizeMax: "",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function triStateLabel(s: TriState): string {
  return s === "any" ? "Any" : s === "yes" ? "Yes" : "No";
}

/** Splits an ISO timestamp into its date and time components for <input>. */
function splitIso(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-start gap-2">
        {Icon ? (
          <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
            <Icon className="h-4 w-4 text-foreground" />
          </div>
        ) : null}
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function NotificationEditPage() {
  const { router, navigate } = usePlatform();
  const id = router.params.id ?? "";
  const existing = useMemo(
    () => (id ? NOTIFICATIONS.find((n) => n.id === id) : undefined),
    [id],
  );
  const isNew = !existing;

  const startParts = splitIso(existing?.startTime ?? "");
  const endParts = splitIso(existing?.endTime ?? "");

  const [title, setTitle] = useState(existing?.title ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [priority, setPriority] = useState<string>(
    existing ? String(existing.priority) : "5",
  );
  const [startDate, setStartDate] = useState(startParts.date);
  const [startTime, setStartTime] = useState(startParts.time || "09:00");
  const [endDate, setEndDate] = useState(endParts.date);
  const [endTime, setEndTime] = useState(endParts.time || "17:00");
  const [segmentOpen, setSegmentOpen] = useState(false);
  // Round 7 fix: load existing.segment if present so editing a
  // notification that had targeting rules doesn't silently reset all
  // rules to "any" (previously the initializer always used EMPTY_SEGMENT).
  const [segment, setSegment] = useState<SegmentRules>(() =>
    existing?.segment ? { ...EMPTY_SEGMENT, ...existing.segment } as SegmentRules : EMPTY_SEGMENT,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);

  const setSegmentField = <K extends keyof SegmentRules>(
    key: K,
    value: SegmentRules[K],
  ) => setSegment((s) => ({ ...s, [key]: value }));

  const resetForm = () => {
    setTitle("");
    setContent("");
    setIsActive(true);
    setPriority("5");
    setStartDate("");
    setStartTime("09:00");
    setEndDate("");
    setEndTime("17:00");
    setSegment(EMPTY_SEGMENT);
  };

  const onSave = () => {
    toast({
      title: "Notification saved",
      description: `${title || "Untitled notification"} was saved successfully.`,
    });
  };

  const onSaveAndAdd = () => {
    toast({
      title: "Notification saved",
      description: `${title || "Untitled notification"} saved. Form cleared for the next notification.`,
    });
    resetForm();
  };

  const onSaveAndContinue = () => {
    toast({
      title: "Changes saved",
      description: `${title || "Untitled notification"} updated. Continuing edits.`,
    });
  };

  const onDelete = () => {
    setDeleteOpen(false);
    toast({
      title: "Notification deleted",
      description: `${title || "Untitled notification"} was permanently deleted.`,
    });
    navigate("notifications-management");
  };

  // Build a preview object using the current form state.
  const preview: ScheduledNotification = {
    id: existing?.id ?? "preview",
    title: title || "Untitled notification",
    content: content || "Notification content will appear here.",
    startTime: startDate && startTime ? new Date(`${startDate}T${startTime}`).toISOString() : new Date().toISOString(),
    endTime: endDate && endTime ? new Date(`${endDate}T${endTime}`).toISOString() : new Date().toISOString(),
    isActive,
    priority: Number(priority) || 0,
    targetAudience: existing?.targetAudience ?? "All Traders",
  };

  return (
    <Page>
      <PageHeader
        title={isNew ? "New Notification" : "Edit Notification"}
        description={
          isNew
            ? "Schedule a new in-dashboard notification for traders."
            : `Editing “${existing?.title ?? ""}”.`
        }
        icon={Bell}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("notifications-management")}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Notifications
          </Button>
        }
      />

      <PageContent>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* Form column */}
          <div className="flex flex-col gap-4">
            {/* Basic Information */}
            <SectionCard
              title="Basic Information"
              description="Title and content shown in the trader dashboard notification card."
              icon={Bell}
            >
              <div className="grid gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="notif-title">Title</Label>
                  <Input
                    id="notif-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. EXPO2026 deal is live"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notif-content">Content</Label>
                  <Textarea
                    id="notif-content"
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Notification body text shown to traders."
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <div className="flex flex-col">
                      <Label htmlFor="notif-active" className="cursor-pointer text-sm font-medium">
                        Is Active
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Inactive notifications are hidden from traders.
                      </span>
                    </div>
                    <Switch
                      id="notif-active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <LabelWithHelp help="Higher numbers appear first in the trader dashboard. Range 1–10.">
                      Priority
                    </LabelWithHelp>
                    <Input
                      id="notif-priority"
                      type="number"
                      min={0}
                      max={10}
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Time Settings */}
            <SectionCard
              title="Time Settings"
              description="When the notification appears and disappears in the trader dashboard."
              icon={Calendar}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="notif-start-date">Start Date</Label>
                  <Input
                    id="notif-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notif-start-time">Start Time</Label>
                  <Input
                    id="notif-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notif-end-date">End Date</Label>
                  <Input
                    id="notif-end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notif-end-time">End Time</Label>
                  <Input
                    id="notif-end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              {startDate && endDate ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  The notification will be visible from{" "}
                  <span className="font-medium text-foreground">
                    {new Date(`${startDate}T${startTime}`).toLocaleString()}
                  </span>{" "}
                  until{" "}
                  <span className="font-medium text-foreground">
                    {new Date(`${endDate}T${endTime}`).toLocaleString()}
                  </span>
                  .
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Pick both start and end dates to schedule the notification.
                </p>
              )}
            </SectionCard>

            {/* User Segment — collapsible (§12) */}
            <Collapsible open={segmentOpen} onOpenChange={setSegmentOpen}>
              <section className="rounded-lg border bg-card p-4">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-md bg-muted/60 p-1.5">
                        <Settings2 className="h-4 w-4 text-foreground" />
                      </div>
                      <div>
                        <h2 className="text-sm font-semibold text-foreground">
                          User Segment
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Optional — narrow the audience by trader attributes and account
                          properties. Empty segment applies to all traders.
                        </p>
                      </div>
                    </div>
                    {segmentOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <TriStateSelect
                      label="Account Purchased"
                      help="Restrict to traders who have or have not purchased a challenge."
                      value={segment.accountPurchased}
                      onChange={(v) => setSegmentField("accountPurchased", v)}
                    />
                    <TriStateSelect
                      label="Competition User"
                      help="Restrict to traders who have or have not participated in a competition."
                      value={segment.competitionUser}
                      onChange={(v) => setSegmentField("competitionUser", v)}
                    />
                    <TriStateSelect
                      label="Has Approved Payout"
                      help="Restrict to traders who have or have not received an approved payout."
                      value={segment.hasApprovedPayout}
                      onChange={(v) => setSegmentField("hasApprovedPayout", v)}
                    />
                    <TriStateSelect
                      label="Fund Accounts Only"
                      help="Restrict to traders currently holding a funded account."
                      value={segment.fundAccountsOnly}
                      onChange={(v) => setSegmentField("fundAccountsOnly", v)}
                    />
                    <TriStateSelect
                      label="Has Failed Accounts"
                      help="Restrict to traders who have or have not failed any challenge."
                      value={segment.hasFailedAccounts}
                      onChange={(v) => setSegmentField("hasFailedAccounts", v)}
                    />
                    <div className="flex flex-col gap-1.5">
                      <LabelWithHelp help="Minimum account size in USD the trader must hold to qualify. Blank = no minimum.">
                        Account Size Min (USD)
                      </LabelWithHelp>
                      <Input
                        type="number"
                        min={0}
                        value={segment.accountSizeMin}
                        onChange={(e) => setSegmentField("accountSizeMin", e.target.value)}
                        placeholder="e.g. 5000"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <LabelWithHelp help="Maximum account size in USD the trader may hold to qualify. Blank = no maximum.">
                        Account Size Max (USD)
                      </LabelWithHelp>
                      <Input
                        type="number"
                        min={0}
                        value={segment.accountSizeMax}
                        onChange={(e) => setSegmentField("accountSizeMax", e.target.value)}
                        placeholder="e.g. 100000"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>

            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">
                {isNew ? "Creating a new notification." : "Editing an existing notification."}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!isNew ? (
                  <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive">
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this notification?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove <span className="font-medium text-foreground">{title || "this notification"}</span> and hide it
                          from the trader dashboard. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-rose-600 hover:bg-rose-700"
                          onClick={onDelete}
                        >
                          Delete notification
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
                <Button size="sm" variant="outline" onClick={onSaveAndAdd}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Save and add another
                </Button>
                <Button size="sm" variant="outline" onClick={onSaveAndContinue}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save and continue editing
                </Button>
                <Button size="sm" onClick={onSave}>
                  <Save className="mr-1 h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </div>
          </div>

          {/* Preview column */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
            <SectionCard
              title="Preview"
              description="How this notification will appear in the trader dashboard."
              icon={Eye}
            >
              <div className="flex flex-col gap-3">
                <NotificationPreviewCard notification={preview} />
                <Separator />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>State:</span>
                  <StatusBadge tone={preview.isActive ? "success" : "muted"}>
                    {preview.isActive ? "Active" : "Inactive"}
                  </StatusBadge>
                  <span>·</span>
                  <span>Priority: <span className="font-medium text-foreground">{preview.priority}</span></span>
                  <span>·</span>
                  <span>Audience: <span className="font-medium text-foreground">{preview.targetAudience}</span></span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Preview card — simulates trader-dashboard notification              */
/* ------------------------------------------------------------------ */

function NotificationPreviewCard({
  notification,
}: {
  notification: ScheduledNotification;
}) {
  return (
    <div
      role="region"
      aria-label="Notification preview"
      className="flex items-start gap-3 rounded-lg border bg-background p-3 shadow-sm"
    >
      <div className="rounded-md bg-emerald-100 p-2 dark:bg-emerald-950/40">
        <Bell className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {notification.title}
          </p>
          {notification.priority >= 8 ? (
            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              High
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{notification.content}</p>
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs">
            Dismiss
          </Button>
          <Button size="sm" className="h-7 text-xs">
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tri-state select                                                     */
/* ------------------------------------------------------------------ */

function TriStateSelect({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: TriState;
  onChange: (v: TriState) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <LabelWithHelp help={help}>{label}</LabelWithHelp>
      <Select value={value} onValueChange={(v) => onChange(v as TriState)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TRI_STATE.map((s) => (
            <SelectItem key={s} value={s}>
              {triStateLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
