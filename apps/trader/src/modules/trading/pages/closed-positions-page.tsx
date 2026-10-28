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
import { toast } from "@/hooks/use-toast";

export function ClosedPositionsPage() {
  const { runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  // Account scope — follows the header switcher; "All accounts" shows the
  // cross-account history.
  const { activeAccount, activeAccountId } = useActiveAccount();
  const [scopeAll, setScopeAll] = useState(false);

  const allClosedPositions = useMemo(() => {
    return [
      {
        id: "closed-1",
        accountId: "acc-100030",
        symbol: "EURUSD",
        side: "long",
        size: 100000,
        entryPrice: 1.08,
        exitPrice: 1.085,
        pnl: 500,
        pnlPercent: 0.46,
        marginUsed: 1000,
        openedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        duration: "2 days 4 hours",
        status: "closed",
      },
      {
        id: "closed-2",
        accountId: "acc-100030",
        symbol: "GBPUSD",
        side: "short",
        size: 100000,
        entryPrice: 1.27,
        exitPrice: 1.26,
        pnl: 1000,
        pnlPercent: 0.79,
        marginUsed: 800,
        openedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        duration: "3 days 6 hours",
        status: "closed",
      },
      {
        id: "closed-3",
        accountId: "acc-098412",
        symbol: "USDJPY",
        side: "long",
        size: 100000,
        entryPrice: 149.5,
        exitPrice: 148.75,
        pnl: -750,
        pnlPercent: -0.5,
        marginUsed: 1200,
        openedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        duration: "2 days 12 hours",
        status: "closed",
      },
      {
        id: "closed-4",
        accountId: "acc-092841",
        symbol: "XAUUSD",
        side: "short",
        size: 100000,
        entryPrice: 2412.5,
        exitPrice: 2406.1,
        pnl: 320,
        pnlPercent: 0.26,
        marginUsed: 900,
        openedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        duration: "1 day 8 hours",
        status: "closed",
      },
    ];
  }, []);

  const closedPositions = useMemo(
    () =>
      scopeAll
        ? allClosedPositions
        : allClosedPositions.filter((p) => p.accountId === activeAccountId),
    [scopeAll, activeAccountId, allClosedPositions],
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
                toast({
                  title: "Export ready",
                  description: `Exported ${closedPositions.length} closed positions (${scopeAll ? "all accounts" : `#${activeAccount.login}`}).`,
                })
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
      </PageContent>
    </Page>
  );
}
