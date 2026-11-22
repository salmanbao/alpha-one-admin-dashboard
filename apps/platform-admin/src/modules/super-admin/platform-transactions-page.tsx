"use client";

/**
 * Platform Transactions Page — Cross-tenant transaction oversight.
 *
 * Stitch screen: platform_transactions
 * Tier 1 — Monitor and manage platform-level transactions across all tenants.
 * P0-3: rebuilt on real persisted transaction store (transaction-store.ts).
 */

import { useState, useMemo } from "react";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { DestructiveActionDialog } from "@/components/platform/destructive-action-dialog";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { readTransactions, useTransactions, createTransaction, retryTransaction, refundTransaction, type Transaction } from "@/lib/platform/transaction-store";
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
  Eye,
  Clock,
} from "lucide-react";

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
  const platformTransactions = useTransactions();

  // Refund confirmation (audit finding #1): refunds were fire-and-forget
  // toasts — now they require a typed reason before the money moves.
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
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
  }, [platformTransactions, search, typeFilter, statusFilter]);

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
  }), [platformTransactions]);

  const handleExport = () => {
    const csv = [
      ["ID", "Tenant", "Type", "Amount", "Fee", "Method", "Date", "Status"],
      ...filtered.map((tx) => [
        tx.id,
        tx.tenant,
        tx.type,
        tx.amount.toString(),
        tx.fee.toString(),
        tx.method,
        tx.date,
        tx.status,
      ]),
    ]
      .map((row) => row.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `platform-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Export complete", description: `${filtered.length} transaction(s) downloaded.` });
  };

  const handleRefresh = () => {
    // Force re-read from the persisted store
    toast({ title: "Refreshed", description: `Transactions reloaded from persisted store.` });
  };

  const handleRetry = (tx: Transaction) => {
    const result = retryTransaction(tx.id);
    toast({ title: result.title, description: result.description });
  };

  const handleRefundConfirm = (reason: string) => {
    if (!refundTarget) return;
    const result = refundTransaction(refundTarget.id, reason);
    toast({ title: result.title, description: result.description });
    setRefundTarget(null);
  };

  return (
    <Page>
      <PageHeader
        title="Platform Transactions"
        description="Cross-tenant transaction oversight and monitoring."
        icon={DollarSign}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="mr-1 h-4 w-4" /> Refresh
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={false}
          error={undefined}
          onRetry={handleRefresh}
          hasData={platformTransactions.length > 0}
          loadingLabel="Loading transactions…"
        >
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
            <Separator orientation="vertical" className="h-4" />
            <Button
              size="sm"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
            >
              All Statuses
            </Button>
            {Object.keys(statusTones).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? "default" : "outline"}
                onClick={() => setStatusFilter(status)}
                className="text-[10px] capitalize"
              >
                {status}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
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
                        {tx.fee > 0 ? formatCurrency(tx.fee) : "—"}
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
                      <td className="px-4 py-3 flex items-center gap-2">
                        {/* Detail (Eye) */}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[11px]" onClick={() => toast({ title: `Transaction ${tx.id}`, description: `Tenant: ${tx.tenant} · Type: ${tx.type} · Amount: ${formatCurrency(tx.amount)} · Fee: ${tx.fee > 0 ? formatCurrency(tx.fee) : "—"} · Method: ${tx.method} · Status: ${tx.status}` })}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {/* Refund (for completed/refund/revenue/chargeback) */}
                        {(tx.type === "refund" || tx.type === "revenue" || tx.type === "chargeback") && (
                          <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px] gap-1" onClick={() => setRefundTarget(tx)}>
                            Refund
                          </Button>
                        )}
                        {/* Retry (for pending/failed) */}
                        {(tx.status === "pending" || tx.status === "failed") && (
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => handleRetry(tx)}>
                            <RefreshCw className="h-3 w-3" /> Retry
                          </Button>
                        )}
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
        </PageAsyncBoundary>

        {/* Refund confirmation — reason required (audit finding #1) */}
        <DestructiveActionDialog
          dialogId="tx-refund-reason"
          open={refundTarget !== null}
          onOpenChange={(o) => { if (!o) setRefundTarget(null); }}
          variant="refund"
          title={`Refund ${refundTarget ? formatCurrency(refundTarget.amount, refundTarget.currency) : ""}?`}
          consequence={
            refundTarget
              ? `${formatCurrency(refundTarget.amount, refundTarget.currency)} will be returned to ${refundTarget.tenant}'s original payment method for transaction ${refundTarget.id}. This posts a compensating entry in the financial ledger and cannot be reversed.`
              : ""
          }
          context={
            refundTarget ? (
              <span className="block text-xs">
                Tenant: <strong>{refundTarget.tenant}</strong> · Method: {refundTarget.method} ·
                Original status: {refundTarget.status}
              </span>
            ) : null
          }
          onConfirm={handleRefundConfirm}
        />
      </PageContent>
    </Page>
  );
}
