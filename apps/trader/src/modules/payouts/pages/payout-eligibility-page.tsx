"use client";

/**
 * Payout Eligibility — converted from stitch_screens/payout_eligibility
 * Eligibility checklist + next payout summary + scaling plan (M3-3C)
 * + payout schedule management (M10 Payout Scheduling).
 */

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import {
  terraPayouts,
  terraAccounts,
  scalingPlan,
  payoutSchedule,
  payoutScheduleOptions,
} from "@/lib/fixtures/terra-fixtures";

const checklist = (account: { balance: number; pnl: number }) => [
  { label: "Account active and in good standing", ok: true, note: "Verified" },
  { label: "Minimum balance > $1,000", ok: true, note: `${account.balance} balance` },
  { label: "P&L is positive since last payout", ok: true, note: `+${account.pnl}` },
  { label: "No open risk breaches", ok: true, note: "Clear" },
  { label: "Payout method configured", ok: true, note: "Bank Transfer (Wise)" },
  { label: "Bi-weekly window is open", ok: true, note: "Next window opens in 4 days" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PayoutEligibilityPage() {
  const params = useSearchParams();
  const accountId = params.get("id") || "acc-092841";
  const account = terraAccounts.find((a) => a.id === accountId) ?? terraAccounts[0];
  const availableSince = account.payoutNote ? "Available in 4 days" : "Aware 14 days";
  const [schedule, setSchedule] = useState(payoutSchedule.current);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const scalePct = Math.round(
    (scalingPlan.consecutivePayouts / scalingPlan.requiredPayouts) * 100,
  );
  const scaleChecks = [
    {
      label: "Consecutive counted payouts",
      value: `${scalingPlan.consecutivePayouts} of ${scalingPlan.requiredPayouts}`,
      ok: scalingPlan.consecutivePayouts >= scalingPlan.requiredPayouts,
    },
    {
      label: "Days funded",
      value: `${scalingPlan.fundedDays} of ${scalingPlan.requiredFundedDays}`,
      ok: scalingPlan.fundedDays >= scalingPlan.requiredFundedDays,
    },
    {
      label: "Account gain",
      value: `${scalingPlan.gainPct}% of ${scalingPlan.requiredGainPct}%`,
      ok: scalingPlan.gainPct >= scalingPlan.requiredGainPct,
    },
  ];
  const scaleReady = scaleChecks.every((c) => c.ok);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Payout Eligibility"
        description={`${account.name} • Login #${account.login}`}
        actions={
          <>
            <TerraBadge tone="primary">Eligible</TerraBadge>
            <TerraBadge tone="success" dot>
              Payout window open
            </TerraBadge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Eligibility checklist" />
            <div className="space-y-3">
              {checklist(account).map((c) => (
                <div key={c.label} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{c.label}</p>
                    <p className="text-xs text-on-surface-variant">{c.note}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${c.ok ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-error-container text-on-error-container"}`}>
                    {c.ok ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Recent payouts" />
            <div className="space-y-2">
              {terraPayouts.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm">
                  <div>
                    <p className="font-bold text-on-surface">{p.reference}</p>
                    <p className="text-xs text-on-surface-variant">{p.requestedAt.slice(0, 10)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-on-surface">{formatMoney(p.amount)}</p>
                    <TerraBadge tone={p.status === "paid" ? "success" : "tertiary"}>{p.status}</TerraBadge>
                  </div>
                </div>
              ))}
            </div>
          </TerraCard>

          {/* Scaling plan (M3-3C + M10 "check scaling eligibility") */}
          <TerraCard>
            <TerraSectionTitle
              title="Scaling plan"
              description="Hit consecutive payouts to auto-scale your account size and profit split."
              actions={
                <TerraBadge tone={scaleReady ? "success" : "primary"} dot={!scaleReady}>
                  {scaleReady ? "Ready to scale" : `${scalingPlan.consecutivePayouts}/${scalingPlan.requiredPayouts} payouts`}
                </TerraBadge>
              }
            />
            <div className="mb-4 rounded-xl bg-surface-container-low p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm font-bold text-on-surface">
                  {scalingPlan.currentTier} → {scalingPlan.nextTier}
                </span>
                <span className="text-xs font-semibold text-on-surface-variant">
                  split {scalingPlan.currentSplit} →{" "}
                  <span className="text-primary">{scalingPlan.nextSplit}</span>
                </span>
              </div>
              <TerraProgress value={scalePct} height="h-2" />
              <div className="mt-1.5 flex justify-between text-[11px] text-on-surface-variant">
                <span>Consecutive counted payouts</span>
                <span>
                  {scalingPlan.consecutivePayouts} of {scalingPlan.requiredPayouts} required
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {scaleChecks.map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl bg-surface-container px-3 py-2.5 text-xs"
                >
                  <p className="text-on-surface-variant">{c.label}</p>
                  <p className="mt-0.5 flex items-center justify-between gap-2">
                    <strong className="tabular-nums text-on-surface">{c.value}</strong>
                    <span className={c.ok ? "font-bold text-primary" : "font-bold text-on-surface-variant"}>
                      {c.ok ? "✓ met" : "pending"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 pt-4">
              <div className="flex flex-wrap gap-1.5">
                {scalingPlan.history.map((h) => (
                  <span
                    key={h.reference}
                    title={
                      h.counted
                        ? `${h.reference} — counted toward scaling`
                        : `${h.reference} — ${h.note}`
                    }
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      h.counted
                        ? "bg-primary-fixed text-on-primary-fixed-variant"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {h.reference} {h.counted ? "✓" : "✕"}
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-on-surface-variant">
                Only the last {scalingPlan.requiredPayouts} consecutive payouts count.
              </span>
            </div>
          </TerraCard>
        </div>

        {/* Right column: next payout + schedule */}
        <div className="flex flex-col gap-6">
          <TerraCard className="flex flex-col gap-4">
            <TerraSectionTitle title="Next payout" />
            <div className="space-y-3 rounded-xl bg-surface-container-low p-4">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Eligible amount</span>
                <span className="font-bold text-on-surface">{formatMoney(account.balance)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Recommended</span>
                <span className="font-bold text-primary">{formatMoney(account.pnl)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Status</span>
                <TerraBadge tone="primary">{availableSince}</TerraBadge>
              </div>
            </div>
            <Link
              href="/payout-request"
              className="block w-full rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Open Payout
            </Link>
          </TerraCard>

          {/* Payout schedule (M10) */}
          <TerraCard className="flex flex-col gap-4">
            <TerraSectionTitle
              title="Payout schedule"
              description="Choose how often eligible payouts are submitted."
            />
            <div className="space-y-3 rounded-xl bg-surface-container-low p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Cycle</span>
                <span className="font-bold text-on-surface">
                  {schedule} • every {payoutSchedule.cycleDays} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Next window</span>
                <span className="font-bold text-on-surface">
                  {fmtDate(payoutSchedule.windowOpensAt)} – {fmtDate(payoutSchedule.windowClosesAt)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-on-surface-variant">Cutoff</span>
                <span className="text-right font-semibold text-on-surface">
                  {payoutSchedule.cutoffNote}
                </span>
              </div>
            </div>
            <label className="space-y-1.5 text-xs font-semibold text-on-surface-variant">
              Preference
              <select
                value={schedule}
                onChange={(e) => {
                  setSchedule(e.target.value as (typeof payoutScheduleOptions)[number]);
                  setSavedAt(e.target.value);
                }}
                className="block w-full rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-sm font-semibold text-on-surface focus:border-primary focus:outline-none"
                aria-label="Payout schedule preference"
              >
                {payoutScheduleOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            {savedAt && (
              <p className="text-[11px] font-semibold text-primary">
                ✓ Schedule set to {savedAt} (demo — not persisted)
              </p>
            )}
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
