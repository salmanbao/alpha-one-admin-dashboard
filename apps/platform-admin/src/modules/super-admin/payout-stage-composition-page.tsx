"use client";

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/platform/data-table";
import { usePayouts } from "@/lib/platform/payout-store";
import { tenants as allTenants } from "@/lib/platform/mock-data";
import { formatCurrency } from "@/components/platform/status";
import { Download, Clock, TrendingUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

const STAGE_ORDER: string[] = ["request", "approved", "processing", "paid", "rejected", "cancelled", "on-hold", "failed"];

export function PayoutStageCompositionPage() {
  const { user } = usePlatform();
  const payouts = usePayouts();

  function stageKey(status: string): number {
    return STAGE_ORDER.indexOf(status);
  }

  const byStage = useMemo(() => {
    const map = new Map<string, { count: number; amount: number; tenants: Set<string> }>();
    for (const p of payouts) {
      const entry = map.get(p.status) ?? { count: 0, amount: 0, tenants: new Set<string>() };
      entry.count++;
      entry.amount += p.amount;
      entry.tenants.add(p.tenantId);
      map.set(p.status, entry);
    }
    return [...map.entries()];
  }, [payouts]);

  const total = payouts.length;
  const inFlight = payouts.filter((p) => ["request", "approved", "processing", "on-hold"].includes(p.status)).length;
  const completed = payouts.filter((p) => p.status === "paid" || p.status === "rejected" || p.status === "cancelled").length;

  const columns: Column<[string, { count: number; amount: number; tenants: Set<string> }]>[] = useMemo(() => {
    return [
      {
        key: "status",
        header: "Stage",
        cell: (e) => <span className="font-medium text-sm">{e[0]}</span>,
        sortValue: (e) => stageKey(e[0]),
      },
      {
        key: "count",
        header: "Count",
        numeric: true,
        cell: (e) => <span className="font-mono text-sm">{e[1].count}</span>,
        sortValue: (e) => e[1].count,
      },
      {
        key: "amount",
        header: "Amount",
        numeric: true,
        cell: (e) => <span className="font-mono text-sm tabular-nums">{formatCurrency(e[1].amount, "USD")}</span>,
        sortValue: (e) => e[1].amount,
      },
      {
        key: "tenantCount",
        header: "Tenants",
        numeric: true,
        cell: (e) => <span className="font-mono text-sm">{e[1].tenants.size}</span>,
        sortValue: (e) => e[1].tenants.size,
      },
    ];
  }, []);

  return (
    <Page>
      <PageHeader
        title="Payout Stage Composition"
        description="Request vs execution split: intake (trader asks), adjudication (firm approves) and execution (money moves) are separated for analysis. (R10 PW-10)"
        icon={Clock}
        actions={
          <Button variant="outline" size="sm" onClick={() => {}} disabled={false}>
            Export CSV
          </Button>
        }
      />
      <PageContent className="p-4">
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard label="Total Payouts" value={total} icon={DollarSign} tone="positive" />
          <MetricCard label="In-Flight" value={inFlight} icon={Clock} tone={inFlight > 0 ? "warning" : "default"} />
          <MetricCard label="Completed" value={completed} icon={TrendingUp} tone="positive" />
          <MetricCard label="Stage Types" value={byStage.length} icon={Download} tone="default" />
        </div>

        <Card>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={byStage.sort((a, b) => stageKey(a[0]) - stageKey(b[0]))}
              rowKey={(e) => e[0]}
              pageSize={20}
              emptyTitle="No payout data"
              emptyDescription="No payouts available to analyze."
            />
          </CardContent>
        </Card>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1 flex items-center gap-1">
            <Clock className="h-4 w-4" /> Stage Definitions
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>request:</strong> Initial intake — trader submits payout request.</li>
            <li><strong>approved:</strong> Adjudication — tenant firm approves the disbursement.</li>
            <li><strong>processing:</strong> Execution — payout is in-flight on the rail.</li>
            <li><strong>paid:</strong> Settlement — payout completed successfully.</li>
            <li><strong>rejected:</strong> Rail declined or operator decision.</li>
            <li><strong>cancelled:</strong> Operator voided the request before execution.</li>
            <li><strong>on-hold:</strong> Paused for compliance/KYC/AML review.</li>
            <li><strong>failed:</strong> Rail transfer failed.</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}