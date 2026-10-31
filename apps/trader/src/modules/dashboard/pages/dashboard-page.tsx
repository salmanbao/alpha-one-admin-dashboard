"use client";

/**
 * Dashboard — converted from stitch_screens/trader_dashboard + trader_dashboard_overview
 * Account context bar, milestone/risk alerts, primary account card with profit
 * target progress, equity curve, and quick stats.
 */

import { useState } from "react";
import Link from "next/link";
import { cn } from "@pfaas/ui";
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
  equityCurveFor,
  recentActivity,
  scalingPlan,
  terraAccounts,
  terraPositions,
  terraRiskLimits,
  terraTrades,
  type ActivityEntry,
} from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { AccountSwitcher } from "@/components/shell/account-switcher";
import { GettingStartedTour } from "@/components/onboarding/getting-started-tour";

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
  const [riskAlertVisible, setRiskAlertVisible] = useState(true);
  // Active trading account — switched via the header switcher or the
  // "Trading Account" selector below. Every acc.* value on this page
  // (target, risk buffers, balance, credentials) follows this context.
  const { activeAccount: acc } = useActiveAccount();
  const accPositions = terraPositions.filter((p) => p.accountId === acc.id);
  const accUnrealized = accPositions.reduce((s, p) => s + p.pnl, 0);

  // Drawdown usage for the active account — persistent meters (audit #4).
  const riskLimits = terraRiskLimits[acc.id] ?? { daily: 1000, maxDd: 5000 };
  const dailyUsed = Math.max(0, riskLimits.daily - acc.dailyLossRemaining);
  const ddUsed = Math.max(0, riskLimits.maxDd - acc.maxDdRemaining);

  // Equity curve follows the active account AND the selected range —
  // derived from this account's real trade/payout history.
  const rangeDays = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const curve = equityCurveFor(acc.id, rangeDays);

  // Quick stats derived from this account's closed trades (not hardcoded).
  const accTrades = terraTrades.filter((t) => t.accountId === acc.id);
  const wins = accTrades.filter((t) => t.pnl > 0).length;
  const winRate = accTrades.length ? Math.round((wins / accTrades.length) * 100) : 0;
  const avgHoldMs = accTrades.length
    ? accTrades.reduce(
        (s, t) => s + (+new Date(t.closedAt) - +new Date(t.openedAt)),
        0,
      ) / accTrades.length
    : 0;
  const avgHold = `${Math.floor(avgHoldMs / 3_600_000)}h ${Math.round((avgHoldMs % 3_600_000) / 60_000)}m`;

  return (
    <div className="flex flex-col gap-6">
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
        {riskAlertVisible && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary-fixed/60 p-4 shadow-sm md:col-span-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 13c0 5-3.5 7.5-7.7 8.9a1.9 1.9 0 0 1-1.3 0C6.5 20.5 3 18 3 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.7 1.7 0 0 1 2.4 0C14.4 3.8 17 5 19 5a1 1 0 0 1 1 1z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-on-secondary-fixed-variant">
                  Risk Buffer
                </p>
                <p className="text-sm font-bold text-on-surface">
                  Daily loss remaining:{" "}
                  <span className="font-mono text-tertiary">{formatMoney(acc.dailyLossRemaining)}</span>
                  <span className="text-xs font-normal text-on-surface-variant"> (Safe threshold)</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Dismiss alert"
              onClick={() => setRiskAlertVisible(false)}
              className="rounded-lg p-1.5 text-on-secondary-fixed-variant transition-colors hover:bg-surface-container"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
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
    </div>
  );
}
