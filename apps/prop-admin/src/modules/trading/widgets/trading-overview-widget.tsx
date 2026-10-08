"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantPositions,
  getTenantAudit,
} from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { Users, CreditCard, Activity, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { Sparkline } from "@/components/platform/charts";

const JPY_LIKE = (sym: string) => /JPY/.test(sym);

function pricePrecision(symbol: string): number {
  // JPY-quoted pairs traditionally quote at 2-3 decimals; most FX at 4-5;
  // crypto at variable. Default to 2; JPY at 2; majors at 4.
  if (JPY_LIKE(symbol)) return 2;
  if (/^(XAU|XAG)/.test(symbol)) return 2;
  if (/^(BTC|ETH)/.test(symbol)) return 2;
  return 4;
}

function fmtPrice(v: number, symbol: string): string {
  return v.toLocaleString("en-US", {
    minimumFractionDigits: pricePrecision(symbol),
    maximumFractionDigits: pricePrecision(symbol),
  });
}

export function TradingOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const traders = getTenantTraders(tid);
  const accounts = getTenantAccounts(tid);
  const positions = getTenantPositions(tid);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalEquity = accounts.reduce((s, a) => s + a.equity, 0);
  const openPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const activeTraders = traders.filter((t) => t.status === "active").length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard label="Active Traders" value={formatCompact(activeTraders)} icon={Users} tone="positive" />
      <MetricCard label="Total Balance" value={formatCurrency(totalBalance, currency)} icon={CreditCard} tone="positive" />
      <MetricCard label="Total Equity" value={formatCurrency(totalEquity, currency)} icon={DollarSign} tone="positive" />
      <MetricCard
        label="Open P&L"
        value={formatCurrency(openPnl, currency)}
        icon={Activity}
        tone={openPnl >= 0 ? "positive" : "negative"}
      />
      <MetricCard label="Open Positions" value={formatCompact(positions.length)} icon={TrendingUp} />
    </div>
  );
}

export function AccountBalanceWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const accounts = getTenantAccounts(tid);
  // Currency-aware bucket thresholds — labels format through
  // formatCurrency so EUR/AED tenants see their own symbol, not "$".
  // Thresholds scale with the major unit (10000 / 50000 / 100000 in
  // account-currency units).
  const thresholds = [10000, 50000, 100000];
  const buckets = [
    { label: formatCurrency(thresholds[0] / 2, currency), value: accounts.filter((a) => a.balance < thresholds[0]).length },
    { label: formatCurrency((thresholds[0] + thresholds[1]) / 2, currency), value: accounts.filter((a) => a.balance >= thresholds[0] && a.balance < thresholds[1]).length },
    { label: formatCurrency((thresholds[1] + thresholds[2]) / 2, currency), value: accounts.filter((a) => a.balance >= thresholds[1] && a.balance < thresholds[2]).length },
    { label: `${formatCurrency(thresholds[2], currency)}+`, value: accounts.filter((a) => a.balance >= thresholds[2]).length },
  ];
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div className="space-y-2">
      {buckets.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="w-16 text-xs text-muted-foreground tabular-nums">{b.label}</span>
          <div className="h-6 flex-1 rounded bg-muted">
            <div
              className="h-full rounded transition-all"
              style={{ width: `${(b.value / max) * 100}%`, background: "var(--brand-primary)" }}
              role="progressbar"
              aria-valuenow={b.value}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-label={`${b.label} bucket: ${b.value} accounts`}
            />
          </div>
          <span className="w-8 text-right text-xs font-medium tabular-nums">{b.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TraderPerformanceWidget() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const traders = getTenantTraders(tid).slice(0, 6);
  const sorted = [...traders].sort((a, b) => b.totalPnl - a.totalPnl);
  return (
    <div className="space-y-2">
      {sorted.map((t, i) => (
        <button
          key={t.id}
          onClick={() => navigate("trader-detail", { id: t.id })}
          aria-label={`View ${t.name}'s trader detail`}
          className="flex w-full items-center gap-3 rounded-md border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
            <p className="text-[10px] text-muted-foreground">{t.trades} trades · {t.winRate}% win rate</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${t.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {t.totalPnl >= 0 ? "+" : ""}{formatCurrency(t.totalPnl, currency)}
            </p>
            <div className="w-16">
              <Sparkline data={Array.from({ length: 12 }, (_, i) => Math.sin(i + t.name.length) * 50 + 100)} color={t.totalPnl >= 0 ? "#16a34a" : "#dc2626"} height={24} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function OpenPositionsWidget() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const positions = getTenantPositions(tid).slice(0, 6);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Symbol</th>
            <th className="font-medium">Side</th>
            <th className="font-medium">Volume</th>
            <th className="font-medium">Entry</th>
            <th className="font-medium">Current</th>
            <th className="text-right font-medium">P&L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr
              key={p.id}
              className="cursor-pointer border-b last:border-0 hover:bg-accent/30"
              onClick={() => navigate("trader-detail", { id: p.traderId })}
            >
              <td className="py-2 font-medium text-foreground">{p.symbol}</td>
              <td>
                <span className={`text-xs font-medium ${p.side === "buy" ? "text-emerald-600" : "text-rose-600"}`}>
                  {p.side.toUpperCase()}
                </span>
              </td>
              <td className="text-xs tabular-nums">{p.volume.toFixed(2)}</td>
              <td className="text-xs tabular-nums">{fmtPrice(p.entryPrice, p.symbol)}</td>
              <td className="text-xs tabular-nums">{fmtPrice(p.currentPrice, p.symbol)}</td>
              <td className={`text-right text-xs font-semibold tabular-nums ${p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {p.pnl >= 0 ? "+" : ""}{formatCurrency(p.pnl, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecentActivityWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  // Pull real per-tenant audit entries (Round 4 fix: previously fabricated
  // "opened a position" / "closed a trade" verbs with "{i+1}h ago" fake
  // timestamps based on iteration index). Now mirrors the activity-ticker
  // pattern Round 1 established for the sidebar feed.
  const events = getTenantAudit(tid).slice(0, 6);
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
        No recent activity. Events will appear here as they occur.
      </div>
    );
  }
  return (
    <ol className="relative space-y-2.5 border-l pl-4">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full border-2 border-background" style={{ background: "var(--brand-primary)" }} />
          <p className="truncate text-sm text-foreground">
            <span className="font-medium">{e.actor}</span>{" "}
            <span className="text-muted-foreground">{e.action}</span>
          </p>
          <p className="text-[10px] text-muted-foreground" title={new Date(e.timestamp).toLocaleString()}>
            {relativeTime(e.timestamp)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
