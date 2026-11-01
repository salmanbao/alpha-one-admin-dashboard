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
 *
 * Educational context (audit): a trade-by-trade timeline of the breach
 * day with the running daily P&L, breach-type coaching (why the rule
 * exists + strategies that stay inside it), a targeted retry plan, and
 * links to in-app risk education — keyed by breach type from the
 * breachCoaching fixture.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraDrawdownMeter,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";
import {
  breachCoaching,
  breachDayTrades,
  challengeBreach,
} from "@/lib/fixtures/terra-fixtures";

export function AccountBreachPage() {
  const breach = challengeBreach;
  const breachedPct = Math.round((breach.breachedBy / breach.limit) * 100);
  const coaching = breachCoaching[breach.rule];

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

      {/* How it happened — trade by trade (audit: educational context) */}
      <TerraCard>
        <TerraSectionTitle
          title={`How the ${breach.rule.toLowerCase()} happened — trade by trade`}
          description={`The four trades of ${new Date(breach.breachedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}, with the running daily P&L. The breach was visible on the meter two trades before it ended the evaluation.`}
        />
        <TerraTable
          head={["Time", "Pair", "Side", "Trade P&L", "Running daily P&L", "Limit"]}
          rows={breachDayTrades.map((t, i) => {
            const crossed = t.running <= -breach.limit;
            const lastSafe = !crossed && breachDayTrades[i + 1] && breachDayTrades[i + 1].running <= -breach.limit;
            return [
              <span key="t" className="tabular-nums">{t.time}</span>,
              <span key="p" className="font-semibold">{t.pair}</span>,
              <span key="s" className="text-on-surface-variant">{t.side}</span>,
              <span key="pnl" className="tabular-nums text-error">{formatMoney(t.pnl)}</span>,
              <span key="run" className={`tabular-nums font-bold ${crossed ? "text-error" : lastSafe ? "text-tertiary" : ""}`}>
                {formatMoney(t.running)}
                {t.note && (
                  <span className={`mt-0.5 block text-[11px] font-normal ${crossed ? "text-error/90" : "text-on-surface-variant"}`}>
                    {t.note}
                  </span>
                )}
              </span>,
              <span key="lim" className="tabular-nums text-on-surface-variant">{formatMoney(breach.limit)}</span>,
            ];
          })}
        />
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
          <TerraSectionTitle
            title="What you can do next"
            description="Your retry comes with a targeted plan for this exact breach type."
          />
          <div className="space-y-3">
            {/* Targeted retry coaching (audit: educational context) */}
            <div className="rounded-xl bg-surface-container-low p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Your {breach.rule.toLowerCase()} retry plan
              </p>
              <ul className="space-y-1.5 text-sm text-on-surface-variant">
                {coaching.retryPlan.map((step) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="mt-0.5 text-primary">✓</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
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

        <div className="space-y-6">
          {/* Breach-type coaching (audit: educational context) */}
          <TerraCard>
            <TerraSectionTitle
              title={`Why the ${breach.rule.toLowerCase()} exists`}
              description="Not just the rule — the reason behind it."
            />
            <p className="text-sm text-on-surface-variant">{coaching.whyItExists}</p>
            <TerraSectionTitle title="What would have kept you inside it" />
            <ul className="space-y-2 text-sm text-on-surface-variant">
              {coaching.strategies.map((s) => (
                <li key={s} className="flex items-start gap-2">
                  <span className="mt-0.5 text-primary">→</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </TerraCard>

          {/* Educational content */}
          <TerraCard>
            <TerraSectionTitle
              title="Learn the skill that prevents this"
              description="In-app tools and content keyed to your breach type."
            />
            <ul className="space-y-1.5">
              {coaching.learnLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-container-low"
                  >
                    {l.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
