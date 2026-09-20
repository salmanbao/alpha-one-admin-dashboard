"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTraders, getTenantAccounts, getTenantPositions } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { Users, CreditCard, Activity, DollarSign, TrendingUp } from "lucide-react";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { Sparkline } from "@/components/platform/charts";

export function TradingOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid);
  const accounts = getTenantAccounts(tid);
  const positions = getTenantPositions(tid);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const totalEquity = accounts.reduce((s, a) => s + a.equity, 0);
  const openPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const activeTraders = traders.filter((t) => t.status === "active").length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard label="Active Traders" value={formatCompact(activeTraders)} delta={12} deltaLabel="vs last week" icon={Users} tone="positive" />
      <MetricCard label="Total Balance" value={formatCurrency(totalBalance, runtime.tenant?.currency)} delta={4} icon={CreditCard} tone="positive" />
      <MetricCard label="Total Equity" value={formatCurrency(totalEquity, runtime.tenant?.currency)} delta={2} icon={DollarSign} tone="positive" />
      <MetricCard label="Open P&L" value={formatCurrency(openPnl, runtime.tenant?.currency)} delta={openPnl >= 0 ? 8 : -3} icon={Activity} tone={openPnl >= 0 ? "positive" : "negative"} />
      <MetricCard label="Open Positions" value={formatCompact(positions.length)} delta={5} icon={TrendingUp} />
    </div>
  );
}

export function AccountBalanceWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accounts = getTenantAccounts(tid);
  // buckets
  const buckets = [
    { label: "$5k", value: accounts.filter((a) => a.balance < 10000).length },
    { label: "$25k", value: accounts.filter((a) => a.balance >= 10000 && a.balance < 50000).length },
    { label: "$50k", value: accounts.filter((a) => a.balance >= 50000 && a.balance < 100000).length },
    { label: "$100k+", value: accounts.filter((a) => a.balance >= 100000).length },
  ];
  const max = Math.max(1, ...buckets.map((b) => b.value));
  return (
    <div className="space-y-2">
      {buckets.map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="w-12 text-xs text-muted-foreground">{b.label}</span>
          <div className="h-6 flex-1 rounded bg-muted">
            <div
              className="h-full rounded transition-all"
              style={{ width: `${(b.value / max) * 100}%`, background: "var(--brand-primary)" }}
            />
          </div>
          <span className="w-8 text-right text-xs font-medium">{b.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TraderPerformanceWidget() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid).slice(0, 6);
  const sorted = [...traders].sort((a, b) => b.totalPnl - a.totalPnl);
  return (
    <div className="space-y-2">
      {sorted.map((t, i) => (
        <button
          key={t.id}
          onClick={() => navigate("trader-detail", { id: t.id })}
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
              {t.totalPnl >= 0 ? "+" : ""}{formatCurrency(t.totalPnl, runtime.tenant?.currency)}
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
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
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
            <tr key={p.id} className="border-b last:border-0">
              <td className="py-2 font-medium text-foreground">{p.symbol}</td>
              <td>
                <span className={`text-xs font-medium ${p.side === "buy" ? "text-emerald-600" : "text-rose-600"}`}>
                  {p.side.toUpperCase()}
                </span>
              </td>
              <td className="text-xs">{p.volume}</td>
              <td className="text-xs">{p.entryPrice}</td>
              <td className="text-xs">{p.currentPrice}</td>
              <td className={`text-right text-xs font-semibold ${p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {p.pnl >= 0 ? "+" : ""}{formatCurrency(p.pnl, runtime.tenant?.currency)}
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
  const traders = getTenantTraders(tid).slice(0, 8);
  return (
    <ol className="relative space-y-3 border-l pl-4">
      {traders.map((t, i) => {
        const verbs = ["opened a position", "closed a trade", "deposited funds", "withdrew profit", "hit profit target"];
        return (
          <li key={t.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full border-2 border-background" style={{ background: "var(--brand-primary)" }} />
            <p className="text-sm text-foreground">
              <span className="font-medium">{t.name}</span> <span className="text-muted-foreground">{verbs[i % verbs.length]}</span>
            </p>
            <p className="text-[10px] text-muted-foreground">{i + 1}h ago</p>
          </li>
        );
      })}
    </ol>
  );
}
