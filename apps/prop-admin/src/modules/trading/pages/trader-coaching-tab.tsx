"use client";

/**
 * Trader Coaching tab (audit finding #2 — missing coaching tools).
 *
 * The risk screens could FLAG a struggling trader but gave the operator
 * no way to actually coach them. This tab adds the three pieces the
 * finding asked for, all on the trader detail view where the operator
 * already is:
 *
 *   1. Templated feedback — pre-written, breach-type-specific messages
 *      the operator can send (or edit) instead of drafting from scratch
 *   2. Educational content links — the knowledge base, content library
 *      and this trader's risk score, one click away
 *   3. Follow-up scheduler + coaching history — a dated record of every
 *      interaction with an outcome, so improvement is trackable over time
 *
 * Deterministic: the seeded history derives from the trader id (stable
 * across renders, no Math.random) and new entries come only from the
 * operator's own actions.
 */

import * as React from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  StitchCard,
  StitchCardHeader,
  StitchPill,
  StitchProgress,
} from "@/components/stitch/stitch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types + fixtures                                                    */
/* ------------------------------------------------------------------ */

type Channel = "email" | "call" | "in-app";
type Outcome = "improved" | "unchanged" | "declined" | "pending";

interface CoachingEntry {
  id: string;
  /** Whole days before today — used for sorting and for the date label. */
  days: number;
  kind: string;
  channel: Channel;
  subject: string;
  outcome: Outcome;
  by: string;
}

interface CoachingTemplate {
  id: string;
  /** Matches mock-data Breach["type"] where one exists. */
  breach: string;
  label: string;
  title: string;
  body: string;
  /** The lesson this template most wants the trader to read. */
  lesson: string;
}

function dateLabel(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** First name for the message salutation — deterministic from the record. */
function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

const templates: CoachingTemplate[] = [
  {
    id: "daily-drawdown",
    breach: "daily-drawdown",
    label: "Daily loss limit",
    title: "Daily loss limit breached — what happened and how to stay inside it",
    body:
      "Hi {name},\n\nYour account hit the daily loss limit today, which closed the open positions automatically. This rule exists to stop one bad session from turning into a failed evaluation, so treat it as a hard stop rather than a target.\n\nTwo things to adjust: size positions so a normal losing day uses no more than half the daily budget, and pre-commit to the maximum number of trades for the session. When the daily budget is gone, the session is over — that is the plan working as designed.\n\nReply with your plan for tomorrow's session and we will check in again after your next trading day.",
    lesson: "Daily loss limit explained",
  },
  {
    id: "max-drawdown",
    breach: "max-drawdown",
    label: "Max drawdown",
    title: "Approaching maximum drawdown — sizing correction required",
    body:
      "Hi {name},\n\nYour equity is now close to the maximum drawdown for this program. Unlike the daily limit, drawdown does not reset — once it is reached the evaluation ends permanently, so this is the most serious warning on the account.\n\nCut position size by half until equity recovers above the level it is at today, and avoid holding correlated positions at the same time. If you would like, send us your last three sessions and we will review the sizing together.",
    lesson: "Drawdown math under volatility",
  },
  {
    id: "profit-target-miss",
    breach: "profit-target-miss",
    label: "Profit target pace",
    title: "Profit target pace — you are behind the curve",
    body:
      "Hi {name},\n\nYou are progressing towards the profit target but at a pace that will miss the deadline if it continues. Nothing is wrong with the trades themselves — the issue is how much of the target each trade is contributing.\n\nReview your last ten trades: if fewer than half moved the target forward meaningfully, tighten the criteria rather than trading more often. A written plan with entry rules usually fixes the pace within a few sessions.",
    lesson: "Building a trading plan",
  },
  {
    id: "time-limit",
    breach: "time-limit",
    label: "Minimum days / time limit",
    title: "Minimum trading days — you are running out of calendar",
    body:
      "Hi {name},\n\nYou have met the profit requirement but are at risk of missing the minimum trading days before the deadline. This fails the phase even when the target is met, so schedule the remaining sessions now rather than at the end.\n\nTrade the remaining days with your normal (reduced) size — the goal of these sessions is consistency, not additional profit.",
    lesson: "How prop challenges work",
  },
  {
    id: "consistency",
    breach: "consistency",
    label: "Consistency rule",
    title: "Consistency rule — your best day is too large a share",
    body:
      "Hi {name},\n\nYour results are healthy, but a single best day is currently above the program's consistency cap, which means part of the profit will be discounted when the phase is reviewed.\n\nSpread the remaining sessions more evenly: cap daily risk below your recent average and let the equity curve flatten out. Consistency is what the review measures, not the peak.",
    lesson: "Journaling for consistency",
  },
];

const educationLinks: { view: string; label: string; detail: string }[] = [
  { view: "support-knowledge", label: "Knowledge base — risk rules", detail: "Explainers traders can be linked to directly" },
  { view: "content-management", label: "Content library — lessons", detail: "Publish and attach education to a program" },
  { view: "trader-risk-scoring", label: "Risk scoring — this cohort", detail: "Where the signal that triggered coaching came from" },
];

const channels: Channel[] = ["email", "call", "in-app"];

/**
 * Seeded history — derived from the trader id so every render (and
 * every reload) shows the same record for the same trader.
 */
function seedHistory(traderId: string): CoachingEntry[] {
  const seed = traderId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const count = 2 + (seed % 2); // 2–3 entries
  const by = ["M. Okafor", "J. Reyes", "Risk Desk"][seed % 3];
  const outcomes: Outcome[] = ["improved", "unchanged", "improved", "declined"];
  return Array.from({ length: count }, (_, i) => {
    const t = templates[(seed + i) % templates.length];
    return {
      id: `${traderId}-coach-${i}`,
      days: 5 + i * 9 + (seed % 4),
      kind: t.label,
      channel: channels[(seed + i) % channels.length],
      subject: t.title,
      outcome: outcomes[(seed + i) % outcomes.length],
      by: i === 0 ? by : ["M. Okafor", "J. Reyes", "Risk Desk"][(seed + i) % 3],
    };
  }).sort((a, b) => a.days - b.days);
}

const OUTCOME_TONE: Record<Outcome, "positive" | "warning" | "negative" | "muted"> = {
  improved: "positive",
  unchanged: "muted",
  declined: "negative",
  pending: "warning",
};

const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  call: "Call",
  "in-app": "In-app",
};

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */

export function TraderCoachingTab({ traderId, traderName }: { traderId: string; traderName: string }) {
  const { navigate } = usePlatform();
  const [history, setHistory] = React.useState<CoachingEntry[]>(() =>
    seedHistory(traderId),
  );
  const [templateId, setTemplateId] = React.useState(templates[0].id);
  const [message, setMessage] = React.useState(templates[0].body.replace("{name}", firstName(traderName)));
  const [followUpDate, setFollowUpDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [followUpChannel, setFollowUpChannel] = React.useState<Channel>("email");
  const [followUpNote, setFollowUpNote] = React.useState("");
  const [followUps, setFollowUps] = React.useState<
    { id: string; date: string; channel: Channel; note: string }[]
  >([]);

  // Switching traders must not carry the previous trader's history.
  React.useEffect(() => {
    setHistory(seedHistory(traderId));
    const first = templates[0];
    setTemplateId(first.id);
    setMessage(first.body.replace("{name}", firstName(traderName)));
  }, [traderId, traderName]);

  const template = templates.find((t) => t.id === templateId) ?? templates[0];

  const chooseTemplate = (t: CoachingTemplate) => {
    setTemplateId(t.id);
    setMessage(t.body.replace("{name}", firstName(traderName)));
  };

  const sendFeedback = () => {
    if (!message.trim()) {
      toast({
        title: "Message is empty",
        description: "Write or keep a template before sending feedback.",
        variant: "destructive",
      });
      return;
    }
    setHistory((prev) => [
      {
        id: `${traderId}-coach-${prev.length + 1}-${template.id}`,
        days: 0,
        kind: template.label,
        channel: "email",
        subject: template.title,
        outcome: "pending",
        by: "You",
      },
      ...prev,
    ]);
    toast({
      title: "Feedback sent",
      description: `"${template.label}" coaching message logged for ${traderName}.`,
    });
  };

  const scheduleFollowUp = () => {
    setFollowUps((prev) => [
      { id: `fu-${prev.length + 1}-${followUpDate}`, date: followUpDate, channel: followUpChannel, note: followUpNote.trim() || "Review progress after the next trading session." },
      ...prev,
    ]);
    setFollowUpNote("");
    toast({
      title: "Follow-up scheduled",
      description: `${followUpDate} via ${CHANNEL_LABEL[followUpChannel].toLowerCase()} — added to this trader's coaching plan.`,
    });
  };

  const decided = history.filter((h) => h.outcome !== "pending");
  const improved = decided.filter((h) => h.outcome === "improved").length;
  const improvementPct = decided.length > 0 ? Math.round((improved / decided.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Structured feedback — templates by breach type */}
        <StitchCard>
          <StitchCardHeader
            icon="mail"
            title="Send structured feedback"
            description="Pick the template that matches the signal, adjust the wording, send — it lands in the coaching history."
          />
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Feedback template by breach type">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={templateId === t.id}
                  onClick={() => chooseTemplate(t)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    templateId === t.id
                      ? "bg-tp text-on-primary shadow-sm"
                      : "bg-sfc-low text-ink-variant hover:bg-sfc hover:text-ink",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="rounded-lg bg-sfc-low p-3">
              <p className="text-xs font-bold text-ink">{template.title}</p>
              <p className="mt-1 text-[11px] text-ink-variant">
                Recommended lesson: <span className="font-semibold text-ink">{template.lesson}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coaching-message" className="text-xs font-semibold text-ink">
                Message to {traderName}
              </Label>
              <Textarea
                id="coaching-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={9}
                className="text-xs"
                aria-describedby="coaching-message-hint"
              />
              <p id="coaching-message-hint" className="text-[10px] text-ink-variant">
                {message.trim().length} characters · editable before sending · logged with your name
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={sendFeedback}>
                Send feedback
              </Button>
              <Button size="sm" variant="outline" onClick={() => chooseTemplate(template)}>
                Reset to template
              </Button>
            </div>
          </div>
        </StitchCard>

        {/* Coaching history + improvement trend */}
        <StitchCard>
          <StitchCardHeader
            icon="history"
            title="Coaching history"
            description={`${history.length} interaction${history.length === 1 ? "" : "s"} recorded · outcomes tracked for improvement`}
          />
          <div className="mb-3 rounded-lg bg-sfc-low p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-ink">Improvement trend</p>
              <p className="text-[11px] tabular-nums text-ink-variant">
                {improved} of {decided.length} follow-ups improved
              </p>
            </div>
            <div
              className="mt-2"
              role="progressbar"
              aria-valuenow={improvementPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Improvement trend: ${improvementPct}% of decided follow-ups improved`}
            >
              <StitchProgress value={improvementPct} tone={improvementPct >= 60 ? "positive" : "warning"} />
            </div>
          </div>

          <ul className="space-y-2" aria-label="Coaching interactions, most recent first">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg bg-sfc-low px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{h.subject}</p>
                    <p className="mt-0.5 text-[10px] text-ink-variant">
                      {dateLabel(h.days)} · {CHANNEL_LABEL[h.channel]} · {h.kind} · by {h.by}
                    </p>
                  </div>
                  <StitchPill tone={OUTCOME_TONE[h.outcome]}>
                    {h.outcome === "pending" ? "awaiting reply" : h.outcome}
                  </StitchPill>
                </div>
              </li>
            ))}
          </ul>
        </StitchCard>
      </div>

      {/* Education links + follow-up scheduler */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StitchCard>
          <StitchCardHeader
            icon="school"
            title="Educational content"
            description="Attach authoritative material instead of re-explaining the rule in every message."
          />
          <ul className="space-y-2">
            {educationLinks.map((l) => (
              <li key={l.view}>
                <button
                  type="button"
                  onClick={() => navigate(l.view)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg bg-sfc-low px-3 py-2.5 text-left transition-colors hover:bg-sfc"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-ink">{l.label}</span>
                    <span className="block truncate text-[10px] text-ink-variant">{l.detail}</span>
                  </span>
                  <span aria-hidden className="text-xs font-bold text-tp">
                    Open →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </StitchCard>

        <StitchCard>
          <StitchCardHeader
            icon="event"
            title="Follow-up scheduler"
            description="Set the next touchpoint while the feedback is fresh."
          />
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="follow-up-date" className="text-xs font-semibold text-ink">
                  Follow-up date
                </Label>
                <input
                  id="follow-up-date"
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-xs text-ink"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="follow-up-channel" className="text-xs font-semibold text-ink">
                  Channel
                </Label>
                <select
                  id="follow-up-channel"
                  value={followUpChannel}
                  onChange={(e) => setFollowUpChannel(e.target.value as Channel)}
                  className="w-full rounded-lg border border-outline-variant bg-background px-3 py-2 text-xs text-ink"
                >
                  {channels.map((c) => (
                    <option key={c} value={c}>
                      {CHANNEL_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="follow-up-note" className="text-xs font-semibold text-ink">
                Agenda note
              </Label>
              <Textarea
                id="follow-up-note"
                rows={3}
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="e.g. Review session sizing after the daily-loss breach."
                className="text-xs"
              />
            </div>
            <Button size="sm" onClick={scheduleFollowUp}>
              Schedule follow-up
            </Button>

            {followUps.length > 0 && (
              <ul className="space-y-2 pt-1" aria-label="Scheduled follow-ups">
                {followUps.map((f) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink">{f.date}</p>
                      <p className="truncate text-[10px] text-ink-variant">
                        {CHANNEL_LABEL[f.channel]} · {f.note}
                      </p>
                    </div>
                    <StitchPill tone="info">scheduled</StitchPill>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </StitchCard>
      </div>
    </div>
  );
}
