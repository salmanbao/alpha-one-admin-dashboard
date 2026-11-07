"use client";

/**
 * M4.4 — Campaign Calendar (spec §8.4).
 *
 * Month/week operational calendar of everything scheduled to send,
 * with channel filters, provider blackout windows, capacity heat
 * tint, audience-overlap conflict detection and a drafts tray that
 * drops unscheduled drafts onto a day (opening the composer at
 * step 3 with the date preselected).
 *
 * Dummy data only — reads/writes the campaign-studio store.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { EmptyState } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Pause,
  Pencil,
  Play,
  Plus,
  TriangleAlert,
} from "lucide-react";
import {
  CHANNEL_LABEL,
  dayOffset,
  getCampaign,
  listCampaigns,
  overlapPercent,
  pauseCampaign,
  resumeCampaign,
  scheduleCampaignOn,
  type Channel,
  type StudioCampaign,
} from "../campaign-studio-store";

const CHANNEL_ACCENT: Record<Channel, string> = {
  email: "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-300",
  sms: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  whatsapp: "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-300",
  push: "bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-300",
  "in-app": "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",
};

const STATUS_DOT: Record<StudioCampaign["status"], string> = {
  scheduled: "bg-sky-500",
  sent: "bg-emerald-500",
  draft: "bg-muted-foreground",
  paused: "bg-amber-500",
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Provider blackout windows (no sends) — YYYY-MM-DD pairs. */
function blackoutDays(): Set<string> {
  return new Set([dayOffset(6), dayOffset(7)]);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CampaignCalendarPage() {
  const { navigate } = usePlatform();

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [view, setView] = useState<"month" | "week">("month");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [peek, setPeek] = useState<StudioCampaign | null>(null);
  const [sendBudget, setSendBudget] = useState(6);
  const [trayOpen, setTrayOpen] = useState(true);
  const [conflict, setConflict] = useState<{
    draft: StudioCampaign;
    day: string;
    overlap: number;
    withName: string;
  } | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ draftId: string; day: string } | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("6");

  const blackouts = useMemo(() => blackoutDays(), []);
  const campaigns = listCampaigns();
  const scheduled = campaigns.filter((c) => c.day && (c.status === "scheduled" || c.status === "sent"));
  const drafts = campaigns.filter((c) => c.status === "draft");

  const filtered = channelFilter === "all" ? scheduled : scheduled.filter((c) => c.channel === channelFilter);

  /* Build the day grid */
  const days = useMemo(() => {
    const out: Date[] = [];
    if (view === "month") {
      const first = new Date(cursor);
      const startDow = (first.getDay() + 6) % 7; // Monday-first
      const start = new Date(first);
      start.setDate(first.getDate() - startDow);
      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push(d);
      }
    } else {
      const start = new Date(cursor);
      const startDow = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - startDow);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push(d);
      }
    }
    return out;
  }, [cursor, view]);

  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });
  const todayStr = ymd(new Date());

  function move(dir: -1 | 1) {
    setCursor((c) => {
      const next = new Date(c);
      if (view === "month") next.setMonth(c.getMonth() + dir);
      else next.setDate(c.getDate() + dir * 7);
      return next;
    });
  }

  function eventsFor(day: string) {
    return filtered.filter((c) => c.day === day);
  }

  /* ── Conflict-aware scheduling ── */
  function attemptSchedule(draftId: string, day: string) {
    const draft = getCampaign(draftId);
    if (!draft) return;
    if (blackouts.has(day)) {
      toast({ title: "Provider blackout", description: "That day is inside a provider maintenance window — pick another." });
      return;
    }
    const dayCampaigns = scheduled.filter((c) => c.day === day);
    let worst = 0;
    let worstName = "";
    for (const existing of dayCampaigns) {
      const pct = overlapPercent(draft, existing);
      if (pct > worst) {
        worst = pct;
        worstName = existing.name;
      }
    }
    if (worst >= 60) {
      setConflict({ draft, day, overlap: worst, withName: worstName });
      setPendingDrop(null);
      return;
    }
    applySchedule(draftId, day);
  }

  function applySchedule(draftId: string, day: string) {
    scheduleCampaignOn(draftId, day);
    const c = getCampaign(draftId);
    toast({
      title: "Draft scheduled",
      description: `${c?.name} → ${new Date(`${day}T00:00`).toDateString()} (opens composer at step 3).`,
    });
    setConflict(null);
    setPendingDrop(null);
    navigate("campaign-new", { campaign: draftId, date: day, step: "3" });
  }

  /* ── Draft drop → composer at step 3 with date preselected ── */
  function handleDraftDrop(day: string) {
    const draftId = pendingDrop?.draftId;
    if (!draftId) return;
    attemptSchedule(draftId, day);
  }

  const peekCampaigns = peek?.day ? eventsFor(peek.day) : [];

  return (
    <Page>
      <PageHeader
        title="Campaign Calendar"
        description="Everything scheduled to send — one operational view with overlap conflict detection."
        icon={CalendarIcon}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setBudgetInput(String(sendBudget)); setBudgetOpen(true); }}>
              Daily budget: {sendBudget}
            </Button>
            <div className="flex rounded-md border p-0.5">
              <button
                type="button"
                onClick={() => setView("month")}
                className={`rounded px-2.5 py-1 text-xs ${view === "month" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setView("week")}
                className={`rounded px-2.5 py-1 text-xs ${view === "week" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              >
                Week
              </button>
            </div>
            <Button size="sm" onClick={() => navigate("campaign-new")}>
              <Plus className="mr-1 h-4 w-4" /> New Campaign
            </Button>
          </div>
        }
      />

      <PageContent>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "email", "sms", "whatsapp", "push"] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  channelFilter === ch ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {ch === "all" ? "All channels" : CHANNEL_LABEL[ch]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => move(-1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => move(1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className={`grid gap-4 ${trayOpen ? "lg:grid-cols-[220px_1fr]" : ""}`}>
          {/* Drafts tray */}
          {trayOpen && (
            <Card className="lg:sticky lg:top-4 lg:self-start">
              <CardContent className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold">Unscheduled drafts</p>
                  <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]" onClick={() => setTrayOpen(false)}>
                    Hide
                  </Button>
                </div>
                {drafts.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No drafts waiting. Create one in the composer.</p>
                ) : (
                  <div className="space-y-2">
                    {drafts.map((d) => (
                      <div
                        key={d.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/draft-id", d.id);
                          setPendingDrop({ draftId: d.id, day: "" });
                        }}
                        className="cursor-grab rounded-md border bg-background p-2 active:cursor-grabbing"
                        title="Drag onto a calendar day"
                      >
                        <p className="truncate text-xs font-medium">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {CHANNEL_LABEL[d.channel]} · {d.audienceSize.toLocaleString()}
                        </p>
                      </div>
                    ))}
                    <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
                      Drag a draft onto a day — the composer opens at step 3 with that date.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!trayOpen && (
            <Button variant="ghost" size="sm" className="justify-start text-xs" onClick={() => setTrayOpen(true)}>
              <ChevronRight className="mr-1 h-3 w-3" /> Show drafts tray
            </Button>
          )}

          {/* Calendar grid */}
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <p className="text-sm font-semibold">{view === "month" ? monthLabel : `Week of ${days[0].toDateString()}`}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" /> Scheduled</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Sent</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Paused</span>
              </div>
            </div>

            {/* DOW header */}
            <div className={`grid ${view === "month" ? "grid-cols-7" : "grid-cols-7"}`}>
              {DOW.map((d) => (
                <div key={d} className="border-b border-r px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground last:border-r-0">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = ymd(d);
                const events = eventsFor(key);
                const isToday = key === todayStr;
                const inMonth = view === "week" || d.getMonth() === cursor.getMonth();
                const isBlackout = blackouts.has(key);
                const overBudget = events.length > sendBudget;
                return (
                  <div
                    key={key}
                    role="gridcell"
                    tabIndex={0}
                    aria-label={`${d.toDateString()}, ${events.length} events`}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        const cells = Array.from(
                          document.querySelectorAll<HTMLElement>('[role="gridcell"]'),
                        );
                        const idx = cells.indexOf(e.currentTarget);
                        const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 7 : -7;
                        cells[idx + delta]?.focus();
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("text/draft-id");
                      if (id) {
                        setPendingDrop({ draftId: id, day: key });
                        attemptSchedule(id, key);
                      }
                    }}
                    onClick={() => {
                      if (events.length > 0) setPeek(events[0]);
                    }}
                    className={`relative min-h-[96px] cursor-pointer border-b border-r p-1.5 transition-colors last:border-r-0 ${
                      inMonth ? "" : "bg-muted/30 text-muted-foreground/60"
                    } ${isToday ? "ring-1 ring-inset ring-primary/60" : ""} ${
                      isBlackout
                        ? "bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,hsl(var(--muted))_6px,hsl(var(--muted))_12px)]"
                        : overBudget
                          ? "bg-amber-500/10"
                          : events.length > 0
                            ? "bg-primary/[0.03]"
                            : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-medium ${isToday ? "text-primary" : ""}`}>{d.getDate()}</span>
                      {isBlackout && (
                        <span className="text-[9px] text-muted-foreground" title="Provider blackout window — no sends">
                          blackout
                        </span>
                      )}
                      {overBudget && !isBlackout && (
                        <span className="text-[9px] text-amber-600" title="Over daily send budget">
                          ↑ over budget
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-1">
                      {events.slice(0, 3).map((c) => (
                        <div
                          key={c.id}
                          className={`truncate rounded border px-1 py-0.5 text-[9px] leading-tight ${CHANNEL_ACCENT[c.channel]}`}
                          title={`${c.name} — ${c.segmentName}`}
                        >
                          <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                          {c.name}
                        </div>
                      ))}
                      {events.length > 3 && (
                        <p className="text-[9px] text-muted-foreground">+{events.length - 3} more</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="p-4">
                <EmptyState
                  title="Nothing scheduled"
                  description="No campaigns match the current filters this month — start one from the composer."
                  icon={CalendarIcon}
                  action={<Button size="sm" onClick={() => navigate("campaign-new")}>New Campaign</Button>}
                />
              </div>
            )}
          </div>
        </div>

        {/* Side peek panel */}
        {peek && (
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{peek.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {CHANNEL_LABEL[peek.channel]} · {peek.segmentName} · {peek.audienceSize.toLocaleString()} audience
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge variant={peek.status === "sent" ? "secondary" : peek.status === "draft" ? "outline" : "default"}>
                      {peek.status}
                    </Badge>
                    {peek.scheduledAt && (
                      <Badge variant="outline">{new Date(peek.scheduledAt).toLocaleString()}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => navigate("campaign-new", { campaign: peek.id })}>
                    <Pencil className="mr-1 h-3 w-3" /> Edit
                  </Button>
                  {peek.status === "scheduled" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        pauseCampaign(peek.id);
                        toast({ title: "Campaign paused", description: `${peek.name} removed from the schedule.` });
                        setPeek({ ...peek, status: "paused" });
                      }}
                    >
                      <Pause className="mr-1 h-3 w-3" /> Pause
                    </Button>
                  ) : peek.status === "paused" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        resumeCampaign(peek.id);
                        toast({ title: "Campaign scheduled", description: `${peek.name} queued for delivery.` });
                        setPeek({ ...peek, status: "scheduled" });
                      }}
                    >
                      <Play className="mr-1 h-3 w-3" /> Resume
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setPeek(null)}>
                    Close
                  </Button>
                </div>
              </div>
              {peek.day && peekCampaigns.length > 1 && (
                <div className="mt-3 rounded-lg border bg-muted/40 p-2 text-xs">
                  <p className="mb-1 font-medium">{peekCampaigns.length} sends on {peek.day}</p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {peekCampaigns.map((c) => (
                      <li key={c.id} className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[c.status]}`} />
                        {c.name} — {CHANNEL_LABEL[c.channel]} · {c.segmentName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </PageContent>

      {/* Conflict popover */}
      <AlertDialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-amber-600" />
              Audience overlap conflict
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>{conflict?.draft.name}</strong> shares{" "}
                  <strong className="text-foreground">{conflict?.overlap}%</strong> of its audience with{" "}
                  <strong className="text-foreground">{conflict?.withName}</strong> on{" "}
                  {conflict ? new Date(`${conflict.day}T00:00`).toDateString() : ""}. The same traders would be hit
                  twice in one day.
                </p>
                <p className="text-xs text-muted-foreground">
                  Pick another day to spread the sends, or schedule anyway if the messages are complementary.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                if (conflict) {
                  // Move to the same weekday next week.
                  const d = new Date(`${conflict.day}T00:00`);
                  d.setDate(d.getDate() + 7);
                  applySchedule(conflict.draft.id, ymd(d));
                }
              }}
            >
              Pick another day (+1 week)
            </Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => conflict && applySchedule(conflict.draft.id, conflict.day)}
            >
              Schedule anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Daily budget dialog */}
      <AlertDialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Daily send budget</AlertDialogTitle>
            <AlertDialogDescription>
              Days exceeding this many sends get a capacity heat tint so you can spot over-scheduling.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="budget" className="text-xs">Sends per day</Label>
            <Input
              id="budget"
              type="number"
              min={1}
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSendBudget(Math.max(1, Number(budgetInput) || 6));
                toast({ title: "Budget updated", description: "Capacity tints recalculated." });
              }}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
