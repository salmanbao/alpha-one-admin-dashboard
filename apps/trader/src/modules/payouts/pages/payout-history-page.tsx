"use client";

/**
 * Payout History — converted from stitch_screens/payout_history
 * History of payouts with status timeline.
 */

import { useState } from "react";
import { TerraBadge, TerraCard, TerraPageHeader, TerraTable, formatMoney } from "@/components/terra/terra-ui";
import { terraPayouts } from "@/lib/fixtures/terra-fixtures";
import { DetailDialog } from "@/components/terra/detail-dialog";
import { PayoutDetailContent } from "./payout-detail-page";

export function PayoutHistoryPage() {
  // Quick-view overlay: clicking a reference opens the payout detail in
  // a dialog on top of the table — the history list is never left.
  const [quickPayoutId, setQuickPayoutId] = useState<string | null>(null);
  const quickPayout = quickPayoutId
    ? (terraPayouts.find((p) => p.id === quickPayoutId) ?? null)
    : null;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Payout History"
        description={`${terraPayouts.length} payouts • ${terraPayouts.filter((p) => p.status === "paid").length} paid`}
        actions={
          <TerraBadge tone="primary">
            Next payout: 4 days
          </TerraBadge>
        }
      />
      <TerraCard>
        <TerraTable
          head={["Reference", "Account", "Amount", "Method", "Status", "Requested", "Processed"]}
          rows={terraPayouts.map((p) => [
            <button
              key="ref"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setQuickPayoutId(p.id)}
              className="text-left font-mono text-xs font-bold text-primary hover:underline"
            >
              {p.reference}
            </button>,
            <span key="acc" className="font-mono text-xs text-on-surface-variant">#{p.accountLogin}</span>,
            <span key="amt" className="font-bold tabular-nums">{formatMoney(p.amount)}</span>,
            <span key="meth">{p.method}</span>,
            <span key="status">
              <TerraBadge tone={p.status === "paid" ? "success" : p.status === "rejected" ? "error" : "tertiary"}>{p.status}</TerraBadge>
            </span>,
            <span key="req">{p.requestedAt.slice(0, 10)}</span>,
            <span key="exp">{p.expectedAt.slice(0, 10)}</span>,
          ])}
        />
      </TerraCard>

      {/* Quick-view overlay — inspect a payout without leaving the table */}
      <DetailDialog
        open={quickPayout !== null}
        onOpenChange={(o) => {
          if (!o) setQuickPayoutId(null);
        }}
        title={quickPayout ? `Payout ${quickPayout.reference}` : "Payout detail"}
        description={
          quickPayout
            ? `#${quickPayout.accountLogin} • ${formatMoney(quickPayout.amount)} • ${quickPayout.method}`
            : undefined
        }
        fullPageHref={quickPayout ? `/payout-detail?id=${quickPayout.id}` : undefined}
      >
        {quickPayout && <PayoutDetailContent id={quickPayout.id} embedded />}
      </DetailDialog>
    </div>
  );
}
