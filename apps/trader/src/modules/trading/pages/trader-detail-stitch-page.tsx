"use client";

/**
 * Trader Detail Page — My Workspace
 *
 * Simplified view for the trader app showing:
 * - Trader profile and KPIs
 * - Account information
 * - Open positions
 * - Basic account health
 * All permission-gated to trader.self
 */

import { useMemo } from "react";
import { usePlatform } from "@pfaas/platform-core";
import {
  Page,
  PageHeader,
  PageContent,
  MetricCard,
  EntityHeader,
} from "@pfaas/ui";
import { DataTable } from "@pfaas/ui";
import { StatusBadge, traderStatusTone, formatCurrency } from "@pfaas/ui";
import { ExplainableStateBadge } from "@pfaas/ui";
import { AccountHealthWidget } from "@pfaas/ui";
import { EmptyState } from "@pfaas/ui";
import { AreaSeries } from "@pfaas/ui";
import {
  Wallet,
  TrendingUp,
  Target,
  Activity,
  CreditCard,
  ShieldAlert,
  User,
} from "lucide-react";
import { Badge } from "@pfaas/ui";
import { Avatar, AvatarFallback } from "@pfaas/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pfaas/ui";
import {
  traderProfiles,
  traderAccounts,
  traderPositions,
  traderKyc,
  traderBreaches,
} from "@/lib/fixtures/trader-fixtures";

export function TraderDetailPage() {
  const { runtime, router } = usePlatform();
  const traderId = router.params.id ?? "trader-1";
  const currency = runtime.tenant?.currency ?? "USD";

  const trader = useMemo(
    () => traderProfiles.find((t) => t.id === traderId),
    [traderId],
  );

  const accounts = useMemo(
    () => traderAccounts.filter((acc) => acc.traderId === traderId),
    [traderId],
  );
  const positions = traderPositions;
  const kyc = traderKyc;
  const breaches = traderBreaches;

  const traderAccount = accounts[0];

  if (!trader) {
    return (
      <Page className="min-h-[calc(100vh-14rem)]">
        <PageHeader title="Trader Not Found" />
        <PageContent>
          <EmptyState
            title="Trader profile not found"
            description="The requested trader profile could not be found."
            icon={User}
          />
        </PageContent>
      </Page>
    );
  }

  return (
    <Page className="min-h-[calc(100vh-14rem)]">
      <PageHeader
        title={trader.name}
        description={trader.email}
        actions={
          <div className="flex items-center gap-2">
            <Avatar>
              <AvatarFallback>
                {trader.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Badge
              variant={trader.status === "active" ? "secondary" : "destructive"}
            >
              {trader.status}
            </Badge>
          </div>
        }
      />

      <PageContent className="space-y-6">
        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Account Balance"
            value={formatCurrency(traderAccount?.balance ?? 0, currency)}
            icon={Wallet}
            tone="positive"
          />
          <MetricCard
            label="Equity"
            value={formatCurrency(traderAccount?.equity ?? 0, currency)}
            icon={TrendingUp}
            tone={
              (traderAccount?.equity ?? 0) >= (traderAccount?.balance ?? 0)
                ? "positive"
                : "negative"
            }
          />
          <MetricCard
            label="Open Positions"
            value={positions.length}
            icon={Activity}
          />
          <MetricCard
            label="Daily P&L"
            value={formatCurrency(traderAccount?.dailyPnl ?? 0, currency)}
            icon={Target}
            tone={(traderAccount?.dailyPnl ?? 0) >= 0 ? "positive" : "negative"}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6 border-b">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="kyc">KYC</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="space-y-4">
              <div className="space-y-2">
                <EntityHeader
                  title="Trader Information"
                  subtitle="Key details about the trader"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Trader ID</span>
                    <p className="text-sm font-medium">{trader.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Application</span>
                    <p className="text-sm font-medium">{trader.application}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p className="text-sm font-medium">
                      <StatusBadge tone={traderStatusTone(trader.status)}>
                        {trader.status}
                      </StatusBadge>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created</span>
                    <p className="text-sm font-medium">
                      {new Date(trader.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <EntityHeader
                  title="Account Summary"
                  subtitle="Overview of the trader's account"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Account ID</span>
                    <p className="text-sm font-medium">
                      {traderAccount?.id ?? "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Currency</span>
                    <p className="text-sm font-medium">{currency}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Margin Used</span>
                    <p className="text-sm font-medium">
                      {formatCurrency(traderAccount?.marginUsed ?? 0, currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Margin Available
                    </span>
                    <p className="text-sm font-medium">
                      {formatCurrency(
                        traderAccount?.marginRemaining ?? 0,
                        currency,
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="accounts">
            <div className="space-y-4">
              <EntityHeader
                title="Trading Accounts"
                subtitle="All trading accounts for this trader"
              />
              {accounts.length > 0 ? (
                <DataTable
                  data={accounts}
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: "id",
                      header: "Account ID",
                      cell: (row) => row.id,
                    },
                    {
                      key: "accountName",
                      header: "Account Name",
                      cell: (row) => row.accountName,
                    },
                    {
                      key: "accountType",
                      header: "Type",
                      cell: (row) => row.accountType,
                    },
                    {
                      key: "currency",
                      header: "Currency",
                      cell: (row) => row.currency,
                    },
                    {
                      key: "balance",
                      header: "Balance",
                      numeric: true,
                      cell: (row) => formatCurrency(row.balance, row.currency),
                    },
                    {
                      key: "equity",
                      header: "Equity",
                      numeric: true,
                      cell: (row) => formatCurrency(row.equity, row.currency),
                    },
                    {
                      key: "marginUsed",
                      header: "Margin Used",
                      cell: (row) =>
                        formatCurrency(row.marginUsed, row.currency),
                    },
                    {
                      key: "marginRemaining",
                      header: "Margin Available",
                      cell: (row) =>
                        formatCurrency(row.marginRemaining, row.currency),
                    },
                    {
                      key: "status",
                      header: "Status",
                      cell: (row) => (
                        <StatusBadge tone={traderStatusTone(row.status)}>
                          {row.status}
                        </StatusBadge>
                      ),
                    },
                  ]}
                />
              ) : (
                <EmptyState
                  title="No accounts found"
                  description="This trader has no trading accounts."
                  icon={CreditCard}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="positions">
            <div className="space-y-4">
              <EntityHeader
                title="Open Positions"
                subtitle="Currently open trading positions"
              />
              {positions.length > 0 ? (
                <DataTable
                  data={positions}
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: "symbol",
                      header: "Symbol",
                      cell: (row) => (
                        <span className="font-medium">{row.symbol}</span>
                      ),
                    },
                    {
                      key: "side",
                      header: "Side",
                      cell: (row) =>
                        row.side === "long" ? (
                          <span className="text-xs font-medium bg-green-100 text-green-800 rounded px-2 py-1">
                            Long
                          </span>
                        ) : (
                          <span className="text-xs font-medium bg-red-100 text-red-800 rounded px-2 py-1">
                            Short
                          </span>
                        ),
                    },
                    {
                      key: "size",
                      header: "Size",
                      cell: (row) =>
                        `${row.size.toLocaleString()} ${row.symbol.slice(3)}`,
                    },
                    {
                      key: "entryPrice",
                      header: "Entry Price",
                      cell: (row) => formatCurrency(row.entryPrice, currency),
                    },
                    {
                      key: "currentPrice",
                      header: "Current Price",
                      cell: (row) => formatCurrency(row.currentPrice, currency),
                    },
                    {
                      key: "pnl",
                      header: "P&L",
                      numeric: true,
                      cell: (row) => formatCurrency(row.pnl, currency),
                    },
                    {
                      key: "pnlPercent",
                      header: "P&L %",
                      numeric: true,
                      cell: (row) => `${row.pnlPercent.toFixed(2)}%`,
                    },
                    {
                      key: "marginUsed",
                      header: "Margin Used",
                      cell: (row) => formatCurrency(row.marginUsed, currency),
                    },
                    {
                      key: "status",
                      header: "Status",
                      cell: (row) => (
                        <StatusBadge
                          tone={row.status === "open" ? "info" : "danger"}
                        >
                          {row.status}
                        </StatusBadge>
                      ),
                    },
                  ]}
                />
              ) : (
                <EmptyState
                  title="No open positions"
                  description="This trader has no open positions."
                  icon={Activity}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="performance">
            <div className="space-y-4">
              <EntityHeader
                title="Performance"
                subtitle="Equity curve and performance metrics"
              />
              <div className="space-y-2">
                <EntityHeader
                  title="Performance Metrics"
                  subtitle="Key performance indicators"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Win Rate</span>
                    <p className="text-sm font-medium">68%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Profit Factor
                    </span>
                    <p className="text-sm font-medium">2.3</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Avg Trade Duration
                    </span>
                    <p className="text-sm font-medium">4h 22m</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Trades</span>
                    <p className="text-sm font-medium">142</p>
                  </div>
                </div>
              </div>

              <div className="h-96 w-full">
                <AreaSeries
                  data={[
                    { x: "Jan", y: 10000 },
                    { x: "Feb", y: 10500 },
                    { x: "Mar", y: 10200 },
                    { x: "Apr", y: 11000 },
                    { x: "May", y: 11500 },
                    { x: "Jun", y: 12000 },
                  ]}
                  xKey="x"
                  yKey="y"
                  height={240}
                  formatValue={(value) => formatCurrency(value, currency)}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="kyc">
            <div className="space-y-4">
              <EntityHeader
                title="KYC Information"
                subtitle="Know Your Customer record for this trader"
              />
              {kyc ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <EntityHeader
                      title="Verification Status"
                      subtitle="Current KYC verification state"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Status</span>
                        <p className="text-sm font-medium">
                          <ExplainableStateBadge
                            status={kyc.verificationStatus}
                            entityType="kyc"
                            detail={kyc.verificationNotes}
                          />
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Level</span>
                        <p className="text-sm font-medium">{kyc.level}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expires</span>
                        <p className="text-sm font-medium">
                          {new Date(kyc.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <EntityHeader
                      title="Personal Information"
                      subtitle="Trader's personal details"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Full Name</span>
                        <p className="text-sm font-medium">{kyc.fullName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Date of Birth
                        </span>
                        <p className="text-sm font-medium">
                          {kyc.dateOfBirth}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Address</span>
                        <p className="text-sm font-medium">{kyc.address}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone</span>
                        <p className="text-sm font-medium">{kyc.phone}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email</span>
                        <p className="text-sm font-medium">{kyc.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No KYC record found"
                  description="This trader has no KYC information on file."
                  icon={ShieldAlert}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="risk">
            <div className="space-y-4">
              <EntityHeader
                title="Risk Management"
                subtitle="Account health and recent breaches"
              />
              <AccountHealthWidget
                accountBalance={traderAccount?.balance ?? 10000}
                currency={currency}
              />

              {breaches.length > 0 ? (
                <div className="space-y-2">
                  <EntityHeader
                    title="Recent Breaches"
                    subtitle="Latest risk breaches for this account"
                  />
                  <DataTable
                    data={breaches}
                    rowKey={(row) => row.id}
                    columns={[
                      {
                        key: "id",
                        header: "Breach ID",
                        cell: (row) => row.id,
                      },
                      {
                        key: "type",
                        header: "Type",
                        cell: (row) => row.type,
                      },
                      {
                        key: "severity",
                        header: "Severity",
                        cell: (row) => (
                          <StatusBadge
                            tone={
                              row.severity === "high"
                                ? "danger"
                                : row.severity === "medium"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {row.severity}
                          </StatusBadge>
                        ),
                      },
                      {
                        key: "description",
                        header: "Description",
                        cell: (row) => row.description,
                      },
                      {
                        key: "timestamp",
                        header: "Timestamp",
                        cell: (row) =>
                          new Date(row.timestamp).toLocaleString(),
                      },
                    ]}
                  />
                </div>
              ) : (
                <EmptyState
                  title="No breaches found"
                  description="No recent risk breaches for this account."
                  icon={ShieldAlert}
                />
              )}
            </div>
          </TabsContent>
          <TabsContent value="change-history">
            <div className="space-y-2">
              <EntityHeader
                title="Change History"
                subtitle="Audit trail of changes for this trader"
              />
              <div className="p-6 text-center text-muted-foreground">
                Change history would be displayed here
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </PageContent>
    </Page>
  );
}
