"use client";

/**
 * Account Statement — converted from stitch_screens/account_statement
 * Statement with period selector, balance summary and trade table.
 */

import {
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades, primaryAccount } from "@/lib/fixtures/terra-fixtures";

export function AccountStatementPage() {
  const deposits = 0;
  const closedPnl = terraTrades.reduce((s, t) => s + t.pnl, 0);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Statement"
        description={`${primaryAccount.name} • Login #${primaryAccount.login} • October 2026`}
        actions={
          <div className="flex gap-2">
            <button type="button" className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container">
              Sep
            </button>
            <button type="button" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary">
              Oct
            </button>
            <button type="button" className="rounded-xl bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container">
              Download PDF
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Opening Balance" value={formatMoney(100000)} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Closed P&L" value={formatSignedMoney(closedPnl)} tone={closedPnl >= 0 ? "positive" : "negative"} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Deposits" value={formatMoney(deposits)} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Closing Balance" value={formatMoney(primaryAccount.balance)} tone="positive" />
        </TerraCard>
      </div>

      <TerraCard>
        <TerraSectionTitle title="Closed positions" description="All closed trades in the statement period" />
        <TerraTable
          head={["Ticket", "Symbol", "Lots", "Entry", "Exit", "Pips", "P&L", "Closed"]}
          rows={terraTrades.map((t) => [
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
