"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantTraders, getTenantAccounts, getTenantPositions, type Trader, type TradingAccount, type Position } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, traderStatusTone, formatCurrency, formatCompact } from "@/components/platform/status";
import { Users, CreditCard, Activity, ArrowLeft, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EntityHeader } from "@/components/platform/page";
import { AreaSeries } from "@/components/platform/charts";
import { EntityChangeHistory, ActivityTimeline } from "@/components/platform/audit";
import { getTenantAudit } from "@/lib/platform/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TradingOverviewPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid);
  const accounts = getTenantAccounts(tid);
  const positions = getTenantPositions(tid);
  const currency = runtime.tenant?.currency ?? "USD";
  const totalEquity = accounts.reduce((s, a) => s + a.equity, 0);
  const openPnl = positions.reduce((s, p) => s + p.pnl, 0);

  return (
    <Page>
      <PageHeader
        title="Trading Overview"
        description="Aggregate trading activity across all accounts."
        icon={Activity}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("trading-traders")}>View traders</Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Traders" value={traders.length} delta={8} icon={Users} tone="positive" />
          <MetricCard label="Accounts" value={accounts.length} delta={5} icon={CreditCard} />
          <MetricCard label="Total Equity" value={formatCurrency(totalEquity, currency)} delta={3} icon={Wallet} tone="positive" />
          <MetricCard label="Open P&L" value={formatCurrency(openPnl, currency)} delta={openPnl >= 0 ? 6 : -2} icon={Activity} tone={openPnl >= 0 ? "positive" : "negative"} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Equity curve (30d)</p>
            <AreaSeries data={Array.from({ length: 30 }, (_, i) => ({ date: `D${i + 1}`, value: Math.round(totalEquity * (1 + Math.sin(i / 3) * 0.05)) }))} xKey="date" yKey="value" formatValue={(v) => formatCurrency(v, currency)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Recent activity</p>
            <ActivityTimeline entries={getTenantAudit(tid).slice(0, 6)} />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

export function TradersPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const columns: Column<Trader>[] = [
    {
      key: "name",
      header: "Trader",
      cell: (t) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>
          <div>
            <p className="font-medium text-foreground">{t.name}</p>
            <p className="text-[10px] text-muted-foreground">{t.email}</p>
          </div>
        </div>
      ),
      sortValue: (t) => t.name,
    },
    { key: "country", header: "Country", cell: (t) => <Badge variant="outline" className="text-[10px]">{t.country}</Badge>, sortValue: (t) => t.country },
    {
      key: "status",
      header: "Status",
      cell: (t) => <StatusBadge tone={traderStatusTone(t.status)}>{t.status}</StatusBadge>,
      sortValue: (t) => t.status,
    },
    {
      key: "phase",
      header: "Phase",
      cell: (t) => <Badge variant="outline" className="text-[10px]">{t.challengePhase ?? "none"}</Badge>,
      sortValue: (t) => t.challengePhase ?? "none",
    },
    { key: "trades", header: "Trades", cell: (t) => t.trades, sortValue: (t) => t.trades },
    { key: "winRate", header: "Win %", cell: (t) => `${t.winRate}%`, sortValue: (t) => t.winRate },
    { key: "equity", header: "Equity", cell: (t) => formatCurrency(t.equity, currency), sortValue: (t) => t.equity },
    { key: "pnl", header: "Total P&L", cell: (t) => <span className={t.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{t.totalPnl >= 0 ? "+" : ""}{formatCurrency(t.totalPnl, currency)}</span>, sortValue: (t) => t.totalPnl },
  ];

  return (
    <Page>
      <PageHeader title="Traders" description={`${traders.length} traders in this tenant.`} icon={Users} />
      <PageContent>
        <DataTable
          columns={columns}
          data={traders}
          rowKey={(t) => t.id}
          onRowClick={(t) => navigate("trader-detail", { id: t.id })}
          searchableText={(t) => `${t.name} ${t.email} ${t.country} ${t.status}`}
          searchPlaceholder="Search traders…"
        />
      </PageContent>
    </Page>
  );
}

export function AccountsPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const accounts = getTenantAccounts(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const columns: Column<TradingAccount>[] = [
    { key: "login", header: "Login", cell: (a) => <span className="font-mono text-xs">{a.login}</span>, sortValue: (a) => a.login },
    { key: "trader", header: "Trader", cell: (a) => <span className="font-medium">{a.traderName}</span>, sortValue: (a) => a.traderName },
    { key: "platform", header: "Platform", cell: (a) => <Badge variant="outline" className="text-[10px]">{a.platform}</Badge>, sortValue: (a) => a.platform },
    { key: "type", header: "Type", cell: (a) => <Badge variant="secondary" className="text-[10px]">{a.type}</Badge>, sortValue: (a) => a.type },
    { key: "phase", header: "Phase", cell: (a) => a.phase, sortValue: (a) => a.phase },
    { key: "balance", header: "Balance", cell: (a) => formatCurrency(a.balance, a.currency), sortValue: (a) => a.balance },
    { key: "equity", header: "Equity", cell: (a) => formatCurrency(a.equity, a.currency), sortValue: (a) => a.equity },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge tone={a.status === "active" ? "success" : a.status === "breached" ? "danger" : a.status === "passed" ? "info" : "warning"}>{a.status}</StatusBadge>,
      sortValue: (a) => a.status,
    },
  ];

  return (
    <Page>
      <PageHeader title="Trading Accounts" description="MT5 / MT4 / DXTrade accounts." icon={CreditCard} />
      <PageContent>
        <DataTable
          columns={columns}
          data={accounts}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate("trader-detail", { id: a.traderId })}
          searchableText={(a) => `${a.login} ${a.traderName} ${a.platform} ${a.type}`}
          searchPlaceholder="Search accounts…"
        />
      </PageContent>
    </Page>
  );
}

export function PositionsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const positions = getTenantPositions(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const columns: Column<Position>[] = [
    { key: "symbol", header: "Symbol", cell: (p) => <span className="font-mono font-medium">{p.symbol}</span>, sortValue: (p) => p.symbol },
    { key: "side", header: "Side", cell: (p) => <span className={p.side === "buy" ? "text-emerald-600" : "text-rose-600"}>{p.side.toUpperCase()}</span>, sortValue: (p) => p.side },
    { key: "volume", header: "Volume", cell: (p) => p.volume, sortValue: (p) => p.volume },
    { key: "entry", header: "Entry", cell: (p) => p.entryPrice, sortValue: (p) => p.entryPrice },
    { key: "current", header: "Current", cell: (p) => p.currentPrice, sortValue: (p) => p.currentPrice },
    { key: "pnl", header: "P&L", cell: (p) => <span className={p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{p.pnl >= 0 ? "+" : ""}{formatCurrency(p.pnl, currency)}</span>, sortValue: (p) => p.pnl },
    { key: "pnlPct", header: "P&L %", cell: (p) => <span className={p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{p.pnl >= 0 ? "+" : ""}{p.pnlPct}%</span>, sortValue: (p) => p.pnlPct },
    { key: "opened", header: "Opened", cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.openedAt).toLocaleString()}</span>, sortValue: (p) => p.openedAt },
  ];

  return (
    <Page>
      <PageHeader title="Open Positions" description={`${positions.length} positions currently open.`} icon={Activity} />
      <PageContent>
        <DataTable
          columns={columns}
          data={positions}
          rowKey={(p) => p.id}
          searchableText={(p) => `${p.symbol} ${p.side} ${p.traderId}`}
          searchPlaceholder="Search positions…"
        />
      </PageContent>
    </Page>
  );
}

export function TraderDetailPage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const traderId = router.params.id;
  const trader = getTenantTraders(tid).find((t) => t.id === traderId);
  const currency = runtime.tenant?.currency ?? "USD";
  const accounts = getTenantAccounts(tid).filter((a) => a.traderId === traderId);
  const positions = getTenantPositions(tid).filter((p) => p.traderId === traderId);

  if (!trader) {
    return (
      <Page>
        <Button variant="ghost" size="sm" onClick={() => navigate("trading-traders")}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
        <p className="text-muted-foreground">Trader not found.</p>
      </Page>
    );
  }

  return (
    <Page>
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate("trading-traders")}><ArrowLeft className="mr-1 h-4 w-4" />Back to traders</Button>
      <EntityHeader
        title={trader.name}
        subtitle={`${trader.email} · ${trader.country}`}
        avatar={<Avatar className="h-12 w-12"><AvatarFallback>{trader.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback></Avatar>}
        badges={
          <>
            <StatusBadge tone={traderStatusTone(trader.status)}>{trader.status}</StatusBadge>
            <Badge variant="outline" className="text-[10px]">{trader.challengePhase ?? "none"}</Badge>
          </>
        }
        actions={<Button size="sm" variant="outline">Edit trader</Button>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Equity" value={formatCurrency(trader.equity, currency)} icon={Wallet} />
        <MetricCard label="Total P&L" value={`${trader.totalPnl >= 0 ? "+" : ""}${formatCurrency(trader.totalPnl, currency)}`} tone={trader.totalPnl >= 0 ? "positive" : "negative"} />
        <MetricCard label="Win rate" value={`${trader.winRate}%`} />
        <MetricCard label="Trades" value={trader.trades} />
      </div>
      <Tabs defaultValue="accounts" className="w-full">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <div className="rounded-lg border bg-card p-4">
            {accounts.length === 0 ? <p className="text-sm text-muted-foreground">No accounts.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Login</th><th>Platform</th><th>Type</th><th>Balance</th><th>Status</th></tr></thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-2 font-mono">{a.login}</td>
                      <td>{a.platform}</td>
                      <td>{a.type}</td>
                      <td>{formatCurrency(a.balance, a.currency)}</td>
                      <td><StatusBadge tone={a.status === "active" ? "success" : "warning"}>{a.status}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
        <TabsContent value="positions">
          <div className="rounded-lg border bg-card p-4">
            {positions.length === 0 ? <p className="text-sm text-muted-foreground">No open positions.</p> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2">Symbol</th><th>Side</th><th>Volume</th><th>P&L</th></tr></thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 font-mono">{p.symbol}</td>
                      <td className={p.side === "buy" ? "text-emerald-600" : "text-rose-600"}>{p.side}</td>
                      <td>{p.volume}</td>
                      <td className={p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatCurrency(p.pnl, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
        <TabsContent value="performance">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Equity curve</p>
            <AreaSeries data={Array.from({ length: 30 }, (_, i) => ({ date: `D${i + 1}`, value: Math.round(trader.equity * (1 + Math.sin(i / 3) * 0.08)) }))} xKey="date" yKey="value" formatValue={(v) => formatCurrency(v, currency)} />
          </div>
        </TabsContent>
        <TabsContent value="history">
          <div className="rounded-lg border bg-card p-4">
            <EntityChangeHistory entries={getTenantAudit(tid).filter((a) => a.entity === "trader")} />
          </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
