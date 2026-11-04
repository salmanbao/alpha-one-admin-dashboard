"use client";

/**
 * ChallengeRulesDialog — quick access to the full program rules
 * (audit finding #5: positions lacked challenge-rule context and there
 * was NO reference surface for the rules anywhere in the app).
 *
 * Renders the active account's rule set from the same fixtures the
 * objectives page derives from (challengeForAccount + terraRiskLimits +
 * challengeTimeline), so the dialog, the objectives page and the risk
 * gauges can never disagree. Scoped to accounts whose timeline fixture
 * actually belongs to them (challengeTimeline is seeded per account).
 *
 * Audit findings #3 + #6 (this round):
 *  - visual rule indicators: a typed icon + a compliance badge per rule
 *    that is DERIVED from the same numbers shown next to it, so the
 *    badge can never contradict the detail line
 *  - boundary examples: each rule states where the trip point actually
 *    is, in this account's money
 *  - rule impact simulator: pick a hypothetical loss and see, before
 *    trading, whether the daily-loss or drawdown rule would trip
 *  - ARIA: list semantics, labelled rows, progress bars with values,
 *    and an aria-live result region for the simulator (no bare visuals)
 *
 * "Open objectives" deep-links to /objectives — the canonical,
 * fully-derived rules view.
 */

import { useState } from "react";
import {
  challengeForAccount,
  challengeTimeline,
  terraRiskLimits,
  type TerraAccount,
} from "@/lib/fixtures/terra-fixtures";
import { formatCurrencyValue } from "@pfaas/platform-core";
import Link from "next/link";
import { DetailDialog } from "@/components/terra/detail-dialog";
import {
  Target,
  TrendingDown,
  Gauge,
  CalendarDays,
  Percent,
  Info,
} from "lucide-react";

type StatusTone = "good" | "warn" | "risk" | "neutral";

const STATUS_STYLE: Record<StatusTone, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  risk: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  neutral: "bg-muted text-muted-foreground",
};

interface RuleStatus {
  label: string;
  tone: StatusTone;
}

function RuleRow({
  icon: Icon,
  label,
  rule,
  detail,
  example,
  status,
  /** 0–100 progress against the rule (None to hide the meter). */
  usedPct,
  meterLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** The program's configured rule (e.g. "6%", "4 days"). */
  rule: string;
  /** The account's current standing against that rule. */
  detail: string;
  /** Boundary example — where the trip point actually sits. */
  example: string;
  status?: RuleStatus;
  usedPct?: number;
  meterLabel?: string;
}) {
  return (
    <li
      className="rounded-lg bg-muted/40 px-3 py-2.5"
      aria-label={`${label}. Rule: ${rule}. ${detail} ${status ? `Status: ${status.label}.` : ""} ${example}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2.5">
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background/70 text-foreground"
            aria-hidden
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{detail}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="whitespace-nowrap text-sm font-semibold tabular-nums"
            aria-label={`Rule limit: ${rule}`}
          >
            {rule}
          </span>
          {status ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[status.tone]}`}
            >
              {status.label}
            </span>
          ) : null}
        </div>
      </div>
      {typeof usedPct === "number" ? (
        <div className="mt-2">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-background/70"
            role="progressbar"
            aria-valuenow={Math.round(usedPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={meterLabel ?? `${label} progress`}
          >
            <div
              className={`h-full rounded-full ${
                usedPct >= 100
                  ? "bg-emerald-500"
                  : usedPct >= 75
                    ? "bg-amber-500"
                    : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, Math.round(usedPct)))}%` }}
            />
          </div>
        </div>
      ) : null}
      <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">In context: </span>
        {example}
      </p>
    </li>
  );
}

/**
 * Rule impact simulator (audit finding #3) — deterministic what-if:
 * pick a hypothetical losing trade and see whether the daily-loss or
 * drawdown rule would trip. Pure arithmetic on fixture values, so the
 * same click always produces the same answer.
 */
function RuleImpactSimulator({
  account,
  dailyLimit,
  maxDdLimit,
}: {
  account: TerraAccount;
  dailyLimit: number | null;
  maxDdLimit: number | null;
}) {
  const [lossPct, setLossPct] = useState<number | null>(null);
  const presets = [1, 2, 5];
  const loss = lossPct === null ? null : Math.round((account.startingBalance * lossPct) / 100);
  const dailyAfter = loss === null || dailyLimit === null ? null : account.dailyLossRemaining - loss;
  const ddAfter = loss === null || maxDdLimit === null ? null : account.maxDdRemaining - loss;
  const dailyTrips = dailyAfter !== null && dailyAfter <= 0;
  const ddTrips = ddAfter !== null && ddAfter <= 0;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-primary">Rule impact simulator</p>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Hypothetical — not a prediction
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        What would a single losing trade cost you? Choose a size as a share of your starting
        balance.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Hypothetical loss size">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={lossPct === p}
            onClick={() => setLossPct(lossPct === p ? null : p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              lossPct === p
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-background/80 text-muted-foreground hover:text-foreground"
            }`}
          >
            −{p}% · {formatCurrencyValue(Math.round((account.startingBalance * p) / 100))}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-2">
        {loss === null ? (
          <p className="text-xs text-muted-foreground">
            Select a size to see the effect on your remaining daily-loss and drawdown room.
          </p>
        ) : (
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">
              A {formatCurrencyValue(loss)} loss would leave{" "}
              {dailyAfter !== null && (
                <span className={dailyAfter <= 0 ? "font-bold text-rose-600 dark:text-rose-400" : "tabular-nums"}>
                  {formatCurrencyValue(Math.max(0, dailyAfter))}
                </span>
              )}{" "}
              of your daily-loss room and{" "}
              {ddAfter !== null && (
                <span className={ddAfter <= 0 ? "font-bold text-rose-600 dark:text-rose-400" : "tabular-nums"}>
                  {formatCurrencyValue(Math.max(0, ddAfter))}
                </span>
              )}{" "}
              of drawdown room.
            </p>
            {dailyTrips || ddTrips ? (
              <p className="font-semibold text-rose-600 dark:text-rose-400">
                ⚠ This trade would breach{" "}
                {dailyTrips && ddTrips
                  ? "both the daily loss limit and the max drawdown"
                  : dailyTrips
                    ? "the daily loss limit"
                    : "the max drawdown"}{" "}
                — the evaluation ends and positions close at the broker.
              </p>
            ) : (
              <p className="text-emerald-700 dark:text-emerald-400">
                ✓ Within both limits — the phase continues.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChallengeRulesDialog({
  account,
  open,
  onOpenChange,
}: {
  account: TerraAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const challenge = challengeForAccount(account.id);
  const limits = terraRiskLimits[account.id];
  // challengeTimeline is seeded for one account — don't quote it for others.
  const timeline = challengeTimeline.accountId === account.id ? challengeTimeline : null;
  const isFunded = account.phase === "Funded";
  const targetPct = Math.round((account.profitTarget / account.startingBalance) * 100);

  // Compliance badges — each derived from the exact numbers rendered in
  // the same row, so a badge can never contradict its detail line.
  const targetProgress = account.targetProgress;
  const targetStatus: RuleStatus =
    targetProgress >= 100
      ? { label: "Target met", tone: "good" }
      : targetProgress >= 50
        ? { label: "On track", tone: "good" }
        : { label: "In progress", tone: "neutral" };

  const dailyUsedPct = limits
    ? Math.min(100, Math.round(((limits.daily - account.dailyLossRemaining) / limits.daily) * 100))
    : undefined;
  const dailyStatus: RuleStatus | undefined =
    dailyUsedPct === undefined
      ? undefined
      : dailyUsedPct < 40
        ? { label: "Comfortable", tone: "good" }
        : dailyUsedPct < 75
          ? { label: "Watch", tone: "warn" }
          : { label: "At risk", tone: "risk" };

  const ddUsedPct = limits
    ? Math.min(100, Math.round(((limits.maxDd - account.maxDdRemaining) / limits.maxDd) * 100))
    : undefined;
  const ddStatus: RuleStatus | undefined =
    ddUsedPct === undefined
      ? undefined
      : ddUsedPct < 40
        ? { label: "Comfortable", tone: "good" }
        : ddUsedPct < 75
          ? { label: "Watch", tone: "warn" }
          : { label: "At risk", tone: "risk" };

  const minDays = challenge?.minDays ?? null;
  const daysElapsed = timeline?.elapsedDays ?? null;
  const daysStatus: RuleStatus | undefined =
    minDays !== null && daysElapsed !== null
      ? daysElapsed >= minDays
        ? { label: "Minimum met", tone: "good" }
        : { label: `${daysElapsed}/${minDays} days`, tone: "neutral" }
      : undefined;

  const consistencyStatus: RuleStatus | undefined = timeline
    ? timeline.bestDayPct <= timeline.consistencyCap
      ? { label: "Within cap", tone: "good" }
      : { label: "Over cap", tone: "risk" }
    : undefined;

  const targetRemaining = Math.max(0, account.profitTarget - Math.max(0, account.pnl));

  return (
    <DetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Challenge rules — ${account.program}`}
      description={`${account.phase} • ${account.platform} • account #${account.login}`}
      fullPageHref="/objectives"
      fullPageLabel="Open objectives"
    >
      <ul className="space-y-2" aria-label="Program rules for this account">
        <RuleRow
          icon={Target}
          label={isFunded ? "Scaling target" : "Profit target"}
          rule={challenge?.profitTarget ?? `${targetPct}%`}
          detail={`${formatCurrencyValue(account.pnl >= 0 ? account.pnl : 0)} of ${formatCurrencyValue(account.profitTarget)} reached (${account.targetProgress}%)`}
          example={`Boundary: ${formatCurrencyValue(targetRemaining)} to go — but only counts while the loss rules below stay intact.`}
          status={targetStatus}
          usedPct={targetProgress}
          meterLabel={`Profit target progress: ${targetProgress}% of ${formatCurrencyValue(account.profitTarget)}`}
        />
        <RuleRow
          icon={TrendingDown}
          label="Daily loss limit"
          rule={challenge?.dailyLoss ?? "—"}
          detail={
            limits
              ? `${formatCurrencyValue(limits.daily)} per day • ${formatCurrencyValue(account.dailyLossRemaining)} remaining today`
              : `${formatCurrencyValue(account.dailyLossRemaining)} remaining today`
          }
          example={
            limits
              ? `Boundary: today's equity may fall to ${formatCurrencyValue(account.startingBalance - limits.daily)} (day start − ${formatCurrencyValue(limits.daily)}) before the rule trips and positions close.`
              : `Boundary: ${formatCurrencyValue(account.dailyLossRemaining)} left today — losing it ends the phase immediately.`
          }
          status={dailyStatus}
          usedPct={dailyUsedPct}
          meterLabel={
            dailyUsedPct !== undefined
              ? `Daily loss limit used: ${dailyUsedPct}% of ${limits ? formatCurrencyValue(limits.daily) : "the limit"}`
              : "Daily loss limit usage"
          }
        />
        <RuleRow
          icon={Gauge}
          label="Max drawdown"
          rule={challenge?.maxDrawdown ?? "—"}
          detail={
            limits
              ? `${formatCurrencyValue(limits.maxDd)} total • ${formatCurrencyValue(account.maxDdRemaining)} remaining`
              : `${formatCurrencyValue(account.maxDdRemaining)} remaining`
          }
          example={
            limits
              ? `Boundary: equity at ${formatCurrencyValue(account.startingBalance - limits.maxDd)} (start − ${formatCurrencyValue(limits.maxDd)}) fails the phase permanently — this one does not reset daily.`
              : `Boundary: ${formatCurrencyValue(account.maxDdRemaining)} of equity cushion left.`
          }
          status={ddStatus}
          usedPct={ddUsedPct}
          meterLabel={
            ddUsedPct !== undefined
              ? `Max drawdown used: ${ddUsedPct}% of ${limits ? formatCurrencyValue(limits.maxDd) : "the limit"}`
              : "Max drawdown usage"
          }
        />
        <RuleRow
          icon={CalendarDays}
          label="Minimum trading days"
          rule={challenge ? `${challenge.minDays} days` : "—"}
          detail={
            timeline
              ? `${timeline.elapsedDays} days elapsed • breach only if the minimum is missed by day ${timeline.maxCalendarDays}`
              : "Evaluation phase requirement — see objectives for progress"
          }
          example={
            timeline
              ? `Boundary: day ${timeline.maxCalendarDays} is the last chance — ${Math.max(0, (challenge?.minDays ?? 0) - timeline.elapsedDays)} more trading day(s) needed to qualify.`
              : `Boundary: ${challenge?.minDays ?? "the required number of"} distinct trading days must be logged before the deadline.`
          }
          status={daysStatus}
          usedPct={
            minDays !== null && daysElapsed !== null && minDays > 0
              ? Math.min(100, Math.round((daysElapsed / minDays) * 100))
              : undefined
          }
          meterLabel={
            minDays !== null && daysElapsed !== null
              ? `Minimum trading days: ${daysElapsed} of ${minDays} logged`
              : "Minimum trading days progress"
          }
        />
        {/* Why the minimum exists — plain-language explanation + the
            educational surface (audit: clarify min trading days) */}
        <li className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-xs font-bold text-primary">Why minimum trading days?</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Profit in a single lucky trade doesn&apos;t prove a repeatable edge. Spreading
            results across at least {challenge?.minDays ?? "the required number of"} trading
            days lets the evaluation measure consistency instead of one outlier — a common
            pattern is hitting the target in {Math.max(1, (challenge?.minDays ?? 5) - 3)}–
            {challenge?.minDays ?? 5} days of steady risk, then pacing the remainder rather
            than forcing trades. Missing the minimum by the deadline (day{" "}
            {timeline?.maxCalendarDays ?? "set per program"}) fails the phase even when the
            profit target is met, so plan your days alongside your target.
          </p>
          <Link
            href="/trading-plan-builder"
            className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary underline-offset-2 hover:underline"
          >
            Build a trading plan that paces your days →
          </Link>
        </li>
        {timeline ? (
          <RuleRow
            icon={Percent}
            label="Consistency rule"
            rule={`best day ≤ ${timeline.consistencyCap}%`}
            detail={`Best day is currently ${timeline.bestDayPct}% of total profit`}
            example={`Boundary: if your best day exceeds ${timeline.consistencyCap}% of total profit, it is discounted — keep any single day under ${timeline.consistencyCap}%.`}
            status={consistencyStatus}
            usedPct={Math.min(100, Math.round((timeline.bestDayPct / timeline.consistencyCap) * 100))}
            meterLabel={`Consistency: best day is ${timeline.bestDayPct}% of a ${timeline.consistencyCap}% cap`}
          />
        ) : null}
      </ul>

      {/* Interactive boundary example (audit finding #3) */}
      <RuleImpactSimulator
        account={account}
        dailyLimit={limits?.daily ?? null}
        maxDdLimit={limits?.maxDd ?? null}
      />

      <p className="flex gap-1.5 pt-1 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Breaching the daily loss limit or max drawdown ends the evaluation immediately;
          positions are closed at the broker. Rules shown are for {account.program} — other
          programs on your account list may differ.
        </span>
      </p>
      {/* Status legend — the badges above are colour + text, never colour
          alone, but the scale is spelled out once for screen readers. */}
      <p className="sr-only">
        Rule status legend: comfortable and on track mean the rule is far from its limit;
        watch means the limit is more than 40 percent used; at risk means more than 75 percent
        used; over cap means the consistency rule is currently breached.
      </p>
    </DetailDialog>
  );
}
