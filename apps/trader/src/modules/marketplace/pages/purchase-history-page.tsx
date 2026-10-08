"use client";

/**
 * Purchase History — converted from stitch_screens/purchase_history
 * Table of past challenge purchases with invoices.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";

const purchases = [
  {
    id: "ord-48210",
    program: "Terra Pro $100K",
    date: "2026-10-02",
    amount: 549,
    method: "Card •••• 4242",
    status: "completed",
  },
  {
    id: "ord-47190",
    program: "Terra Flash Instant $25K",
    date: "2026-08-18",
    amount: 299,
    method: "USDT (TRC-20)",
    status: "completed",
  },
  {
    id: "ord-45501",
    program: "Terra Starter $25K",
    date: "2026-05-30",
    amount: 149,
    method: "Card •••• 4242",
    status: "completed",
  },
  {
    id: "ord-44877",
    program: "Terra Pro $50K",
    date: "2026-05-14",
    amount: 299,
    method: "Card •••• 4242",
    status: "refunded",
  },
];

export function PurchaseHistoryPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Purchase History"
        description="All challenge purchases and their invoices"
        actions={
          <Link
            href="/marketplace"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            + New Challenge
          </Link>
        }
      />
      <TerraCard>
        <TerraTable
          head={["Order", "Program", "Date", "Amount", "Method", "Status", "Invoice"]}
          rows={purchases.map((p) => [
            <span key="o" className="font-mono text-xs font-bold">
              #{p.id.replace("ord-", "")}
            </span>,
            p.program,
            p.date,
            <span key="a" className="font-bold tabular-nums">
              {formatMoney(p.amount)}
            </span>,
            p.method,
            p.status === "completed" ? (
              <TerraBadge key="s" tone="success">
                Completed
              </TerraBadge>
            ) : (
              <TerraBadge key="s" tone="neutral">
                Refunded
              </TerraBadge>
            ),
            <Link
              key="i"
              href={`/invoice-detail?id=${p.id}`}
              className="text-xs font-bold text-primary hover:underline"
            >
              View
            </Link>,
          ])}
        />
      </TerraCard>
    </div>
  );
}
