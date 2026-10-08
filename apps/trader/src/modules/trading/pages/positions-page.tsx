"use client";

/**
 * Positions Page — My Open Positions
 *
 * Simplified view for the trader app showing open positions.
 * Permission-gated to trader.self.
 */

import { useMemo } from "react";
import { usePlatform } from "@pfaas/platform-core";
import { Page, PageHeader, PageContent } from "@pfaas/ui";
import { DataTable } from "@pfaas/ui";
import { StatusBadge } from "@pfaas/ui";
import { EmptyState } from "@pfaas/ui";
import { formatCurrency } from "@pfaas/ui";
import { Activity, Plus } from "lucide-react";
import { Button } from "@pfaas/ui";

export function PositionsPage() {
  const { runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";

  const positions = useMemo(() => {
    return [
      {
        id: "pos-1",
        symbol: "EURUSD",
        side: "long",
        size: 100000,
        entryPrice: 1.085,
        currentPrice: 1.0875,
        pnl: 250,
        pnlPercent: 0.23,
        marginUsed: 1000,
        marginRemaining: 4000,
        marginPercent: 2,
        stopLoss: 1.082,
        takeProfit: 1.09,
        openedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: "open",
      },
      {
        id: "pos-2",
        symbol: "GBPUSD",
        side: "short",
        size: 100000,
        entryPrice: 1.265,
        currentPrice: 1.2625,
        pnl: -150,
        pnlPercent: -0.12,
        marginUsed: 800,
        marginRemaining: 5000,
        marginPercent: 1.6,
        stopLoss: 1.27,
        takeProfit: 1.255,
        openedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        status: "open",
      },
    ];
  }, []);

  return (
    <Page className="min-h-[calc(100vh-14rem)]">
      <PageHeader
        title="My Open Positions"
        description="View and manage your currently open trading positions"
        actions={
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Position
          </Button>
        }
      />

      <PageContent className="space-y-6">
        {positions.length > 0 ? (
          <DataTable
            data={positions}
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
                key: "size",
                header: "Size",
                cell: (row) => `${row.size.toLocaleString()} ${row.symbol.slice(3)}`,
              },
              {
                key: "entryPrice",
                header: "Entry Price",
                cell: (row) => formatCurrency(row.entryPrice, currency),
              },
              {
                key: "currentPrice",
                header: "Current Price",
                cell: (row) => formatCurrency(row.currentPrice, currency),
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
                key: "marginUsed",
                header: "Margin Used",
                cell: (row) => formatCurrency(row.marginUsed, currency),
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => (
                  <StatusBadge tone={row.status === "open" ? "info" : "danger"}>
                    {row.status}
                  </StatusBadge>
                ),
              },
            ]}
          />
        ) : (
          <EmptyState
            title="No open positions"
            description="You have no currently open trading positions."
            icon={Activity}
          />
        )}
      </PageContent>
    </Page>
  );
}
