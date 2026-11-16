"use client";

/**
 * Closed Positions Page — My Closed Positions
 *
 * Simplified view for the trader app showing closed positions/trading history.
 * Permission-gated to trader.self.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@pfaas/platform-core";
import { Page, PageHeader, PageContent } from "@pfaas/ui";
import { DataTable } from "@pfaas/ui";
import { StatusBadge } from "@pfaas/ui";
import { formatCurrency } from "@pfaas/ui";
import { EmptyState } from "@pfaas/ui";
import { Activity, Clock } from "lucide-react";
import { Button } from "@pfaas/ui";
import { useActiveAccount } from "@/lib/platform/account-context";
import { useTrading } from "@/lib/trading/trading-context";
import { exportToCsv } from "@/lib/export/export-csv";
import { terraAccounts, type TerraTrade } from "@/lib/fixtures/terra-fixtures";

/** Hold time as a human duration ("2 days 4 hours" / "3 hours 12 min"). */
function holdDuration(openedAt: string, closedAt: string): string {
  const ms = Math.max(0, +new Date(closedAt) - +new Date(openedAt));
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) {
    return `${hours} hour${hours === 1 ? "" : "s"} ${mins} min${mins === 1 ? "" : "s"}`;
  }
  return `${mins} min${mins === 1 ? "" : "s"}`;
}

/** Trading store trade → the row shape this table renders (R7 I1). */
function toClosedRow(t: TerraTrade) {
  const size = Math.round(t.lots * 100_000);
  const balance = terraAccounts.find((a) => a.id === t.accountId)?.balance;
  const marginUsed = Math.round((t.entry * size) / 100);
  return {
    id: t.id,
    accountId: t.accountId,
    symbol: t.symbol,
    side: t.side,
    size,
    entryPrice: t.entry,
    exitPrice: t.exit,
    pnl: t.pnl,
    pnlPercent: balance ? (t.pnl / balance) * 100 : 0,
    marginUsed,
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    duration: holdDuration(t.openedAt, t.closedAt),
    status: "closed" as const,
  };
}

export function ClosedPositionsPage() {
  const { runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  // Account scope — follows the header switcher; "All accounts" shows the
  // cross-account history.
  const { activeAccount, activeAccountId } = useActiveAccount();
  const [scopeAll, setScopeAll] = useState(false);

  // R7 I1 — the persistent trading store: fixture seed on first run plus
  // every close taken in this browser (no hand-written rows).
  const { closedTrades } = useTrading();

  const closedPositions = useMemo(
    () =>
      closedTrades
        .filter((t) => scopeAll || t.accountId === activeAccountId)
        .map(toClosedRow),
    [scopeAll, activeAccountId, closedTrades],
  );

  return (
    <Page className="min-h-[calc(100vh-14rem)]">
      <PageHeader
        title="My Closed Positions"
        description={
          scopeAll
            ? "View your trading history and closed positions across all accounts"
            : `Trading history on #${activeAccount.login} • ${activeAccount.name}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope toggle — active account (follows switcher) vs all accounts */}
            <div className="flex items-center rounded-xl bg-muted p-0.5" role="group" aria-label="Position scope">
              <button
                type="button"
                aria-pressed={!scopeAll}
                onClick={() => setScopeAll(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${!scopeAll ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                This account
              </button>
              <button
                type="button"
                aria-pressed={scopeAll}
                onClick={() => setScopeAll(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${scopeAll ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                All accounts
              </button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportToCsv(
                  closedPositions,
                  [
                    { header: "Symbol", value: (r) => r.symbol },
                    { header: "Side", value: (r) => r.side },
                    { header: "Size", value: (r) => r.size },
                    { header: "Entry", value: (r) => r.entryPrice },
                    { header: "Exit", value: (r) => r.exitPrice },
                    { header: "P&L", value: (r) => r.pnl },
                    { header: "Closed At", value: (r) => new Date(r.closedAt).toISOString() },
                  ],
                  "closed-positions.csv",
                )
              }
            >
              <Clock className="h-4 w-4 mr-2" />
              Export History
            </Button>
          </div>
        }
      />

      <PageContent className="space-y-6">
        {closedPositions.length > 0 ? (
          <DataTable
            data={closedPositions}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "symbol",
                header: "Symbol",
                cell: (row) => <span className="font-medium">{row.symbol}</span>,
              },
              {
                key: "side",
                header: "Side",
                cell: (row) =>
                  row.side === "long" ? (
                    <span className="text-xs font-medium bg-green-100 text-green-800 rounded px-2 py-1">
                      Long
                    </span>
                  ) : (
                    <span className="text-xs font-medium bg-red-100 text-red-800 rounded px-2 py-1">
                      Short
                    </span>
                  ),
              },
              {
                key: "entryPrice",
                header: "Entry Price",
                cell: (row) => formatCurrency(row.entryPrice, currency),
              },
              {
                key: "exitPrice",
                header: "Exit Price",
                cell: (row) => formatCurrency(row.exitPrice, currency),
              },
              {
                key: "size",
                header: "Size",
                cell: (row) => `${row.size.toLocaleString()} ${row.symbol.slice(3)}`,
              },
              {
                key: "pnl",
                header: "P&L",
                numeric: true,
                cell: (row) => formatCurrency(row.pnl, currency),
              },
              {
                key: "pnlPercent",
                header: "P&L %",
                numeric: true,
                cell: (row) => `${row.pnlPercent.toFixed(2)}%`,
              },
              {
                key: "duration",
                header: "Duration",
                cell: (row) => row.duration,
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => (
                  <StatusBadge tone={row.status === "closed" ? "default" : "danger"}>
                    {row.status}
                  </StatusBadge>
                ),
              },
            ]}
          />
        ) : (
          <EmptyState
            title="No closed positions"
            description={
              scopeAll
                ? "You have no closed positions in your trading history."
                : `#${activeAccount.login} has no closed positions yet — switch accounts or All accounts to see the rest of your history.`
            }
            icon={Activity}
          />
        )}

        {/* R7 I1 — honest provenance for the seeded history (local only). */}
        <p className="text-center text-xs text-muted-foreground">
          Demo trades seeded on first run · closes are saved in this browser (Demo)
        </p>
      </PageContent>
    </Page>
  );
}
