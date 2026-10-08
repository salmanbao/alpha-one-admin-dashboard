"use client";

/**
 * Order Detail — converted from stitch_screens/order_detail
 * Pending order summary with modify/cancel actions.
 */

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
          <button
            type="button"
            className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Modify Order
          </button>
          <button
            type="button"
            className="rounded-xl bg-error-container px-5 py-3 text-sm font-bold text-on-error-container hover:bg-error-container/80"
          >
            Cancel Order
          </button>
          <p className="text-center text-[11px] text-on-surface-variant">
            Orders execute automatically when price reaches the trigger.
          </p>
        </TerraCard>
      </div>
    </div>
  );
}
