"use client";

/**
 * Account Statement — converted from stitch_screens/account_statement
 * Statement with period selector, balance summary and trade table.
 *
 * The period is real: trades and payouts are filtered by the month
 * they occurred in, and the balance chain is coherent —
 *
 *   Closing(P) = Balance − P&L after P + Withdrawals after P
 *   Opening(P) = Closing(P) − P&L in P + Withdrawals in P
 *
 * so September's closing balance equals October's opening balance.
 * `?month=YYYY-MM` deep-links a month (used by the Documents center).
 */

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraPayouts, terraTrades } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";

const monthKey = (iso: string) => iso.slice(0, 7); // "2026-10"
const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};
const monthBounds = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return { start: Date.UTC(y, m - 1, 1), end: Date.UTC(y, m, 1) };
};

export function AccountStatementPage() {
  const [downloaded, setDownloaded] = useState(false);
  // Statement is scoped to the active trading account (header switcher);
  // the trade list, P&L, withdrawals and balances all follow it.
  const { activeAccount } = useActiveAccount();

  // Months that actually have activity for this account (newest first).
  const accTrades = terraTrades.filter((t) => t.accountId === activeAccount.id);
  const accPayouts = terraPayouts.filter((p) => p.account === activeAccount.id);
  const months = Array.from(
    new Set([
      ...accTrades.map((t) => monthKey(t.closedAt)),
      ...accPayouts.map((p) => monthKey(p.requestedAt)),
    ]),
  ).sort((a, b) => b.localeCompare(a));

  // Selected month: ?month= deep link, else the most recent active month.
  const paramMonth = useSearchParams().get("month");
  const requested = paramMonth ? monthKey(paramMonth) : null;
  const [month, setMonth] = useState<string | null>(requested);
  const activeMonth =
    month && months.includes(month) ? month : (months[0] ?? monthKey(new Date().toISOString()));
  const { start, end } = monthBounds(activeMonth);

  const monthTrades = accTrades.filter((t) => {
    const t0 = +new Date(t.closedAt);
    return t0 >= start && t0 < end;
  });
  const monthPayouts = accPayouts.filter((p) => {
    const t0 = +new Date(p.requestedAt);
    return t0 >= start && t0 < end;
  });

  const closedPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);
  const pnlAfter = accTrades
    .filter((t) => +new Date(t.closedAt) >= end)
    .reduce((s, t) => s + t.pnl, 0);
  // Only paid payouts have left the balance; pending requests have not.
  const paidInMonth = monthPayouts
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const paidAfter = accPayouts
    .filter((p) => p.status === "paid" && +new Date(p.requestedAt) >= end)
    .reduce((s, p) => s + p.amount, 0);

  const closingBalance = activeAccount.balance - pnlAfter + paidAfter;
  const openingBalance = closingBalance - closedPnl + paidInMonth;

  const handleDownload = () => {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Account Statement"
        description={`${activeAccount.name} • Login #${activeAccount.login} • ${monthLabel(activeMonth)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonth(m)}
                className={`rounded-xl px-4 py-2 text-sm ${activeMonth === m ? "bg-primary font-bold text-on-primary" : "bg-surface-container-low font-semibold text-on-surface hover:bg-surface-container"}`}
              >
                {monthLabel(m)}
              </button>
            ))}
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
          <TerraStat
            label="Closed P&L"
            value={formatSignedMoney(closedPnl)}
            tone={closedPnl >= 0 ? "positive" : "negative"}
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Withdrawals" value={formatSignedMoney(-paidInMonth)} tone={paidInMonth > 0 ? "negative" : undefined} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Closing Balance"
            value={formatMoney(closingBalance)}
            tone="positive"
          />
        </TerraCard>
      </div>

      <TerraCard>
        <TerraSectionTitle
          title="Closed positions"
          description={`Closed trades on #${activeAccount.login} in ${monthLabel(activeMonth)}`}
        />
        {monthTrades.length === 0 ? (
          <TerraEmpty
            title="No closed trades in this period"
            description={`#${activeAccount.login} has no closed trades in ${monthLabel(activeMonth)}.`}
          />
        ) : (
          <TerraTable
            head={["Ticket", "Symbol", "Lots", "Entry", "Exit", "Pips", "P&L", "Closed"]}
            rows={monthTrades.map((t) => [
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
        )}
      </TerraCard>

      {monthPayouts.length > 0 && (
        <TerraCard>
          <TerraSectionTitle
            title="Withdrawals"
            description={`Payout requests on #${activeAccount.login} in ${monthLabel(activeMonth)}`}
          />
          <TerraTable
            head={["Reference", "Amount", "Method", "Status", "Requested"]}
            rows={monthPayouts.map((p) => [
              <span key="r" className="font-mono text-xs font-bold">{p.reference}</span>,
              <span key="a" className="font-semibold tabular-nums">{formatMoney(p.amount)}</span>,
              p.method,
              <span key="s">{p.status}</span>,
              p.requestedAt.slice(0, 10),
            ])}
          />
        </TerraCard>
      )}
    </div>
  );
}
