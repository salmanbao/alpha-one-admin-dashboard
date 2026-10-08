"use client";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTenantAccounts, hashStr } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/platform/status";
import { formatCurrency } from "@/components/platform/status";
import { ShoppingCart, CheckCircle2, Clock, XCircle } from "lucide-react";

interface PurchaseRow {
  id: string;
  challenge: string;
  accountSize: number;
  price: number;
  method: string;
  date: string;
  status: "paid" | "pending" | "failed" | "refunded";
  accountCreated: boolean;
}

export function PurchaseHistoryPage() {
  const { runtime, user, navigate } = usePlatform();
  const currency = runtime.tenant?.currency ?? "USD";
  const trader = getTraderForUser(user);
  const tid = runtime.tenant?.id ?? "platform";

  const purchases: PurchaseRow[] = trader
    ? Array.from({ length: 3 }, (_, i) => {
        const seed = hashStr(trader.id + i);
        const sizes = [100000, 50000, 25000];
        return {
          id: `ORD-${String(10000 + seed % 90000)}`,
          challenge: ["2-Step Standard", "1-Step Turbo", "2-Step Gen Z"][i],
          accountSize: sizes[i],
          price: [990, 490, 199][i],
          method: ["Credit Card", "Crypto (USDT)", "PayPal"][i],
          date: new Date(Date.now() - (i + 1) * 30 * 86400000).toLocaleDateString(),
          status: i === 2 ? "refunded" : "paid",
          accountCreated: i < 2,
        };
      })
    : [];

  const columns: Column<PurchaseRow>[] = [
    { key: "id", header: "Order", cell: (p) => <button onClick={() => navigate("order-detail", { id: p.id })} className="font-mono text-xs font-medium text-primary hover:underline">{p.id}</button>, sortValue: (p) => p.id },
    { key: "challenge", header: "Challenge", cell: (p) => <span className="text-xs">{p.challenge}</span>, sortValue: (p) => p.challenge },
    { key: "price", header: "Price", cell: (p) => <span className="text-xs tabular-nums">{formatCurrency(p.price, currency)}</span>, sortValue: (p) => p.price, numeric: true },
    { key: "method", header: "Method", cell: (p) => <Badge variant="outline" className="text-[10px]">{p.method}</Badge>, sortValue: (p) => p.method },
    { key: "date", header: "Date", cell: (p) => <span className="text-xs text-muted-foreground">{p.date}</span>, sortValue: (p) => p.date },
    { key: "status", header: "Status", cell: (p) => <StatusBadge tone={p.status === "paid" ? "success" : p.status === "pending" ? "info" : p.status === "refunded" ? "muted" : "danger"}>{p.status}</StatusBadge>, sortValue: (p) => p.status },
    { key: "account", header: "Account", cell: (p) => p.accountCreated ? <Button size="sm" variant="ghost" className="text-xs" onClick={() => navigate("trader-detail")}>View →</Button> : <span className="text-xs text-muted-foreground">—</span> },
  ];

  return (
    <Page>
      <PageHeader title="Purchase History" description="Your challenge purchases and payment history." icon={ShoppingCart} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total Purchases" value={purchases.length} icon={ShoppingCart} />
          <MetricCard label="Paid" value={purchases.filter((p) => p.status === "paid").length} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Total Spent" value={formatCurrency(purchases.filter((p) => p.status === "paid").reduce((s, p) => s + p.price, 0), currency)} icon={ShoppingCart} />
          <MetricCard label="Refunds" value={purchases.filter((p) => p.status === "refunded").length} icon={XCircle} />
        </div>
        <DataTable columns={columns} data={purchases} rowKey={(p) => p.id} searchableText={(p) => `${p.id} ${p.challenge} ${p.method}`} searchPlaceholder="Search purchases…" pageSize={10} emptyTitle="No purchases" emptyDescription="Your purchase history will appear here." />
      </PageContent>
    </Page>
  );
}
