"use client";

/**
 * Trading Journal — converted from stitch_screens/trading_journal
 * Journal entry list with mood, tags, P&L and notes.
 */

import { useState } from "react";
import { TerraBadge, TerraCard, TerraPageHeader, TerraStat, formatSignedMoney } from "@/components/terra/terra-ui";
import { journalEntries } from "@/lib/fixtures/terra-fixtures";

const moodTone = {
  disciplined: "success",
  confident: "primary",
  patient: "secondary",
  frustrated: "error",
} as const;

export function TradingJournalPage() {
  const total = journalEntries.reduce((s, e) => s + e.pnl, 0);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: "", notes: "", mood: "disciplined" });

  const handleCreateEntry = () => {
    if (!newEntry.title.trim()) return;
    alert(`Journal entry "${newEntry.title}" created successfully!\n\nMood: ${newEntry.mood}\nNotes: ${newEntry.notes || "(no notes)"}`);
    setShowNewEntry(false);
    setNewEntry({ title: "", notes: "", mood: "disciplined" });
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trading Journal"
        description="Review your trades, mindset and lessons"
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
                value={newEntry.title}
                onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
                placeholder="e.g. Good discipline on EURUSD"
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Mood
              </label>
              <select
                value={newEntry.mood}
                onChange={(e) => setNewEntry({ ...newEntry, mood: e.target.value })}
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
                Notes
              </label>
              <textarea
                value={newEntry.notes}
                onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                placeholder="What did you learn from this trade?"
                rows={3}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCreateEntry}
                disabled={!newEntry.title.trim()}
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
          <TerraStat label="Entries" value={journalEntries.length} sub="last 7 days" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Journal P&L" value={formatSignedMoney(total)} tone={total >= 0 ? "positive" : "negative"} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Best Mood" value="Disciplined" sub="avg +$280" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Streak" value="3 days" sub="entries logged" />
        </TerraCard>
      </div>

      <div className="space-y-4">
        {journalEntries.map((e) => (
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
            <p className="text-sm text-on-surface-variant">{e.notes}</p>
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
    </div>
  );
}
