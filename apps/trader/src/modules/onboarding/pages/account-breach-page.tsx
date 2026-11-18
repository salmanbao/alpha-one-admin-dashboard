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
import { useLifecycleLog } from "@pfaas/lifecycle";
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
import { useActiveAccount } from "@/lib/platform/account-context";
import { useTrading } from "@/lib/trading/trading-context";

/** Narrow an unknown lifecycle-payload value to a display string. */
const payloadText = (v: unknown, fallback = ""): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : fallback;

export function AccountBreachPage() {
  const breach = challengeBreach;
  const breachedPct = Math.round((breach.breachedBy / breach.limit) * 100);
  const coaching = breachCoaching[breach.rule];

  const lifecycleEvents = useLifecycleLog();
  // Oldest-first log → the most recent hard-breach is the last match.
  const engineBreach = lifecycleEvents
    .filter((e) => e.name === "risk.alert.raised" && e.payload?.severity === "hard-breach")
    .at(-1);

  const { activeAccountId } = useActiveAccount();
  const { closedTrades } = useTrading();

  // Breach account: the event's account, falling back to the active one.
  const breachAccountId = payloadText(engineBreach?.payload?.accountId) || activeAccountId;
  const breachTrades = closedTrades.filter((t) => t.accountId === breachAccountId);

  const ruleId = payloadText(engineBreach?.payload?.ruleId);
  const ruleName = payloadText(engineBreach?.payload?.ruleName, "Risk rule");
  const ruleVersion =
    engineBreach && typeof engineBreach.payload.ruleVersion === "number"
      ? engineBreach.payload.ruleVersion
      : null;
  const operator = payloadText(engineBreach?.payload?.operator);
  const threshold = payloadText(engineBreach?.payload?.threshold);
  const observedValue = payloadText(engineBreach?.payload?.value);
  const observedPct =
    engineBreach && typeof engineBreach.payload.pct === "number"
      ? ` (${engineBreach.payload.pct}%)`
      : "";
  const detail = payloadText(engineBreach?.payload?.detail);
  const thresholdRow = `${
    operator ? `${operator} ` : ""
  }threshold ${threshold} · observed ${observedValue}${observedPct}`;
  const accountLogin = payloadText(engineBreach?.payload?.accountLogin, breachAccountId);

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

      {/* R9 W1 (UC-T3 + UC-O9) — rule-triggered breach evidence replay. */}
      <TerraCard>
        <TerraSectionTitle
          title="Breach evidence"
          description={
            engineBreach
              ? "Rule-triggered breach (Demo) — captured from this session's lifecycle log."
              : undefined
          }
          actions={
            engineBreach ? (
              <TerraBadge tone="error" dot>
                Hard breach
              </TerraBadge>
            ) : undefined
          }
        />
        {engineBreach ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
              <strong>Rule-triggered breach (Demo):</strong> {ruleName} — {detail}. Cited rule:{" "}
              {ruleId}.
            </div>
            <div className="space-y-1.5 text-sm">
              <p>
                <strong className="text-on-surface">Rule: </strong>
                <span className="text-on-surface-variant">
                  {ruleId} — {ruleName}
                  {ruleVersion !== null ? ` · Rules v${ruleVersion}` : ""}
                </span>
              </p>
              <p className="tabular-nums">
                <strong className="text-on-surface">Threshold vs observed: </strong>
                <span className="text-on-surface-variant">{thresholdRow}</span>
              </p>
              {detail && <p className="text-on-surface-variant">{detail}</p>}
              <p>
                <strong className="text-on-surface">Detected: </strong>
                <span className="tabular-nums text-on-surface-variant">
                  {new Date(engineBreach.at).toLocaleString()}
                </span>
              </p>
            </div>
            <div>
              <h3 className="font-headline text-sm font-bold text-on-surface">
                Closed trades behind the loss
              </h3>
              {breachTrades.length === 0 ? (
                <p className="mt-1 text-sm text-on-surface-variant">
                  No closed trades recorded in this session (Demo)
                </p>
              ) : (
                <div className="mt-2">
                  <TerraTable
                    head={["Closed", "Symbol", "Side", "Lots", "P&L"]}
                    rows={breachTrades.map((t) => [
                      <span key="closed" className="tabular-nums">
                        {new Date(t.closedAt).toLocaleString()}
                      </span>,
                      <span key="symbol" className="font-semibold">
                        {t.symbol}
                      </span>,
                      <span key="side" className="text-on-surface-variant">
                        {t.side}
                      </span>,
                      <span key="lots" className="tabular-nums">
                        {String(t.lots)}
                      </span>,
                      <span
                        key="pnl"
                        className={`tabular-nums ${t.pnl < 0 ? "text-error" : ""}`}
                      >
                        {formatMoney(t.pnl)}
                      </span>,
                    ])}
                  />
                </div>
              )}
            </div>
            <Link
              href="/risk-dashboard"
              className="inline-block rounded-lg px-3 py-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Open the equity-vs-drawdown-floor replay →
            </Link>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            (Demo fixture) — no rule-triggered breach recorded in this session
          </p>
        )}
      </TerraCard>

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

      {/* R9 W1 (UC-O9) — printable evidence packet for the same facts. */}
      <TerraCard>
        <TerraSectionTitle
          title="Evidence packet"
          description="(Demo evidence packet) — the same rule-triggered facts as Breach evidence, stacked for printing."
          actions={
            <button
              type="button"
              onClick={() => window.print()}
              aria-label="Print the demo evidence packet"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              Print this packet
            </button>
          }
        />
        {engineBreach ? (
          <div className="space-y-3 text-sm">
            <ul className="space-y-1.5">
              <li>
                <strong className="text-on-surface">Account: </strong>
                <span className="text-on-surface-variant">
                  {accountLogin !== breachAccountId
                    ? `#${accountLogin} · ${breachAccountId}`
                    : breachAccountId}
                </span>
              </li>
              <li>
                <strong className="text-on-surface">Rule: </strong>
                <span className="text-on-surface-variant">
                  {ruleId} — {ruleName}
                  {ruleVersion !== null ? ` · Rules v${ruleVersion}` : ""}
                </span>
              </li>
              <li className="tabular-nums">
                <strong className="text-on-surface">Threshold vs observed: </strong>
                <span className="text-on-surface-variant">{thresholdRow}</span>
              </li>
              <li>
                <strong className="text-on-surface">Breached at: </strong>
                <span className="tabular-nums text-on-surface-variant">
                  {new Date(engineBreach.at).toLocaleString()}
                </span>
              </li>
            </ul>
            <div>
              <h3 className="font-headline text-sm font-bold text-on-surface">
                Closed trades behind the loss
              </h3>
              {breachTrades.length === 0 ? (
                <p className="mt-1 text-on-surface-variant">
                  No closed trades recorded in this session (Demo)
                </p>
              ) : (
                <ul className="mt-1 space-y-1 text-on-surface-variant">
                  {breachTrades.map((t) => (
                    <li key={t.id} className="tabular-nums">
                      {new Date(t.closedAt).toLocaleString()} — {t.symbol} {t.side}{" "}
                      {String(t.lots)} lots · {formatMoney(t.pnl)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">
            (Demo fixture) — no rule-triggered breach recorded in this session
          </p>
        )}
      </TerraCard>
    </div>
  );
}
