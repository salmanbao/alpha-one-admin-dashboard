"use client";

/**
 * Evaluation Passed — converted from stitch_screens/evaluation_passed
 * Celebration screen: phase passed → next phase / funded.
 */

import Link from "next/link";
import { TerraBadge, TerraCard, TerraPageHeader, TerraStat, formatMoney } from "@/components/terra/terra-ui";
import { primaryAccount } from "@/lib/fixtures/terra-fixtures";

const nextSteps = [
  { title: "Funded account credentials", note: "Email delivered when the new account is live", done: false },
  { title: "Profit split upgrades to 85/15", note: "Effective on your first funded trade", done: false },
  { title: "Payout schedule", note: "First payout eligible in 14 days", done: false },
];

export function EvaluationPassedPage() {
  const acc = primaryAccount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-4xl text-on-primary">
          🏆
        </span>
        <h1 className="font-headline text-3xl font-bold text-on-surface">
          Congratulations — you passed!
        </h1>
        <p className="max-w-md text-sm text-on-surface-variant">
          You completed the Phase 1 evaluation on #{acc.login} without breaching any rules.
        </p>
        <div className="flex gap-2">
          <TerraBadge tone="success">Phase 1 complete</TerraBadge>
          <TerraBadge tone="primary" dot pulse>
            Moving to Phase 2
          </TerraBadge>
        </div>
      </div>

      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Final P&L" value={`+${formatMoney(acc.pnl)}`} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Win Rate" value="68%" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Trading Days" value="12" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Rule Violations" value="0" tone="positive" />
        </TerraCard>
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        <TerraCard>
          <h2 className="pb-3 font-headline text-lg font-bold text-on-surface">What's next</h2>
          <ol className="space-y-4">
            {nextSteps.map((s, i) => (
              <li key={s.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-bold text-on-surface">{s.title}</p>
                  <p className="text-xs text-on-surface-variant">{s.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </TerraCard>

        <div className="flex justify-center gap-3">
          <Link
            href="/my-accounts"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            View my accounts
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
