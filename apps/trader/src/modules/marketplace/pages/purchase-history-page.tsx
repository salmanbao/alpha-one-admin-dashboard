"use client";

/**
 * Purchase History — R4-09 (store-backed, fixtures removed).
 *
 * Rows come from purchases-store (checkout writes them) with the
 * prop-admin refund decision overlaid from the shared lifecycle bus —
 * an order refunded by the firm flips to "Refunded" here and on its
 * invoice without either app writing the other's slot.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";
import { usePurchaseOrders } from "@/lib/purchases-store";

export function PurchaseHistoryPage() {
  const orders = usePurchaseOrders();

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Purchase History"
        description="All challenge purchases and their invoices"
        actions={
          <Link
            href="/marketplace"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            + New Challenge
          </Link>
        }
      />
      <TerraCard>
        {orders.length === 0 ? (
          <p className="px-4 py-6 text-sm text-on-surface-variant">
            No purchases yet — completed checkouts appear here with their
            invoices.
          </p>
        ) : (
          <TerraTable
            head={["Order", "Program", "Date", "Amount", "Method", "Status", "Invoice"]}
            rows={orders.map((p) => [
              <span key="o" className="font-mono text-xs font-bold">
                #{p.orderId}
              </span>,
              p.program,
              new Date(p.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              }),
              <span key="a" className="font-bold tabular-nums">
                {formatMoney(p.amount, p.currency)}
              </span>,
              p.method,
              p.refunded ? (
                <TerraBadge key="s" tone="neutral">
                  Refunded
                </TerraBadge>
              ) : (
                <TerraBadge key="s" tone="success">
                  Completed
                </TerraBadge>
              ),
              <Link
                key="i"
                href={`/invoice-detail?orderId=${p.orderId}`}
                className="text-xs font-bold text-primary hover:underline"
              >
                View
              </Link>,
            ])}
          />
        )}
      </TerraCard>
    </div>
  );
}
