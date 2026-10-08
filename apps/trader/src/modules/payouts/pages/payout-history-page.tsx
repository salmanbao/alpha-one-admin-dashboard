"use client";

/**
 * Payout History — converted from stitch_screens/payout_history
 * History of payouts with status timeline.
 */

import Link from "next/link";
import { TerraBadge, TerraCard, TerraPageHeader, TerraTable, formatMoney } from "@/components/terra/terra-ui";
import { terraPayouts } from "@/lib/fixtures/terra-fixtures";

export function PayoutHistoryPage() {
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
            <Link key="ref" href={`/payout-detail?id=${p.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
              {p.reference}
            </Link>,
            <span key="acc" className="font-mono text-xs text-on-surface-variant">#{p.accountLogin}</span>,
            <span key="amt" className="font-bold tabular-nums">{formatMoney(p.amount)}</span>,
            <span key="meth">{p.method}</span>,
            <span key="status">
              <TerraBadge tone={p.status === "paid" ? "success" : "tertiary"}>{p.status}</TerraBadge>
            </span>,
            <span key="req">{p.requestedAt.slice(0, 10)}</span>,
            <span key="exp">{p.expectedAt.slice(0, 10)}</span>,
          ])}
        />
      </TerraCard>
    </div>
  );
}
