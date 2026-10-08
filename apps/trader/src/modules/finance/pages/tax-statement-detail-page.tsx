"use client";

/**
 * Tax Statement Detail — converted from stitch_screens/tax_statement_detail
 * Single tax statement with summary and per-month breakdown.
 */

import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatSignedMoney,
} from "@/components/terra/terra-ui";

const monthly = [
  { month: "July 2025", trades: 42, pnl: 1980, fees: -64 },
  { month: "August 2025", trades: 38, pnl: 2410, fees: -58 },
  { month: "September 2025", trades: 44, pnl: 4094, fees: -71 },
];

export function TaxStatementDetailPage() {
  const params = useSearchParams();
  const id = params.get("id") ?? "tx-2025-q3";
  const totalPnl = monthly.reduce((s, m) => s + m.pnl, 0);
  const totalFees = monthly.reduce((s, m) => s + m.fees, 0);

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Tax Statement — ${id.toUpperCase()}`}
        description="Net performance summary for the period"
        actions={
          <>
            <TerraBadge tone="success">Generated</TerraBadge>
            <button
              type="button"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
            >
              Download PDF
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Net P&L" value={formatSignedMoney(totalPnl)} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Fees & Commission" value={formatSignedMoney(totalFees)} tone="negative" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Total Trades" value={monthly.reduce((s, m) => s + m.trades, 0)} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Taxable Estimate" value={formatSignedMoney(totalPnl + totalFees)} tone="positive" />
        </TerraCard>
      </div>

      <TerraCard>
        <TerraSectionTitle title="Monthly breakdown" />
        <TerraTable
          head={["Month", "Trades", "Net P&L", "Fees", "Net"]}
          rows={monthly.map((m) => [
            m.month,
            m.trades,
            <span key="p" className="font-bold tabular-nums text-primary">
              {formatSignedMoney(m.pnl)}
            </span>,
            <span key="f" className="tabular-nums text-error">
              {formatSignedMoney(m.fees)}
            </span>,
            <span key="n" className="font-bold tabular-nums">
              {formatSignedMoney(m.pnl + m.fees)}
            </span>,
          ])}
        />
      </TerraCard>

      <p className="text-xs text-on-surface-variant">
        This statement is provided for informational purposes only and does not constitute tax advice.
        Consult a qualified professional for your jurisdiction.
      </p>
    </div>
  );
}
