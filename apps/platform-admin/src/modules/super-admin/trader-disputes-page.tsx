"use client";

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { usePayouts } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";
import { Download, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function TraderDisputesPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();
  const [focusedTenant, setFocusedTenant] = useState<string | null>(null);
  const [focusedPayoutId, setFocusedPayoutId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const inFlight = useMemo(() =>
    payouts.filter((p) => ["pending", "approved", "processing", "on-hold"].includes(p.status)),
    [payouts],
  );

  const stalePayouts = useMemo(() =>
    inFlight.filter((p) => ageDays(p.createdAt) >= 7),
    [inFlight],
  );

  const disputeCandidates = useMemo(() => stalePayouts, [stalePayouts]);

  const columns: Column<any>[] = useMemo(() => {
    return [
      {
        key: "reference",
        header: "Reference",
        cell: (e) => <span className="font-mono text-xs">{e.reference}</span>,
      },
      {
        key: "tenant",
        header: "Tenant",
        cell: (e) => <span className="text-sm font-medium">{e.tenantName ?? e.tenantId}</span>,
        sortValue: (e) => e.tenantName ?? e.tenantId,
      },
      {
        key: "trader",
        header: "Trader",
        cell: (e) => <span className="text-sm">{e.traderName}</span>,
        sortValue: (e) => e.traderName,
      },
      {
        key: "amount",
        header: "Amount",
        numeric: true,
        cell: (e) => <span className="font-mono text-sm tabular-nums">{formatCurrency(e.amount, e.currency)}</span>,
        sortValue: (e) => e.amount,
      },
      {
        key: "ageDays",
        header: "Age (days)",
        numeric: true,
        cell: (e) => <span className={`font-mono text-sm ${ageDays(e.createdAt) >= 14 ? "text-rose-600" : ""}`}>\n{ageDays(e.createdAt)}d\n</span>,
        sortValue: (e) => ageDays(e.createdAt),
      },
      {
        key: "actions",
        header: "Actions",
        cell: (e) => (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-1 text-[10px]"
              onClick={() => {
                setFocusedPayoutId(e.id);
                setFocusedTenant(e.tenantId ?? "");
                setDisputeReason("");
              }}
            >
              Dispute
            </Button>
          </div>
        ),
      },
    ];
  }, []);

  const totalStale = disputeCandidates.length;

  return (
    <Page>
      <PageHeader
        title="Trader Disputes"
        description="Trader disputes a payout (amount, split percentage or non-arrival) and escalates beyond the tenant firm; the platform operator must adjudicate cross-tenant. (R10 PU-01)"
        icon={AlertTriangle}
        actions={
          <Button variant="outline" size="sm" onClick={() => {}} disabled={false}>
            Export CSV
          </Button>
        }
      />
      <PageContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard label="Stale In-Flight" value={totalStale} icon={AlertTriangle} tone={totalStale > 0 ? "warning" : "default"} />
          <MetricCard label="Focused Tenant" value={focusedTenant ?? "None"} icon={Download} tone="default" />
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={disputeCandidates}
              rowKey={(e) => e.id}
              pageSize={20}
              searchableText={(e) => `${e.reference} ${e.traderName} ${e.tenantId}`}
              emptyTitle="No dispute candidates"
              emptyDescription="No stale in-flight payouts found."
            />
          </CardContent>
        </Card>

        {focusedTenant && (
          <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p className="font-medium mb-1 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" /> Adjudicate Dispute
            </p>
            <p className="text-sm mb-2">Tenant: {focusedTenant}</p>
            <p className="text-sm mb-2">Reason: <span className="font-mono">{disputeReason}</span></p>
            <div className="grid gap-2">
              <Button
                variant="default"
                onClick={() => {
                  setFocusedTenant(null);
                  setFocusedPayoutId(null);
                  setDisputeReason("");
                }}
              >
                Resolve
              </Button>
              <Button variant="outline" onClick={() => setFocusedTenant(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </PageContent>
    </Page>
  );
}