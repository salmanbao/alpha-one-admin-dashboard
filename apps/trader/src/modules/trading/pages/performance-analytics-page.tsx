"use client";

/**
 * Performance Analytics — converted from stitch_screens/performance_analytics
 * Win rate, expectancy, equity curve and symbol breakdown.
 */

import { useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraAreaChart,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { equityCurve30d, terraTrades } from "@/lib/fixtures/terra-fixtures";

const tabs = ["Overview", "Symbols", "Sessions"] as const;

export function PerformanceAnalyticsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");

  const winTrades = terraTrades.filter((t) => t.pnl > 0);
  const lossTrades = terraTrades.filter((t) => t.pnl < 0);
  const wins = winTrades.length;
  const winRate = Math.round((wins / terraTrades.length) * 100);
  const avgWin = winTrades.length
    ? winTrades.reduce((s, t) => s + t.pnl, 0) / winTrades.length
    : 0;
  const avgLoss = lossTrades.length
    ? lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length
    : 0;
  const expectancy =
    (winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss;

  const bySymbol = terraTrades.reduce<Record<string, { pnl: number; count: number }>>(
    (acc, t) => {
      acc[t.symbol] ??= { pnl: 0, count: 0 };
      acc[t.symbol].pnl += t.pnl;
      acc[t.symbol].count += 1;
      return acc;
    },
    {},
  );

  const handleExportReport = () => {
    alert(
      "Performance Report (PDF) — export started\n\n" +
        `Win rate: ${winRate}%\n` +
        `Net P&L: ${formatSignedMoney(terraTrades.reduce((s, t) => s + t.pnl, 0))}\n` +
        `Expectancy: ${formatSignedMoney(Math.round(expectancy * 10) / 10)} per trade\n\n` +
        "Branded TerraTrader cover, equity curve, symbol & session breakdown. " +
        "You'll also receive it by email. (Demo — no backend call.)",
    );
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Performance Analytics"
        description="Last 30 days across all accounts"
        actions={
          <button
            type="button"
            onClick={handleExportReport}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm hover:bg-primary/90"
          >
            Export report (PDF)
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Win Rate" value={`${winRate}%`} sub={`${wins}/${terraTrades.length} trades`} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Net P&L" value={formatSignedMoney(terraTrades.reduce((s, t) => s + t.pnl, 0))} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Profit Factor" value="2.3" sub="gross win / loss" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Avg Hold" value="4h 22m" sub="per trade" />
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
            value={formatSignedMoney(Math.min(...terraTrades.map((t) => t.pnl)))}
            sub="single trade"
            tone="negative"
          />
        </TerraCard>
      </div>

      <TerraCard>
        <TerraSectionTitle title="Equity curve" description="Growth of your account balance" />
        <TerraAreaChart data={equityCurve30d} formatValue={(v) => formatMoneyShort(v)} />
      </TerraCard>

      <div className="flex items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
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

      {tab === "Overview" && (
        <TerraCard>
          <TerraSectionTitle title="Trade breakdown" />
          <TerraTable
            head={["Ticket", "Symbol", "Pips", "P&L"]}
            rows={terraTrades.map((t) => [
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
      )}

      {tab === "Symbols" && (
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
              </div>
            ))}
          </div>
        </TerraCard>
      )}

      {tab === "Sessions" && (
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
      )}
    </div>
  );
}

function formatMoneyShort(v: number): string {
  return `$${(v / 1000).toFixed(0)}k`;
}
