"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { PayoutLedgerEntry } from "@/lib/platform/payout-ledger";
import { useLedgerForTenant } from "@/lib/platform/payout-ledger";
import { usePayouts } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";

// NOTE: this is module-level (not inside a component), so it must NOT use
// hooks like useMemo — hooks outside a render throw React error #321 in
// production ("Invalid hook call"). The array is static; no memoization needed.
const columns: Column<PayoutLedgerEntry>[] = (() => {
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
        <span className={`font-mono text-sm tabular-nums ${e.signedAmount < 0 ? "text-destructive" : "text-emerald-600"}`}>\n          {e.signedAmount >= 0 ? "+" : ""}{formatCurrency(Math.abs(e.signedAmount), e.currency)}\n        </span>
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
})();

export function PayoutsTab({ tenantId }: { tenantId: string }) {
  const { user } = usePlatform();
  const ledgerEntries = useLedgerForTenant(tenantId);
  const payouts = usePayouts();
  const tenant = allTenants.find((t) => t.id === tenantId);
  const tenantName = tenant ? tenant.name : tenantId;

  return (
    <Page>
      <PageHeader
        title={`Payouts for ${tenantName}`}
        description={`View all payout entries for ${tenantName}. Filter and sort the ledger entries.`}
        icon={require("lucide-react").ArrowRight}
      />
      <PageContent className="p-4">
        <Card className="p-0">
          <CardContent>
            <DataTable
              columns={columns}
              data={ledgerEntries.filter((e) => e.tenantId === tenantId)}
              rowKey={(e) => e.id}
              pageSize={25}
              searchableText={(e) => `${e.reference} ${e.traderName} ${e.tenantId}`}
              emptyTitle="No payout entries"
              emptyDescription="No payout entries found for this tenant."
            />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}