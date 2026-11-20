"use client";

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { usePayouts } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";
import { Download, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PayoutAuditorEvidencePackPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();

  // Filter for auditor-ready entries: those with evidence or notes
  const filtered = useMemo(() => {
    return payouts.filter((p) => {
      const hasEvidence = !!p.evidence?.type;
      const hasNotes = !!p.notes?.length;
      return hasEvidence || hasNotes;
    });
  }, [payouts]);

  const columns: Column<any>[] = useMemo(() => {
    return [
      {
        key: "reference",
        header: "Reference",
        cell: (e) => <span className="font-mono text-xs">{e.reference}</span>,
      },
      {
        key: "status",
        header: "Status",
        cell: (e) => (
          <span className={`font-mono text-sm ${
            e.status === "paid" ? "text-green-600" : e.status === "failed" ? "text-red-600" : "text-gray-600"
          }`}>
            {e.status}
          </span>
        ),
        sortValue: (e) => e.status,
      },
      {
        key: "tenants",
        header: "Tenants",
        cell: (e) => <span className="text-sm font-medium">{e.tenantName ?? e.tenantId}</span>,
        sortValue: (e) => e.tenantName ?? e.tenantId,
      },
      {
        key: "notes",
        header: "Notes",
        cell: (e) => (
          <span className="text-sm max-w-[300px] truncate block" title={e.notes ?? ""}>
            {e.notes ?? ""}
          </span>
        ),
        sortValue: (e) => e.notes,
      },
      {
        key: "evidence",
        header: "Evidence",
        cell: (e) => {
          const parts: string[] = [];
          if (e.evidence?.type) parts.push(`Type: ${e.evidence.type}`);
          if (e.evidence?.reference) parts.push(`Ref: ${e.evidence.reference}`);
          if (e.evidence?.attachedAt) parts.push(`Attached: ${new Date(e.evidence.attachedAt).toLocaleString()}`);
          return <span className="text-sm">{parts.join(" | ")}</span>;
        },
        sortValue: (e) => e.evidence?.attachedAt ?? "",
      },
    ];
  }, []);

  const total = payouts.length;
  const withEvidenceNotes = filtered.length;

  return (
    <Page>
      <PageHeader
        title="Auditor Evidence Pack"
        description="Filter and export complete payout history with evidence and notes for audit purposes. (R10 PU-03)"
        icon={TrendingUp}
        actions={
          <Button variant="outline" size="sm" onClick={() => {}} disabled={false}>
            Export CSV
          </Button>
        }
      />
      <PageContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard label="Total Payouts" value={total} icon={DollarSign} tone="positive" />
          <MetricCard label="With Evidence/Notes" value={withEvidenceNotes} icon={AlertTriangle} tone={withEvidenceNotes > 0 ? "warning" : "default"} />
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(e) => e.id}
              pageSize={25}
              searchableText={(e) => `${e.reference} ${e.traderName} ${e.tenantId}`}
              emptyTitle="No auditor-ready entries"
              emptyDescription="No payout entries with evidence or notes found."
            />
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}