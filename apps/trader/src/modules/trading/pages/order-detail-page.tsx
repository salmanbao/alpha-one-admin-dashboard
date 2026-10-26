"use client";

/**
 * Order Detail — converted from stitch_screens/order_detail
 * Pending order summary with modify/cancel actions.
 */

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
} from "@/components/terra/terra-ui";
import { terraOrders } from "@/lib/fixtures/terra-fixtures";

export function OrderDetailPage() {
  const params = useSearchParams();
  const order = terraOrders.find((o) => o.id === params.get("id")) ?? terraOrders[0];
  const [modifying, setModifying] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [newPrice, setNewPrice] = useState(String(order.price));
  const [modified, setModified] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const handleModify = () => {
    setModified(true);
    setModifying(false);
    setTimeout(() => setModified(false), 3000);
  };

  const handleCancel = () => {
    setCancelled(true);
    setConfirmCancel(false);
  };

  if (cancelled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
        <div className="rounded-full bg-error-container p-6">
          <span className="text-6xl">✓</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Order Cancelled</h2>
          <p className="mt-2 text-on-surface-variant">
            Order #{order.ticket} ({order.symbol}) has been cancelled.
          </p>
        </div>
        <a
          href="/order-ticket"
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          Place New Order
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Order #${order.ticket}`}
        description={`${order.symbol} • ${order.type}`}
        actions={<TerraBadge tone="tertiary">Pending</TerraBadge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Order parameters" />
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                ["Symbol", order.symbol],
                ["Type", order.type],
                ["Volume", `${order.lots.toFixed(2)} lots`],
                ["Trigger Price", String(order.price)],
                ["Stop Loss", String(order.sl)],
                ["Take Profit", String(order.tp)],
                ["Expiry", order.expiry],
                ["Placed", new Date(order.placedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })],
                ["Status", "Pending"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-surface-container-low p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {k}
                  </span>
                  <span className="text-sm font-bold text-on-surface">{v}</span>
                </div>
              ))}
            </div>
          </TerraCard>
        </div>

        <TerraCard className="flex flex-col gap-3">
          <TerraSectionTitle title="Actions" />
          {modified && (
            <div className="rounded-lg bg-primary-fixed/50 px-4 py-3 text-sm font-semibold text-on-primary-fixed-variant">
              ✓ Order modified successfully
            </div>
          )}
          {modifying ? (
            <div className="space-y-3 rounded-xl bg-surface-container-low p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  New Trigger Price
                </span>
                <input
                  type="number"
                  step="0.00001"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm tabular-nums outline-none focus:border-primary"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleModify}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setModifying(false)}
                  className="flex-1 rounded-xl bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
                >
                  Back
                </button>
              </div>
            </div>
          ) : confirmCancel ? (
            <div className="space-y-3 rounded-xl border border-error/40 bg-error-container/30 p-4">
              <p className="text-sm font-bold text-on-surface">Cancel this order?</p>
              <p className="text-xs text-on-surface-variant">Order #{order.ticket} will be permanently removed. This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 rounded-xl bg-error px-4 py-2.5 text-sm font-bold text-on-error hover:bg-error/90"
                >
                  Yes, Cancel Order
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 rounded-xl bg-surface-container px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container-high"
                >
                  Keep Order
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setModifying(true)}
                className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
              >
                Modify Order
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="rounded-xl bg-error-container px-5 py-3 text-sm font-bold text-on-error-container hover:bg-error-container/80"
              >
                Cancel Order
              </button>
            </>
          )}
          <p className="text-center text-[11px] text-on-surface-variant">
            Orders execute automatically when price reaches the trigger.
          </p>
        </TerraCard>
      </div>
    </div>
  );
}
