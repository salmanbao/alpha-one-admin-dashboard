"use client";

/**
 * Account Breach / Failed Evaluation — converted from stitch_screens/account_breach_failed_evaluation
 * Breach explanation, rule that triggered, and recovery options.
 */

import Link from "next/link";
import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle, TerraStat, formatMoney } from "@/components/terra/terra-ui";

const breach = {
  rule: "Daily Loss Limit",
  limit: 3000,
  exceededBy: 214,
  at: "2026-10-06 15:42 UTC",
  account: "Terra Starter $25K (Phase 1)",
  login: "097724",
};

export function AccountBreachPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Evaluation Failed"
        description={`Account #${breach.login} • ${breach.account}`}
        actions={
          <TerraBadge tone="error" dot>
            Breached
          </TerraBadge>
        }
      />

      <TerraCard className="border border-error/30 bg-error-container/40">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-headline text-lg font-bold text-on-error-container">
              Daily loss limit exceeded
            </p>
            <p className="text-sm text-on-error-container/80">
              Your equity fell {formatMoney(breach.exceededBy)} below the daily loss threshold of{" "}
              {formatMoney(breach.limit)} on {breach.at}. The account is now closed per the trading
              rules.
            </p>
          </div>
        </div>
      </TerraCard>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Rule" value={breach.rule} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Limit" value={formatMoney(breach.limit)} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Exceeded by" value={formatMoney(breach.exceededBy)} tone="negative" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Account" value={`#${breach.login}`} />
        </TerraCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TerraCard>
          <TerraSectionTitle title="What you can do next" />
          <div className="space-y-3">
            <Link
              href="/marketplace"
              className="block rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Retry with 50% discount
            </Link>
            <Link
              href="/rules"
              className="block rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Review the trading rules
            </Link>
            <Link
              href="/support"
              className="block rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Contact support
            </Link>
          </div>
        </TerraCard>

        <TerraCard>
          <TerraSectionTitle title="Tips to avoid breaches" />
          <ul className="space-y-2 text-sm text-on-surface-variant">
            <li>• Risk ≤ 1% of balance per trade.</li>
            <li>• Set a hard daily stop at 2 losing trades.</li>
            <li>• Avoid trading 30 min around high-impact news.</li>
            <li>• Track the daily loss meter on the risk dashboard.</li>
          </ul>
        </TerraCard>
      </div>
    </div>
  );
}
