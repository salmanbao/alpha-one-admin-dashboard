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
import { usePurchaseOrders, useFeeRefundSync } from "@/lib/purchases-store";

export function PurchaseHistoryPage() {
  const orders = usePurchaseOrders();
  // R9 W2 UC-T6 — a paid payout settles the challenge fee for its
  // program; the flip persists here and emits the lifecycle receipt.
  useFeeRefundSync();

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

      {/* R9 W2 UC-T6 — fee-back ledger: first-class record of challenge
          fees settled by a paid payout (one writer: purchases-store). */}
      {orders.some((o) => o.feeRefund) && (
        <TerraCard>
          <p className="px-4 pt-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Fee refund ledger
          </p>
          <ul className="space-y-2 px-4 pb-4 pt-2">
            {orders
              .filter((o) => o.feeRefund)
              .map((o) => (
                <li
                  key={o.orderId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-container p-3 text-sm"
                >
                  <span>
                    <span className="font-bold text-on-surface">{o.program}</span>{" "}
                    <span className="text-on-surface-variant">
                      — challenge fee {formatMoney(o.amount, o.currency)}
                      {o.feeRefund?.status === "refunded" ? (
                        <>
                          {" "}refunded with payout{" "}
                          <span className="font-mono font-bold text-on-surface">
                            {o.feeRefund.payoutId}
                          </span>
                        </>
                      ) : (
                        " — refunded with your first payout on a funded account"
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <TerraBadge tone={o.feeRefund?.status === "refunded" ? "success" : "tertiary"}>
                      {o.feeRefund?.status === "refunded" ? "Fee refunded" : "Pending first payout"}
                    </TerraBadge>
                    <span className="text-xs text-on-surface-variant">
                      {(o.feeRefund?.refundedAt ?? o.createdAt).slice(0, 10)} (Demo)
                    </span>
                  </span>
                </li>
              ))}
          </ul>
        </TerraCard>
      )}
    </div>
  );
}
