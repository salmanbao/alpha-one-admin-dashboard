"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { getTenantTransactions, type Transaction } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { formatCurrency } from "@/components/platform/status";
import { BarSeries, AreaSeries } from "@/components/platform/charts";
import { ArrowDownCircle, ArrowUpCircle, Percent, Wallet } from "lucide-react";

/**
 * Build a 12-point transaction flow series from the tenant's transactions.
 * Aggregates absolute amount by month index so the area chart shows
 * overall ledger activity over time.
 */
function transactionFlowSeries(txns: { date: string; amount: number }[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const buckets = new Array(12).fill(0);
  for (const t of txns) {
    const m = new Date(t.date).getMonth();
    if (!Number.isNaN(m)) buckets[m] += Math.abs(t.amount);
  }
  return months.map((date, i) => ({ date, value: Math.round(buckets[i]) }));
}

export function AccountingOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const term = makeTermResolver(runtime.tenant);
  const txns = getTenantTransactions(tid);
  const revenue = txns
    .filter((t) => t.type === "challenge-fee" || t.type === "subscription")
    .reduce((s, t) => s + t.amount, 0);
  const payouts = txns.filter((t) => t.type === "payout").reduce((s, t) => s + t.amount, 0);
  const fees = txns.filter((t) => t.type === "commission").reduce((s, t) => s + t.amount, 0);
  const net = revenue - payouts - fees;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Revenue" value={formatCurrency(revenue, currency)} icon={ArrowUpCircle} tone="positive" />
      <MetricCard label={plural(term("payout"))} value={formatCurrency(payouts, currency)} icon={ArrowDownCircle} tone="negative" />
      <MetricCard label="Fees" value={formatCurrency(fees, currency)} icon={Percent} tone="warning" />
      <MetricCard label="Net" value={formatCurrency(net, currency)} icon={Wallet} tone={net >= 0 ? "positive" : "negative"} />
    </div>
  );
}

export function RevenueByTypeWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const txns = getTenantTransactions(tid);
  const types: Transaction["type"][] = ["challenge-fee", "subscription", "payout", "refund", "commission"];
  const data = types.map((t) => ({
    date: t,
    value: txns.filter((x) => x.type === t).reduce((s, x) => s + x.amount, 0),
  }));
  return (
    <BarSeries
      data={data}
      xKey="date"
      yKey="value"
      color="#b45309"
      formatValue={(v) => formatCurrency(v, currency)}
      height={200}
    />
  );
}

export function TransactionFlowWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const txns = getTenantTransactions(tid);
  const data = transactionFlowSeries(txns.map((t) => ({ date: t.date, amount: t.amount })));
  return (
    <AreaSeries
      data={data}
      xKey="date"
      yKey="value"
      color="#b45309"
      formatValue={(v) => formatCurrency(v, currency)}
      height={200}
    />
  );
}
