"use client";

import { useMemo, useState, useEffect } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { usePlatform } from "@/lib/platform/platform-context";
import { formatCurrency } from "@/components/platform/status";
import { useSavedViews } from "@/lib/platform/saved-views";
import { toast } from "@/hooks/use-toast";
import { applyPayoutDecision, effectivePayoutStatus } from "@/modules/payouts/payout-store";
import { payoutFraudBlock, usePayoutFraudFlags } from "@/lib/payout-fraud-store";
import { Wallet, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/platform/guards";
import { makeTermResolver } from "@/lib/platform/terminology";
import { getTenantPayouts } from "@/lib/platform/mock-data";
import type { Payout } from "@/lib/platform/mock-data";

export function FailedPayoutsQueuePage() {
  const { runtime, tenant, user } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const pays = (getTenantPayouts(tid) || []).map((p) => ({ ...p, status: effectivePayoutStatus(p) }));
  const failed = pays.filter((p) => p.status === "failed");

  const handleExport = () => {
    toast({
      title: "Export failed payouts",
      description: "Export functionality for failed payouts not yet implemented.",
      variant: "destructive",
    });
  };

  const handleRetry = (p: Payout) => {
    const result = applyPayoutDecision(p.reference, "processing", { providerTransactionId: `retry-${p.reference}` });
    if (result.ok) {
      toast({
        title: "Retry initiated",
        description: `Retry started for ${p.traderName}'s payout ${p.reference}`,
      });
    } else {
      toast({
        title: "Retry failed",
        description: `Cannot retry ${p.traderName}'s payout: ${result.reason}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Page>
      <PageHeader
        title={term("failed payouts queue")}
        description={`${failed.length} ${term("withdrawal")}s require attention`}
        icon={AlertTriangle}
      />
      <PageContent>
        <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2 bg-muted/20">
          Demo data: payout records shown here are illustrative.
        </p>

        <div className="flex items-center justify-between mb-4">
          <MetricCard
            label="Failed"
            value={failed.length}
            icon={AlertTriangle}
            tone="destructive"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
          >
            {term("Export CSV")}
          </Button>
        </div>

        {failed.length === 0 ? (
          <EmptyState
            title={term("no failed payouts")}
            description={term("All payouts are currently in good standing.")}
            icon={CheckCircle2}
          />
        ) : (
          <DataTable
            columns={[] as any}
            data={failed}
            rowKey={(p) => p.reference}
            searchableText={(p: Payout) => `${p.reference} ${p.traderName} ${p.status}`}
            emptyTitle="No failed payouts yet"
            emptyDescription="Failed payouts will appear here once payouts fail or are marked as such."
          />
        )}
      </PageContent>
    </Page>
  );
}

export default FailedPayoutsQueuePage;
