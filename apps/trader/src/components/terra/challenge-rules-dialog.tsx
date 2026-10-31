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
 * "Open objectives" deep-links to /objectives — the canonical,
 * fully-derived rules view.
 */

import {
  challengeForAccount,
  challengeTimeline,
  terraRiskLimits,
  type TerraAccount,
} from "@/lib/fixtures/terra-fixtures";
import { formatCurrencyValue } from "@pfaas/platform-core";
import { DetailDialog } from "@/components/terra/detail-dialog";

function RuleRow({
  label,
  rule,
  detail,
}: {
  label: string;
  /** The program's configured rule (e.g. "6%", "4 days"). */
  rule: string;
  /** The account's current standing against that rule. */
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/40 px-3 py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{rule}</span>
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

  return (
    <DetailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Challenge rules — ${account.program}`}
      description={`${account.phase} • ${account.platform} • account #${account.login}`}
      fullPageHref="/objectives"
      fullPageLabel="Open objectives"
    >
      <div className="space-y-2">
        <RuleRow
          label={isFunded ? "Scaling target" : "Profit target"}
          rule={challenge?.profitTarget ?? `${targetPct}%`}
          detail={`${formatCurrencyValue(account.pnl >= 0 ? account.pnl : 0)} of ${formatCurrencyValue(account.profitTarget)} reached (${account.targetProgress}%)`}
        />
        <RuleRow
          label="Daily loss limit"
          rule={challenge?.dailyLoss ?? "—"}
          detail={
            limits
              ? `${formatCurrencyValue(limits.daily)} per day • ${formatCurrencyValue(account.dailyLossRemaining)} remaining today`
              : `${formatCurrencyValue(account.dailyLossRemaining)} remaining today`
          }
        />
        <RuleRow
          label="Max drawdown"
          rule={challenge?.maxDrawdown ?? "—"}
          detail={
            limits
              ? `${formatCurrencyValue(limits.maxDd)} total • ${formatCurrencyValue(account.maxDdRemaining)} remaining`
              : `${formatCurrencyValue(account.maxDdRemaining)} remaining`
          }
        />
        <RuleRow
          label="Minimum trading days"
          rule={challenge ? `${challenge.minDays} days` : "—"}
          detail={
            timeline
              ? `${timeline.elapsedDays} days elapsed • breach only if the minimum is missed by day ${timeline.maxCalendarDays}`
              : "Evaluation phase requirement — see objectives for progress"
          }
        />
        {timeline ? (
          <RuleRow
            label="Consistency rule"
            rule={`best day ≤ ${timeline.consistencyCap}%`}
            detail={`Best day is currently ${timeline.bestDayPct}% of total profit`}
          />
        ) : null}
        <p className="pt-1 text-xs text-muted-foreground">
          Breaching the daily loss limit or max drawdown ends the evaluation immediately;
          positions are closed at the broker. Rules shown are for {account.program} —
          other programs on your account list may differ.
        </p>
      </div>
    </DetailDialog>
  );
}
