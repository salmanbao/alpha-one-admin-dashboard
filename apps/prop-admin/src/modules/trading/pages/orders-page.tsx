"use client";

/**
 * Orders Directory — research item #24.
 *
 * Lists challenge purchase orders with trader, challenge, amount, payment
 * method, status, and payment provider. Row click navigates to the
 * existing order-detail page.
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/components/platform/status";
import { getTenantTraders, getTenantAccounts, hashStr } from "@/lib/platform/mock-data";
import { ShoppingCart, CheckCircle2, Clock, XCircle, DollarSign } from "lucide-react";

interface Order {
  id: string;
  traderId: string;
  traderName: string;
  challenge: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  paymentProvider: string;
  createdAt: string;
}

const challenges = ["2-Step Standard", "1-Step Turbo", "2-Step Gen Z", "Instant Funded"];
const methods = ["Visa", "Mastercard", "Crypto (USDT)", "PayPal", "Match2Pay"];

function buildOrders(tid: string): Order[] {
  const traders = getTenantTraders(tid);
  return traders.slice(0, 20).map((t, i) => {
    const seed = hashStr(tid + t.id + i);
    const statuses: Order["status"][] = ["paid", "paid", "paid", "pending", "failed", "refunded"];
    return {
      id: `ORD-${String(10000 + seed % 90000)}`,
      traderId: t.id,
      traderName: t.name,
      challenge: challenges[seed % challenges.length],
      amount: [490, 990, 1990, 4990][seed % 4],
      currency: "USD",
      paymentMethod: methods[seed % methods.length],
      status: statuses[i % statuses.length],
      paymentProvider: seed % 2 === 0 ? "NOWPayments" : "Match2Pay",
      createdAt: new Date(Date.now() - (seed % 30) * 86400000).toISOString(),
    };
  });
}

const statusTone = (s: Order["status"]) =>
  s === "paid" ? "success" : s === "pending" ? "info" : s === "failed" ? "danger" : s === "refunded" ? "warning" : "muted";

export function OrdersPage() {
  const { runtime, navigate } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const orders = useMemo(() => buildOrders(tid), [tid]);

  const paid = orders.filter((o) => o.status === "paid").length;
  const pending = orders.filter((o) => o.status === "pending").length;
  const failed = orders.filter((o) => o.status === "failed").length;
  const totalRevenue = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.amount, 0);

  const columns: Column<Order>[] = [
    { key: "id", header: "Order", cell: (o) => <span className="font-mono text-xs font-medium">{o.id}</span>, sortValue: (o) => o.id },
    { key: "traderName", header: "Trader", cell: (o) => <button onClick={() => navigate("trader-detail", { id: o.traderId })} className="text-xs font-medium text-primary hover:underline">{o.traderName}</button>, sortValue: (o) => o.traderName },
    { key: "challenge", header: "Challenge", cell: (o) => <span className="text-xs">{o.challenge}</span>, sortValue: (o) => o.challenge },
    { key: "amount", header: "Amount", cell: (o) => <span className="text-xs tabular-nums">{formatCurrency(o.amount, o.currency)}</span>, sortValue: (o) => o.amount, numeric: true },
    { key: "paymentMethod", header: "Method", cell: (o) => <Badge variant="outline" className="text-[10px]">{o.paymentMethod}</Badge>, sortValue: (o) => o.paymentMethod },
    { key: "status", header: "Status", cell: (o) => <StatusBadge tone={statusTone(o.status)}>{o.status}</StatusBadge>, sortValue: (o) => o.status },
    { key: "provider", header: "Provider", cell: (o) => <span className="text-xs text-muted-foreground">{o.paymentProvider}</span>, sortValue: (o) => o.paymentProvider },
    { key: "createdAt", header: "Created", cell: (o) => <span className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</span>, sortValue: (o) => o.createdAt },
    {
      key: "actions", header: "Actions",
      cell: (o) => <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate("order-detail", { id: o.id }); }} className="text-xs">View →</Button>,
    },
  ];

  return (
    <Page>
      <PageHeader title="Orders" description="Challenge purchase orders and payment status." icon={ShoppingCart} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Orders" value={orders.length} icon={ShoppingCart} />
          <MetricCard label="Paid" value={paid} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Pending" value={pending} icon={Clock} tone={pending > 0 ? "warning" : "positive"} />
          <MetricCard label="Revenue" value={formatCurrency(totalRevenue, currency)} icon={DollarSign} tone="positive" />
        </div>
        {failed > 0 && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-50/50 p-3 dark:bg-rose-950/20">
            <p className="flex items-center gap-2 text-sm font-medium text-rose-700 dark:text-rose-400">
              <XCircle className="h-4 w-4" />{failed} failed order{failed === 1 ? "" : "s"} — review payment failures and retry.
            </p>
          </div>
        )}
        <DataTable columns={columns} data={orders} rowKey={(o) => o.id} onRowClick={(o) => navigate("order-detail", { id: o.id })} searchableText={(o) => `${o.id} ${o.traderName} ${o.challenge} ${o.status}`} searchPlaceholder="Search orders…" pageSize={15} emptyTitle="No orders" emptyDescription="Orders will appear here when traders purchase challenges." />
      </PageContent>
    </Page>
  );
}
