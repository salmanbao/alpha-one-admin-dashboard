"use client";

/**
 * My Accounts — converted from stitch_screens/my_accounts
 * Account cards with phase badge, KPI mini-cards, progress bar and risk status.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraProgress,
  TerraStat,
  TerraEmpty,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraAccounts } from "@/lib/fixtures/terra-fixtures";

function StatusChip({ status }: { status: string }) {
  if (status === "active")
    return (
      <TerraBadge tone="primary" dot pulse>
        Active
      </TerraBadge>
    );
  if (status === "standby") return <TerraBadge tone="secondary">Standby</TerraBadge>;
  if (status === "breached") return <TerraBadge tone="error">Breached</TerraBadge>;
  if (status === "passed") return <TerraBadge tone="success">Passed</TerraBadge>;
  return <TerraBadge tone="neutral">Provisioning</TerraBadge>;
}

export function MyAccountsPage() {
  if (terraAccounts.length === 0) {
    return (
      <div className="space-y-6">
        <TerraPageHeader title="My Accounts" description="All your trading accounts" />
        <TerraEmpty
          title="No accounts yet"
          description="Purchase a challenge from the marketplace to get your first account."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="My Accounts"
        description={`${terraAccounts.length} accounts • ${terraAccounts.filter((a) => a.status === "active").length} active`}
        actions={
          <Link
            href="/marketplace"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90"
          >
            + New Challenge
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {terraAccounts.map((acc) => (
          <TerraCard key={acc.id} className="flex flex-col justify-between gap-5">
            {/* Top row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="rounded-lg bg-surface-container-low px-2.5 py-1 font-mono text-sm font-bold tracking-tight text-on-surface">
                  #{acc.login}
                </span>
                {acc.phase === "Funded" ? (
                  <TerraBadge tone="primary">Funded Trader</TerraBadge>
                ) : (
                  <TerraBadge tone="secondary">{acc.phase}</TerraBadge>
                )}
                <StatusChip status={acc.status} />
              </div>
              <span className="rounded-md bg-surface-container px-2.5 py-0.5 text-xs font-semibold text-on-surface-variant">
                {acc.platform}
              </span>
            </div>

            {/* Name & meta */}
            <div>
              <h2 className="font-headline text-lg font-semibold text-on-surface transition-colors hover:text-primary sm:text-xl">
                {acc.name}
                {acc.phase !== "Funded" && " • Evaluation"}
              </h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {acc.profitSplit
                  ? `${acc.profitSplit} Profit Split • Live Payout Track`
                  : `Server ${acc.server} • ${acc.phase} progress`}
              </p>
            </div>

            {/* KPI mini-cards */}
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-container-low p-3 sm:gap-3">
              <TerraStat label="Balance" value={formatMoney(acc.balance)} />
              <TerraStat label="Equity" value={formatMoney(acc.equity)} tone="positive" />
              <TerraStat
                label="P&L"
                value={
                  <>
                    {formatSignedMoney(acc.pnl)}{" "}
                    <span className="text-[10px] font-medium">
                      ({acc.pnl >= 0 ? "+" : ""}
                      {acc.pnlPercent.toFixed(2)}%)
                    </span>
                  </>
                }
                tone={acc.pnl >= 0 ? "positive" : "negative"}
              />
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-medium text-on-surface">
                  {acc.phase === "Funded" ? (
                    <>
                      Payout Eligible:{" "}
                      <strong className="font-bold text-primary">Bi-Weekly</strong>
                    </>
                  ) : (
                    <>
                      Target:{" "}
                      <strong className="font-bold text-primary">{acc.targetProgress}%</strong>
                    </>
                  )}
                </span>
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {formatMoney(acc.pnl)} / {formatMoney(acc.profitTarget)}
                </span>
              </div>
              <TerraProgress value={acc.targetProgress} />
            </div>

            {/* Risk status box */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container px-3 py-2.5 text-xs text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Daily Loss: <strong className="text-on-surface">{formatMoney(acc.dailyLossRemaining)} rem</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Max DD: <strong className="text-on-surface">{formatMoney(acc.maxDdRemaining)} rem</strong>
              </span>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-3 border-t border-outline-variant/40 pt-4">
              <Link
                href="/account-detail"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary transition-colors hover:text-on-primary-fixed-variant sm:text-sm"
              >
                <span>View Account</span>
                <span>→</span>
              </Link>
              <Link
                href="/trading-credentials"
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container"
              >
                <svg className="h-4 w-4 text-on-surface-variant" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m21 2-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L19.5 4.5m0 0 2.5 2.5-3 3-2.5-2.5" />
                </svg>
                <span>Credentials</span>
              </Link>
            </div>
          </TerraCard>
        ))}
      </div>
    </div>
  );
}
