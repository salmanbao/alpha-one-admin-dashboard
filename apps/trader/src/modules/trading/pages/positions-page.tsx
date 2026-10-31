"use client";

/**
 * Positions Page — My Open Positions
 *
 * Simplified view for the trader app showing open positions.
 * Permission-gated to trader.self.
 *
 * Audit finding #5 (MEDIUM): positions now carry challenge-rule context —
 * a per-account rules strip (profit target, daily/max drawdown remaining)
 * above the table, a per-position "Rule impact" column (contribution to
 * the profit target, stop-loss risk vs the remaining daily loss budget,
 * and a warning when a position has no SL at all), and a "View rules"
 * quick reference dialog showing the full program rules.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@pfaas/platform-core";
import { Page, PageHeader, PageContent } from "@pfaas/ui";
import { DataTable } from "@pfaas/ui";
import { MetricCard } from "@pfaas/ui";
import { StatusBadge } from "@pfaas/ui";
import { EmptyState } from "@pfaas/ui";
import { formatCurrency } from "@pfaas/ui";
import { Activity, Gauge, Plus, ScrollText, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@pfaas/ui";
import { useActiveAccount } from "@/lib/platform/account-context";
import { ChallengeRulesDialog } from "@/components/terra/challenge-rules-dialog";

export function PositionsPage() {
  const { runtime } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const { activeAccount } = useActiveAccount();
  const [rulesOpen, setRulesOpen] = useState(false);

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

  /**
   * finding #5 — per-position challenge impact.
   *
   * slRisk: dollars lost if the stop-loss fills (price distance × size;
   * both fixtures are USD-quoted pairs so 1.0 point = $1 per unit).
   * Compared against the remaining daily-loss budget so the trader sees
   * how much of today's drawdown allowance THIS position puts at risk.
   */
  const impacts = useMemo(() => {
    return positions.map((p) => {
      const slRisk = p.stopLoss
        ? Math.abs(p.entryPrice - p.stopLoss) * p.size
        : null;
      const slShare =
        slRisk === null
          ? null
          : Math.round((slRisk / Math.max(1, activeAccount.dailyLossRemaining)) * 100);
      const targetShare =
        (p.pnl / Math.max(1, activeAccount.profitTarget)) * 100;
      return { id: p.id, slRisk, slShare, targetShare };
    });
  }, [positions, activeAccount]);

  return (
    <Page className="min-h-[calc(100vh-14rem)]">
      <PageHeader
        title="My Open Positions"
        description="View and manage your currently open trading positions"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              title="Full program rules for this account — targets, drawdowns, trading days"
              onClick={() => setRulesOpen(true)}
            >
              <ScrollText className="h-4 w-4 mr-2" />
              View rules
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast({
                  title: "Order ticket",
                  description: "Mock: open new position ticket (no backend call).",
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              New Position
            </Button>
          </>
        }
      />

      <PageContent className="space-y-6">
        {/* finding #5 — challenge-rule context strip for the active account */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Profit target"
            value={`${activeAccount.targetProgress}%`}
            deltaLabel={`${formatCurrency(activeAccount.profitTarget, currency)} to pass`}
            icon={Target}
            tone={activeAccount.targetProgress >= 80 ? "positive" : "default"}
          />
          <MetricCard
            label="Daily loss remaining"
            value={formatCurrency(activeAccount.dailyLossRemaining, currency)}
            deltaLabel="resets at midnight UTC"
            icon={Gauge}
            tone={activeAccount.dailyLossRemaining < 500 ? "negative" : "default"}
          />
          <MetricCard
            label="Max drawdown remaining"
            value={formatCurrency(activeAccount.maxDdRemaining, currency)}
            deltaLabel="breach ends the evaluation"
            icon={Activity}
            tone={activeAccount.maxDdRemaining < 1000 ? "negative" : "default"}
          />
          <MetricCard
            label="Open positions"
            value={positions.length}
            deltaLabel={`on #${activeAccount.login} • ${activeAccount.phase}`}
            icon={ScrollText}
          />
        </div>

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
                key: "ruleImpact",
                header: "Rule impact",
                cell: (row) => {
                  const impact = impacts.find((i) => i.id === row.id);
                  if (!impact) return null;
                  const { slRisk, slShare, targetShare } = impact;
                  return (
                    <div className="space-y-1 text-xs">
                      {/* contribution to (or erosion of) the profit target */}
                      <p
                        className={
                          row.pnl >= 0 ? "text-emerald-600" : "text-rose-600"
                        }
                      >
                        {row.pnl >= 0 ? "+" : ""}
                        {formatCurrency(row.pnl, currency)} toward target (
                        {targetShare >= 0 ? "+" : ""}
                        {targetShare.toFixed(1)}%)
                      </p>
                      {/* stop-loss risk vs the remaining daily-loss budget */}
                      {slRisk === null ? (
                        <StatusBadge tone="warning">
                          No stop loss — unbounded DD risk
                        </StatusBadge>
                      ) : (
                        <p
                          className={
                            (slShare ?? 0) >= 50
                              ? "font-medium text-amber-600"
                              : "text-muted-foreground"
                          }
                          title="Loss if the stop-loss fills, as a share of your remaining daily-loss budget"
                        >
                          SL risk {formatCurrency(slRisk, currency)} ={" "}
                          {slShare}% of daily budget
                          {(slShare ?? 0) >= 50 ? " — heavy" : ""}
                        </p>
                      )}
                    </div>
                  );
                },
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

        {/* finding #5 — quick access to the full program rules */}
        {rulesOpen ? (
          <ChallengeRulesDialog
            account={activeAccount}
            open={rulesOpen}
            onOpenChange={setRulesOpen}
          />
        ) : null}
      </PageContent>
    </Page>
  );
}
