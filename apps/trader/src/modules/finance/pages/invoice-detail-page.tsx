"use client";

/**
 * Invoice Detail — R5-H4 / R4-09 (store-backed line items).
 *
 * Reads the purchase record checkout wrote: program, amount, method and
 * date are the real order. An order refunded by the firm flips the
 * invoice to "Refunded" via the shared `purchase.refunded` event.
 * Deep-links without a store record fall back to the legacy sample —
 * honestly tagged "(demo)" so the fixture never passes as fact.
 */

import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import { toast } from "@/hooks/use-toast";
import { usePurchaseOrders, type PurchaseOrderView } from "@/lib/purchases-store";
import { useSession } from "@/lib/session-store";

export function InvoiceDetailPage() {
  const params = useSearchParams();
  const orderId = (params.get("orderId") ?? params.get("id")?.replace("ord-", "") ?? "48210").replace(/^TT-/, "");
  const orders = usePurchaseOrders();
  const session = useSession();

  const record = orders.find((o) => o.orderId === orderId);
  const refunded = record?.refunded ?? false;

  // Legacy sample only when the store has no such order (R5-H4).
  const sample: PurchaseOrderView | null = record
    ? null
    : {
        orderId,
        program: "Terra Pro $100K — Two-Phase Evaluation",
        challengeId: null,
        amount: 549,
        currency: "USD",
        method: "Card •••• 4242",
        applicantName: null,
        status: "completed",
        createdAt: "2026-10-02T00:00:00.000Z",
        refunded: false,
      };
  const line = record ?? sample;
  const program = line?.program ?? "Terra Pro $100K — Two-Phase Evaluation";
  const amount = line?.amount ?? 549;
  const currency = line?.currency ?? "USD";
  const method = line?.method ?? "Card •••• 4242";
  const purchasedAt = line
    ? new Date(line.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "2026-10-02";

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Invoice INV-2026-${orderId}`}
        description={
          record
            ? `Paid • ${program}`
            : `Paid • ${program} (demo — no stored order for this id)`
        }
        actions={
          <>
            <TerraBadge tone={refunded ? "neutral" : "success"}>
              {refunded ? "Refunded" : "Paid"}
            </TerraBadge>
            <button
              type="button"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
              onClick={() => {
                // Demo: show browser print dialog instead of opening a PDF
                toast({
                  title: "Download PDF",
                  description: "(demo — use your browser's Save as PDF)",
                });
                window.print();
              }}
            >
              Download PDF
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TerraCard className="lg:col-span-2">
          <TerraSectionTitle title="Line items" />
          <div className="space-y-3 text-sm">
            <div className="flex justify-between rounded-xl bg-surface-container-low px-4 py-3">
              <div>
                <p className="font-semibold text-on-surface">{program}</p>
                <p className="text-xs text-on-surface-variant">
                  Order #{record ? record.orderId : `TT-${orderId}`} • {purchasedAt}
                </p>
              </div>
              <span className="font-bold tabular-nums text-on-surface">
                {formatMoney(amount, currency)}
              </span>
            </div>
            <div className="flex justify-between px-4 py-2 text-on-surface-variant">
              <span>Processing fee</span>
              <span>{formatMoney(0)}</span>
            </div>
            <div className="flex justify-between px-4 py-2 text-on-surface-variant">
              <span>Tax (digital services)</span>
              <span>{formatMoney(0)}</span>
            </div>
            <div className="flex justify-between border-t border-outline-variant/40 px-4 pt-3 text-base font-bold text-on-surface">
              <span>{refunded ? "Refunded total" : "Total"}</span>
              <span className={refunded ? "text-on-surface-variant line-through" : undefined}>
                {formatMoney(amount, currency)}
              </span>
            </div>
            {refunded && (
              <p className="px-4 text-xs font-semibold text-on-surface-variant">
                Refunded on{" "}
                {new Date(record!.refundedAt!).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {record!.refundReason ? ` — ${record!.refundReason}` : ""}.
              </p>
            )}
          </div>
        </TerraCard>

        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Billed to" />
            <div className="text-sm text-on-surface-variant">
              <p className="font-semibold text-on-surface">
                {session?.displayName ?? "Tom Allen"}
              </p>
              <p>{session?.email ?? "tom.allen@terra.trader"}</p>
              <p>United States</p>
            </div>
          </TerraCard>
          <TerraCard>
            <TerraSectionTitle title="Payment" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Method</span>
                <span className="font-semibold text-on-surface">{method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Paid on</span>
                <span className="text-on-surface">{purchasedAt}</span>
              </div>
              {!record && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Transaction</span>
                  <span className="font-mono text-xs text-on-surface">pi_3Nx4k…9f2 (demo)</span>
                </div>
              )}
            </div>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
