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
import { equityCurveFor, terraAccounts, terraTrades } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { toast } from "@/hooks/use-toast";

const tabs = ["Overview", "Symbols", "Sessions"] as const;

export function PerformanceAnalyticsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");

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
  const grossWin = winTrades.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "—";

  const bySymbol = pool.reduce<Record<string, { pnl: number; count: number }>>(
    (acc, t) => {
      acc[t.symbol] ??= { pnl: 0, count: 0 };
      acc[t.symbol].pnl += t.pnl;
      acc[t.symbol].count += 1;
      return acc;
    },
    {},
  );

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
          <TerraStat label="Profit Factor" value={profitFactor} sub="gross win / loss" />
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
        <TerraAreaChart data={curve} formatValue={(v) => formatMoneyShort(v)} />
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
