"use client";

/**
 * Open Positions — converted from stitch_screens/open_positions
 * Live positions table grouped with a summary strip.
 */

import Link from "next/link";
import { useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraAccounts, terraPositions } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";

export function OpenPositionsPage() {
  const { activeAccount, activeAccountId } = useActiveAccount();
  // Scope: the active trading account by default (follows the header
  // switcher); "All accounts" shows the cross-account view.
  const [scopeAll, setScopeAll] = useState(false);
  const rows = scopeAll
    ? terraPositions
    : terraPositions.filter((p) => p.accountId === activeAccountId);

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
            <Link
              href="/order-ticket"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              + New Order
            </Link>
          </div>
        }
      />

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
          head={["Symbol", "Side", "Lots", "Entry", "Current", "SL", "TP", "P&L", "Account"]}
          rows={rows.map((p) => [
            <Link key="s" href={`/trade-detail?id=${p.id}`} className="font-semibold text-primary hover:underline">
              {p.symbol}
            </Link>,
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
              #{terraAccounts.find((a) => a.id === p.accountId)?.login ?? p.accountId.replace("acc-", "")}
            </span>,
          ])}
        />
        )}      </TerraCard>
    </div>
  );
}
