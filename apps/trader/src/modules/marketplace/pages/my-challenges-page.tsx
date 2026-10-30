"use client";

/**
 * My Challenges — converted from stitch_screens/my_challenges
 * Overview of active and completed challenges with progress.
 *
 * Audit fixes on this screen:
 *   #6 (HIGH) persistent drawdown meters — every active challenge card
 *     shows daily-loss and max-drawdown usage meters (green/amber/red)
 *     next to the profit target, so risk is visible without navigating
 *     to the risk dashboard.
 *   #2 (CRITICAL) a completed "Breached" challenge links to the
 *     Evaluation Failed outcome screen.
 *   #8 (MEDIUM) first-use empty state with guided next steps.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraDrawdownMeter,
  TerraEmpty,
  TerraPageHeader,
  TerraProgress,
  formatMoney,
} from "@/components/terra/terra-ui";
import { terraAccounts, terraRiskLimits } from "@/lib/fixtures/terra-fixtures";

const completed = [
  { id: "ch-starter-25k-old", name: "Terra Starter $25K", result: "Passed", date: "2026-05-18" },
  { id: "ch-pro-50k-old", name: "Terra Pro $50K", result: "Breached", date: "2026-04-22" },
];

export function MyChallengesPage() {
  if (terraAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <TerraPageHeader title="My Challenges" description="0 active • 0 completed" />
        <TerraEmpty
          title="No challenges yet"
          description="Pick a program in the marketplace to start your evaluation. You'll track profit targets, drawdown limits and trading days here."
          actionLabel="Browse the marketplace"
          actionHref="/marketplace"
          steps={[
            "Choose a program size and phase structure",
            "Complete KYC so payouts unlock later",
            "Trade the evaluation while the meters stay green",
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="My Challenges"
        description={`${terraAccounts.length} active • ${completed.length} completed`}
        actions={
          <Link
            href="/marketplace"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            + New Challenge
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {terraAccounts.map((acc) => {
          const limits = terraRiskLimits[acc.id] ?? { daily: 1000, maxDd: 5000 };
          const dailyUsed = Math.max(0, limits.daily - acc.dailyLossRemaining);
          const ddUsed = Math.max(0, limits.maxDd - acc.maxDdRemaining);
          return (
            <TerraCard key={acc.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-on-surface-variant">
                  #{acc.login}
                </span>
                <TerraBadge tone={acc.status === "active" ? "primary" : "secondary"} dot={acc.status === "active"}>
                  {acc.phase}
                </TerraBadge>
              </div>
              <div>
                <h2 className="font-headline font-bold text-on-surface">{acc.name}</h2>
                <p className="text-xs text-on-surface-variant">
                  Balance {formatMoney(acc.balance)} • P&L +
                  {formatMoney(acc.pnl)}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-on-surface">Profit target</span>
                  <span className="text-on-surface-variant">{acc.targetProgress}%</span>
                </div>
                <TerraProgress value={acc.targetProgress} />
              </div>
              {/* Persistent drawdown meters (audit #6) — risk at a glance */}
              <div className="space-y-2">
                <TerraDrawdownMeter
                  label="Daily loss"
                  used={dailyUsed}
                  limit={limits.daily}
                  remaining={acc.dailyLossRemaining}
                />
                <TerraDrawdownMeter
                  label="Max drawdown"
                  used={ddUsed}
                  limit={limits.maxDd}
                  remaining={acc.maxDdRemaining}
                />
              </div>
              <Link
                href={`/account-detail?id=${acc.id}`}
                className="mt-auto rounded-xl bg-surface-container-low py-2 text-center text-xs font-bold text-on-surface hover:bg-surface-container"
              >
                View challenge →
              </Link>
            </TerraCard>
          );
        })}
      </div>

      <TerraCard>
        <h2 className="pb-3 font-headline text-lg font-bold text-on-surface">Completed</h2>
        <div className="space-y-2">
          {completed.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3"
            >
              <div>
                <p className="text-sm font-bold text-on-surface">{c.name}</p>
                <p className="text-xs text-on-surface-variant">{c.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <TerraBadge tone={c.result === "Passed" ? "success" : "error"}>{c.result}</TerraBadge>
                {c.result === "Breached" && (
                  <Link
                    href="/account-breach"
                    className="rounded-lg bg-error-container px-3 py-1.5 text-xs font-bold text-on-error-container hover:opacity-80"
                  >
                    Why & how to retry →
                  </Link>
                )}
                {c.result === "Passed" && (
                  <Link
                    href="/certificates"
                    className="rounded-lg bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high"
                  >
                    Certificate →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </TerraCard>
    </div>
  );
}
