"use client";

/**
 * Account Detail — converted from stitch_screens/account_detail
 * Account header with phase/status, KPIs, objective progress and open positions.
 */

import Link from "next/link";
import {
  TerraAreaChart,
  TerraBadge,
  TerraBarChart,
  TerraCard,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import {
  challengeTimeline,
  dailyPnl14d,
  equityCurve30d,
  primaryAccount,
  terraObjectives,
  terraPositions,
} from "@/lib/fixtures/terra-fixtures";

export function AccountDetailPage() {
  const acc = primaryAccount;
  const accountPositions = terraPositions.filter((p) => p.accountId === acc.id);
  const tl = challengeTimeline;
  const daysRemaining = Math.max(0, tl.maxCalendarDays - tl.elapsedDays);
  const timeUsedPct = Math.round((tl.elapsedDays / tl.maxCalendarDays) * 100);
  const deadline = new Date(tl.startedAt);
  deadline.setDate(deadline.getDate() + tl.maxCalendarDays);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Account #${acc.login}`}
        description={`${acc.name} • Server ${acc.server} • ${acc.platform}`}
        actions={
          <>
            <TerraBadge tone="secondary">{acc.phase}</TerraBadge>
            <TerraBadge tone="primary" dot pulse>
              ACTIVE
            </TerraBadge>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Balance" value={formatMoney(acc.balance)} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Equity" value={formatMoney(acc.equity)} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Net P&L"
            value={formatSignedMoney(acc.pnl)}
            sub={`+${acc.pnlPercent.toFixed(2)}%`}
            tone="positive"
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Open Positions" value={accountPositions.length} />
        </TerraCard>
      </div>

      {/* Evaluation timeline (M12: trading days counter + time remaining) */}
      <TerraCard>
        <TerraSectionTitle
          title="Evaluation timeline"
          description="Phase 1 calendar clock and trading-day requirement."
          actions={
            <TerraBadge tone={daysRemaining <= 5 ? "error" : "primary"} dot={daysRemaining <= 5}>
              {daysRemaining} days remaining
            </TerraBadge>
          }
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <TerraStat
            label="Trading Days"
            value={`${tl.tradingDays}`}
            sub={`minimum ${tl.minTradingDays} — met ✓`}
            tone="positive"
          />
          <TerraStat
            label="Time Remaining"
            value={`${daysRemaining} days`}
            sub={`of ${tl.maxCalendarDays}-day limit`}
          />
          <TerraStat
            label="Calendar Day"
            value={`${tl.elapsedDays} of ${tl.maxCalendarDays}`}
            sub={`${timeUsedPct}% elapsed`}
          />
          <TerraStat
            label="Consistency"
            value={`${tl.bestDayPct}% of profit`}
            sub={`cap ${tl.consistencyCap}% — on track`}
            tone="positive"
          />
        </div>
        <div className="mt-4">
          <TerraProgress value={timeUsedPct} height="h-2" />
          <div className="mt-1.5 flex justify-between text-[11px] text-on-surface-variant">
            <span>Started {new Date(tl.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            <span>
              Deadline{" "}
              {deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </div>
      </TerraCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Objectives progress + charts */}
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle
              title="Objectives Progress"
              description="Evaluation objectives for this account."
              actions={
                <Link
                  href="/objectives"
                  className="text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
                >
                  View all →
                </Link>
              }
            />
            <div className="space-y-4">
              {terraObjectives.slice(0, 4).map((obj) => {
                const pct =
                  obj.status === "complete"
                    ? 100
                    : obj.target > 0
                      ? Math.min(100, (obj.current / obj.target) * 100)
                      : 0;
                return (
                  <div key={obj.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-on-surface">{obj.name}</span>
                      <span className="tabular-nums text-on-surface-variant">
                        {obj.status === "complete" ? (
                          <TerraBadge tone="success">Complete</TerraBadge>
                        ) : (
                          `${obj.current.toLocaleString()} / ${obj.target.toLocaleString()} ${obj.unit}`
                        )}
                      </span>
                    </div>
                    <TerraProgress
                      value={pct}
                      barClassName={obj.status === "complete" ? "bg-primary" : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </TerraCard>

          {/* Equity curve (M12) */}
          <TerraCard>
            <TerraSectionTitle
              title="Equity Curve · 30 days"
              description="Daily equity snapshots for this challenge."
            />
            <TerraAreaChart
              data={equityCurve30d}
              formatValue={(v) => formatMoney(Math.round(v))}
            />
          </TerraCard>

          {/* Daily P&L bar chart (M12) */}
          <TerraCard>
            <TerraSectionTitle
              title="Daily P&L"
              description="Realized profit and loss per trading day."
              actions={
                <TerraBadge tone="primary">
                  {dailyPnl14d.filter((d) => d.y > 0).length} green /{" "}
                  {dailyPnl14d.filter((d) => d.y < 0).length} red
                </TerraBadge>
              }
            />
            <TerraBarChart
              data={dailyPnl14d}
              formatValue={(v) => formatSignedMoney(Math.round(v))}
            />
          </TerraCard>
        </div>

        {/* Risk side panel */}
        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Risk Limits" />
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-surface-container px-3 py-2.5">
                <span className="text-on-surface-variant">Daily loss remaining</span>
                <strong className="text-on-surface">{formatMoney(acc.dailyLossRemaining)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-container px-3 py-2.5">
                <span className="text-on-surface-variant">Max DD remaining</span>
                <strong className="text-on-surface">{formatMoney(acc.maxDdRemaining)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-container px-3 py-2.5">
                <span className="text-on-surface-variant">Profit target</span>
                <strong className="text-primary">
                  {formatMoney(acc.pnl)} / {formatMoney(acc.profitTarget)}
                </strong>
              </div>
            </div>
          </TerraCard>
          <TerraCard>
            <TerraSectionTitle title="Account Meta" />
            <div className="space-y-2 text-xs text-on-surface-variant">
              <div className="flex justify-between">
                <span>Login</span>
                <strong className="font-mono text-on-surface">#{acc.login}</strong>
              </div>
              <div className="flex justify-between">
                <span>Platform</span>
                <strong className="text-on-surface">{acc.platform}</strong>
              </div>
              <div className="flex justify-between">
                <span>Server</span>
                <strong className="font-mono text-on-surface">{acc.server}</strong>
              </div>
              <div className="flex justify-between">
                <span>Program</span>
                <strong className="text-on-surface">{acc.program}</strong>
              </div>
            </div>
          </TerraCard>
        </div>
      </div>

      {/* Open positions table */}
      <TerraCard>
        <TerraSectionTitle
          title="Open Positions"
          description={`${accountPositions.length} positions on this account`}
          actions={
            <Link
              href="/trading-positions"
              className="text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
            >
              Manage →
            </Link>
          }
        />
        <TerraTable
          head={["Symbol", "Side", "Lots", "Entry", "Current", "P&L"]}
          rows={accountPositions.map((p) => [
            <span key="s" className="font-semibold">{p.symbol}</span>,
            <TerraBadge key="sd" tone={p.side === "long" ? "primary" : "error"}>
              {p.side === "long" ? "Long" : "Short"}
            </TerraBadge>,
            p.lots.toFixed(2),
            p.entry,
            p.current,
            <span
              key="p"
              className={`font-bold tabular-nums ${p.pnl >= 0 ? "text-primary" : "text-error"}`}
            >
              {formatSignedMoney(p.pnl)}
            </span>,
          ])}
        />
      </TerraCard>
    </div>
  );
}
