"use client";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAccounts } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AreaSeries } from "@/components/platform/charts";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { TrendingUp, Target, Activity, Award, Percent, Clock } from "lucide-react";
import { hashStr } from "@/lib/platform/mock-data";

export function TraderPerformancePage() {
  const { runtime, user } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const trader = getTraderForUser(user);
  const accounts = trader ? getTraderAccounts(trader.id) : [];

  // Equity curve (deterministic)
  const equityCurve = Array.from({ length: 30 }, (_, i) => ({
    date: `D-${30 - i}`,
    value: Math.round(25000 + Math.sin(i / 3) * 800 + i * 65),
  }));

  // Daily P&L
  const dailyPnl = Array.from({ length: 14 }, (_, i) => ({
    date: `D-${14 - i}`,
    value: Math.round((Math.sin(i * 0.7) * 240 + Math.cos(i * 1.3) * 180)),
  }));

  const totalPnl = equityCurve[equityCurve.length - 1]?.value - 25000 ?? 0;
  const winRate = 62;
  const profitFactor = 1.8;
  const avgWin = 320;
  const avgLoss = -180;
  const totalTrades = 47;
  const tradingDays = 12;

  return (
    <Page>
      <PageHeader title="Performance Analytics" description="Your trading performance — deeper analysis belongs here." icon={TrendingUp} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total P&L" value={formatCurrency(totalPnl, currency)} icon={TrendingUp} tone={totalPnl >= 0 ? "positive" : "negative"} />
          <MetricCard label="Win Rate" value={`${winRate}%`} icon={Target} tone="positive" />
          <MetricCard label="Profit Factor" value={profitFactor.toString()} icon={Percent} tone="positive" />
          <MetricCard label="Total Trades" value={totalTrades} icon={Activity} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Equity curve (30 days)</span></CardHeader>
            <CardContent><AreaSeries data={equityCurve} xKey="date" yKey="value" color="#0f766e" height={200} formatValue={(v) => formatCurrency(v, currency)} /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Daily P&L (14 days)</span></CardHeader>
            <CardContent><AreaSeries data={dailyPnl} xKey="date" yKey="value" color="#b45309" height={200} formatValue={(v) => formatCurrency(v, currency)} /></CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Trade statistics</span></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3 lg:grid-cols-4">
              <div><p className="text-muted-foreground">Avg win</p><p className="font-medium text-emerald-600">+{formatCurrency(avgWin, currency)}</p></div>
              <div><p className="text-muted-foreground">Avg loss</p><p className="font-medium text-rose-600">{formatCurrency(avgLoss, currency)}</p></div>
              <div><p className="text-muted-foreground">Largest win</p><p className="font-medium text-emerald-600">+{formatCurrency(820, currency)}</p></div>
              <div><p className="text-muted-foreground">Largest loss</p><p className="font-medium text-rose-600">{formatCurrency(-340, currency)}</p></div>
              <div><p className="text-muted-foreground">Trading days</p><p className="font-medium">{tradingDays}</p></div>
              <div><p className="text-muted-foreground">Avg duration</p><p className="font-medium">2h 14m</p></div>
              <div><p className="text-muted-foreground">Win streak</p><p className="font-medium text-emerald-600">5</p></div>
              <div><p className="text-muted-foreground">Loss streak</p><p className="font-medium text-rose-600">2</p></div>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
