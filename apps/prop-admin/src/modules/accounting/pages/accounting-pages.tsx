"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantTransactions, type Transaction } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { BarSeries, AreaSeries } from "@/components/platform/charts";
import { Calculator, Receipt, ArrowLeftRight, ArrowUpCircle, ArrowDownCircle, Percent, Wallet, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";

function transactionStatusTone(status: string) {
  if (status === "reconciled") return "success" as const;
  if (status === "posted") return "info" as const;
  return "warning" as const;
}

function transactionFlowSeries(txns: { date: string; amount: number }[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const buckets = new Array(12).fill(0);
  for (const t of txns) {
    const m = new Date(t.date).getMonth();
    if (!Number.isNaN(m)) buckets[m] += Math.abs(t.amount);
  }
  return months.map((date, i) => ({ date, value: Math.round(buckets[i]) }));
}

/* ---------------------------------------------------------------- */
/* Overview page                                                   */
/* ---------------------------------------------------------------- */

export function AccountingOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const txns = getTenantTransactions(tid);
  const revenue = txns
    .filter((t) => t.type === "challenge-fee" || t.type === "subscription")
    .reduce((s, t) => s + t.amount, 0);
  const payouts = txns.filter((t) => t.type === "payout").reduce((s, t) => s + t.amount, 0);
  const fees = txns.filter((t) => t.type === "commission").reduce((s, t) => s + t.amount, 0);
  const net = revenue - payouts - fees;

  return (
    <Page>
      <PageHeader title="Accounting" description={`${term("account")} financial ledger and bank reconciliation.`} icon={Calculator} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Revenue" value={formatCurrency(revenue, currency)} icon={ArrowUpCircle} tone="positive" />
          <MetricCard label={plural(term("payout"))} value={formatCurrency(payouts, currency)} icon={ArrowDownCircle} tone="negative" />
          <MetricCard label="Fees" value={formatCurrency(fees, currency)} icon={Percent} tone="warning" />
          <MetricCard label="Net" value={formatCurrency(net, currency)} icon={Wallet} tone={net >= 0 ? "positive" : "negative"} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Revenue by type</p>
            <BarSeries
              data={(["challenge-fee", "subscription", "payout", "refund", "commission"] as const).map((t) => ({
                date: t,
                value: txns.filter((x) => x.type === t).reduce((s, x) => s + x.amount, 0),
              }))}
              xKey="date"
              yKey="value"
              color="#b45309"
              formatValue={(v) => formatCurrency(v, currency)}
            />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Transaction flow</p>
            <AreaSeries
              data={transactionFlowSeries(txns.map((t) => ({ date: t.date, amount: t.amount })))}
              xKey="date"
              yKey="value"
              color="#b45309"
              formatValue={(v) => formatCurrency(v, currency)}
            />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ---------------------------------------------------------------- */
/* Transactions page                                               */
/* ---------------------------------------------------------------- */

export function TransactionsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const txns = getTenantTransactions(tid);

  const columns: Column<Transaction>[] = [
    { key: "reference", header: "Reference", cell: (t) => <span className="font-mono text-xs">{t.reference}</span>, sortValue: (t) => t.reference },
    { key: "type", header: "Type", cell: (t) => <span className="capitalize">{t.type}</span>, sortValue: (t) => t.type },
    { key: "description", header: "Description", cell: (t) => <span className="text-muted-foreground">{t.description}</span>, sortValue: (t) => t.description },
    {
      key: "amount",
      header: "Amount",
      cell: (t) => {
        const isOutflow = t.type === "payout" || t.type === "refund" || t.type === "commission";
        return (
          <span className={isOutflow ? "font-medium text-rose-600" : "font-medium text-emerald-600"}>
            {isOutflow ? "-" : "+"}{formatCurrency(t.amount, t.currency)}
          </span>
        );
      },
      sortValue: (t) => t.amount,
    },
    { key: "category", header: "Category", cell: (t) => <span className="capitalize">{t.category}</span>, sortValue: (t) => t.category },
    {
      key: "status",
      header: "Status",
      cell: (t) => <StatusBadge tone={transactionStatusTone(t.status)} className="capitalize">{t.status}</StatusBadge>,
      sortValue: (t) => t.status,
    },
    { key: "date", header: "Date", cell: (t) => <span className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString()}</span>, sortValue: (t) => t.date },
    { key: "account", header: "Account", cell: (t) => <span className="text-xs">{t.account}</span>, sortValue: (t) => t.account },
  ];

  return (
    <Page>
      <PageHeader
        title="Transactions"
        description={`All ${term("account").toLowerCase()} financial transactions.`}
        icon={Receipt}
        actions={
          <Button size="sm" variant="outline" onClick={() => exportToCsv(
            getTenantTransactions(tid),
            [
              { key: "reference", header: "Reference", value: (t) => t.reference },
              { key: "type", header: "Type", value: (t) => t.type },
              { key: "description", header: "Description", value: (t) => t.description },
              { key: "amount", header: "Amount", value: (t) => t.amount },
              { key: "currency", header: "Currency", value: (t) => t.currency },
              { key: "category", header: "Category", value: (t) => t.category },
              { key: "status", header: "Status", value: (t) => t.status },
              { key: "date", header: "Date", value: (t) => t.date },
              { key: "account", header: "Account", value: (t) => t.account },
            ],
            `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
          )}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <PageContent>
        <DataTable
          columns={columns}
          data={txns}
          rowKey={(t) => t.id}
          searchableText={(t) => `${t.reference} ${t.type} ${t.description} ${t.category} ${t.status}`}
          searchPlaceholder="Search transactions…"
          emptyTitle="No transactions"
          emptyDescription="This tenant has no financial transactions yet."
        />
      </PageContent>
    </Page>
  );
}

/* ---------------------------------------------------------------- */
/* Reconciliation page                                             */
/* ---------------------------------------------------------------- */

export function ReconciliationPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const txns = getTenantTransactions(tid);
  const total = txns.reduce((s, t) => s + t.amount, 0);
  const reconciled = txns.filter((t) => t.status === "reconciled");
  const reconciledTotal = reconciled.reduce((s, t) => s + t.amount, 0);
  const pending = txns.filter((t) => t.status === "pending");
  const pendingTotal = pending.reduce((s, t) => s + t.amount, 0);
  const reconciliationRate = txns.length ? Math.round((reconciled.length / txns.length) * 100) : 0;

  const columns: Column<Transaction>[] = [
    { key: "reference", header: "Reference", cell: (t) => <span className="font-mono text-xs">{t.reference}</span>, sortValue: (t) => t.reference },
    { key: "type", header: "Type", cell: (t) => <span className="capitalize">{t.type}</span>, sortValue: (t) => t.type },
    { key: "description", header: "Description", cell: (t) => <span className="text-muted-foreground">{t.description}</span>, sortValue: (t) => t.description },
    {
      key: "amount",
      header: "Amount",
      cell: (t) => <span className="font-medium">{formatCurrency(t.amount, t.currency)}</span>,
      sortValue: (t) => t.amount,
    },
    { key: "account", header: "Account", cell: (t) => <span className="text-xs">{t.account}</span>, sortValue: (t) => t.account },
    {
      key: "status",
      header: "Status",
      cell: (t) => <StatusBadge tone={transactionStatusTone(t.status)} className="capitalize">{t.status}</StatusBadge>,
      sortValue: (t) => t.status,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (t) =>
        t.status !== "reconciled" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => toast({ title: "Reconciled", description: `${t.reference} marked as reconciled (demo).` })}
          >
            <CheckCircle2 className="mr-1 h-4 w-4" /> Reconcile
          </Button>
        ) : (
          <span className="text-xs text-emerald-600">Cleared</span>
        ),
    },
  ];

  return (
    <Page>
      <PageHeader title="Reconciliation" description={`Match ${term("account").toLowerCase()} ledger entries against bank statements.`} icon={ArrowLeftRight} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Volume" value={formatCurrency(total, currency)} icon={Wallet} />
          <MetricCard label="Reconciled" value={formatCurrency(reconciledTotal, currency)} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Pending" value={formatCurrency(pendingTotal, currency)} icon={Percent} tone="warning" />
          <MetricCard label="Reconciliation Rate" value={`${reconciliationRate}%`} icon={ArrowLeftRight} tone={reconciliationRate >= 80 ? "positive" : "warning"} />
        </div>
        <DataTable
          columns={columns}
          data={txns.filter((t) => t.status !== "reconciled")}
          rowKey={(t) => t.id}
          searchableText={(t) => `${t.reference} ${t.type} ${t.description} ${t.status}`}
          searchPlaceholder="Search pending entries…"
          emptyTitle="Nothing to reconcile"
          emptyDescription="All transactions are already reconciled."
        />
      </PageContent>
    </Page>
  );
}
