"use client";

/**
 * Account Detail — converted from stitch_screens/account_detail
 * Account header with phase/status, KPIs, objective progress and open
 * positions, plus PRD §3.7.1 tabs: Charts & Analytics / Trade History /
 * Credentials (per-account export + platform credentials component).
 */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@pfaas/ui";
import {
  TerraAreaChart,
  TerraBadge,
  TerraBarChart,
  TerraCard,
  TerraEmpty,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { AccountCredentials } from "@/components/terra/account-credentials";
import {
  challengeTimeline,
  dailyPnlFor,
  equityCurveFor,
  objectivesFor,
  terraPositions,
  terraTrades,
} from "@/lib/fixtures/terra-fixtures";
import { useSyncActiveAccount } from "@/lib/platform/account-context";
import { toast } from "@/hooks/use-toast";

const detailTabs = ["Charts & Analytics", "Trade History", "Credentials"] as const;

export function AccountDetailPage() {
  const [tab, setTab] = useState<(typeof detailTabs)[number]>("Charts & Analytics");
  // Account scope: ?id= from My Accounts deep links, otherwise the globally
  // active account from the header switcher (URL and switcher stay in sync).
  const params = useSearchParams();
  const acc = useSyncActiveAccount(params.get("id"));
  const accountPositions = terraPositions.filter((p) => p.accountId === acc.id);
  const accountTrades = terraTrades.filter((t) => t.accountId === acc.id);
  // Charts and objectives follow the account in view (never the $100K fixture).
  const objectives = objectivesFor(acc.id).slice(0, 4);
  const equityCurve = equityCurveFor(acc.id, 30);
  const dailyPnl = dailyPnlFor(acc.id);
  const tl = challengeTimeline;
  const daysRemaining = Math.max(0, tl.maxCalendarDays - tl.elapsedDays);
  const timeUsedPct = Math.round((tl.elapsedDays / tl.maxCalendarDays) * 100);
  const deadline = new Date(tl.startedAt);
  deadline.setDate(deadline.getDate() + tl.maxCalendarDays);

  const handleExportCsv = () => {
    const headers = ["Ticket", "Symbol", "Side", "Lots", "Pips", "P&L", "Closed"];
    const rows = accountTrades.map((t) => [
      t.ticket,
      t.symbol,
      t.side,
      t.lots.toFixed(2),
      t.pips,
      t.pnl,
      t.closedAt,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `account-${acc.login}-trades.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export ready",
      description: `Exported ${accountTrades.length} trades for #${acc.login} to CSV.`,
    });
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Account #${acc.login}`}
        description={`${acc.name} • Server ${acc.server} • ${acc.platform}`}
        actions={
          <>
            <TerraBadge tone="secondary">{acc.phase}</TerraBadge>
            <TerraBadge tone={acc.status === "active" ? "primary" : acc.status === "breached" ? "error" : "secondary"} dot pulse={acc.status === "active"}>
              {acc.status.toUpperCase()}
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

      {/* Evaluation timeline (M12: trading days counter + time remaining).
          The detailed clock fixture is anchored to #100030 — other accounts
          get their own account-scoped snapshot so nothing renders stale. */}
      {tl.accountId === acc.id ? (
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
      ) : (
      <TerraCard>
        <TerraSectionTitle
          title="Evaluation timeline"
          description={
            acc.phase === "Funded"
              ? "Funded account — the evaluation clock is complete."
              : `${acc.phase} snapshot for this account.`
          }
          actions={<TerraBadge tone="secondary">{acc.phase}</TerraBadge>}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <TerraStat
            label="Profit Target"
            value={formatMoney(acc.profitTarget)}
            sub={`${acc.targetProgress}% reached`}
            tone={acc.targetProgress >= 100 ? "positive" : undefined}
          />
          <TerraStat
            label="Daily Loss Remaining"
            value={formatMoney(acc.dailyLossRemaining)}
          />
          <TerraStat
            label="Max DD Remaining"
            value={formatMoney(acc.maxDdRemaining)}
          />
          <TerraStat
            label="Account Status"
            value={acc.status === "active" ? "In good standing" : acc.status === "standby" ? "Standby" : acc.status === "breached" ? "Breached" : acc.status}
            sub={`#${acc.login}`}
            tone={acc.status === "active" ? "positive" : acc.status === "breached" ? "negative" : undefined}
          />
        </div>
      </TerraCard>
      )}

      {/* Tabs: Charts & Analytics / Trade History / Credentials (PRD §3.7.1) */}
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Account sections">
        {detailTabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
              tab === t
                ? "bg-primary font-bold text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Charts & Analytics" && (
        <>
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
                  {objectives.map((obj) => {
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
                  description={`Daily equity snapshots for #${acc.login}.`}
                />
                <TerraAreaChart
                  data={equityCurve}
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
                      {dailyPnl.filter((d) => d.y > 0).length} green /{" "}
                      {dailyPnl.filter((d) => d.y < 0).length} red
                    </TerraBadge>
                  }
                />
                <TerraBarChart
                  data={dailyPnl}
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
        </>
      )}

      {tab === "Trade History" && (
        <TerraCard>
          <TerraSectionTitle
            title="Trade History"
            description={`${accountTrades.length} closed trades on #${acc.login}`}
            actions={
              <button
                type="button"
                onClick={handleExportCsv}
                className="rounded-xl bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container"
              >
                Export CSV
              </button>
            }
          />
          {accountTrades.length === 0 ? (
            <TerraEmpty
              title="No closed trades yet"
              description="Closed trades on this account will appear here."
            />
          ) : (
            <>
              <TerraTable
                head={["Ticket", "Symbol", "Side", "Lots", "Pips", "P&L", "Closed"]}
                rows={accountTrades.map((t) => [
                  <Link key="t" href={`/trade-detail?id=${t.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    {t.ticket}
                  </Link>,
                  <span key="s" className="font-semibold">{t.symbol}</span>,
                  <TerraBadge key="sd" tone={t.side === "long" ? "primary" : "error"}>
                    {t.side === "long" ? "Long" : "Short"}
                  </TerraBadge>,
                  t.lots.toFixed(2),
                  <span key="p" className={t.pips >= 0 ? "text-primary" : "text-error"}>
                    {t.pips >= 0 ? "+" : ""}
                    {t.pips}
                  </span>,
                  <span key="pl" className={`font-bold tabular-nums ${t.pnl >= 0 ? "text-primary" : "text-error"}`}>
                    {formatSignedMoney(t.pnl)}
                  </span>,
                  new Date(t.closedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                ])}
              />
              <div className="mt-3 flex justify-end">
                <Link
                  href="/trade-history"
                  className="text-xs font-bold text-primary hover:text-on-primary-fixed-variant"
                >
                  Full trade history (search, sort, paginate) →
                </Link>
              </div>
            </>
          )}
        </TerraCard>
      )}

      {tab === "Credentials" && (
        <TerraCard>
          <TerraSectionTitle
            title="Trading Credentials"
            description={`Platform login details for #${acc.login} — ${acc.platform} · ${acc.server}`}
          />
          <AccountCredentials account={acc} />
        </TerraCard>
      )}
    </div>
  );
}
