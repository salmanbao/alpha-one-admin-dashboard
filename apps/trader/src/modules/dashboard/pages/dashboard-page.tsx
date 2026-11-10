"use client";

/**
 * Dashboard — converted from stitch_screens/trader_dashboard + trader_dashboard_overview
 * Account context bar, milestone/risk alerts, primary account card with profit
 * target progress, equity curve, and quick stats.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
import { RiskWarningBanner } from "@/components/terra/risk-warning-banner";
import { useRiskWarning } from "@/lib/trading/use-risk-warning";
import {
  TerraBadge,
  TerraCard,
  TerraProgress,
  TerraAreaChart,
  TerraDrawdownMeter,
  TerraSectionTitle,
  TerraStat,
  formatMoney,
  formatSignedMoney,
  type TerraTone,
} from "@/components/terra/terra-ui";
import {
  announcements,
  challengeForAccount,
  equityCurveFor,
  recentActivity,
  scalingPlan,
  terraAccounts,
  terraPositions,
  terraRiskLimits,
  terraTrades,
  type ActivityEntry,
} from "@/lib/fixtures/terra-fixtures";
import { payoutEntitlement } from "@/lib/fixtures/terra-fixtures";
import { buildPayoutCriteria } from "@/components/terra/payout-summary-strip";
import { useActiveAccount } from "@/lib/platform/account-context";
import { AccountSwitcher } from "@/components/shell/account-switcher";
import { GettingStartedTour } from "@/components/onboarding/getting-started-tour";
import { PayoutSummaryStrip } from "@/components/terra/payout-summary-strip";
import { KycStatusCard } from "@/components/terra/kyc-status-card";
import { TraderStageBanner } from "@/components/terra/trader-stage-banner";
import { ChallengeRulesDialog } from "@/components/terra/challenge-rules-dialog";
import { OutageRecoveryBanner } from "@/components/terra/outage-recovery-banner";

const ranges = ["7d", "30d", "90d"] as const;

const annTone: Record<string, TerraTone> = {
  platform: "secondary",
  payouts: "primary",
  community: "tertiary",
  product: "success",
};

const actTone: Record<ActivityEntry["kind"], TerraTone> = {
  trade: "primary",
  payout: "tertiary",
  milestone: "success",
  kyc: "secondary",
  challenge: "primary",
  system: "neutral",
};

const actIcon: Record<ActivityEntry["kind"], string> = {
  trade: "📈",
  payout: "💸",
  milestone: "🎯",
  kyc: "🪪",
  challenge: "🏆",
  system: "🛠️",
};

/**
 * Trading platforms available on this account (audit U #1) — the
 * dashboard used to be a dead end: the only way to a terminal was the
 * sidebar's Web Terminal link. Deterministic statuses (no Math.random).
 */
const tradingPlatforms = [
  { id: "web", name: "Web Terminal", detail: "Runs in the browser — no install", status: "Connected" },
  { id: "mt5", name: "MetaTrader 5", detail: "Desktop & mobile", status: "Connected" },
  { id: "ctrader", name: "cTrader", detail: "Web & desktop", status: "Available" },
] as const;

function activityTime(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const hrs = Math.floor(diffMs / 3_600_000);
  if (hrs < 1) return "just now";
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function DashboardPage() {
  const [range, setRange] = useState<(typeof ranges)[number]>("30d");
  const [platform, setPlatform] = useState<(typeof tradingPlatforms)[number]["id"]>("web");
  // Active trading account — switched via the header switcher or the
  // "Trading Account" selector below. Every acc.* value on this page
  // (target, risk buffers, balance, credentials) follows this context.
  const { activeAccount: acc } = useActiveAccount();
  const [rulesOpen, setRulesOpen] = useState(false);
  // R3-05 — risk-warning state (banner + one-time inbox message).
  const risk = useRiskWarning();
  // Persistent drawdown meters (audit #4) — green/amber/red before a breach.
  const riskLimits = terraRiskLimits[acc.id] ?? { daily: 1000, maxDd: 5000 };
  const dailyUsed = Math.max(0, riskLimits.daily - acc.dailyLossRemaining);
  const ddUsed = Math.max(0, riskLimits.maxDd - acc.maxDdRemaining);
  const accPositions = terraPositions.filter((p) => p.accountId === acc.id);
  const accUnrealized = accPositions.reduce((s, p) => s + p.pnl, 0);

  // Equity curve follows the active account AND the selected range —
  // derived from this account's real trade/payout history.
  const rangeDays = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const curve = equityCurveFor(acc.id, rangeDays);

  // Quick stats derived from this account's closed trades (not hardcoded).
  const accTrades = terraTrades.filter((t) => t.accountId === acc.id);
  const wins = accTrades.filter((t) => t.pnl > 0).length;
  const winRate = accTrades.length ? Math.round((wins / accTrades.length) * 100) : 0;
  // Minimum trading days counter (audit D #2) — distinct days with a
  // closed trade vs the program minimum, same derivation as
  // objectivesFor so the dashboard can never disagree with Objectives.
  const minDays = challengeForAccount(acc.id)?.minDays ?? 4;
  const tradingDays = new Set(accTrades.map((t) => t.closedAt.slice(0, 10))).size;
  const avgHoldMs = accTrades.length
    ? accTrades.reduce(
        (s, t) => s + (+new Date(t.closedAt) - +new Date(t.openedAt)),
        0,
      ) / accTrades.length
    : 0;
  const avgHold = `${Math.floor(avgHoldMs / 3_600_000)}h ${Math.round((avgHoldMs % 3_600_000) / 60_000)}m`;

  // Payout eligibility for the active account — displayed prominently before request (audit #1 HIGH)
  const entitlement = payoutEntitlement(acc.id);
  const criteria = buildPayoutCriteria(acc.id, entitlement.withdrawable);
  const outstanding = criteria.filter((c) => !c.ok).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Platform outage auto-recovery (finding #7a) — degraded → restored,
          plays once per session (sessionStorage one-shot). */}
      <OutageRecoveryBanner />

      {/* Top controls bar */}
      <div className="flex flex-col items-stretch justify-between gap-4 rounded-xl bg-surface-container-low p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Account selector — wired (switches the active account context) */}
          <AccountSwitcher variant="panel" />
          {/* Account state badge — follows the active account */}
          <TerraBadge tone={acc.status === "active" ? "primary" : acc.status === "breached" ? "error" : "secondary"} dot pulse={acc.status === "active"}>
            {acc.status === "active"
              ? "Active • In Good Standing"
              : acc.status === "standby"
                ? "Standby • Paused"
                : acc.status === "breached"
                  ? "Breached • Action Needed"
                  : acc.status}
          </TerraBadge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/trading-positions"
            className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm transition-all active:scale-95 hover:bg-primary/90"
          >
            <span>Continue Trading</span>
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* R2-W3-02 — the single TraderStage (lifecycle log) drives this
          banner, the journey checklist and the provisioning header. */}
      <TraderStageBanner />

      {/* First-use onboarding tour (audit #3 fix #6) — dismissible
          checklist for new traders; hidden once dismissed/completed. */}
      <GettingStartedTour />

      {/* Alerts banner */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {/* Failed state detected → the Evaluation Failed outcome screen (audit #1) */}
        {acc.status === "breached" && (
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl bg-error-container/60 p-4 shadow-sm sm:flex-row sm:items-center md:col-span-12">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error text-on-error">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-on-error-container">
                  Evaluation failed • Account breached
                </p>
                <p className="text-sm font-bold text-on-surface">
                  #{acc.login} crossed a rule limit — see exactly what happened, your final
                  metrics, and your options to retry.
                </p>
              </div>
            </div>
            <Link
              href="/account-breach"
              className="shrink-0 rounded-xl bg-error px-4 py-2.5 text-xs font-bold text-on-error transition-opacity hover:opacity-90"
            >
              Open Evaluation Failed →
            </Link>
          </div>
        )}
        {/* KYC status — rejected state gets a prominent retry path (audit #1) */}
        <KycStatusCard />
        <div className="flex items-center justify-between gap-3 rounded-xl bg-primary-fixed/50 p-4 shadow-sm md:col-span-7">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 7h6v6M22 7l-8.5 8.5-5-5L2 17" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-on-primary-fixed-variant">
                Milestone Alert
              </p>
              <p className="text-sm font-bold text-on-surface">
                You are {acc.targetProgress}% toward{" "}
                {acc.phase === "Funded"
                  ? "your next scaling tier"
                  : "your profit target"}{" "}
                <span className="font-normal text-on-surface-variant">
                  ({formatMoney(acc.pnl)} of {formatMoney(acc.profitTarget)} reached)
                </span>
              </p>
            </div>
          </div>
          <span className="hidden shrink-0 rounded-full bg-surface-container-lowest px-2.5 py-1 text-xs font-bold text-primary sm:inline-flex">
            +{formatMoney(acc.profitTarget - acc.pnl)} left
          </span>
        </div>
        {/* R3-05 — threshold-driven risk warning (banner + inbox event),
             replacing the static Risk Buffer card. */}
        {risk.warned && (
          <RiskWarningBanner
            account={acc}
            dailyPct={risk.dailyPct}
            maxDdPct={risk.maxDdPct}
            breach={risk.breach}
            limits={risk.limits}
          />
        )}
        {/* Evaluation progress detail — trade-by-trade timeline and rule adherence (audit #5) */}
        {acc.status === "breached" && (
          <div className="mt-6 rounded-xl bg-surface-container-low border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <TerraBadge tone="error" className="h-3 w-3">
                ⚠️
              </TerraBadge>
              <p className="text-sm font-medium text-on-surface-variant">
                Evaluation Progress Detail
              </p>
            </div>
            <div className="text-xs text-on-surface-variant mb-3">
              Review the specific trades and rules that triggered the breach, along
              with coaching suggestions for your next attempt.
            </div>
            <Link
              href="/account-breach"
              className="inline-flex items-center gap-1 text-xs font-bold text-error hover:text-on-error-fixed-variant underline"
              aria-label="View detailed evaluation progress showing which rules were breached and when"
            >
              View Detailed Progress →
            </Link>
          </div>
        )}
      </div>

      {/* Primary account card */}
      <TerraCard className="p-6 lg:p-7">
        <div className="flex flex-col justify-between gap-6 pb-6 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-bold tracking-widest text-on-surface-variant">
                ACCOUNT #{acc.login}
              </span>
              <TerraBadge tone="secondary">{acc.phase} Evaluation</TerraBadge>
              <TerraBadge tone={acc.status === "active" ? "primary" : acc.status === "breached" ? "error" : "secondary"} dot>
                {acc.status.toUpperCase()}
              </TerraBadge>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <span>
                Server: <strong className="font-mono text-on-surface">{acc.server}</strong>
              </span>
              <span className="text-outline-variant">•</span>
              <span>
                Platform: <strong className="text-on-surface">{acc.platform} Bridge v4.9</strong>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-8 lg:text-right">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Account Balance
              </p>
              <p className="mt-0.5 font-headline text-2xl font-bold tabular-nums text-on-surface sm:text-3xl">
                {formatMoney(acc.balance)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Current Equity
              </p>
              <p className="mt-0.5 font-headline text-2xl font-bold tabular-nums text-primary sm:text-3xl">
                {formatMoney(acc.equity)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Total Net P&amp;L
              </p>
              <p className="mt-0.5 font-headline text-2xl font-bold tabular-nums text-primary sm:text-3xl">
                {formatSignedMoney(acc.pnl)}{" "}
                <span className="text-sm font-bold text-primary">
                  (+{acc.pnlPercent.toFixed(2)}%)
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Profit target progress */}
        <div className="mt-2 rounded-xl bg-surface-container-low/50 p-5 pt-6">
          <div className="mb-2.5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-on-surface">
                {acc.phase === "Funded"
                  ? "Scaling Profit Target"
                  : "Profit Target Progress"}
              </span>
              <span className="rounded bg-primary-fixed px-2 py-0.5 text-[11px] font-bold text-on-primary-fixed-variant">
                {acc.targetProgress.toFixed(1)}%
              </span>
            </div>
            <span className="text-xs font-bold tabular-nums text-on-surface">
              {formatMoney(acc.pnl)}{" "}
              <span className="font-normal text-on-surface-variant">
                / {formatMoney(acc.profitTarget)} target
              </span>{" "}
              <span className="font-bold text-primary">
                ({formatMoney(acc.profitTarget - acc.pnl)} remaining)
              </span>
            </span>
          </div>
          <TerraProgress value={acc.targetProgress} height="h-3" />

          {/* Minimum trading days — same prominence as the profit target
              and drawdown meters (audit D #2). Funded accounts have no
              minimum-day requirement, so the counter only renders for
              evaluation phases. */}
          {acc.phase !== "Funded" && (
            <div className="mt-4 rounded-xl bg-surface-container-low/60 p-4">
              <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-on-surface">
                    Minimum Trading Days
                  </span>
                  <span className="rounded bg-primary-fixed px-2 py-0.5 text-[11px] font-bold text-on-primary-fixed-variant">
                    {tradingDays} / {minDays} days
                  </span>
                  {tradingDays >= minDays && (
                    <span className="rounded bg-primary-fixed/60 px-2 py-0.5 text-[11px] font-bold text-primary">
                      ✓ Requirement met
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold tabular-nums text-on-surface">
                  {tradingDays >= minDays ? (
                    <span className="text-primary">Satisfied — keep trading normally</span>
                  ) : (
                    <>
                      <span className="text-primary">
                        {minDays - tradingDays} day
                        {minDays - tradingDays === 1 ? "" : "s"} remaining
                      </span>{" "}
                      <span className="font-normal text-on-surface-variant">
                        · {Math.round(Math.min(100, (tradingDays / minDays) * 100))}% complete
                      </span>
                    </>
                  )}
                </span>
              </div>
              <TerraProgress
                value={Math.min(100, (tradingDays / minDays) * 100)}
                height="h-2.5"
              />
              <p className="mt-2 text-[11px] text-on-surface-variant">
                A day counts once you close at least one trade on it — the rule keeps
                evaluations from being passed on a single lucky day, so spread your
                trading across multiple days.
              </p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/40 pt-4">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="font-semibold text-primary">✓</span>
              <span>Normal trading speed • Target drawdown limit is safely preserved</span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/account-detail"
                className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container"
              >
                Account Detail
              </Link>
              {/* Full rules breakdown — every evaluation criterion with the
                  account's current standing (audit #2) */}
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container"
              >
                Challenge Rules
              </button>
              <Link
                href="/objectives"
                className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-colors hover:bg-primary/90"
              >
                View Objectives
              </Link>
            </div>
          </div>
        </div>
      </TerraCard>

      {/* Payout Eligibility — prominently visible before request (audit #1 HIGH) */}
      <TerraCard className="p-6 lg:p-7">
        <div className="flex items-center justify-between gap-3">
          <TerraSectionTitle title="Payout Eligibility" description="Check your eligibility before submitting a payout request." />
          <Link href="/payout-request" className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90">
            Request Payout →
          </Link>
        </div>
        <div className="mt-4">
          <PayoutSummaryStrip
            accountId={acc.id}
            withdrawable={entitlement.withdrawable}
            balance={acc.balance}
            outstanding={outstanding}
          />
        </div>
      </TerraCard>

      {/* Two-column section: equity curve + side stats */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle
              title={`Equity Curve · ${range}`}
              description={`Daily equity snapshot for #${acc.login}.`}
              actions={
                <div className="flex items-center gap-1 self-start rounded-lg bg-surface-container-low p-1 sm:self-auto">
                  {ranges.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRange(r)}
                      className={cn(
                        "rounded px-3 py-1 text-xs transition-colors",
                        range === r
                          ? "bg-primary font-bold text-on-primary shadow-xs"
                          : "font-semibold text-on-surface-variant hover:text-on-surface",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="mb-4 flex items-baseline justify-between rounded-xl bg-surface-container-low/60 p-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Current Peak Equity
                </span>
                <div className="mt-0.5 font-headline text-2xl font-bold text-on-surface">
                  {formatMoney(acc.equity)}
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-bold text-on-primary-fixed-variant">
                +{(acc.pnlPercent).toFixed(2)}% Total Growth
              </span>
            </div>
            <TerraAreaChart data={curve} formatValue={(v) => formatMoney(Math.round(v))} />
          </TerraCard>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Quick Stats" />
            <div className="grid grid-cols-2 gap-4">
              <TerraStat label="Open Positions" value={accPositions.length} sub={`#${acc.login}`} />
              <TerraStat
                label="Unrealized P&L"
                value={formatSignedMoney(accUnrealized)}
                tone={accUnrealized >= 0 ? "positive" : "negative"}
              />
              <TerraStat
                label="Win Rate"
                value={`${winRate}%`}
                sub={`${accTrades.length} trades`}
              />
              <TerraStat label="Avg Hold" value={avgHold} sub="per trade" />
            </div>
          </TerraCard>
          <TerraCard>
            <TerraSectionTitle
              title="Risk Status"
              actions={<TerraBadge tone="neutral">Live</TerraBadge>}
            />
            {/* Persistent drawdown meters (audit #4) — green/amber/red before a breach */}
            <div className="space-y-2">
              <TerraDrawdownMeter
                label="Daily loss"
                used={dailyUsed}
                limit={riskLimits.daily}
                remaining={acc.dailyLossRemaining}
              />
              <TerraDrawdownMeter
                label="Max drawdown"
                used={ddUsed}
                limit={riskLimits.maxDd}
                remaining={acc.maxDdRemaining}
              />
            </div>
            <Link
              href="/risk-dashboard"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
            >
              Open Risk Dashboard →
            </Link>
          </TerraCard>
          <TerraCard>
            <TerraSectionTitle
              title="Scaling Progress"
              actions={
                scalingPlan.accountId === acc.id ? (
                  <TerraBadge tone="primary">{scalingPlan.consecutivePayouts}/{scalingPlan.requiredPayouts}</TerraBadge>
                ) : (
                  <TerraBadge tone="neutral">Locked</TerraBadge>
                )
              }
            />
            {scalingPlan.accountId === acc.id ? (
              <>
                <p className="text-xs text-on-surface-variant">
                  {scalingPlan.consecutivePayouts} consecutive counted payouts toward
                  scaling to{" "}
                  <strong className="text-on-surface">{scalingPlan.nextTier}</strong> at
                  a <strong className="text-primary">{scalingPlan.nextSplit}</strong>{" "}
                  split.
                </p>
                <TerraProgress
                  value={Math.round((scalingPlan.consecutivePayouts / scalingPlan.requiredPayouts) * 100)}
                  className="mt-3"
                />
                <Link
                  href={`/payout-eligibility?id=${acc.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
                >
                  View scaling plan →
                </Link>
              </>
            ) : (
              <>
                <p className="text-xs text-on-surface-variant">
                  Scaling starts after your first counted payout on a funded
                  account.{" "}
                  <strong className="text-on-surface">
                    #{terraAccounts.find((a) => a.id === scalingPlan.accountId)?.login ?? "funded account"}
                  </strong>{" "}
                  is currently on the plan.
                </p>
                <Link
                  href="/my-accounts"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
                >
                  Switch to your funded account →
                </Link>
              </>
            )}
          </TerraCard>
        </div>
      </div>

      {/* Trading Platforms — launch without leaving the dashboard (audit U #1) */}
      <TerraCard className="p-6 lg:p-7">
        <TerraSectionTitle
          title="Trading Platforms"
          description="Pick a platform and launch it in a new tab — this dashboard stays open."
        />
        <div
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
          role="group"
          aria-label="Available trading platforms"
        >
          {tradingPlatforms.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={platform === p.id}
              onClick={() => setPlatform(p.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                platform === p.id
                  ? "border-primary bg-primary-fixed/30"
                  : "border-outline-variant bg-surface-container-low hover:bg-surface-container",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-on-surface">{p.name}</span>
                <TerraBadge tone={p.status === "Connected" ? "success" : "neutral"}>
                  {p.status}
                </TerraBadge>
              </span>
              <span className="mt-1 block text-xs text-on-surface-variant">{p.detail}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low p-4">
          <p className="text-xs text-on-surface-variant">
            <span className="font-bold text-on-surface">
              {tradingPlatforms.find((p) => p.id === platform)?.name}
            </span>{" "}
            · account #{acc.login} · launches in a new tab so you keep your dashboard context
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/order-ticket"
              className="rounded-xl bg-surface-container px-4 py-2.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              New Order
            </Link>
            <Link
              href="/web-terminal"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
            >
              Launch Platform →
            </Link>
          </div>
        </div>
      </TerraCard>

      {/* Announcements / News (M12 Overview) */}
      <TerraCard>
        <TerraSectionTitle
          title="Announcements & News"
          description="Platform updates, payout cycles and community events."
          actions={
            <Link
              href="/notification-center"
              className="text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
            >
              All notifications →
            </Link>
          }
        />
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={
                a.pinned
                  ? "flex items-start gap-3 rounded-xl border border-primary-fixed bg-primary-fixed/30 p-4"
                  : "flex items-start gap-3 rounded-xl bg-surface-container-low p-4"
              }
            >
              <span className="mt-0.5">
                <TerraBadge tone={annTone[a.tag] ?? "neutral"}>
                  {a.pinned ? `pinned • ${a.tag}` : a.tag}
                </TerraBadge>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-bold text-on-surface">{a.title}</p>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(a.at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-on-surface-variant">{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      </TerraCard>

      {/* Recent Activity timeline (M3 §3.6 GET /dashboard/recent-activity) */}
      <TerraCard>
        <TerraSectionTitle
          title="Recent Activity"
          description="Your latest trades, payouts and account milestones."
          actions={
            <Link
              href="/notification-center"
              className="text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
            >
              Full history →
            </Link>
          }
        />
        <ol className="relative space-y-4 border-l border-outline-variant/60 pl-6">
          {recentActivity.map((a) => {
            const inner = (
              <>
                <span
                  aria-hidden="true"
                  className="absolute -left-[31px] flex h-4 w-4 items-center justify-center rounded-full bg-surface-container-lowest ring-2 ring-outline-variant/60"
                >
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </span>
                <div className="flex items-start justify-between gap-3 rounded-xl bg-surface-container-low px-4 py-3 transition-colors hover:bg-surface-container">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 text-lg" aria-hidden="true">
                      {actIcon[a.kind]}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface">{a.title}</p>
                      <p className="mt-0.5 text-xs text-on-surface-variant">{a.detail}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="whitespace-nowrap text-[11px] font-semibold text-on-surface-variant">
                      {activityTime(a.at)}
                    </span>
                    <TerraBadge tone={actTone[a.kind]}>{a.kind}</TerraBadge>
                  </div>
                </div>
              </>
            );
            return (
              <li key={a.id} className="relative">
                {a.href ? (
                  <Link
                    href={a.href}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ol>
      </TerraCard>

      {/* Challenge rules breakdown — same dialog the positions screens use */}
      {rulesOpen ? (
        <ChallengeRulesDialog
          account={acc}
          open={rulesOpen}
          onOpenChange={setRulesOpen}
        />
      ) : null}
    </div>
  );
}
