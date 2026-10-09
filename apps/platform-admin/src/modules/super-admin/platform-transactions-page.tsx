"use client";

/**
 * Platform Transactions Page — Cross-tenant transaction oversight.
 *
 * Stitch screen: platform_transactions
 * Tier 1 — Monitor and manage platform-level transactions across all tenants.
 */

import { useState, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  Search,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Filter,
  Download,
  CreditCard,
  Banknote,
} from "lucide-react";

// Demo platform transactions
const platformTransactions = [
  { id: "tx-001", tenant: "Alpha Capital", type: "payout", amount: 42500, currency: "USD", status: "completed", date: "2026-10-08T14:30:00Z", fee: 127.50, method: "wire" },
  { id: "tx-002", tenant: "Beta Trading", type: "payout", amount: 28900, currency: "USD", status: "processing", date: "2026-10-08T13:15:00Z", fee: 86.70, method: "wire" },
  { id: "tx-003", tenant: "Gamma Fund", type: "refund", amount: 1500, currency: "USD", status: "completed", date: "2026-10-08T11:45:00Z", fee: 0, method: "credit" },
  { id: "tx-004", tenant: "Delta Prop", type: "payout", amount: 56000, currency: "USD", status: "pending", date: "2026-10-08T10:00:00Z", fee: 168, method: "wire" },
  { id: "tx-005", tenant: "Alpha Capital", type: "revenue", amount: 125000, currency: "USD", status: "completed", date: "2026-10-08T09:30:00Z", fee: 0, method: "platform" },
  { id: "tx-006", tenant: "Epsilon Markets", type: "payout", amount: 18750, currency: "USD", status: "completed", date: "2026-10-07T16:45:00Z", fee: 56.25, method: "wire" },
  { id: "tx-007", tenant: "Zeta Trading", type: "chargeback", amount: 3200, currency: "USD", status: "processing", date: "2026-10-07T15:20:00Z", fee: 96, method: "credit" },
  { id: "tx-008", tenant: "Beta Trading", type: "payout", amount: 34200, currency: "USD", status: "completed", date: "2026-10-07T14:00:00Z", fee: 102.60, method: "wire" },
  { id: "tx-009", tenant: "Gamma Fund", type: "revenue", amount: 89000, currency: "USD", status: "completed", date: "2026-10-07T11:00:00Z", fee: 0, method: "platform" },
  { id: "tx-010", tenant: "Delta Prop", type: "refund", amount: 2500, currency: "USD", status: "completed", date: "2026-10-07T09:15:00Z", fee: 0, method: "credit" },
  { id: "tx-011", tenant: "Alpha Capital", type: "payout", amount: 67800, currency: "USD", status: "processing", date: "2026-10-07T08:30:00Z", fee: 203.40, method: "wire" },
  { id: "tx-012", tenant: "Theta Capital", type: "payout", amount: 45300, currency: "USD", status: "pending", date: "2026-10-06T17:00:00Z", fee: 135.90, method: "wire" },
];

const typeColors: Record<string, string> = {
  payout: "#4a7c59",
  refund: "#6b6358",
  revenue: "#705c30",
  chargeback: "#b83230",
};

const statusTones: Record<string, "success" | "info" | "warning" | "danger"> = {
  completed: "success",
  processing: "info",
  pending: "warning",
  failed: "danger",
};

export function PlatformTransactionsPage() {
  const { navigate } = usePlatform();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return platformTransactions.filter((tx) => {
      const matchesSearch =
        search === "" ||
        tx.id.toLowerCase().includes(search.toLowerCase()) ||
        tx.tenant.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || tx.type === typeFilter;
      const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [search, typeFilter, statusFilter]);

  const stats = useMemo(() => ({
    totalVolume: platformTransactions.reduce((s, tx) => s + tx.amount, 0),
    totalFees: platformTransactions.reduce((s, tx) => s + tx.fee, 0),
    completed: platformTransactions.filter((tx) => tx.status === "completed").length,
    processing: platformTransactions.filter((tx) => tx.status === "processing").length,
    pending: platformTransactions.filter((tx) => tx.status === "pending").length,
    byType: platformTransactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] ?? 0) + tx.amount;
      return acc;
    }, {} as Record<string, number>),
  }), []);

  return (
    <Page>
      <PageHeader
        title="Platform Transactions"
        description="Cross-tenant transaction oversight and monitoring."
        icon={DollarSign}
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />
      <PageContent>
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Total Volume (24h)" value={formatCurrency(stats.totalVolume)} delta={12} icon={TrendingUp} tone="positive" />
          <MetricCard label="Processing Fees" value={formatCurrency(stats.totalFees)} icon={CreditCard} />
          <MetricCard label="Completed" value={stats.completed} icon={ArrowUpRight} tone="positive" />
          <MetricCard label="Pending" value={stats.pending + stats.processing} icon={Clock} tone="warning" />
        </div>

        {/* Volume by type */}
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-base font-semibold">Volume by Type</h2>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(stats.byType).map(([type, amount]) => (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-4"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center"
                      style={{ background: `${typeColors[type]}20`, color: typeColors[type] }}
                    >
                      {type === "payout" ? <Banknote className="h-4 w-4" /> : type === "revenue" ? <TrendingUp className="h-4 w-4" /> : type === "refund" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    </div>
                    <span className="text-sm capitalize">{type}</span>
                  </div>
                  <span className="text-lg font-bold">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by transaction ID or tenant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={typeFilter === "all" ? "default" : "outline"}
              onClick={() => setTypeFilter("all")}
            >
              All Types
            </Button>
            {Object.keys(typeColors).map((type) => (
              <Button
                key={type}
                size="sm"
                variant={typeFilter === type ? "default" : "outline"}
                onClick={() => setTypeFilter(type)}
                className="text-[10px] capitalize"
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        {/* Transactions table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{tx.id}</td>
                      <td className="px-4 py-3 text-sm font-medium">{tx.tenant}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                          style={{ borderColor: typeColors[tx.type], color: typeColors[tx.type] }}
                        >
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {tx.type === "revenue" ? (
                          <span className="text-emerald-600">+{formatCurrency(tx.amount)}</span>
                        ) : (
                          formatCurrency(tx.amount)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {tx.fee > 0 ? `$${tx.fee.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {tx.method}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={statusTones[tx.status]}>{tx.status}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="flex items-center justify-center p-8 text-center">
                  <DollarSign className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="mt-2 font-medium">No transactions found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or filter.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}

// Import Clock icon separately to avoid unused imports error
import { Clock } from "lucide-react";
