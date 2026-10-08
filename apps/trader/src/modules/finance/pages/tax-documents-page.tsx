"use client";

/**
 * Tax Documents — converted from stitch_screens/tax_documents
 * Tax report list with year selector.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraTable,
} from "@/components/terra/terra-ui";

const taxDocs = [
  { id: "tx-2025-q3", year: "2025", period: "Q3", generated: "2025-10-01", profit: 8420, ready: true },
  { id: "tx-2025-q2", year: "2025", period: "Q2", generated: "2025-07-02", profit: 6180, ready: true },
  { id: "tx-2025-q1", year: "2025", period: "Q1", generated: "2025-04-03", profit: 4910, ready: true },
  { id: "tx-2024-q4", year: "2024", period: "Q4", generated: "2025-01-02", profit: 7250, ready: true },
];

export function TaxDocumentsPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Tax Documents"
        description="Generated tax statements for your trading profits"
        actions={<TerraBadge tone="neutral">For reference only — not tax advice</TerraBadge>}
      />

      <TerraCard>
        <TerraTable
          head={["Statement", "Year", "Period", "Net P&L", "Generated", "Action"]}
          rows={taxDocs.map((t) => [
            <span key="i" className="font-mono text-xs font-bold">{t.id}</span>,
            t.year,
            t.period,
            <span key="p" className="font-bold tabular-nums text-primary">
              +${t.profit.toLocaleString()}
            </span>,
            t.generated,
            <Link
              key="a"
              href={`/tax-statement-detail?id=${t.id}`}
              className="text-xs font-bold text-primary hover:underline"
            >
              Open
            </Link>,
          ])}
        />
      </TerraCard>
    </div>
  );
}
