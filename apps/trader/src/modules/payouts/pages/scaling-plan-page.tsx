"use client";

/**
 * Scaling Plan — audit B #3
 *
 * The trader could see *that* the next tier was close (a line on the
 * dashboard, a checklist on the eligibility page) but never what the
 * program's scaling ladder looks like end to end, why each requirement
 * exists, or which payouts actually count toward it. This screen makes
 * the whole path visible up front: readiness meters, the rules in plain
 * language, the tier ladder with what each step costs, and the payout
 * history with the "counts / doesn't count" reason attached.
 *
 * All values come from the scalingPlan / scalingTiers fixtures — the
 * same source the eligibility page and dashboard card read, so the three
 * surfaces can never disagree.
 */

import Link from "next/link";
import { useMemo } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  TerraProgress,
} from "@/components/terra/terra-ui";
import { scalingPlan, scalingTiers } from "@/lib/fixtures/terra-fixtures";
import { Check, Info, X } from "lucide-react";

export function ScalingPlanPage() {
  const requirements = useMemo(
    () => [
      {
        key: "payouts",
        label: "Consecutive counted payouts",
        value: scalingPlan.consecutivePayouts,
        target: scalingPlan.requiredPayouts,
        unit: "",
        why: "Three payouts in a row prove the account withdraws on a schedule, not that one lucky month was cashed out.",
      },
      {
        key: "days",
        label: "Funded trading days",
        value: scalingPlan.fundedDays,
        target: scalingPlan.requiredFundedDays,
        unit: " days",
        why: "A minimum funded history keeps the gain from being a single-session result.",
      },
      {
        key: "gain",
        label: "Net gain on the account",
        value: scalingPlan.gainPct,
        target: scalingPlan.requiredGainPct,
        unit: "%",
        why: "The tier only grows behind real performance — the firm is sizing up capital it has already earned back.",
      },
    ],
    [],
  );

  const ready = requirements.every((r) => r.value >= r.target);
  const currentIndex = scalingTiers.findIndex((t) => t.tier === scalingPlan.currentTier);
  const overallPct = Math.round(
    (requirements.reduce((sum, r) => sum + Math.min(1, r.value / r.target), 0) /
      requirements.length) *
      100,
  );

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Scaling Plan"
        description={`${scalingPlan.currentTier} → ${scalingPlan.nextTier} • profit split ${scalingPlan.currentSplit} → ${scalingPlan.nextSplit}`}
        actions={
          <TerraBadge tone={ready ? "success" : "secondary"} dot pulse={ready}>
            {ready ? "Ready to scale" : `${overallPct}% to next tier`}
          </TerraBadge>
        }
      />

      {/* Readiness */}
      <TerraCard>
        <TerraSectionTitle
          title={`Requirements for ${scalingPlan.nextTier}`}
          description="All three must be met at the same time — a single missed requirement holds the tier."
        />
        <div className="space-y-5">
          {requirements.map((r) => {
            const pct = Math.min(100, Math.round((r.value / r.target) * 100));
            const met = r.value >= r.target;
            return (
              <div key={r.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-on-surface">
                    <span
                      className={`flex h-4.5 w-4.5 items-center justify-center rounded-full ${
                        met ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-surface-container-high text-on-surface-variant"
                      }`}
                      aria-hidden="true"
                    >
                      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </span>
                    {r.label}
                    <span className="sr-only">{met ? "— met" : "— not yet met"}</span>
                  </span>
                  <span className="tabular-nums text-on-surface-variant">
                    {r.value}
                    {r.unit} of {r.target}
                    {r.unit}
                  </span>
                </div>
                <TerraProgress value={pct} height="h-3" />
                <p className="text-xs text-on-surface-variant">{r.why}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Only the last {scalingPlan.requiredPayouts} consecutive payouts count. A payout below
            the program minimum resets the streak — see{" "}
            <Link
              href="/payout-eligibility"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              eligibility
            </Link>{" "}
            for the amounts.
          </span>
        </p>
      </TerraCard>

      {/* How scaling works */}
      <TerraCard>
        <TerraSectionTitle
          title="How scaling works"
          description="The mechanics behind the meters above, so nothing about the next tier is a surprise."
        />
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: "1",
              title: "Withdraw on schedule",
              body: `Request payouts as they open. Each one that clears the program minimum is logged against your streak (${scalingPlan.consecutivePayouts}/${scalingPlan.requiredPayouts} so far).`,
            },
            {
              step: "2",
              title: "Keep the streak intact",
              body: `The count is consecutive: a payout below the minimum, or a skipped cycle, resets it. History below shows exactly which requests counted.`,
            },
            {
              step: "3",
              title: "Hold days and gain",
              body: `${scalingPlan.requiredFundedDays} funded days and ${scalingPlan.requiredGainPct}% net gain run in parallel with the payout streak — they do not reset it.`,
            },
            {
              step: "4",
              title: "Tier and split increase",
              body: `On the next payout cycle the account moves to ${scalingPlan.nextTier} and the split becomes ${scalingPlan.nextSplit} — no new challenge, no re-verification.`,
            },
          ].map((item) => (
            <li key={item.step} className="rounded-xl bg-surface-container-low p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-fixed text-xs font-bold text-on-primary-fixed-variant">
                {item.step}
              </span>
              <p className="mt-2 text-sm font-semibold text-on-surface">{item.title}</p>
              <p className="mt-1 text-xs text-on-surface-variant">{item.body}</p>
            </li>
          ))}
        </ol>
      </TerraCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ladder */}
        <TerraCard>
          <TerraSectionTitle
            title="Tier ladder"
            description="What each level pays and what it costs to enter."
          />
          <TerraTable
            head={["Tier", "Split", "Enters at", "Status"]}
            rows={scalingTiers.map((t, i) => {
              const isCurrent = i === currentIndex;
              const isNext = i === currentIndex + 1;
              const passed = currentIndex >= 0 && i < currentIndex;
              return [
                <span key="tier" className="font-semibold">
                  {t.tier}
                  {isCurrent && (
                    <TerraBadge tone="primary" className="ml-2">
                      Current
                    </TerraBadge>
                  )}
                </span>,
                <span key="split" className="tabular-nums">{t.split}</span>,
                <span key="req" className="text-xs text-on-surface-variant">
                  {t.enter
                    ? `${t.enter.payouts} payouts • ${t.enter.fundedDays}d • ${t.enter.gainPct}%`
                    : "Starting tier"}
                </span>,
                <span key="st">
                  {isCurrent ? (
                    <TerraBadge tone="primary">You are here</TerraBadge>
                  ) : isNext ? (
                    <TerraBadge tone="tertiary">Next</TerraBadge>
                  ) : passed ? (
                    <TerraBadge tone="success">Reached</TerraBadge>
                  ) : (
                    <TerraBadge tone="neutral">Locked</TerraBadge>
                  )}
                </span>,
              ];
            })}
          />
          <p className="pt-3 text-xs text-on-surface-variant">
            {scalingTiers.map((t) => `${t.tier}: ${t.note}`).join(" ")}
          </p>
        </TerraCard>

        {/* Payout history */}
        <TerraCard>
          <TerraSectionTitle
            title="Payout history"
            description="Which requests moved the needle — and which one reset the streak."
          />
          <TerraTable
            head={["Reference", "Requested", "Counts", "Why"]}
            rows={scalingPlan.history.map((h) => [
              <span key="ref" className="font-semibold">#{h.reference}</span>,
              <span key="at" className="whitespace-nowrap tabular-nums text-on-surface-variant">
                {new Date(h.at).toLocaleDateString([], { month: "short", day: "numeric" })}
              </span>,
              <span key="count">
                <TerraBadge tone={h.counted ? "success" : "error"}>
                  {h.counted ? "Counted" : "Not counted"}
                </TerraBadge>
              </span>,
              <span key="why" className="text-xs text-on-surface-variant">
                {h.counted
                  ? "Cleared the program minimum and kept the streak alive."
                  : (h.note ?? "Did not meet the minimum.")}
              </span>,
            ])}
          />
          <div className="mt-4 grid grid-cols-2 gap-4">
            <TerraStat
              label="Current split"
              value={scalingPlan.currentSplit}
              sub="of every dollar withdrawn"
            />
            <TerraStat
              label="After scaling"
              value={scalingPlan.nextSplit}
              sub={`at ${scalingPlan.nextTier}`}
              tone="positive"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <TerraStat
              label="Next tier size"
              value={scalingPlan.nextTier}
              sub="firm capital allocated"
            />
            <TerraStat
              label="Remaining"
              value={`${Math.max(0, scalingPlan.requiredPayouts - scalingPlan.consecutivePayouts)} payouts`}
              sub={`of ${scalingPlan.requiredPayouts} consecutive`}
            />
          </div>
        </TerraCard>
      </div>

      <TerraCard className="bg-primary-fixed/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-headline font-bold text-on-primary-fixed-variant">
              Want the full picture first?
            </h3>
            <p className="mt-1 text-xs text-on-primary-fixed-variant/80">
              The eligibility checklist shows the payout rules this plan depends on, and the
              program rules page lists the thresholds verbatim.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/payout-eligibility"
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:bg-primary/90"
            >
              Payout eligibility
            </Link>
            <Link
              href="/payout-history"
              className="rounded-xl border border-primary/40 px-4 py-2.5 text-xs font-bold text-on-primary-fixed-variant hover:bg-surface-container-low"
            >
              Payout history
            </Link>
          </div>
        </div>
      </TerraCard>
    </div>
  );
}
