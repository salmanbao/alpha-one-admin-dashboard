"use client";

/**
 * Trading Journal — converted from stitch_screens/trading_journal
 * Journal entry list with mood, tags, P&L and notes.
 *
 * P2 upgrades: entries persist to localStorage (demo-only storage —
 * no backend), new entries support tag chips and linking to real
 * closed trades, and the stats strip is derived instead of hardcoded.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraStat,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { journalEntries, terraTrades } from "@/lib/fixtures/terra-fixtures";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "terra.journal-entries";

const moodTone = {
  disciplined: "success",
  confident: "primary",
  patient: "secondary",
  frustrated: "error",
} as const;

interface JournalEntry {
  id: string;
  date: string;
  title: string;
  mood: string;
  tags: string[];
  notes: string;
  pnl: number;
  tradeIds: string[];
}

/** Recent closed trades, newest first — offered as link targets. */
const recentTrades = [...terraTrades]
  .sort((a, b) => +new Date(b.closedAt) - +new Date(a.closedAt))
  .slice(0, 20);

export function TradingJournalPage() {
  // User entries live in localStorage; fixture entries seed the list.
  const [userEntries, setUserEntries] = useState<JournalEntry[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as JournalEntry[] : [];
    } catch {
      return [];
    }
  });
  const [hydrated, setHydrated] = useState(true);

  const persist = (next: JournalEntry[]) => {
    setUserEntries(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / private-mode errors */
    }
  };

  const entries = useMemo(
    () => [...userEntries, ...(journalEntries as JournalEntry[])],
    [userEntries],
  );
  const total = entries.reduce((s, e) => s + e.pnl, 0);

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState("disciplined");
  const [tagsInput, setTagsInput] = useState("");
  const [linkedTradeId, setLinkedTradeId] = useState("");

  const tags = tagsInput
    .split(",")
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
  const linkedTrade = recentTrades.find((t) => t.id === linkedTradeId) ?? null;

  // Derived stats — best mood by average P&L, entry streak by day.
  const moodStats = useMemo(() => {
    const by = new Map<string, { sum: number; count: number }>();
    for (const e of entries) {
      const b = by.get(e.mood) ?? { sum: 0, count: 0 };
      b.sum += e.pnl;
      b.count += 1;
      by.set(e.mood, b);
    }
    let best: { mood: string; avg: number } | null = null;
    for (const [moodKey, b] of by) {
      const avg = b.sum / b.count;
      if (!best || avg > best.avg) best = { mood: moodKey, avg };
    }
    return best;
  }, [entries]);

  const streakDays = useMemo(() => {
    const days = new Set(entries.map((e) => e.date.slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    // Allow today to be missing without breaking the streak (not logged yet).
    if (!days.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [entries]);

  const handleCreateEntry = () => {
    if (!title.trim()) return;
    const entry: JournalEntry = {
      id: `jr-user-${Date.now()}`,
      date: new Date().toISOString(),
      title: title.trim(),
      mood,
      tags,
      notes: notes.trim(),
      // Journal P&L follows the linked trade when one is attached.
      pnl: linkedTrade ? linkedTrade.pnl : 0,
      tradeIds: linkedTrade ? [linkedTrade.id] : [],
    };
    persist([entry, ...userEntries]);
    toast({
      title: "Journal entry saved",
      description: `"${entry.title}" — mood: ${mood}${linkedTrade ? ` • linked #${linkedTrade.ticket}` : ""}. Stored locally in this browser.`,
    });
    setShowNewEntry(false);
    setTitle("");
    setNotes("");
    setTagsInput("");
    setLinkedTradeId("");
    setMood("disciplined");
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trading Journal"
        description="Review your trades, mindset and lessons — entries are saved in this browser"
        actions={
          <button
            type="button"
            onClick={() => setShowNewEntry(true)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            + New Entry
          </button>
        }
      />

      {showNewEntry && (
        <TerraCard className="border-primary">
          <div className="space-y-4">
            <h3 className="font-headline text-lg font-bold text-on-surface">New Journal Entry</h3>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Good discipline on EURUSD"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Mood
                </label>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="disciplined">Disciplined</option>
                  <option value="confident">Confident</option>
                  <option value="patient">Patient</option>
                  <option value="frustrated">Frustrated</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Link a trade (optional)
                </label>
                <select
                  value={linkedTradeId}
                  onChange={(e) => setLinkedTradeId(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">No linked trade</option>
                  {recentTrades.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.ticket} · {t.symbol} {t.side} · {formatSignedMoney(t.pnl)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. reversal, london, A+ setup"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-surface-container px-2.5 py-0.5 text-[11px] font-semibold text-on-surface-variant"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you learn from this trade?"
                rows={3}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCreateEntry}
                disabled={!title.trim()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
              >
                Save Entry
              </button>
              <button
                type="button"
                onClick={() => setShowNewEntry(false)}
                className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
              >
                Cancel
              </button>
            </div>
          </div>
        </TerraCard>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Entries" value={hydrated ? entries.length : "—"} sub="all time" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Journal P&L" value={formatSignedMoney(total)} tone={total >= 0 ? "positive" : "negative"} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Best Mood"
            value={moodStats ? moodStats.mood[0].toUpperCase() + moodStats.mood.slice(1) : "—"}
            sub={moodStats ? `avg ${formatSignedMoney(moodStats.avg)}` : "no entries"}
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Streak" value={`${streakDays} day${streakDays === 1 ? "" : "s"}`} sub="entries logged" />
        </TerraCard>
      </div>

      {entries.length === 0 ? (
        <TerraEmpty
          title="No journal entries yet"
          description="Log your first session review — mood, tags and lessons learned."
        />
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
            <TerraCard key={e.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">
                    {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <h2 className="font-headline font-bold text-on-surface">{e.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <TerraBadge tone={moodTone[e.mood as keyof typeof moodTone] ?? "neutral"}>{e.mood}</TerraBadge>
                  <span className={`font-bold tabular-nums ${e.pnl >= 0 ? "text-primary" : "text-error"}`}>
                    {formatSignedMoney(e.pnl)}
                  </span>
                </div>
              </div>
              <p className="text-sm text-on-surface-variant">{e.notes || "No notes."}</p>
              {e.tradeIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {e.tradeIds.map((id) => {
                    const t = terraTrades.find((x) => x.id === id);
                    if (!t) return null;
                    return (
                      <Link
                        key={id}
                        href={`/trade-detail?id=${id}`}
                        className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container"
                      >
                        <span>
                          #{t.ticket} · {t.symbol} {t.side}
                        </span>
                        <span className={t.pnl >= 0 ? "text-primary" : "text-error"}>
                          {formatSignedMoney(t.pnl)}
                        </span>
                        <span className="text-primary">↗</span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {e.tags.map((t) => (
                  <span key={t} className="rounded-full bg-surface-container px-2.5 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                    #{t}
                  </span>
                ))}
              </div>
            </TerraCard>
          ))}
        </div>
      )}
    </div>
  );
}
