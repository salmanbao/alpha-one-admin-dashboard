"use client";

/**
 * TraderPerformanceChip — shared payout-approval context (audit #3 fix #2).
 *
 * Payout reviewers need the trader's recent performance next to the
 * amount they are approving. Used on the Pending Payouts approval cards,
 * the payouts table, and the Enhanced Withdrawals queue so every payout
 * decision surface carries the same context.
 */

import { cn } from "@/lib/utils";

export interface PayoutTraderPerformance {
  name: string;
  country?: string;
  totalPnl: number;
  accountBalance: number;
  winRate: number;
  trades: number;
  challengePhase?: string;
}

const PHASE_LABEL: Record<string, string> = {
  "phase-1": "Phase 1",
  "phase-2": "Phase 2",
  funded: "Funded",
  none: "—",
};

export function TraderPerformanceChip({
  trader,
  compact = false,
}: {
  trader: PayoutTraderPerformance | undefined;
  compact?: boolean;
}) {
  if (!trader) return <span className="text-xs text-muted-foreground">—</span>;

  const pnlPct =
    trader.accountBalance > 0 ? ((trader.totalPnl / trader.accountBalance) * 100).toFixed(1) : "0";
  const profitable = trader.totalPnl > 0;

  if (compact) {
    return (
      <span className="flex items-center gap-2 text-[11px]">
        <span className={cn("font-semibold tabular-nums", profitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
          {profitable ? "+" : ""}
          {pnlPct}%
        </span>
        <span className="text-muted-foreground">PnL ·</span>
        <span className="tabular-nums">{trader.winRate}%</span>
        <span className="text-muted-foreground">win ·</span>
        <span className="tabular-nums">{trader.trades}</span>
        <span className="text-muted-foreground">trades</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-semibold tabular-nums",
            profitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
          )}
        >
          {profitable ? "+" : ""}
          {pnlPct}%
        </span>
        <span className="text-muted-foreground">PnL</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="tabular-nums text-foreground">{trader.winRate}%</span>
        <span className="text-muted-foreground">win rate</span>
      </div>
      <div className="text-muted-foreground">{trader.trades} trades</div>
      {trader.challengePhase ? (
        <div className="text-muted-foreground">{PHASE_LABEL[trader.challengePhase] ?? trader.challengePhase}</div>
      ) : null}
    </div>
  );
}
