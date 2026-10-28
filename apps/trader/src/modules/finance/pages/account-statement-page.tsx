"use client";

/**
 * Account Statement — converted from stitch_screens/account_statement
 * Statement with period selector, balance summary and trade table.
 */

import { useState } from "react";
import {
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";

export function AccountStatementPage() {
  const [period, setPeriod] = useState<"Sep" | "Oct">("Oct");
  const [downloaded, setDownloaded] = useState(false);
  // Statement is scoped to the active trading account (header switcher);
  // the trade list, P&L and balances all follow it.
  const { activeAccount } = useActiveAccount();
  const accTrades = terraTrades.filter((t) => t.accountId === activeAccount.id);
  const deposits = 0;
  const closedPnl = accTrades.reduce((s, t) => s + t.pnl, 0);
  const openingBalance = activeAccount.balance - closedPnl - deposits;

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Statement"
        description={`${activeAccount.name} • Login #${activeAccount.login} • ${period === "Oct" ? "October" : "September"} 2026`}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPeriod("Sep")}
              className={`rounded-xl px-4 py-2 text-sm ${period === "Sep" ? "bg-primary font-bold text-on-primary" : "bg-surface-container-low font-semibold text-on-surface hover:bg-surface-container"}`}
            >
              Sep
            </button>
            <button
              type="button"
              onClick={() => setPeriod("Oct")}
              className={`rounded-xl px-4 py-2 text-sm ${period === "Oct" ? "bg-primary font-bold text-on-primary" : "bg-surface-container-low font-semibold text-on-surface hover:bg-surface-container"}`}
            >
              Oct
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container"
            >
              {downloaded ? "✓ Downloaded" : "Download PDF"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Opening Balance" value={formatMoney(openingBalance)} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Closed P&L" value={formatSignedMoney(closedPnl)} tone={closedPnl >= 0 ? "positive" : "negative"} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Deposits" value={formatMoney(deposits)} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Closing Balance" value={formatMoney(activeAccount.balance)} tone="positive" />
        </TerraCard>
      </div>

      <TerraCard>
        <TerraSectionTitle title="Closed positions" description={`Closed trades on #${activeAccount.login} in the statement period`} />
        <TerraTable
          head={["Ticket", "Symbol", "Lots", "Entry", "Exit", "Pips", "P&L", "Closed"]}
          rows={accTrades.map((t) => [
            <span key="t" className="font-mono text-xs font-bold">{t.ticket}</span>,
            <span key="s" className="font-semibold">{t.symbol}</span>,
            t.lots.toFixed(2),
            t.entry,
            t.exit,
            <span key="p" className={t.pips >= 0 ? "text-primary" : "text-error"}>
              {t.pips >= 0 ? "+" : ""}{t.pips}
            </span>,
            <span key="pl" className={`font-bold tabular-nums ${t.pnl >= 0 ? "text-primary" : "text-error"}`}>
              {formatSignedMoney(t.pnl)}
            </span>,
            t.closedAt.slice(0, 10),
          ])}
        />
      </TerraCard>
    </div>
  );
}
