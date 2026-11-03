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
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { journalEntries, terraTrades } from "@/lib/fixtures/terra-fixtures";
import { exportToCsv, type ExportColumn } from "@/lib/export/export-csv";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "terra.journal-entries";

/** Reflective prompts offered as one-tap starters in the entry form (audit U #4). */
const reflectionPrompts = [
  "What was my thesis before entry?",
  "Did I follow my risk rules?",
  "What would I repeat or change next time?",
] as const;

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
  /** Closed-list setup the entry was taken under (audit B #9). */
  strategy?: string;
  tags: string[];
  notes: string;
  pnl: number;
  tradeIds: string[];
}

/** Closed list behind the strategy axis — keeps the comparison finite. */
const strategies = ["Reversal", "Trend follow", "Range fade", "Breakout"] as const;

/** Display order for the strategy table (Uncategorised always last). */
const strategyOrder = new Map<string, number>(strategies.map((s, i) => [s, i]));

/** Entries saved before the strategy field existed group here. */
const strategyOf = (entry: JournalEntry) => entry.strategy ?? "Uncategorised";

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

  // Tag filter (audit B #9) — a tag chip anywhere on the page scopes the
  // entry list; the strip above the list states what is showing so a
  // filtered view can never be mistaken for the full journal.
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const visibleEntries = useMemo(
    () => (activeTag ? entries.filter((e) => e.tags.includes(activeTag)) : entries),
    [entries, activeTag],
  );

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState("disciplined");
  const [strategy, setStrategy] = useState<string>(strategies[0]);
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

  /**
   * Per-tag performance correlation (audit B #9) — every tag scored
   * across the entries carrying it, so a recurring tag can be judged on
   * results rather than recall. Scored = entry has a non-zero P&L.
   */
  const tagStats = useMemo(() => {
    const by = new Map<string, { count: number; scored: number; net: number; wins: number }>();
    for (const e of entries) {
      for (const t of e.tags) {
        const b = by.get(t) ?? { count: 0, scored: 0, net: 0, wins: 0 };
        b.count += 1;
        if (e.pnl !== 0) {
          b.scored += 1;
          b.net += e.pnl;
          if (e.pnl > 0) b.wins += 1;
        }
        by.set(t, b);
      }
    }
    return [...by.entries()]
      .map(([tag, b]) => ({
        tag,
        ...b,
        avg: b.scored > 0 ? b.net / b.scored : 0,
        winRate: b.scored > 0 ? Math.round((b.wins / b.scored) * 100) : null,
      }))
      .sort((a, b) => b.net - a.net);
  }, [entries]);

  /**
   * Strategy comparison (audit B #9) — the same scoring keyed by the
   * closed strategy list. Entries from before the field existed land in
   * "Uncategorised" rather than disappearing from the comparison.
   */
  const strategyStats = useMemo(() => {
    const by = new Map<string, { count: number; scored: number; net: number; wins: number }>();
    for (const e of entries) {
      const key = strategyOf(e);
      const b = by.get(key) ?? { count: 0, scored: 0, net: 0, wins: 0 };
      b.count += 1;
      if (e.pnl !== 0) {
        b.scored += 1;
        b.net += e.pnl;
        if (e.pnl > 0) b.wins += 1;
      }
      by.set(key, b);
    }
    return [...by.entries()]
      .map(([strategyName, b]) => ({
        strategy: strategyName,
        ...b,
        avg: b.scored > 0 ? b.net / b.scored : 0,
        winRate: b.scored > 0 ? Math.round((b.wins / b.scored) * 100) : null,
      }))
      .sort(
        (a, b) =>
          (strategyOrder.get(a.strategy) ?? strategies.length) -
          (strategyOrder.get(b.strategy) ?? strategies.length),
      );
  }, [entries]);

  // Trade analysis — performance metrics derived from every entry (audit U #4).
  const analysis = useMemo(() => {
    const withPnl = entries.filter((e) => e.pnl !== 0);
    const winners = withPnl.filter((e) => e.pnl > 0).length;
    const losers = withPnl.filter((e) => e.pnl < 0).length;
    const winRate = withPnl.length > 0 ? Math.round((winners / withPnl.length) * 100) : null;
    const avg = withPnl.length > 0 ? withPnl.reduce((s, e) => s + e.pnl, 0) / withPnl.length : 0;
    const sorted = [...withPnl].sort((a, b) => b.pnl - a.pnl);
    const tagCounts = new Map<string, number>();
    for (const e of entries) {
      for (const t of e.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    return {
      withPnlCount: withPnl.length,
      winners,
      losers,
      winRate,
      avg,
      best: sorted[0] ?? null,
      worst: sorted.length > 0 ? sorted[sorted.length - 1] : null,
      topTags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
      linked: entries.filter((e) => e.tradeIds.length > 0).length,
      maxAbs: withPnl.reduce((m, e) => Math.max(m, Math.abs(e.pnl)), 0),
      recent: withPnl.slice(0, 8),
    };
  }, [entries]);

  const handleCreateEntry = () => {
    if (!title.trim()) return;
    const entry: JournalEntry = {
      id: `jr-user-${Date.now()}`,
      date: new Date().toISOString(),
      title: title.trim(),
      mood,
      strategy,
      tags,
      notes: notes.trim(),
      // Journal P&L follows the linked trade when one is attached.
      pnl: linkedTrade ? linkedTrade.pnl : 0,
      tradeIds: linkedTrade ? [linkedTrade.id] : [],
    };
    persist([entry, ...userEntries]);
    toast({
      title: "Journal entry saved",
      description: `"${entry.title}" — ${strategy} • mood: ${mood}${linkedTrade ? ` • linked #${linkedTrade.ticket}` : ""}. Stored locally in this browser.`,
    });
    setShowNewEntry(false);
    setTitle("");
    setNotes("");
    setTagsInput("");
    setLinkedTradeId("");
    setMood("disciplined");
    setStrategy(strategies[0]);
  };

  // Export the current view (audit B #9) — a filtered journal exports what
  // is on screen, so the CSV always matches what the user was looking at.
  const handleExport = () => {
    const columns: ExportColumn<JournalEntry>[] = [
      { header: "Date", value: (e) => e.date },
      { header: "Title", value: (e) => e.title },
      { header: "Mood", value: (e) => e.mood },
      { header: "Strategy", value: (e) => strategyOf(e) },
      { header: "Tags", value: (e) => e.tags.join(" | ") },
      { header: "P&L", value: (e) => e.pnl },
      { header: "Linked trades", value: (e) => e.tradeIds.join(" | ") },
      { header: "Notes", value: (e) => e.notes },
    ];
    exportToCsv(
      visibleEntries,
      columns,
      `terra-journal${activeTag ? `-${activeTag.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}` : ""}-${new Date().toISOString().slice(0, 10)}`,
    );
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trading Journal"
        description="Review your trades, mindset and lessons — entries are saved in this browser"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => setShowNewEntry(true)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              + New Entry
            </button>
          </div>
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
                  Strategy
                </label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  {strategies.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-[11px] text-on-surface-variant">
                  Drives the strategy comparison — pick the setup this entry belongs to.
                </p>
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
              <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Reflection prompts">
                {reflectionPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    title="Add this prompt to your notes"
                    onClick={() => setNotes((n) => (n ? `${n}\n` : "") + `${p} `)}
                    className="rounded-full bg-surface-container px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                  >
                    + {p}
                  </button>
                ))}
              </div>
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

      {/* Performance analysis — metrics, P&L distribution, reflection (audit U #4) */}
      <TerraCard className="p-6">
        <TerraSectionTitle
          title="Performance Analysis"
          description="Derived from your entries — winners, losers and the tags behind them."
        />
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <TerraStat
            label="Win Rate"
            value={analysis.winRate === null ? "—" : `${analysis.winRate}%`}
            sub={
              analysis.withPnlCount > 0
                ? `${analysis.winners}W · ${analysis.losers}L`
                : "no scored entries yet"
            }
            tone={
              analysis.winRate === null ? "neutral" : analysis.winRate >= 50 ? "positive" : "negative"
            }
          />
          <TerraStat
            label="Avg Entry P&L"
            value={analysis.withPnlCount > 0 ? formatSignedMoney(analysis.avg) : "—"}
            tone={analysis.withPnlCount > 0 ? (analysis.avg >= 0 ? "positive" : "negative") : "neutral"}
            sub={`${analysis.withPnlCount} scored entr${analysis.withPnlCount === 1 ? "y" : "ies"}`}
          />
          <TerraStat
            label="Best Entry"
            value={analysis.best ? formatSignedMoney(analysis.best.pnl) : "—"}
            sub={analysis.best ? analysis.best.title : "no scored entries"}
            tone={analysis.best ? "positive" : "neutral"}
          />
          <TerraStat
            label="Worst Entry"
            value={analysis.worst ? formatSignedMoney(analysis.worst.pnl) : "—"}
            sub={analysis.worst ? analysis.worst.title : "no scored entries"}
            tone={analysis.worst ? "negative" : "neutral"}
          />
        </div>

        {analysis.recent.length > 0 ? (
          <div
            className="mt-5 space-y-2"
            role="img"
            aria-label={`P&L per entry for the ${analysis.recent.length} most recent scored entries`}
          >
            {analysis.recent.map((e) => {
              const pct =
                analysis.maxAbs > 0
                  ? Math.max(6, Math.round((Math.abs(e.pnl) / analysis.maxAbs) * 100))
                  : 6;
              return (
                <div key={e.id} className="flex items-center gap-3">
                  <span
                    className="w-36 shrink-0 truncate text-xs text-on-surface-variant sm:w-44"
                    title={e.title}
                  >
                    {e.title}
                  </span>
                  <span
                    className="h-3 flex-1 overflow-hidden rounded-full bg-surface-container-low"
                    aria-hidden="true"
                  >
                    <span
                      className={`block h-full rounded-full ${e.pnl >= 0 ? "bg-primary" : "bg-error"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span
                    className={`w-20 shrink-0 text-right text-xs font-bold tabular-nums ${e.pnl >= 0 ? "text-primary" : "text-error"}`}
                  >
                    {formatSignedMoney(e.pnl)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-surface-container-low p-4 text-xs text-on-surface-variant">
            Link a trade to an entry to score it — the P&amp;L distribution appears here once
            entries carry a trade.
          </p>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Top tags
            </p>
            {analysis.topTags.length > 0 ? (
              <div
                className="mt-2 flex flex-wrap gap-1.5"
                role="group"
                aria-label="Filter the entry list by tag"
              >
                {analysis.topTags.map(([t, c]) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={activeTag === t}
                    onClick={() => setActiveTag((cur) => (cur === t ? null : t))}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      activeTag === t
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    #{t} · {c}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-on-surface-variant">
                No tags yet — tag entries to spot recurring patterns.
              </p>
            )}
            <p className="mt-3 text-[11px] text-on-surface-variant">
              {analysis.linked} of {entries.length} entries linked to a trade.
            </p>
          </div>
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Reflection prompts
            </p>
            <ul className="mt-2 space-y-1.5">
              {reflectionPrompts.map((p) => (
                <li key={p} className="flex gap-2 text-xs text-on-surface-variant">
                  <span aria-hidden="true">💬</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </TerraCard>

      {/* Correlation + comparison (audit B #9) — the two questions the
          journal could not answer: "which tags actually make money?" and
          "which of my setups is carrying me?". Both are derived from the
          same entries the list below shows. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TerraCard className="p-6">
          <TerraSectionTitle
            title="Tag performance"
            description="Every tag scored across the entries carrying it — click one to filter the list."
          />
          {tagStats.length > 0 ? (
            <div className="mt-3">
              <TerraTable
                head={["Tag", "Entries", "Net", "Avg", "Win rate"]}
                rows={tagStats.map((s) => [
                  <button
                    key={s.tag}
                    type="button"
                    aria-pressed={activeTag === s.tag}
                    onClick={() => setActiveTag((cur) => (cur === s.tag ? null : s.tag))}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      activeTag === s.tag
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    #{s.tag}
                  </button>,
                  <span key="n" className="tabular-nums text-on-surface-variant">{s.count}</span>,
                  <span key="net" className={`font-bold tabular-nums ${s.net >= 0 ? "text-primary" : "text-error"}`}>
                    {formatSignedMoney(s.net)}
                  </span>,
                  <span key="avg" className="tabular-nums text-on-surface-variant">
                    {s.scored > 0 ? formatSignedMoney(s.avg) : "—"}
                  </span>,
                  <span key="wr" className="tabular-nums text-on-surface-variant">
                    {s.winRate === null ? "—" : `${s.winRate}%`}
                  </span>,
                ])}
              />
              <p className="mt-3 text-[11px] text-on-surface-variant">
                Scored entries only — untagged P&amp;L stays in the totals above but not in any
                one row.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-on-surface-variant">
              No tags yet — tag entries to spot recurring patterns.
            </p>
          )}
        </TerraCard>

        <TerraCard className="p-6">
          <TerraSectionTitle
            title="Strategy comparison"
            description="The same scoring by setup — where the edge comes from, and what is costing you."
          />
          <div className="mt-3">
            <TerraTable
              head={["Strategy", "Entries", "Net", "Avg", "Win rate"]}
              rows={strategyStats.map((s) => [
                <span key="s" className="font-semibold text-on-surface">{s.strategy}</span>,
                <span key="n" className="tabular-nums text-on-surface-variant">{s.count}</span>,
                <span key="net" className={`font-bold tabular-nums ${s.net >= 0 ? "text-primary" : "text-error"}`}>
                  {formatSignedMoney(s.net)}
                </span>,
                <span key="avg" className="tabular-nums text-on-surface-variant">
                  {s.scored > 0 ? formatSignedMoney(s.avg) : "—"}
                </span>,
                <span key="wr" className="tabular-nums text-on-surface-variant">
                  {s.winRate === null ? "—" : `${s.winRate}%`}
                </span>,
              ])}
            />
            <p className="mt-3 text-[11px] text-on-surface-variant">
              Entries logged before strategies existed are grouped as Uncategorised rather than
              dropped from the comparison.
            </p>
          </div>
        </TerraCard>
      </div>

      {activeTag && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary-fixed/40 px-4 py-3"
        >
          <p className="text-sm text-on-surface">
            Filtered by <span className="font-bold">#{activeTag}</span> — showing{" "}
            {visibleEntries.length} of {entries.length} entries.
          </p>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className="text-xs font-bold text-on-primary-fixed-variant underline-offset-2 hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {visibleEntries.length === 0 ? (
        activeTag ? (
          <TerraEmpty
            title="No entries with this tag"
            description={`Nothing in the journal is tagged #${activeTag} yet — use "Clear filter" above to see every entry.`}
          />
        ) : (
          <TerraEmpty
            title="No journal entries yet"
            description="Log your first session review — mood, tags and lessons learned."
          />
        )
      ) : (
        <div className="space-y-4">
          {visibleEntries.map((e) => (
            <TerraCard key={e.id} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">
                    {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <h2 className="font-headline font-bold text-on-surface">{e.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <TerraBadge tone="secondary">{strategyOf(e)}</TerraBadge>
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
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tags on this entry">
                {e.tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={activeTag === t}
                    onClick={() => setActiveTag((cur) => (cur === t ? null : t))}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                      activeTag === t
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </TerraCard>
          ))}
        </div>
      )}
    </div>
  );
}
