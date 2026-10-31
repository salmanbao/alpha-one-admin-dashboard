"use client";

/**
 * Open Positions — converted from stitch_screens/open_positions
 * Live positions table grouped with a summary strip.
 *
 * Wired to the TradingContext: closes (full/partial), SL/TP modify,
 * breakeven and flatten-all act on the live session state, and the
 * Pending Orders tab shows/cancels resting orders.
 */

import Link from "next/link";
import { useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraAccounts, challengeTimeline } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { useTrading } from "@/lib/trading/trading-context";
import { DetailDialog } from "@/components/terra/detail-dialog";
import { PositionDetailContent } from "./position-detail-content";

const tabs = ["Positions", "Pending Orders"] as const;

const loginOf = (accountId: string) =>
  terraAccounts.find((a) => a.id === accountId)?.login ?? accountId.replace("acc-", "");

export function OpenPositionsPage() {
  const { activeAccount, activeAccountId } = useActiveAccount();
  const { positions, orders, closePosition, closeAll, cancelOrder } = useTrading();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Positions");
  // Quick-view overlay: clicking a symbol opens the trade detail in a
  // dialog on top of the live table — the positions view is never lost.
  const [quickPosId, setQuickPosId] = useState<string | null>(null);
  const quickPos = quickPosId ? (positions.find((p) => p.id === quickPosId) ?? null) : null;
  // Scope: the active trading account by default (follows the header
  // switcher); "All accounts" shows the cross-account view.
  const [scopeAll, setScopeAll] = useState(false);
  const rows = scopeAll
    ? positions
    : positions.filter((p) => p.accountId === activeAccountId);
  const orderRows = scopeAll
    ? orders
    : orders.filter((o) => o.accountId === activeAccountId);

  const totalPnl = rows.reduce((s, p) => s + p.pnl, 0);
  const lots = rows.reduce((s, p) => s + p.lots, 0);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Open Positions"
        description={
          scopeAll
            ? "Live positions across all your accounts"
            : `Live positions on #${activeAccount.login} • ${activeAccount.name}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope toggle — active account (follows switcher) vs all accounts */}
            <div className="flex items-center rounded-xl bg-surface-container-low p-0.5" role="group" aria-label="Position scope">
              <button
                type="button"
                aria-pressed={!scopeAll}
                onClick={() => setScopeAll(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${!scopeAll ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                This account
              </button>
              <button
                type="button"
                aria-pressed={scopeAll}
                onClick={() => setScopeAll(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${scopeAll ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                All accounts
              </button>
            </div>
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => closeAll(scopeAll ? undefined : activeAccountId)}
                className="rounded-xl border border-error/60 px-4 py-2 text-sm font-bold text-error hover:bg-error/10"
              >
                Flatten all
              </button>
            )}
            <Link
              href="/order-ticket"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              + New Order
            </Link>
          </div>
        }
      />

      {/* Positions / Pending Orders tabs */}
      <div className="flex items-center gap-1.5" role="tablist" aria-label="Trade views">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
              tab === t
                ? "bg-primary-fixed/60 text-on-primary-fixed-variant shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-low",
            )}
          >
            {t}
            {t === "Pending Orders" && orderRows.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-on-primary">
                {orderRows.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Positions" ? (
        <>
          {/* Rule Context panel — challenge limits at a glance */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-4">
            {/* Profit target progress */}
            <div className="rounded-lg bg-primary-fixed/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Profit Target</p>
              <TerraStat
                label={`Progress: ${activeAccount.targetProgress}%`}
                value={`${formatSignedMoney(activeAccount.profitTarget)} target`}
                tone={activeAccount.targetProgress >= 80 ? "positive" : "neutral"}
              />
            </div>

            {/* Daily drawdown remaining */}
            <div className="rounded-lg bg-error-fixed/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Daily Drawdown</p>
              <TerraStat
                label={`${formatSignedMoney(activeAccount.dailyLossRemaining)} remaining`}
                value={`Profit used: ${formatSignedMoney(activeAccount.pnl)}`}
                tone={activeAccount.dailyLossRemaining < 500 ? "negative" : "neutral"}
              />
            </div>

            {/* Max drawdown remaining */}
            <div className="rounded-lg bg-surface-container-low p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Max Drawdown</p>
              <TerraStat
                label={`${formatSignedMoney(activeAccount.maxDdRemaining)} remaining`}
                value={`10% limit of ${formatSignedMoney(activeAccount.startingBalance)}`}
                tone={activeAccount.maxDdRemaining < 1000 ? "negative" : "neutral"}
              />
            </div>

            {/* Trading days / consistency */}
            <div className="rounded-lg bg-primary-fixed/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Trading Days</p>
              <TerraStat
                label={
                  activeAccount.phase === "Funded"
                    ? "Funded account"
                    : `${Math.max(0, challengeTimeline.minTradingDays - challengeTimeline.elapsedDays)} days remaining`
                }
                value={`${challengeTimeline.elapsedDays} of ${challengeTimeline.minTradingDays} minimum`}
                tone={challengeTimeline.elapsedDays >= challengeTimeline.minTradingDays ? "positive" : challengeTimeline.elapsedDays / (challengeTimeline.minTradingDays || 1) >= 0.5 ? "neutral" : "negative"}
              />
            </div>
          </div>

          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <TerraCard className="p-5">
              <TerraStat label="Open Positions" value={rows.length} />
            </TerraCard>
            <TerraCard className="p-5">
              <TerraStat
                label="Unrealized P&L"
                value={formatSignedMoney(totalPnl)}
                tone={totalPnl >= 0 ? "positive" : "negative"}
              />
            </TerraCard>
            <TerraCard className="p-5">
              <TerraStat label="Total Volume" value={`${lots.toFixed(2)} lots`} />
            </TerraCard>
            <TerraCard className="p-5">
              <TerraStat label="Winning" value={rows.filter((p) => p.pnl > 0).length} sub={`of ${rows.length}`} />
            </TerraCard>
          </div>

          <TerraCard>
            {rows.length === 0 ? (
              <TerraEmpty
                title="No open positions"
                description={`#${activeAccount.login} has no open positions right now. Switch accounts or place a new order.`}
              />
            ) : (
            <TerraTable
              head={["Symbol", "Side", "Lots", "Entry", "Current", "SL", "TP", "P&L", "Account", ""]}
              rows={rows.map((p) => [
                <button
                  key="s"
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setQuickPosId(p.id)}
                  className="text-left font-semibold text-primary hover:underline"
                >
                  {p.symbol}
                </button>,
                <TerraBadge key="sd" tone={p.side === "long" ? "primary" : "error"}>
                  {p.side === "long" ? "Long" : "Short"}
                </TerraBadge>,
                p.lots.toFixed(2),
                p.entry,
                p.current,
                p.sl ?? "—",
                p.tp ?? "—",
                <span key="p" className={`font-bold tabular-nums ${p.pnl >= 0 ? "text-primary" : "text-error"}`}>
                  {formatSignedMoney(p.pnl)}
                </span>,
                <span key="a" className="font-mono text-xs text-on-surface-variant">
                  #{loginOf(p.accountId)}
                </span>,
                <button
                  key="x"
                  type="button"
                  onClick={() => closePosition(p.id)}
                  className="rounded-lg border border-outline-variant px-2.5 py-1 text-xs font-semibold text-on-surface hover:bg-surface-container-low"
                >
                  Close
                </button>,
              ])}
            />
            )}
          </TerraCard>
        </>
      ) : (
        <TerraCard>
          {orderRows.length === 0 ? (
            <TerraEmpty
              title="No pending orders"
              description={`#${activeAccount.login} has no resting orders. Limit and stop orders appear here until filled or cancelled.`}
            />
          ) : (
            <TerraTable
              head={["Symbol", "Type", "Lots", "Price", "SL", "TP", "Expiry", "Placed", "Account", ""]}
              rows={orderRows.map((o) => [
                <span key="s" className="font-semibold">{o.symbol}</span>,
                <TerraBadge key="t" tone={o.type.startsWith("Buy") ? "primary" : "error"}>
                  {o.type}
                </TerraBadge>,
                o.lots.toFixed(2),
                o.price,
                o.sl ?? "—",
                o.tp ?? "—",
                o.expiry,
                new Date(o.placedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
                <span key="a" className="font-mono text-xs text-on-surface-variant">
                  #{loginOf(o.accountId)}
                </span>,
                <button
                  key="x"
                  type="button"
                  onClick={() => cancelOrder(o.id)}
                  className="rounded-lg border border-error/50 px-2.5 py-1 text-xs font-semibold text-error hover:bg-error/10"
                >
                  Cancel
                </button>,
              ])}
            />
          )}
        </TerraCard>
      )}

      {/* Quick-view overlay — inspect a position without leaving live positions */}
      <DetailDialog
        open={quickPos !== null}
        onOpenChange={(o) => {
          if (!o) setQuickPosId(null);
        }}
        title={quickPos ? `${quickPos.symbol} position` : "Position detail"}
        description={
          quickPos
            ? `${quickPos.side === "long" ? "Long" : "Short"} • ${quickPos.lots.toFixed(2)} lots • opened ${new Date(quickPos.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : undefined
        }
      >
        {quickPos && <PositionDetailContent id={quickPos.id} embedded />}
      </DetailDialog>
    </div>
  );
}
