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
  TerraSectionTitle,
  TerraStat,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import {
  equityCurve30d,
  primaryAccount,
  terraPositions,
} from "@/lib/fixtures/terra-fixtures";

const ranges = ["7d", "30d", "90d"] as const;

export function DashboardPage() {
  const [range, setRange] = useState<(typeof ranges)[number]>("30d");
  const [riskAlertVisible, setRiskAlertVisible] = useState(true);
  const acc = primaryAccount;

  const curve =
    range === "7d"
      ? equityCurve30d.slice(-7)
      : range === "90d"
        ? equityCurve30d // demo: same series
        : equityCurve30d;

  return (
    <div className="flex flex-col gap-6">
      {/* Top controls bar */}
      <div className="flex flex-col items-stretch justify-between gap-4 rounded-xl bg-surface-container-low p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* Account selector */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-3 rounded-lg bg-surface-container-lowest px-4 py-2.5 text-left shadow-sm transition-all hover:bg-surface-container"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed-variant">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </span>
              <span className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Trading Account
                </span>
                <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
                  <span className="font-mono">#{acc.login}</span>
                  <span className="hidden text-xs font-normal text-on-surface-variant sm:inline">
                    • {acc.name}
                  </span>
                </span>
              </span>
              <svg className="ml-2 h-4 w-4 text-on-surface-variant transition-transform group-hover:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
          </div>
          {/* Account state badge */}
          <TerraBadge tone="primary" dot pulse>
            Active • In Good Standing
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

      {/* Alerts banner */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
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
                You are {acc.targetProgress}% toward your profit target{" "}
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
              <TerraBadge tone="primary" dot>
                ACTIVE
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
              <span className="text-sm font-bold text-on-surface">Profit Target Progress</span>
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
              title="Equity Curve · 30 days"
              description="Daily equity snapshot across all your accounts."
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
              <TerraStat label="Open Positions" value={terraPositions.length} />
              <TerraStat
                label="Unrealized P&L"
                value={formatSignedMoney(terraPositions.reduce((s, p) => s + p.pnl, 0))}
                tone={terraPositions.reduce((s, p) => s + p.pnl, 0) >= 0 ? "positive" : "negative"}
              />
              <TerraStat label="Win Rate" value="68%" sub="142 trades" />
              <TerraStat label="Avg Hold" value="4h 22m" sub="per trade" />
            </div>
          </TerraCard>
          <TerraCard>
            <TerraSectionTitle title="Risk Status" />
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-surface-container px-3 py-2.5">
                <span className="text-on-surface-variant">Daily loss remaining</span>
                <strong className="text-on-surface">{formatMoney(acc.dailyLossRemaining)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-container px-3 py-2.5">
                <span className="text-on-surface-variant">Max DD remaining</span>
                <strong className="text-on-surface">{formatMoney(acc.maxDdRemaining)}</strong>
              </div>
              <Link
                href="/risk-dashboard"
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
              >
                Open Risk Dashboard →
              </Link>
            </div>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
