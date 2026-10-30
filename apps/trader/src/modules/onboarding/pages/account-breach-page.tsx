"use client";

/**
 * Account Breach / Failed Evaluation — converted from stitch_screens/account_breach_failed_evaluation
 * Breach explanation, rule that triggered, and recovery options.
 *
 * Audit fix #2 (CRITICAL): this is the evaluation-failure outcome screen.
 * It renders from the challengeBreach fixture — the specific rule that
 * broke, a visual limit-vs-breach meter, plain-language explanation,
 * what the trader had achieved before the breach, and the retry path
 * (re-purchase with discount → marketplace, rules review, support).
 * Linked from My Challenges when a challenge ended in "Breached".
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraDrawdownMeter,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  formatMoney,
} from "@/components/terra/terra-ui";
import { challengeBreach } from "@/lib/fixtures/terra-fixtures";

export function AccountBreachPage() {
  const breach = challengeBreach;
  const breachedPct = Math.round((breach.breachedBy / breach.limit) * 100);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Evaluation Failed"
        description={`${breach.challenge} • Account #${breach.login} • ${breach.phase}`}
        actions={
          <TerraBadge tone="error" dot>
            Breached
          </TerraBadge>
        }
      />

      {/* What happened — the specific rule, in plain language */}
      <TerraCard className="border border-error/30 bg-error-container/40">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-headline text-lg font-bold text-on-error-container">
              {breach.rule} exceeded
            </p>
            <p className="text-sm text-on-error-container/80">
              Your equity fell {formatMoney(breach.breachedBy)} below the {breach.rule.toLowerCase()} of{" "}
              {formatMoney(breach.limit)} on{" "}
              {new Date(breach.breachedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              . Per the trading rules, the {breach.phase} evaluation ends when this limit is
              crossed — this protects you from oversized losses on a funded account.
            </p>
          </div>
        </div>
      </TerraCard>

      {/* Visual: how far past the limit */}
      <TerraCard>
        <TerraSectionTitle
          title="What triggered the breach"
          description={`${breach.breachedBy > 0 ? `${breachedPct}% past` : "At"} the ${breach.rule.toLowerCase()} — the meter turns red before the limit is crossed to warn you.`}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TerraDrawdownMeter
            label={breach.rule}
            used={breach.limit + breach.breachedBy}
            limit={breach.limit}
            remaining={0}
            description="limit crossed"
          />
          <div className="grid grid-cols-2 gap-3">
            <TerraCard className="p-4">
              <TerraStat label="Limit" value={formatMoney(breach.limit)} />
            </TerraCard>
            <TerraCard className="p-4">
              <TerraStat label="Exceeded by" value={formatMoney(breach.breachedBy)} tone="negative" />
            </TerraCard>
            <TerraCard className="p-4">
              <TerraStat
                label="Trading Days"
                value={`${breach.tradingDays}`}
                sub={`minimum ${breach.minTradingDays} — met ✓`}
                tone="positive"
              />
            </TerraCard>
            <TerraCard className="p-4">
              <TerraStat
                label="Best Day"
                value={`${breach.bestDayPct}%`}
                sub="of total profit — under 45% cap"
                tone="positive"
              />
            </TerraCard>
          </div>
        </div>
      </TerraCard>

      {/* You were otherwise on track — soften + inform */}
      <TerraCard>
        <p className="text-sm text-on-surface-variant">
          <strong className="text-on-surface">Good news:</strong> you met the minimum trading
          days and stayed inside the consistency rule. The only obstacle was the{" "}
          {breach.rule.toLowerCase()} — traders who retry with a daily stop-loss order in place
          pass at a much higher rate.
        </p>
      </TerraCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TerraCard>
          <TerraSectionTitle title="What you can do next" />
          <div className="space-y-3">
            <Link
              href={`/checkout?retry=${breach.accountId}`}
              className="block rounded-xl bg-primary px-5 py-3 text-center text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Retry {breach.challenge} with 50% discount
            </Link>
            <Link
              href="/challenge-comparison"
              className="block rounded-xl bg-surface-container-low px-5 py-3 text-center text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              Compare other programs
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
            <li>• Place a broker-side stop-out alert at 60% of the daily limit.</li>
            <li>• Avoid trading 30 min around high-impact news.</li>
            <li>• Track the daily loss meter on the risk dashboard.</li>
          </ul>
        </TerraCard>
      </div>
    </div>
  );
}
