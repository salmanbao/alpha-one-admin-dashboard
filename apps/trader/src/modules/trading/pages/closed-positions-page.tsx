"use client";

/**
 * Closed Positions Page — My Closed Positions
 *
 * Simplified view for the trader app showing closed positions/trading history.
 * Permission-gated to trader.self.
 */

import { useMemo } from "react";
import { usePlatform } from "@pfaas/platform-core";
import { Page, PageHeader, PageContent } from "@pfaas/ui";
import { DataTable } from "@pfaas/ui";
import { StatusBadge } from "@pfaas/ui";
import { formatCurrency } from "@pfaas/ui";
import { EmptyState } from "@pfaas/ui";
import { Activity, Clock } from "lucide-react";
import { Button } from "@pfaas/ui";

export function ClosedPositionsPage() {
  const { runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";

  const closedPositions = useMemo(() => {
    return [
      {
        id: "closed-1",
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
    ];
  }, []);

  return (
    <Page className="min-h-[calc(100vh-14rem)]">
      <PageHeader
        title="My Closed Positions"
        description="View your trading history and closed positions"
        actions={
          <Button variant="outline" size="sm">
            <Clock className="h-4 w-4 mr-2" />
            Export History
          </Button>
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
            description="You have no closed positions in your trading history."
            icon={Activity}
          />
        )}
      </PageContent>
    </Page>
  );
}
