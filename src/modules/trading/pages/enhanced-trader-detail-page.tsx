"use client";

/**
 * Enhanced Trader Detail Page — 7-tab trader workspace.
 *
 * Builds on the existing TraderDetailPage with the same header, KPI row
 * and Account Health widget, then adds four explainability tabs:
 *  - Overview     (account summary + key metrics)
 *  - Accounts     (table of trading accounts)
 *  - Positions    (open positions)
 *  - Performance  (equity curve)
 *  - KYC          (KYC record for this trader w/ explainable state badge)
 *  - Risk         (Account Health widget + recent breaches)
 *  - Change History (ActivityTimeline of changes for this trader)
 *
 * Top actions include a destructive "Block Account" wrapped in an
 * AlertDialog (UX §24) plus outline "Resync" and "Edit Payout Schedule".
 */

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantPositions,
  getTenantKyc,
  getTenantBreaches,
  getChangeHistory,
  getTenantAudit,
  type Trader,
  type TradingAccount,
  type Position,
  type Breach,
} from "@/lib/platform/mock-data";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
  EntityHeader,
} from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import {
  StatusBadge,
  traderStatusTone,
  formatCurrency,
} from "@/components/platform/status";
import { ExplainableStateBadge } from "@/components/platform/state-explanations";
import { AccountHealthWidget } from "@/components/platform/account-health";
import { ActivityTimeline } from "@/components/platform/audit";
import { EmptyState } from "@/components/platform/guards";
import { AreaSeries } from "@/components/platform/charts";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import {
  Wallet,
  TrendingUp,
  Target,
  ArrowLeft,
  Ban,
  RefreshCw,
  Calendar,
  ShieldAlert,
  CreditCard,
  Activity,
  FileCheck,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function EnhancedTraderDetailPage() {
  const { runtime, router, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const traderId = router.params.id;
  const currency = runtime.tenant?.currency ?? "USD";

  const trader = useMemo(
    () => getTenantTraders(tid).find((t) => t.id === traderId),
    [tid, traderId],
  );
  const accounts = useMemo(
    () => getTenantAccounts(tid).filter((a) => a.traderId === traderId),
    [tid, traderId],
  );
  const positions = useMemo(
    () => getTenantPositions(tid).filter((p) => p.traderId === traderId),
    [tid, traderId],
  );
  const kycRecords = useMemo(
    () => getTenantKyc(tid).filter((k) => k.traderId === traderId),
    [tid, traderId],
  );
  const breaches = useMemo(
    () => getTenantBreaches(tid).filter((b) => b.traderId === traderId),
    [tid, traderId],
  );
  const changeEntries = useMemo(
    () =>
      getChangeHistory("Account")
        .filter((c) => c.entityId === traderId)
        .map((c) => ({
          id: c.id,
          timestamp: c.timestamp,
          actor: c.actor,
          action: `Changed ${c.field}`,
          entity: "trader",
          entityId: c.entityId,
          summary: `${c.oldValue} → ${c.newValue} (${c.reason})`,
          severity: "info" as const,
          module: "audit",
        })),
    [traderId],
  );
  const traderAudit = useMemo(
    () => getTenantAudit(tid).filter((a) => a.entity === "trader").slice(0, 12),
    [tid],
  );

  if (!trader) {
    return (
      <Page>
        <Button variant="ghost" size="sm" onClick={() => navigate("trading-traders")}>
          <ArrowLeft className="mr-1 h-4 w-4" />Back
        </Button>
        <p className="text-muted-foreground">Trader not found.</p>
      </Page>
    );
  }

  const openBreaches = breaches.filter((b) => b.status === "open");
  const kyc = kycRecords[0];

  const isChallengePhase =
    trader.challengePhase === "funded" ||
    trader.challengePhase === "phase-1" ||
    trader.challengePhase === "phase-2";

  return (
    <Page>
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => navigate("trading-traders")}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />Back to traders
      </Button>

      <EntityHeader
        title={trader.name}
        subtitle={`${trader.email} · ${trader.country}`}
        avatar={
          <Avatar className="h-12 w-12">
            <AvatarFallback>
              {trader.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        }
        badges={
          <>
            <StatusBadge tone={traderStatusTone(trader.status)}>{trader.status}</StatusBadge>
            <Badge variant="outline" className="text-[10px]">{trader.challengePhase ?? "none"}</Badge>
          </>
        }
        actions={
          <>
            {/* Destructive action wrapped in AlertDialog (§24) */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Ban className="mr-1 h-4 w-4" />Block Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Block trader account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately suspend all of {trader.name}&apos;s trading accounts,
                    close open positions at market, and prevent new logins. The trader will be
                    notified by email. This action is reversible from the admin panel.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
                    onClick={() =>
                      toast({
                        title: "Account blocked",
                        description: `${trader.name} can no longer log in.`,
                      })
                    }
                  >
                    Block account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast({ title: "Resync queued", description: "Re-syncing trading accounts from MT5." })}
            >
              <RefreshCw className="mr-1 h-4 w-4" />Resync
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast({ title: "Opening payout schedule", description: "Editing payout schedule for this trader." })}
            >
              <Calendar className="mr-1 h-4 w-4" />Edit Payout Schedule
            </Button>
          </>
        }
      />

      {/* KPI row — same shape as existing TraderDetailPage */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Equity" value={formatCurrency(trader.equity, currency)} icon={Wallet} />
        <MetricCard
          label="Total P&L"
          value={`${trader.totalPnl >= 0 ? "+" : ""}${formatCurrency(trader.totalPnl, currency)}`}
          tone={trader.totalPnl >= 0 ? "positive" : "negative"}
          icon={TrendingUp}
        />
        <MetricCard label="Win rate" value={`${trader.winRate}%`} icon={Target} />
        <MetricCard label="Trades" value={trader.trades} icon={Activity} />
      </div>

      {/* Account Health — unified risk visualization (§21) */}
      {isChallengePhase ? (
        <div className="rounded-lg border bg-card p-4">
          <AccountHealthWidget
            dailyLoss={{ current: Math.round(trader.equity * 0.041), limit: Math.round(trader.equity * 0.05) }}
            maxDrawdown={{ current: Math.round(trader.equity * 0.037), limit: Math.round(trader.equity * 0.1) }}
            profitTarget={{ current: Math.max(0, trader.totalPnl), limit: Math.round(trader.equity * 0.08) }}
            accountBalance={trader.equity}
          />
        </div>
      ) : null}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="kyc">KYC</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="history">Change History</TabsTrigger>
        </TabsList>

        {/* Overview — account summary + key metrics */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-4 lg:col-span-2">
              <p className="mb-3 text-sm font-medium">Account Summary</p>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Trader ID</dt>
                  <dd className="font-mono text-xs">{trader.id}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Country</dt>
                  <dd>{trader.country}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Joined</dt>
                  <dd>{new Date(trader.joinedAt).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phase</dt>
                  <dd className="capitalize">{trader.challengePhase ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Account Balance</dt>
                  <dd>{formatCurrency(trader.accountBalance, currency)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Equity</dt>
                  <dd>{formatCurrency(trader.equity, currency)}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-sm font-medium">
                <LabelWithHelp help="Open positions, KYC status, and any active breaches for this trader.">
                  Key Metrics
                </LabelWithHelp>
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Accounts</span>
                  <Badge variant="secondary" className="text-[10px]">{accounts.length}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open positions</span>
                  <Badge variant="secondary" className="text-[10px]">{positions.length}</Badge>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">KYC</span>
                  {kyc ? <ExplainableStateBadge status={kyc.status} entityType="kyc" /> : <Badge variant="outline" className="text-[10px]">None</Badge>}
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Open breaches</span>
                  <Badge variant={openBreaches.length > 0 ? "destructive" : "outline"} className="text-[10px]">{openBreaches.length}</Badge>
                </li>
              </ul>
            </div>
          </div>
        </TabsContent>

        {/* Accounts — table of trading accounts */}
        <TabsContent value="accounts">
          <div className="rounded-lg border bg-card p-4">
            <AccountsTable
              accounts={accounts}
              currency={currency}
              onRowClick={(a) => navigate("account-workspace", { id: a.id })}
            />
          </div>
        </TabsContent>

        {/* Positions — open positions table */}
        <TabsContent value="positions">
          <div className="rounded-lg border bg-card p-4">
            <PositionsTable positions={positions} currency={currency} />
          </div>
        </TabsContent>

        {/* Performance — equity curve */}
        <TabsContent value="performance">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Equity curve (30d)</p>
            <AreaSeries
              data={Array.from({ length: 30 }, (_, i) => ({
                date: `D${i + 1}`,
                value: Math.round(trader.equity * (1 + Math.sin(i / 3) * 0.08)),
              }))}
              xKey="date"
              yKey="value"
              formatValue={(v) => formatCurrency(v, currency)}
            />
          </div>
        </TabsContent>

        {/* KYC — KYC record for this trader with explainable state */}
        <TabsContent value="kyc">
          <div className="rounded-lg border bg-card p-4">
            {kyc ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">KYC record</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(kyc.submittedAt).toLocaleDateString()}
                      {kyc.reviewedAt ? ` · Reviewed ${new Date(kyc.reviewedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <ExplainableStateBadge status={kyc.status} entityType="kyc" />
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Document type</dt>
                    <dd className="capitalize">{kyc.documentType.replace("-", " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Country</dt>
                    <dd>{kyc.country}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Risk level</dt>
                    <dd>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          kyc.riskLevel === "high"
                            ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
                            : kyc.riskLevel === "medium"
                            ? "border-amber-500/40 text-amber-700 dark:text-amber-400"
                            : "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                        )}
                      >
                        {kyc.riskLevel}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <EmptyState
                icon={FileCheck}
                title="No KYC record"
                description={`${trader.name} has not submitted KYC documents yet.`}
                hint="KYC verification is required before payouts can be processed."
              />
            )}
          </div>
        </TabsContent>

        {/* Risk — Account Health + recent breaches for this trader */}
        <TabsContent value="risk">
          <div className="space-y-4">
            {isChallengePhase ? (
              <div className="rounded-lg border bg-card p-4">
                <AccountHealthWidget
                  dailyLoss={{ current: Math.round(trader.equity * 0.041), limit: Math.round(trader.equity * 0.05) }}
                  maxDrawdown={{ current: Math.round(trader.equity * 0.037), limit: Math.round(trader.equity * 0.1) }}
                  profitTarget={{ current: Math.max(0, trader.totalPnl), limit: Math.round(trader.equity * 0.08) }}
                  accountBalance={trader.equity}
                />
              </div>
            ) : null}
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Recent breaches for {trader.name}
              </p>
              {breaches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No breaches recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {breaches.map((b) => (
                    <li key={b.id} className="flex items-center justify-between rounded-md border bg-muted/20 p-2 text-sm">
                      <div>
                        <p className="font-medium">{b.type}</p>
                        <p className="text-xs text-muted-foreground">{b.rule}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{b.severity}</Badge>
                        <Badge variant={b.status === "open" ? "destructive" : "outline"} className="text-[10px]">{b.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Change History — ActivityTimeline of changes for this trader */}
        <TabsContent value="history">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
              <History className="h-4 w-4 text-muted-foreground" />
              Change history for {trader.name}
            </p>
            {changeEntries.length === 0 && traderAudit.length === 0 ? (
              <EmptyState
                icon={History}
                title="No change history recorded"
                description="When administrators update this trader's configuration, those changes will appear here."
              />
            ) : (
              <ActivityTimeline entries={[...changeEntries, ...traderAudit].slice(0, 12)} max={12} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-tables — identical to existing TraderDetailPage so behavior    */
/* matches across both views.                                          */
/* ------------------------------------------------------------------ */

function AccountsTable({
  accounts,
  currency,
  onRowClick,
}: {
  accounts: TradingAccount[];
  currency: string;
  onRowClick?: (row: TradingAccount) => void;
}) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No accounts"
        description="This trader has no trading accounts yet."
      />
    );
  }
  const columns: Column<TradingAccount>[] = [
    { key: "login", header: "Login", cell: (a) => <span className="font-mono text-xs">{a.login}</span>, sortValue: (a) => a.login },
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
    <DataTable
      columns={columns}
      data={accounts}
      rowKey={(a) => a.id}
      pageSize={6}
      onRowClick={onRowClick}
      emptyTitle="No accounts"
      emptyDescription="This trader has no trading accounts yet."
    />
  );
}

function PositionsTable({ positions, currency }: { positions: Position[]; currency: string }) {
  if (positions.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No open positions"
        description="This trader currently has no open positions."
      />
    );
  }
  const columns: Column<Position>[] = [
    { key: "symbol", header: "Symbol", cell: (p) => <span className="font-mono font-medium">{p.symbol}</span>, sortValue: (p) => p.symbol },
    { key: "side", header: "Side", cell: (p) => <span className={p.side === "buy" ? "text-emerald-600" : "text-rose-600"}>{p.side.toUpperCase()}</span>, sortValue: (p) => p.side },
    { key: "volume", header: "Volume", cell: (p) => p.volume, sortValue: (p) => p.volume, numeric: true },
    { key: "entry", header: "Entry", cell: (p) => p.entryPrice, sortValue: (p) => p.entryPrice, numeric: true },
    { key: "current", header: "Current", cell: (p) => p.currentPrice, sortValue: (p) => p.currentPrice, numeric: true },
    {
      key: "pnl",
      header: "P&L",
      cell: (p) => (
        <span className={p.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
          {p.pnl >= 0 ? "+" : ""}{formatCurrency(p.pnl, currency)}
        </span>
      ),
      sortValue: (p) => p.pnl,
      numeric: true,
    },
  ];
  return (
    <DataTable
      columns={columns}
      data={positions}
      rowKey={(p) => p.id}
      pageSize={6}
    />
  );
}
