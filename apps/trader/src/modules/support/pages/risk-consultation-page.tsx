"use client";

/**
 * Risk Consultation — personalized with trader's breach history, win rate,
 * drawdown usage, and recommended actions (audit #8 MEDIUM).
 *
 * Unlike the generic booking UI, this surface surfaces the trader's own
 * risk metrics so the consultation is targeted and educational.
 */

import { useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { useActiveAccount } from "@/lib/platform/account-context";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  breachCoaching,
  challengeBreach,
  terraTrades,
  type TerraTrade,
} from "@/lib/fixtures/terra-fixtures";

const days = ["Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16"];
const slots = ["09:00", "10:30", "13:00", "15:30", "17:00"];
const topics = ["Daily loss control", "Drawdown recovery", "Consistency rule", "Psychology"];

export function RiskConsultationPage() {
  const { activeAccount } = useActiveAccount();
  const { navigate } = usePlatform();

  // Compute trader-specific metrics from fixtures
  const accTrades = terraTrades.filter((t: TerraTrade) => t.accountId === activeAccount.id);
  const wins = accTrades.filter((t: TerraTrade) => t.pnl > 0).length;
  const winRate = accTrades.length ? Math.round((wins / accTrades.length) * 100) : 0;

  // Breach history from fixtures keyed by rule
  const breachRule = challengeBreach?.rule ?? "Daily Loss Limit";
  const coaching = breachCoaching[breachRule];

  const [day, setDay] = useState(days[0]);
  const [slot, setSlot] = useState(slots[0]);
  const [topic, setTopic] = useState(topics[0]);
  const [booked, setBooked] = useState(false);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Risk Consultation"
        description="30-minute 1:1 session with a Terra risk coach"
        actions={<TerraBadge tone="primary">Free • 2 sessions/month</TerraBadge>}
      />

      {/* Trader-specific risk metrics panel */}
      <TerraCard className="sticky top-24 flex flex-col gap-4">
        <TerraSectionTitle title="Your Risk Profile" />
        <div className="space-y-4 rounded-xl bg-surface-container-low p-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Win Rate</p>
              <p className="text-3xl font-bold text-on-surface">{winRate}%</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Daily Loss</p>
              <p className="text-3xl font-bold text-primary">{formatMoney(activeAccount.dailyLossRemaining)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Max DD Remaining</p>
              <p className="text-3xl font-bold text-tertiary">{formatMoney(activeAccount.maxDdRemaining)}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Current P&L</p>
              <p className="text-3xl font-bold" style={{ color: activeAccount.pnl >= 0 ? "var(--emerald-600)" : "var(--rose-600)" }}>
                {formatMoney(activeAccount.pnl)} ({activeAccount.pnlPercent.toFixed(2)}%)
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-on-surface-variant">Recent Breach History</p>
          <p className="text-sm text-on-surface-variant">
            Primary rule at risk: <strong className="text-on-surface">{breachRule}</strong>
          </p>
          <p className="text-sm text-on-surface-variant">
            {coaching?.whyItExists.substring(0, 120)}...
          </p>
        </div>
      </TerraCard>

      {booked ? (
        <TerraCard className="mx-auto max-w-lg flex flex-col items-center gap-3 py-10 text-center">
          <span className="text-4xl">📅</span>
          <h2 className="font-headline text-xl font-bold text-on-surface">Session booked</h2>
          <p className="text-sm text-on-surface-variant">
            {day} at {slot} UTC — "{topic}". A calendar invite was sent to your email.
          </p>
          <button
            type="button"
            onClick={() => setBooked(false)}
            className="rounded-xl bg-surface-container-low px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Book another
          </button>
        </TerraCard>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <TerraCard>
              <TerraSectionTitle title="Choose a day" />
              <div className="flex flex-wrap gap-2">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDay(d)}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm font-bold transition-all",
                      day === d
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </TerraCard>

            <TerraCard>
              <TerraSectionTitle title="Choose a time (UTC)" />
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSlot(s)}
                    className={cn(
                      "rounded-xl px-4 py-2.5 font-mono text-sm font-bold transition-all",
                      slot === s
                        ? "bg-primary text-on-primary shadow-sm"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </TerraCard>

            <TerraCard>
              <TerraSectionTitle title="Topic" />
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    className={cn(
                      "rounded-full px-4 py-2 text-xs font-bold transition-all",
                      topic === t
                        ? "bg-primary-fixed text-on-primary-fixed-variant"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </TerraCard>
          </div>

          <TerraCard className="sticky top-24 flex flex-col gap-4">
            <TerraSectionTitle title="Summary" />
            <div className="space-y-2 rounded-xl bg-surface-container-low p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">When</span>
                <span className="font-semibold text-on-surface">{day}, {slot}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Duration</span>
                <span className="text-on-surface">30 minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Topic</span>
                <span className="font-semibold text-on-surface">{topic}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBooked(true)}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Confirm booking
            </button>
          </TerraCard>
        </div>
      )}
    </div>
  );
}