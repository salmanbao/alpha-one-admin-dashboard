"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantPayouts, type Payout } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, payoutStatusTone, formatCurrency } from "@/components/platform/status";
import { Wallet, Banknote, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

function PayoutsTable({ filter }: { filter: (p: Payout) => boolean }) {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const pays = getTenantPayouts(tid).filter(filter);

  const columns: Column<Payout>[] = [
    { key: "reference", header: "Reference", cell: (p) => <span className="font-mono text-xs">{p.reference}</span>, sortValue: (p) => p.reference },
    { key: "trader", header: "Trader", cell: (p) => <span className="font-medium">{p.traderName}</span>, sortValue: (p) => p.traderName },
    { key: "amount", header: "Amount", cell: (p) => <span className="font-semibold">{formatCurrency(p.amount, p.currency)}</span>, sortValue: (p) => p.amount },
    { key: "method", header: "Method", cell: (p) => p.method, sortValue: (p) => p.method },
    { key: "split", header: "Split", cell: (p) => `${p.profitSplit}%`, sortValue: (p) => p.profitSplit },
    {
      key: "status",
      header: "Status",
      cell: (p) => <StatusBadge tone={payoutStatusTone(p.status)}>{p.status}</StatusBadge>,
      sortValue: (p) => p.status,
    },
    { key: "created", header: "Requested", cell: (p) => <span className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>, sortValue: (p) => p.createdAt },
    {
      key: "actions",
      header: "",
      cell: (p) =>
        p.status === "pending" ? (
          <div className="flex gap-1">
            <Button size="sm" variant="default" onClick={() => toast({ title: "Approved", description: `${p.traderName} payout approved.` })}>Approve</Button>
            <Button size="sm" variant="ghost" onClick={() => toast({ title: "Rejected", description: `${p.traderName} payout rejected.`, variant: "destructive" })}>Reject</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={pays}
      rowKey={(p) => p.id}
      searchableText={(p) => `${p.reference} ${p.traderName} ${p.method} ${p.status}`}
      searchPlaceholder="Search payouts…"
    />
  );
}

export function PayoutsOverviewPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const pays = getTenantPayouts(tid);
  const currency = runtime.tenant?.currency ?? "USD";
  const pending = pays.filter((p) => p.status === "pending").length;
  const paid = pays.filter((p) => p.status === "paid");
  const totalPaid = paid.reduce((s, p) => s + p.amount, 0);

  return (
    <Page>
      <PageHeader title="Payouts" description="Trader withdrawal requests and approvals." icon={Wallet} actions={<Button size="sm" variant="outline" onClick={() => toast({ title: "Export", description: "Payouts exported (demo)." })}>Export</Button>} />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Pending" value={pending} icon={Clock} tone="warning" />
          <MetricCard label="Paid (30d)" value={paid.length} icon={CheckCircle2} tone="positive" />
          <MetricCard label="Total Paid" value={formatCurrency(totalPaid, currency)} icon={Banknote} tone="positive" />
          <MetricCard label="Avg Split" value="80%" icon={Wallet} />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium">All Payouts</p>
          <PayoutsTable filter={() => true} />
        </div>
      </PageContent>
    </Page>
  );
}

export function PendingPayoutsPage() {
  return (
    <Page>
      <PageHeader title="Pending Payouts" description="Awaiting approval." icon={Clock} />
      <PageContent>
        <PayoutsTable filter={(p) => p.status === "pending"} />
      </PageContent>
    </Page>
  );
}

export function PayoutHistoryPage() {
  return (
    <Page>
      <PageHeader title="Payout History" description="All processed payouts." icon={CheckCircle2} />
      <PageContent>
        <PayoutsTable filter={(p) => p.status === "paid" || p.status === "rejected"} />
      </PageContent>
    </Page>
  );
}
