"use client";

/**
 * Performance Analytics — converted from stitch_screens/performance_analytics
 * Win rate, expectancy, equity curve and symbol breakdown.
 *
 * + Detailed analytics (audit #8): computed avg holding period, profit
 *   factor + win rate per symbol, consistency analysis (best-day share,
 *   green days), a P&L distribution histogram and a weekday heatmap —
 *   all derived deterministically from the trade fixtures.
 */

import { useState } from "react";
import { cn } from "@pfaas/ui";
import {
  formatCompactCurrencyValue,
  formatProfitFactor,
} from "@pfaas/platform-core";
import {
  TerraAreaChart,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { equityCurveFor, terraAccounts, terraTrades } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { toast } from "@/hooks/use-toast";
import { useRovingTabs } from "@/lib/a11y/roving-tabs";

const tabs = ["Overview", "Symbols", "Sessions"] as const;

export function PerformanceAnalyticsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  // Roving tabindex + arrow keys (audit W #1) — same ARIA tabs pattern
  // as account detail and open positions.
  const roving = useRovingTabs(tabs, tab, setTab, "performance-analytics");

  // Account scope — follows the header switcher; "All accounts" shows the
  // cross-account view (matches the previous behavior).
  const { activeAccount, activeAccountId } = useActiveAccount();
  const [scopeAll, setScopeAll] = useState(false);
  const pool = scopeAll
    ? terraTrades
    : terraTrades.filter((t) => t.accountId === activeAccountId);

  // Equity curve follows the same scope as the KPI cards — the active
  // account's own curve, or the combined equity of every account.
  const curve = scopeAll
    ? terraAccounts.reduce<{ x: string; y: number }[]>((accs, a) => {
        equityCurveFor(a.id, 30).forEach((p, i) => {
          accs[i] ??= { x: p.x, y: 0 };
          accs[i].y += p.y;
        });
        return accs;
      }, [])
    : equityCurveFor(activeAccountId, 30);

  const winTrades = pool.filter((t) => t.pnl > 0);
  const lossTrades = pool.filter((t) => t.pnl < 0);
  const wins = winTrades.length;
  const winRate = pool.length ? Math.round((wins / pool.length) * 100) : 0;
  const avgWin = winTrades.length
    ? winTrades.reduce((s, t) => s + t.pnl, 0) / winTrades.length
    : 0;
  const avgLoss = lossTrades.length
    ? lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length
    : 0;
  const expectancy =
    (winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss;
  // Profit factor — kept numeric here (for coaching thresholds) and
  // formatted only for display (line 88).
  const grossWin = winTrades.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0));
  const profitFactorNum = grossLoss > 0 ? grossWin / grossLoss : 0;
  const profitFactorFormatted = formatProfitFactor(grossWin, grossLoss);

  const bySymbol = pool.reduce<Record<string, { pnl: number; count: number; grossWin: number; grossLoss: number }>>(
    (acc, t) => {
      acc[t.symbol] ??= { pnl: 0, count: 0, grossWin: 0, grossLoss: 0 };
      acc[t.symbol].pnl += t.pnl;
      acc[t.symbol].count += 1;
      if (t.pnl > 0) acc[t.symbol].grossWin += t.pnl;
      else if (t.pnl < 0) acc[t.symbol].grossLoss += -t.pnl;
      return acc;
    },
    {},
  );

  // Average holding period — computed from open/close timestamps (audit:
  // detailed trade analytics; was a hardcoded demo value).
  const avgHoldMs = pool.length
    ? pool.reduce((s, t) => s + (new Date(t.closedAt).getTime() - new Date(t.openedAt).getTime()), 0) /
      pool.length
    : 0;
  const fmtHold = (ms: number) => {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.round((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Consistency — best trading day's share of net profit + how many days
  // were green (the metric the challenge consistency rule measures).
  const byDay = pool.reduce<Record<string, number>>((acc, t) => {
    const d = t.closedAt.slice(0, 10);
    acc[d] = (acc[d] ?? 0) + t.pnl;
    return acc;
  }, {});
  const dayValues = Object.values(byDay);
  const totalNet = dayValues.reduce((s, v) => s + v, 0);
  const bestDay = dayValues.length ? Math.max(...dayValues) : 0;
  const bestDayShare = totalNet > 0 ? Math.round((bestDay / totalNet) * 100) : null;
  const profitableDays = dayValues.filter((v) => v > 0).length;

  // P&L distribution — 6 deterministic buckets over the trade range.
  const pnlValues = pool.map((t) => t.pnl);
  const minPnl = pnlValues.length ? Math.min(...pnlValues) : 0;
  const maxPnl = pnlValues.length ? Math.max(...pnlValues) : 0;
  const bucketCount = 6;
  const span = (maxPnl - minPnl) / bucketCount || 1;
  const distribution = Array.from({ length: bucketCount }, (_, i) => {
    const lo = minPnl + i * span;
    const hi = lo + span;
    const count = pool.filter((t) =>
      i === bucketCount - 1 ? t.pnl >= lo && t.pnl <= hi : t.pnl >= lo && t.pnl < hi,
    ).length;
    return { lo, hi, count };
  });
  const maxBucketCount = Math.max(1, ...distribution.map((d) => d.count));

  // Weekday heatmap — net P&L per weekday (Mon–Sun), color intensity
  // scaled to the largest day so patterns pop without a chart library.
  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const byWeekday = Array.from({ length: 7 }, () => ({ pnl: 0, count: 0 }));
  for (const t of pool) {
    const wd = (new Date(t.closedAt).getDay() + 6) % 7; // Mon = 0
    byWeekday[wd].pnl += t.pnl;
    byWeekday[wd].count += 1;
  }
  const maxAbsDay = Math.max(1, ...byWeekday.map((d) => Math.abs(d.pnl)));

  const handleExportReport = () => {
    toast({
      title: "Performance report (PDF) — export started",
      description: `Win rate ${winRate}% • Net P&L ${formatSignedMoney(pool.reduce((s, t) => s + t.pnl, 0))} • Expectancy ${formatSignedMoney(Math.round(expectancy * 10) / 10)}/trade. Branded cover with equity curve and breakdowns — you'll also receive it by email. (Demo — no backend call.)`,
    });
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Performance Analytics"
        description={
          scopeAll
            ? "Last 30 days across all accounts"
            : `Last 30 days • #${activeAccount.login} ${activeAccount.name}`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope toggle — active account (follows switcher) vs all accounts */}
            <div className="flex items-center rounded-xl bg-surface-container-low p-0.5" role="group" aria-label="Analytics scope">
              <button
                type="button"
                aria-pressed={!scopeAll}
                onClick={() => setScopeAll(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${!scopeAll ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                This account
              </button>
              <button
                type="button"
                aria-pressed={scopeAll}
                onClick={() => setScopeAll(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${scopeAll ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
              >
                All accounts
              </button>
            </div>
            <button
              type="button"
              onClick={handleExportReport}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm hover:bg-primary/90"
            >
              Export report (PDF)
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Win Rate" value={`${winRate}%`} sub={`${wins}/${pool.length} trades`} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Net P&L" value={formatSignedMoney(pool.reduce((s, t) => s + t.pnl, 0))} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Profit Factor" value={profitFactorNum} sub="gross win / loss" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Avg Hold" value={fmtHold(avgHoldMs)} sub="per trade" />
        </TerraCard>
      </div>

      {/* Avg win/loss analytics (M12) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat
            label="Avg Win"
            value={formatSignedMoney(avgWin)}
            sub={`${winTrades.length} winners`}
            tone="positive"
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Avg Loss"
            value={formatSignedMoney(avgLoss)}
            sub={`${lossTrades.length} losers`}
            tone="negative"
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Expectancy"
            value={formatSignedMoney(Math.round(expectancy * 10) / 10)}
            sub="per trade"
            tone={expectancy >= 0 ? "positive" : "negative"}
          />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat
            label="Largest Loss"
            value={formatSignedMoney(Math.min(...pool.map((t) => t.pnl)))}
            sub="single trade"
            tone="negative"
          />
        </TerraCard>
      </div>

      <TerraCard>
        <TerraSectionTitle
          title="Equity curve"
          description={
            scopeAll
              ? "Combined equity across all your accounts (30 days)"
              : `Growth of #${activeAccount.login} balance (30 days)`
          }
        />
        <TerraAreaChart data={curve} formatValue={(v) => formatCompactCurrencyValue(v)} />
      </TerraCard>

      {/* Consistency + distribution + heatmap (audit: detailed analytics) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TerraCard className="p-5">
          <TerraSectionTitle
            title="Consistency"
            description="How evenly results are spread across days."
          />
          <div className="space-y-1 pt-2">
            <TerraStat
              label="Best day share"
              value={bestDayShare === null ? "—" : `${bestDayShare}%`}
              sub={bestDayShare === null ? "no net profit yet" : "of net profit"}
              tone={bestDayShare !== null && bestDayShare <= 50 ? "positive" : "negative"}
            />
            <TerraStat
              label="Green days"
              value={`${profitableDays}/${dayValues.length}`}
              sub="profitable trading days"
            />
            {bestDayShare !== null && bestDayShare > 50 && (
              <p className="text-xs text-on-surface-variant">
                ⚠ One day carries most of your profit — spread risk across
                more days to reduce consistency-rule risk.
              </p>
            )}
          </div>
        </TerraCard>

        <TerraCard className="p-5 lg:col-span-2">
          <TerraSectionTitle
            title="Trade distribution"
            description="How your trade results cluster across P&L buckets."
          />
          <div className="flex h-32 items-end gap-1.5 pt-4" role="img" aria-label="Histogram of trade results across six P&L buckets">
            {distribution.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums text-on-surface-variant">
                  {d.count}
                </span>
                <div
                  className={`w-full rounded-t ${d.lo >= 0 ? "bg-primary" : "bg-error"}`}
                  style={{ height: `${Math.max(4, (d.count / maxBucketCount) * 100)}%` }}
                />
                <span className="text-[9px] tabular-nums text-on-surface-variant">
                  {d.lo >= 0 ? "+" : ""}
                  {Math.round(d.lo)}
                </span>
              </div>
            ))}
          </div>
          <p className="pt-2 text-[11px] text-on-surface-variant">
            {pool.length} trades across {distribution.length} buckets • red
            buckets are net-loss ranges, green are net-profit
          </p>
        </TerraCard>
      </div>

      <TerraCard>
        <TerraSectionTitle
          title="Performance by weekday"
          description="Net P&L per weekday — spot which days actually pay off."
        />
        <div className="grid grid-cols-4 gap-2 pt-2 sm:grid-cols-7">
          {byWeekday.map((d, i) => {
            const alpha = (0.08 + 0.55 * (Math.abs(d.pnl) / maxAbsDay)).toFixed(2);
            return (
              <div
                key={WEEKDAYS[i]}
                className={`rounded-xl p-3 text-center ${d.count === 0 ? "bg-surface-container-low" : ""}`}
                style={
                  d.count === 0
                    ? undefined
                    : {
                        backgroundColor:
                          d.pnl >= 0
                            ? `rgba(16, 185, 129, ${alpha})`
                            : `rgba(244, 63, 94, ${alpha})`,
                      }
                }
                title={`${WEEKDAYS[i]}: ${formatSignedMoney(d.pnl)} across ${d.count} trades`}
              >
                <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {WEEKDAYS[i]}
                </p>
                <p
                  className={`font-headline text-sm font-bold tabular-nums ${
                    d.pnl >= 0 ? "text-primary" : "text-error"
                  }`}
                >
                  {d.count === 0 ? "—" : formatSignedMoney(d.pnl)}
                </p>
                <p className="text-[10px] text-on-surface-variant">
                  {d.count} trade{d.count === 1 ? "" : "s"}
                </p>
              </div>
            );
          })}
        </div>
      </TerraCard>

      <div
        className="flex items-center gap-1.5"
        role="tablist"
        aria-label="Performance analytics sections"
        onKeyDown={roving.onKeyDown}
      >
        {tabs.map((t) => (
          <button
            {...roving.tabProps(t)}
            key={t}
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

      {tab === "Overview" && (
        <div {...roving.panelProps("Overview")}>
        <TerraCard>
          <TerraSectionTitle title="Trade breakdown" />
          <TerraTable
            head={["Ticket", "Symbol", "Pips", "P&L"]}
            rows={pool.map((t) => [
              <span key="t" className="font-mono text-xs font-bold">{t.ticket}</span>,
              <span key="s" className="font-semibold">{t.symbol}</span>,
              <span key="p" className={t.pips >= 0 ? "text-primary" : "text-error"}>
                {t.pips >= 0 ? "+" : ""}{t.pips}
              </span>,
              <span key="pl" className={`font-bold tabular-nums ${t.pnl >= 0 ? "text-primary" : "text-error"}`}>
                {formatSignedMoney(t.pnl)}
              </span>,
            ])}
          />
        </TerraCard>

        {/* Coaching insights (audit X #4) — deterministic recommendations
            derived from the trade pool (win rate, best-day share,
            profit factor, avg hold, consistency). */}
        <TerraCard>
          <TerraSectionTitle title="Performance coaching" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ...(winRate >= 55
                ? [
                    {
                      icon: "Target",
                      label: "Win rate strength",
                      body: `Your ${winRate}% win rate is above the 50% baseline — maintain your entry criteria rather than widening them, and protect the edge with tighter stops.`,
                    },
                  ]
                : winRate < 40
                  ? [
                      {
                        icon: "Target",
                        label: "Win rate gap",
                        body: `At ${winRate}% your win rate is below 50%. Review recent losing trades (filter by symbol / session) for repeated setup errors before scaling size.`,
                      },
                    ]
                  : []),
              ...(bestDayShare !== null && bestDayShare > 40
                ? [
                    {
                      icon: "TrendingUp",
                      label: "Concentration risk",
                      body: `Your best day contributed ${bestDayShare}% of total net — a high share. Diversify session exposure (style / symbol mix) so one good day isn't carrying all performance.`,
                    },
                  ]
                : bestDayShare !== null && bestDayShare < 15
                  ? [
                      {
                        icon: "TrendingUp",
                        label: "Consistent day-to-day",
                        body: `Your best day contributed only ${bestDayShare}% of total — consistent across sessions. Build on this with a structured weekly review to lock the rhythm.`,
                      },
                    ]
                  : []),
              ...(profitFactorNum >= 1.8
                ? [
                    {
                      icon: "Scale",
                      label: "Strong reward / risk",
                      body: `Profit factor ${profitFactorFormatted} (grossWin / grossLoss) shows healthy reward-to-risk. Keep the risk profile fixed as you grow — don't inflate position size to chase targets.`,
                    },
                  ]
                : profitFactorNum < 1.2
                  ? [
                      {
                        icon: "Scale",
                        label: "Profit factor low",
                        body: `Profit factor ${profitFactorFormatted} is under 1.2. Focus on reducing average loss (tighter exits / faster invalidation) rather than increasing win rate alone.`,
                      },
                    ]
                  : [
                      {
                        icon: "Scale",
                        label: "Balanced reward / risk",
                        body: `Profit factor ${profitFactorFormatted} is healthy. Maintain the current exit / risk ratio and grow through more qualified setups.`,
                      },
                    ]),
              ...(profitFactorNum >= 1.2 && avgHoldMs > 4 * 3_600_000
                ? [
                    {
                      icon: "Clock",
                      label: "Hold period long",
                      body: `Average hold ~${fmtHold(avgHoldMs)} — long holds can amplify overnight / gap risk. Confirm each trade's time-based exit plan before holding past session windows.`,
                    },
                  ]
                : avgHoldMs < 30 * 60_000
                  ? [
                      {
                        icon: "Clock",
                        label: "Hold period short",
                        body: `Average hold ~${fmtHold(avgHoldMs)} — very short holds need precise execution. Verify slippage / fill quality at your working timeframes.`,
                      },
                    ]
                  : []),
            ].filter(Boolean).map((item, i) => (
              <div key={i} className="rounded-xl bg-surface-container-low p-3 border">
                <p className="font-bold text-sm">{item.label}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">{item.body}</p>
              </div>
            ))}
            {(
              winRate >= 40 &&
              winRate < 55 &&
              (!bestDayShare || (bestDayShare >= 15 && bestDayShare <= 40)) &&
              profitFactorNum >= 1.2 &&
              profitFactorNum < 1.8 &&
              !(profitFactorNum >= 1.2 && avgHoldMs > 4 * 3_600_000) &&
              !(avgHoldMs < 30 * 60_000)
            ) && (
              <div className="rounded-xl bg-surface-container-low p-3 border">
                <p className="font-bold text-sm">Balanced profile</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  No strong signals detected — keep the journal up to date
                  and revisit after your next 10–15 closed trades.
                </p>
              </div>
            )}
          </div>
        </TerraCard>

        {/* Strategy & backtest links (audit X #7) — partial coverage only. */}
        <TerraCard>
          <TerraSectionTitle title="Strategy development (partial)" />
          <div className="flex flex-wrap gap-2">
            <a href="/trading-plan-builder" className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Plan Builder</a>
            <a href="/trade-replay" className="inline-flex items-center gap-2 rounded-lg bg-secondary-container px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Trade Replay</a>
            <a href="/learning-center" className="inline-flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Learning Center</a>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Plan Builder (structured rules · sessions · risk), Trade Replay (re-run individual setups) and the Learning Center (educational content) cover part of the strategy-development surface. A full backtesting / pattern-recognition tool is not yet available.
          </p>
        </TerraCard>
        </div>
      )}

      {tab === "Symbols" && (
        <div {...roving.panelProps("Symbols")}>
        <TerraCard>
          <TerraSectionTitle title="By symbol" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(bySymbol).map(([sym, v]) => (
              <div key={sym} className="rounded-xl bg-surface-container-low p-4">
                <p className="font-headline font-bold text-on-surface">{sym}</p>
                <p className={`font-headline text-lg font-bold tabular-nums ${v.pnl >= 0 ? "text-primary" : "text-error"}`}>
                  {formatSignedMoney(v.pnl)}
                </p>
                <p className="text-xs text-on-surface-variant">{v.count} trades</p>
                <p className="text-xs text-on-surface-variant">
                  PF <span className="font-bold text-on-surface">{formatProfitFactor(v.grossWin, v.grossLoss)}</span>
                  {" • "}
                  {v.count ? Math.round((pool.filter((t) => t.symbol === sym && t.pnl > 0).length / v.count) * 100) : 0}% win
                </p>
              </div>
            ))}
          </div>
        </TerraCard>
        </div>
      )}

      {tab === "Sessions" && (
        <div {...roving.panelProps("Sessions")}>
        <TerraCard>
          <TerraSectionTitle title="By session" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { name: "London", pnl: 640, count: 8 },
              { name: "New York", pnl: 166, count: 5 },
              { name: "Asia", pnl: -40, count: 2 },
            ].map((s) => (
              <div key={s.name} className="rounded-xl bg-surface-container-low p-4">
                <p className="font-headline font-bold text-on-surface">{s.name}</p>
                <p className={`font-headline text-lg font-bold tabular-nums ${s.pnl >= 0 ? "text-primary" : "text-error"}`}>
                  {formatSignedMoney(s.pnl)}
                </p>
                <p className="text-xs text-on-surface-variant">{s.count} trades</p>
              </div>
            ))}
          </div>
        </TerraCard>
        </div>
      )}
    </div>
  );
}
