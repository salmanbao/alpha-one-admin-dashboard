"use client";

/**
 * Trading Plan Builder — converted from stitch_screens/trading_plan_builder
 * Structured plan form: strategy, sessions, risk rules.
 */

import { useState } from "react";
import { TerraCard, TerraPageHeader, TerraSectionTitle, TerraBadge } from "@/components/terra/terra-ui";

const planSections = [
  {
    title: "Strategy",
    items: [
      { label: "Primary setup", value: "London session reversal + NY trend continuation" },
      { label: "Timeframes", value: "H4 bias · H1 structure · M15 entry" },
      { label: "Indicators", value: "EMA 21/50, RSI divergence, volume profile" },
    ],
  },
  {
    title: "Sessions",
    items: [
      { label: "Trading window", value: "07:00–11:00 London · 13:30–16:00 New York" },
      { label: "Blackout", value: "No trades 30 min around high-impact news" },
      { label: "Max sessions/day", value: "2" },
    ],
  },
  {
    title: "Risk rules",
    items: [
      { label: "Risk per trade", value: "0.5% of account equity" },
      { label: "Daily loss cap", value: "2 hard stops (stops trading for the day)" },
      { label: "Max open positions", value: "3" },
      { label: "Weekly target", value: "1.5% (stop after reaching)" },
    ],
  },
  {
    title: "Review",
    items: [
      { label: "Daily review", value: "17:00 — journal entry required" },
      { label: "Weekly review", value: "Sunday — plan adjustments" },
      { label: "Monthly review", value: "First day of month — full plan audit" },
    ],
  },
];

export function TradingPlanBuilderPage() {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    planSections.forEach((s) => s.items.forEach((i) => { d[i.label] = i.value; }));
    return d;
  });

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Trading Plan Builder"
        description="Your written rules — the contract with yourself"
        actions={
          <>
            <TerraBadge tone="success">Active plan v4</TerraBadge>
            {editing ? (
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Save Plan
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Edit plan
              </button>
            )}
          </>
        }
      />

      {saved && (
        <div className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant">
          ✓ Plan saved — your rules are up to date.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {planSections.map((s) => (
          <TerraCard key={s.title}>
            <TerraSectionTitle title={s.title} />
            <div className="space-y-3">
              {s.items.map((i) => (
                <div key={i.label} className="rounded-xl bg-surface-container-low px-3.5 py-2.5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {i.label}
                  </span>
                  {editing ? (
                    <input
                      type="text"
                      value={draft[i.label] ?? i.value}
                      onChange={(e) => setDraft({ ...draft, [i.label]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 py-1.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-on-surface">{draft[i.label] ?? i.value}</span>
                  )}
                </div>
              ))}
            </div>
          </TerraCard>
        ))}
      </div>

      <TerraCard className="flex items-start gap-3 bg-secondary-fixed/60">
        <span className="text-lg">💡</span>
        <div>
          <p className="text-sm font-bold text-on-surface">Consistency check</p>
          <p className="text-xs text-on-surface-variant">
            Your best day accounts for 38% of total profit — under the 45% consistency rule. Keep it up.
          </p>
        </div>
      </TerraCard>
    </div>
  );
}
