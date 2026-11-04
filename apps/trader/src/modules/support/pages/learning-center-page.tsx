"use client";

/**
 * Learning Center — educational resources (audit U #7).
 *
 * Articles, videos and interactive tutorials organized by experience
 * level with progress tracking. Completion persists to localStorage
 * (demo-only storage — no backend), the same pattern as the trading
 * journal, and every value here is deterministic (no Math.random).
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  TerraStat,
} from "@/components/terra/terra-ui";
import {
  terraAccounts,
  terraTrades,
  traderBreachesFallback,
} from "@/lib/fixtures/terra-fixtures";

const STORAGE_KEY = "terra.learning-progress";

type Level = "beginner" | "intermediate" | "advanced";
type Kind = "article" | "video" | "interactive";

interface Lesson {
  id: string;
  title: string;
  level: Level;
  kind: Kind;
  minutes: number;
  description: string;
}

const lessons: Lesson[] = [
  // Beginner
  { id: "b1", title: "How prop challenges work", level: "beginner", kind: "article", minutes: 6, description: "Phases, profit targets, drawdown rules and what actually fails an evaluation." },
  { id: "b2", title: "Reading your equity curve", level: "beginner", kind: "video", minutes: 8, description: "What the curve, peak equity and drawdown really tell you about a strategy." },
  { id: "b3", title: "Platform basics: charts & order tickets", level: "beginner", kind: "interactive", minutes: 10, description: "Place, modify and close orders in the web terminal with a guided walkthrough." },
  { id: "b4", title: "Daily loss limit explained", level: "beginner", kind: "article", minutes: 5, description: "How the daily loss limit is calculated and how to stay well inside it." },
  // Intermediate
  { id: "i1", title: "Building a trading plan", level: "intermediate", kind: "article", minutes: 9, description: "Entry criteria, session rules and a checklist you can actually follow." },
  { id: "i2", title: "Risk per trade & position sizing", level: "intermediate", kind: "video", minutes: 11, description: "Sizing positions from stop distance so one trade never breaks the account." },
  { id: "i3", title: "Journaling for consistency", level: "intermediate", kind: "interactive", minutes: 7, description: "Use the Trading Journal's tags and reflection prompts to find your patterns." },
  { id: "i4", title: "Scaling plans & payout rules", level: "intermediate", kind: "article", minutes: 6, description: "Counted payouts, split tiers and how scaling changes your targets." },
  // Advanced
  { id: "a1", title: "Drawdown math under volatility", level: "advanced", kind: "article", minutes: 12, description: "Why wide stops and news spikes push you closer to limits than intuition suggests." },
  { id: "a2", title: "Managing a funded account through drawdown", level: "advanced", kind: "video", minutes: 14, description: "Recovery routines, size cuts and when to step away from the screen." },
  { id: "a3", title: "Correlation & portfolio risk", level: "advanced", kind: "interactive", minutes: 13, description: "Correlated pairs stack risk — measure your real exposure across open positions." },
  { id: "a4", title: "Payout records & tax documents", level: "advanced", kind: "article", minutes: 8, description: "Statements, certificates and payout history — what to keep and where to find it." },
];

const levelMeta: Record<Level, { label: string; icon: string; blurb: string }> = {
  beginner: { label: "Beginner", icon: "🌱", blurb: "Start here — platform basics and evaluation rules." },
  intermediate: { label: "Intermediate", icon: "📈", blurb: "Process, risk and the habits that keep you funded." },
  advanced: { label: "Advanced", icon: "🎯", blurb: "Deeper math, portfolio risk and account management." },
};

const kindMeta: Record<Kind, { label: string; icon: string }> = {
  article: { label: "Article", icon: "📄" },
  video: { label: "Video", icon: "🎬" },
  interactive: { label: "Interactive", icon: "🧩" },
};

const filters: Array<{ id: "all" | Level; label: string }> = [
  { id: "all", label: "All levels" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

/* ------------------------------------------------------------------ */
/* Personalized recommendations (audit finding #10)                    */
/* ------------------------------------------------------------------ */
/* Derived from the SAME fixtures the dashboard uses — breach history,  */
/* daily-loss headroom on the active accounts, realised win rate and   */
/* profit-target progress — so the suggestion always points at a real  */
/* signal instead of generic content. Deterministic: no Math.random.    */

interface Recommendation {
  lesson: Lesson;
  reason: string;
}

function deriveRecommendations(completed: Record<string, boolean>): Recommendation[] {
  const out: Recommendation[] = [];
  const push = (id: string, reason: string) => {
    const lesson = lessons.find((l) => l.id === id);
    if (!lesson || completed[id] || out.some((r) => r.lesson.id === id)) return;
    out.push({ lesson, reason });
  };

  const activeAccounts = terraAccounts.filter((a) => a.status === "active");
  const dailyBreach = traderBreachesFallback.find((b) => b.type === "daily-drawdown");
  const ddBreach = traderBreachesFallback.find((b) => b.type === "max-drawdown");

  // Tightest daily-loss headroom across active accounts, as a share of
  // the starting balance (below 3% = the limit is genuinely close).
  const tightest = activeAccounts.length
    ? Math.min(...activeAccounts.map((a) => a.dailyLossRemaining / a.startingBalance))
    : null;

  const wins = terraTrades.filter((t) => t.pnl > 0).length;
  const winRate = terraTrades.length > 0 ? Math.round((wins / terraTrades.length) * 100) : null;
  const minTargetProgress = activeAccounts.length
    ? Math.min(...activeAccounts.map((a) => a.targetProgress))
    : 100;

  if (dailyBreach) {
    push(
      "b4",
      `You hit the daily loss limit ${new Date(dailyBreach.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} — this lesson shows exactly how the limit is calculated and how much room it really leaves.`,
    );
  }
  if (tightest !== null && tightest < 0.03) {
    push(
      "b4",
      `Your closest account has only ${Math.round(tightest * 100)}% of its starting balance left as daily-loss room — learn what a normal losing day looks like against that budget.`,
    );
  }
  if (ddBreach) {
    push(
      "a1",
      `Your equity came within 1% of the maximum drawdown — the advanced drawdown lesson covers why volatility pushes you there faster than intuition suggests.`,
    );
  }
  if (winRate !== null && winRate < 50) {
    push(
      "i2",
      `Your realised win rate is ${winRate}% — position sizing and expectancy matter more than hit rate at that level.`,
    );
  }
  if (minTargetProgress < 50) {
    push(
      "i1",
      `Your profit target is only ${minTargetProgress}% complete — a written plan with entry and session rules is the fastest way to close that gap.`,
    );
  }
  if (winRate !== null && winRate >= 60) {
    push(
      "i3",
      `You're winning ${winRate}% of trades — journaling which setups produce them turns a good stretch into a repeatable edge.`,
    );
  }

  // Progression fallback — point at the next unfinished lesson in order.
  if (out.length < 3) {
    for (const l of lessons) {
      if (out.length >= 3) break;
      if (!completed[l.id] && !out.some((r) => r.lesson.id === l.id)) {
        push(l.id, `Next up in the ${levelMeta[l.level].label.toLowerCase()} track — ${l.minutes} min.`);
      }
    }
  }

  return out.slice(0, 3);
}

export function LearningCenterPage() {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);
  const [level, setLevel] = useState<"all" | Level>("all");

  // Progress lives in localStorage (demo-only storage, no backend).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCompleted(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* private mode / quota — start from empty progress */
    }
    setHydrated(true);
  }, []);

  const toggle = (id: string) => {
    setCompleted((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / private-mode errors */
      }
      return next;
    });
  };

  const doneCount = lessons.filter((l) => completed[l.id]).length;
  const progressPct = Math.round((doneCount / lessons.length) * 100);
  const minutesLeft = lessons
    .filter((l) => !completed[l.id])
    .reduce((s, l) => s + l.minutes, 0);

  const visible = useMemo(
    () => (level === "all" ? lessons : lessons.filter((l) => l.level === level)),
    [level],
  );

  // Personalized picks (audit finding #10) — recomputed only when the
  // completion record changes, so marking a lesson done refreshes them.
  const recommendations = useMemo(() => deriveRecommendations(completed), [completed]);

  const byLevel = (lv: Level) => visible.filter((l) => l.level === lv);
  const levels: Level[] = ["beginner", "intermediate", "advanced"];

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Learning Center"
        description="Guided lessons on strategy, risk management and the platform — track your progress as you go"
        actions={
          <Link
            href="/help-center"
            className="rounded-xl bg-surface-container-low px-4 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            Help Center →
          </Link>
        }
      />

      {/* Overall progress */}
      <TerraCard className="p-6">
        <TerraSectionTitle
          title="Your progress"
          description={`${doneCount} of ${lessons.length} lessons completed · ${minutesLeft} min remaining`}
        />
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <TerraStat
            label="Completed"
            value={hydrated ? `${progressPct}%` : "—"}
            sub="of all lessons"
            tone={progressPct >= 70 ? "positive" : "neutral"}
          />
          <TerraStat label="Lessons done" value={hydrated ? doneCount : "—"} sub={`of ${lessons.length}`} />
          <TerraStat label="Time remaining" value={`${minutesLeft} min`} sub="across unfinished lessons" />
          <TerraStat
            label="Current focus"
            value={level === "all" ? "All levels" : levelMeta[level].label}
            sub="filter below"
          />
        </div>
        <div className="mt-4" role="img" aria-label={`Overall lesson progress: ${progressPct}% complete`}>
          <TerraProgress value={progressPct} />
        </div>
      </TerraCard>

      {/* Recommended for you (audit finding #10) — personalized picks */}
      <TerraCard className="p-6">
        <TerraSectionTitle
          title="✨ Recommended for you"
          description="Chosen from your own signals — breach history, daily-loss room, win rate and target progress."
        />
        {recommendations.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface-variant">
            Nothing left to suggest — you&apos;ve completed every lesson we&apos;d recommend.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Personalized lesson recommendations">
            {recommendations.map(({ lesson, reason }) => {
              const isDone = !!completed[lesson.id];
              return (
                <li
                  key={lesson.id}
                  className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary-fixed/10 p-4"
                >
                  <div className="flex items-center gap-2">
                    <TerraBadge tone="neutral">{levelMeta[lesson.level].label}</TerraBadge>
                    <span className="text-[11px] text-on-surface-variant">
                      {kindMeta[lesson.kind].icon} {kindMeta[lesson.kind].label} · {lesson.minutes} min
                    </span>
                  </div>
                  <p className="text-sm font-bold text-on-surface">{lesson.title}</p>
                  <p className="text-xs leading-relaxed text-on-surface-variant">{reason}</p>
                  <button
                    type="button"
                    aria-pressed={isDone}
                    onClick={() => toggle(lesson.id)}
                    className={`mt-auto self-start rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                      isDone
                        ? "bg-primary text-on-primary hover:bg-primary/90"
                        : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                    }`}
                  >
                    {isDone ? "✓ Completed" : "Start lesson"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </TerraCard>

      {/* Level filter */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter lessons by experience level">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={level === f.id}
            onClick={() => setLevel(f.id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
              level === f.id
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lessons by level */}
      {levels.map((lv) => {
        const items = byLevel(lv);
        if (items.length === 0) return null;
        return (
          <TerraCard key={lv} className="p-6">
            <TerraSectionTitle
              title={`${levelMeta[lv].icon} ${levelMeta[lv].label}`}
              description={levelMeta[lv].blurb}
              actions={
                <TerraBadge tone="neutral">
                  {items.filter((l) => completed[l.id]).length}/{items.length} done
                </TerraBadge>
              }
            />
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((l) => {
                const isDone = !!completed[l.id];
                return (
                  <div
                    key={l.id}
                    className={`flex flex-col gap-2 rounded-xl border p-4 ${
                      isDone ? "border-primary/40 bg-primary-fixed/20" : "border-outline-variant bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface">{l.title}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">{l.description}</p>
                      </div>
                      <span className="shrink-0 text-lg" aria-hidden="true">
                        {kindMeta[l.kind].icon}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <span className="flex items-center gap-2 text-[11px] font-semibold text-on-surface-variant">
                        <TerraBadge tone={isDone ? "success" : "neutral"}>
                          {kindMeta[l.kind].label}
                        </TerraBadge>
                        {l.minutes} min
                      </span>
                      <button
                        type="button"
                        aria-pressed={isDone}
                        onClick={() => toggle(l.id)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-colors ${
                          isDone
                            ? "bg-primary text-on-primary hover:bg-primary/90"
                            : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        {isDone ? "✓ Completed" : "Mark complete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TerraCard>
        );
      })}

      {/* Keep learning — bridge to the other support surfaces */}
      <TerraCard className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-on-surface-variant">
          Finished everything? The Help Center has answers for edge cases, and the Trading
          Journal turns your lessons into practice.
        </p>
        <div className="flex gap-3">
          <Link
            href="/help-center"
            className="rounded-xl bg-surface-container-low px-4 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            Help Center
          </Link>
          <Link
            href="/trading-journal"
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
          >
            Open Journal →
          </Link>
        </div>
      </TerraCard>
    </div>
  );
}
