"use client";

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantTraders, getTenantAccounts, getTenantPositions, type Trader, type TradingAccount, type Position } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, traderStatusTone, formatCurrency, formatCompact } from "@/components/platform/status";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { AccountHealthWidget } from "@/components/platform/account-health";
import { Users, CreditCard, Activity, ArrowLeft, Wallet, Filter, X, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EntityHeader } from "@/components/platform/page";
import { AreaSeries } from "@/components/platform/charts";
import { EntityChangeHistory, ActivityTimeline } from "@/components/platform/audit";
import { getTenantAudit } from "@/lib/platform/mock-data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/* Shared filter bar primitives (UX §25 / §26 — operational workspaces)*/
/* ------------------------------------------------------------------ */

function FilterBar({
  label,
  activeCount,
  onClear,
  resultCount,
  totalCount,
  children,
}: {
  label: string;
  activeCount: number;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          <span>{label}</span>
          {activeCount > 0 ? (
            <Badge variant="secondary" className="text-[9px]">
              {activeCount}
            </Badge>
          ) : null}
        </span>
        {children}
        {activeCount > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClear}
            className="h-8 gap-1 px-2 text-xs"
          >
            <X className="h-3 w-3" /> Clear all
          </Button>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {resultCount} of {totalCount} shown
      </span>
    </div>
  );
}

function FilterSelect<T extends string>({
  value,
  onChange,
  placeholder,
  options,
  width = "w-[140px]",
}: {
  value: string;
  onChange: (v: T) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className={`h-8 ${width}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TradingOverviewPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
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
        title={`Trading Overview`}
        description={`Aggregate trading activity across all ${plural(term("trader")).toLowerCase()} accounts.`}
        icon={Activity}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("trading-traders")}>{`View ${plural(term("trader")).toLowerCase()}`}</Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label={plural(term("trader"))} value={traders.length} delta={8} icon={Users} tone="positive" />
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
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const traders = getTenantTraders(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const countries = useMemo(
    () => Array.from(new Set(traders.map((t) => t.country))).sort(),
    [traders],
  );

  const filteredTraders = useMemo(
    () =>
      traders.filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (
          phaseFilter !== "all" &&
          (t.challengePhase ?? "none") !== phaseFilter
        )
          return false;
        if (countryFilter !== "all" && t.country !== countryFilter)
          return false;
        return true;
      }),
    [traders, statusFilter, phaseFilter, countryFilter],
  );

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (phaseFilter !== "all" ? 1 : 0) +
    (countryFilter !== "all" ? 1 : 0);

  const clearAll = () => {
    setStatusFilter("all");
    setPhaseFilter("all");
    setCountryFilter("all");
  };

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
      cell: (t) => <ExplainableStateBadge status={t.status} entityType="trader" />,
      sortValue: (t) => t.status,
    },
    {
      key: "phase",
      header: "Phase",
      cell: (t) => <Badge variant="outline" className="text-[10px]">{t.challengePhase ?? "none"}</Badge>,
      sortValue: (t) => t.challengePhase ?? "none",
    },
    { key: "trades", header: "Trades", cell: (t) => t.trades, sortValue: (t) => t.trades, numeric: true },
    { key: "winRate", header: "Win %", cell: (t) => `${t.winRate}%`, sortValue: (t) => t.winRate, numeric: true },
    { key: "equity", header: "Equity", cell: (t) => formatCurrency(t.equity, currency), sortValue: (t) => t.equity, numeric: true },
    { key: "pnl", header: "Total P&L", cell: (t) => <span className={t.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"} role="img" aria-label={`Total P&L: ${t.totalPnl >= 0 ? "profit" : "loss"} of ${formatCurrency(Math.abs(t.totalPnl), currency)}`}>{t.totalPnl >= 0 ? "+" : ""}{formatCurrency(t.totalPnl, currency)}</span>, sortValue: (t) => t.totalPnl, numeric: true },
  ];

  return (
    <Page>
      <PageHeader title={plural(term("trader"))} description={`${traders.length} ${plural(term("trader")).toLowerCase()} in this tenant.`} icon={Users} />
      <PageContent>
        <FilterBar
          label="Filters"
          activeCount={activeFilterCount}
          onClear={clearAll}
          resultCount={filteredTraders.length}
          totalCount={traders.length}
        >
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "invited", label: "Invited" },
              { value: "suspended", label: "Suspended" },
              { value: "breached", label: "Breached" },
            ]}
          />
          <FilterSelect
            value={phaseFilter}
            onChange={setPhaseFilter}
            placeholder="All phases"
            options={[
              { value: "all", label: "All phases" },
              { value: "phase-1", label: "Phase 1" },
              { value: "phase-2", label: "Phase 2" },
              { value: "funded", label: "Funded" },
              { value: "none", label: "No phase" },
            ]}
          />
          <FilterSelect
            value={countryFilter}
            onChange={setCountryFilter}
            placeholder="All countries"
            width="w-[160px]"
            options={[
              { value: "all", label: "All countries" },
              ...countries.map((c) => ({ value: c, label: c })),
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          data={filteredTraders}
          rowKey={(t) => t.id}
          onRowClick={(t) => navigate("trader-detail", { id: t.id })}
          searchableText={(t) => `${t.name} ${t.email} ${t.country} ${t.status}`}
          searchPlaceholder={`Search ${plural(term("trader")).toLowerCase()}…`}
          emptyTitle="No traders match"
          emptyDescription="Try clearing one of the filters above or search by a different name."
        />
      </PageContent>
    </Page>
  );
}

export function AccountsPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const accounts = getTenantAccounts(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");

  const platforms = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.platform))).sort(),
    [accounts],
  );

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((a) => {
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (platformFilter !== "all" && a.platform !== platformFilter)
          return false;
        if (phaseFilter !== "all" && a.phase !== phaseFilter) return false;
        return true;
      }),
    [accounts, statusFilter, platformFilter, phaseFilter],
  );

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (platformFilter !== "all" ? 1 : 0) +
    (phaseFilter !== "all" ? 1 : 0);

  const clearAll = () => {
    setStatusFilter("all");
    setPlatformFilter("all");
    setPhaseFilter("all");
  };

  const columns: Column<TradingAccount>[] = [
    { key: "login", header: "Login", cell: (a) => <span className="font-mono text-xs">{a.login}</span>, sortValue: (a) => a.login },
    {
      key: "trader",
      header: "Trader",
      cell: (a) => (
        <Button
          type="button"
          variant="link"
          size="sm"
          // Compact inline link-style button that doubles as a cross-link to
          // the trader workspace (UX §22 — contextual actions where the
          // decision happens). `h-auto px-0` overrides the size="sm" default
          // so the link fits inside a DataTable cell without inflating row
          // height. `e.stopPropagation()` prevents the row click (which goes
          // to the Account Workspace) from firing when the operator clicks
          // directly on the trader name.
          className="h-auto gap-1 px-0 font-medium text-foreground hover:text-emerald-700 hover:underline dark:text-emerald-400"
          onClick={(e) => {
            e.stopPropagation();
            navigate("trader-detail", { id: a.traderId });
          }}
          aria-label={`View trader ${a.traderName}`}
          title={`View trader ${a.traderName}`}
        >
          {a.traderName}
          <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
        </Button>
      ),
      sortValue: (a) => a.traderName,
    },
    { key: "platform", header: "Platform", cell: (a) => <Badge variant="outline" className="text-[10px]">{a.platform}</Badge>, sortValue: (a) => a.platform },
    { key: "type", header: "Type", cell: (a) => <Badge variant="secondary" className="text-[10px]">{a.type}</Badge>, sortValue: (a) => a.type },
    { key: "phase", header: "Phase", cell: (a) => a.phase, sortValue: (a) => a.phase },
    { key: "balance", header: "Balance", cell: (a) => formatCurrency(a.balance, a.currency), sortValue: (a) => a.balance, numeric: true },
    { key: "equity", header: "Equity", cell: (a) => formatCurrency(a.equity, a.currency), sortValue: (a) => a.equity, numeric: true },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge tone={a.status === "active" ? "success" : a.status === "breached" ? "danger" : a.status === "passed" ? "info" : "warning"}>{a.status}</StatusBadge>,
      sortValue: (a) => a.status,
    },
  ];

  return (
    <Page>
      <PageHeader title={`${term("trader")} Accounts`} description={`MT5 / MT4 / DXTrade accounts for this ${term("trader").toLowerCase()} tenant.`} icon={CreditCard} />
      <PageContent>
        <FilterBar
          label="Filters"
          activeCount={activeFilterCount}
          onClear={clearAll}
          resultCount={filteredAccounts.length}
          totalCount={accounts.length}
        >
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
            options={[
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "passed", label: "Passed" },
              { value: "pending", label: "Pending" },
              { value: "breached", label: "Breached" },
            ]}
          />
          <FilterSelect
            value={platformFilter}
            onChange={setPlatformFilter}
            placeholder="All platforms"
            options={[
              { value: "all", label: "All platforms" },
              ...platforms.map((p) => ({ value: p, label: p })),
            ]}
          />
          <FilterSelect
            value={phaseFilter}
            onChange={setPhaseFilter}
            placeholder="All phases"
            options={[
              { value: "all", label: "All phases" },
              { value: "phase-1", label: "Phase 1" },
              { value: "phase-2", label: "Phase 2" },
              { value: "funded", label: "Funded" },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          data={filteredAccounts}
          rowKey={(a) => a.id}
          onRowClick={(a) => navigate("account-workspace", { id: a.id })}
          searchableText={(a) => `${a.login} ${a.traderName} ${a.platform} ${a.type}`}
          searchPlaceholder={`Search ${term("trader").toLowerCase()} accounts…`}
          emptyTitle="No accounts match"
          emptyDescription="Try clearing one of the filters above or search by a different login or trader name."
        />
      </PageContent>
    </Page>
  );
}

export function PositionsPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const positions = getTenantPositions(tid);
  const currency = runtime.tenant?.currency ?? "USD";

  const [sideFilter, setSideFilter] = useState<string>("all");
  const [symbolFilter, setSymbolFilter] = useState<string>("all");
  const [pnlFilter, setPnlFilter] = useState<string>("all");

  const symbols = useMemo(
    () => Array.from(new Set(positions.map((p) => p.symbol))).sort(),
    [positions],
  );

  const filteredPositions = useMemo(
    () =>
      positions.filter((p) => {
        if (sideFilter !== "all" && p.side !== sideFilter) return false;
        if (symbolFilter !== "all" && p.symbol !== symbolFilter) return false;
        if (pnlFilter === "profit" && p.pnl < 0) return false;
        if (pnlFilter === "loss" && p.pnl >= 0) return false;
        return true;
      }),
    [positions, sideFilter, symbolFilter, pnlFilter],
  );

  const activeFilterCount =
    (sideFilter !== "all" ? 1 : 0) +
    (symbolFilter !== "all" ? 1 : 0) +
    (pnlFilter !== "all" ? 1 : 0);

  const clearAll = () => {
    setSideFilter("all");
    setSymbolFilter("all");
    setPnlFilter("all");
  };

  const columns: Column<Position>[] = [
    {
      key: "symbol",
      header: "Symbol",
      cell: (p) => <span className="font-mono font-medium">{p.symbol}</span>,
      sortValue: (p) => p.symbol,
    },
    { key: "side", header: "Side", cell: (p) => <span className={p.side === "buy" ? "text-emerald-600" : "text-rose-600"} role="img" aria-label={`Position side: ${p.side}`}>{p.side.toUpperCase()}</span>, sortValue: (p) => p.side },
    { key: "volume", header: "Volume", cell: (p) => p.volume, sortValue: (p) => p.volume, numeric: true },
    { key: "entry", header: "Entry", cell: (p) => p.entryPrice, sortValue: (p) => p.entryPrice, numeric: true },
    { key: "current", header: "Current", cell: (p) => p.currentPrice, sortValue: (p) => p.currentPrice, numeric: true },
    { key: "pnl", header: "P&L", cell: (p) => <span className={p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"} role="img" aria-label={`Profit and loss: ${p.pnl >= 0 ? "profit" : "loss"} of ${formatCurrency(Math.abs(p.pnl), currency)}`}>{p.pnl >= 0 ? "+" : ""}{formatCurrency(p.pnl, currency)}</span>, sortValue: (p) => p.pnl, numeric: true },
    { key: "pnlPct", header: "P&L %", cell: (p) => <span className={p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"} role="img" aria-label={`P&L percentage: ${p.pnl >= 0 ? "profit" : "loss"} of ${p.pnlPct} percent`}>{p.pnl >= 0 ? "+" : ""}{p.pnlPct}%</span>, sortValue: (p) => p.pnlPct, numeric: true },
    { key: "opened", header: "Opened", cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.openedAt).toLocaleString()}</span>, sortValue: (p) => p.openedAt },
  ];

  return (
    <Page>
      <PageHeader title="Open Positions" description={`${positions.length} positions currently open across all ${plural(term("trader")).toLowerCase()}.`} icon={Activity} />
      <PageContent>
        <FilterBar
          label="Filters"
          activeCount={activeFilterCount}
          onClear={clearAll}
          resultCount={filteredPositions.length}
          totalCount={positions.length}
        >
          <FilterSelect
            value={sideFilter}
            onChange={setSideFilter}
            placeholder="All sides"
            options={[
              { value: "all", label: "All sides" },
              { value: "buy", label: "Buy (long)" },
              { value: "sell", label: "Sell (short)" },
            ]}
          />
          <FilterSelect
            value={symbolFilter}
            onChange={setSymbolFilter}
            placeholder="All symbols"
            width="w-[160px]"
            options={[
              { value: "all", label: "All symbols" },
              ...symbols.map((s) => ({ value: s, label: s })),
            ]}
          />
          <FilterSelect
            value={pnlFilter}
            onChange={setPnlFilter}
            placeholder="All P&L"
            options={[
              { value: "all", label: "All P&L" },
              { value: "profit", label: "Profit only" },
              { value: "loss", label: "Loss only" },
            ]}
          />
        </FilterBar>
        <DataTable
          columns={columns}
          data={filteredPositions}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate("account-workspace", { id: p.accountId })}
          searchableText={(p) => `${p.symbol} ${p.side} ${p.traderId}`}
          searchPlaceholder="Search positions…"
          emptyTitle="No positions match"
          emptyDescription="Try clearing one of the filters above or search by a different symbol or side."
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
      {/* Account Health — unified risk visualization (§21) */}
      {trader.challengePhase === "funded" || trader.challengePhase === "phase-1" || trader.challengePhase === "phase-2" ? (
        <div className="rounded-lg border bg-card p-4">
          <AccountHealthWidget
            dailyLoss={{ current: Math.round(trader.equity * 0.041), limit: Math.round(trader.equity * 0.05) }}
            maxDrawdown={{ current: Math.round(trader.equity * 0.037), limit: Math.round(trader.equity * 0.1) }}
            profitTarget={{ current: Math.max(0, trader.totalPnl), limit: Math.round(trader.equity * 0.08) }}
            accountBalance={trader.equity}
          />
        </div>
      ) : null}
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
