"use client";

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { PayoutLedgerEntry } from "@/lib/platform/payout-ledger";
import { useLedgerForTenant } from "@/lib/platform/payout-ledger";
import { usePayouts } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";
import { ArrowRight, Share2 } from "lucide-react";

export function PayoutDetailPage({ params }: { params: Record<string, string> }) {
  const { user } = usePlatform();
  const payoutId = params.payoutId ?? params.id ?? "";
  const payouts = usePayouts();
  const payout = payouts.find((p) => p.id === payoutId);
  const tenantId = payout?.tenantId ?? "";
  const tenant = allTenants.find((t) => t.id === tenantId);
  const tenantName = tenant ? tenant.name : tenantId;

  const ledgerEntries = useLedgerForTenant(tenantId);

  const columns: Column<PayoutLedgerEntry>[] = useMemo(() => {
    return [
      {
        key: "at",
        header: "Time",
        cell: (e) => <span className="font-mono text-xs tabular-nums">{new Date(e.at).toLocaleString()}</span>,
        sortValue: (e) => e.at,
      },
      {
        key: "type",
        header: "Type",
        cell: (e) => (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            e.type === "clawback" || e.type === "fail"
              ? "bg-rose-100 text-rose-700 border border-rose-200"
              : e.type === "execute" || e.type === "release"
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : e.type === "hold"
              ? "bg-amber-100 text-amber-700 border border-amber-200"
              : "bg-blue-100 text-blue-700 border border-blue-200"
          }`}>
            {e.type}
          </span>
        ),
        sortValue: (e) => e.type,
      },
      {
        key: "reference",
        header: "Reference",
        cell: (e) => <span className="font-mono text-xs">{e.reference}</span>,
        sortValue: (e) => e.reference,
      },
      {
        key: "tenant",
        header: "Tenant",
        cell: (e) => (
          <span className="text-sm font-medium">
            {allTenants.find((t) => t.id === e.tenantId)?.name ?? e.tenantId}
          </span>
        ),
        sortValue: (e) => allTenants.find((t) => t.id === e.tenantId)?.name ?? e.tenantId,
      },
      {
        key: "trader",
        header: "Trader",
        cell: (e) => <span className="text-sm">{e.traderName}</span>,
        sortValue: (e) => e.traderName,
      },
      {
        key: "currency",
        header: "Currency",
        cell: (e) => <span className="font-mono text-xs">{e.currency}</span>,
      },
      {
        key: "amount",
        header: "Amount",
        numeric: true,
        cell: (e) => (
          <span className={`font-mono text-sm tabular-nums ${e.signedAmount < 0 ? "text-destructive" : "text-emerald-600"}`}>
            {e.signedAmount >= 0 ? "+" : ""}{formatCurrency(Math.abs(e.signedAmount), e.currency)}
          </span>
        ),
        sortValue: (e) => e.signedAmount,
      },
      {
        key: "actor",
        header: "Actor",
        cell: (e) => <span className="text-sm">{e.actor}</span>,
      },
      {
        key: "reason",
        header: "Reason",
        cell: (e) => (
          <span className="text-sm max-w-xs truncate block" title={e.reason}>
            {e.reason}
          </span>
        ),
        sortValue: (e) => e.reason,
      },
    ];
  }, [ledgerEntries, tenantId]);

  const evidenceBlock = payout?.evidence ? (
    <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
      <p className="font-medium mb-1 flex items-center gap-1">
        <Share2 className="h-4 w-4" /> Evidence Attachments
      </p>
      <ul className="list-disc list-inside space-y-1">
        <li>
          <strong>{payout.evidence.type}:</strong> {payout.evidence.reference}
        </li>
        <li>
          <strong>Attached:</strong>{" "}
          {new Date(payout.evidence.attachedAt).toLocaleString()}
        </li>
      </ul>
    </div>
  ) : null;

  return (
    <Page>
      <PageHeader
        title={`Payout Detail: ${payout?.reference ?? payoutId}`}
        description={`View the complete money-movement ledger for payout ${payout?.reference ?? payoutId}. (PS-02)`}
        icon={ArrowRight}
      />
      <PageContent className="p-4">
        <Card className="p-0">
          <CardContent>
            <DataTable
              columns={columns}
              data={ledgerEntries.filter((e) => e.payoutId === payoutId)}
              rowKey={(e) => e.id}
              pageSize={25}
              searchableText={(e) => `${e.reference} ${e.traderName} ${e.tenantId}`}
              emptyTitle={`No ledger entries for ${payout?.reference ?? payoutId}`}
              emptyDescription="No ledger entries found for this payout."
            />
          </CardContent>
        </Card>
        {evidenceBlock}
      </PageContent>
    </Page>
  );
}