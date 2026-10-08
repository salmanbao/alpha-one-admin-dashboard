"use client";

/**
 * Invoice Detail — converted from stitch_screens/invoice_detail
 * Invoice view with line items and download.
 */

import { useSearchParams } from "next/navigation";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";

export function InvoiceDetailPage() {
  const params = useSearchParams();
  const id = params.get("id")?.replace("ord-", "") ?? "48210";

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title={`Invoice INV-2026-${id}`}
        description="Paid • Terra Pro $100K challenge"
        actions={
          <>
            <TerraBadge tone="success">Paid</TerraBadge>
            <button
              type="button"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
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
                <p className="font-semibold text-on-surface">Terra Pro $100K — Two-Phase Evaluation</p>
                <p className="text-xs text-on-surface-variant">Order #TT-{id} • 2026-10-02</p>
              </div>
              <span className="font-bold tabular-nums text-on-surface">{formatMoney(549)}</span>
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
              <span>Total</span>
              <span>{formatMoney(549)}</span>
            </div>
          </div>
        </TerraCard>

        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Billed to" />
            <div className="text-sm text-on-surface-variant">
              <p className="font-semibold text-on-surface">Tom Allen</p>
              <p>tom.allen@terra.trader</p>
              <p>United States</p>
            </div>
          </TerraCard>
          <TerraCard>
            <TerraSectionTitle title="Payment" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Method</span>
                <span className="font-semibold text-on-surface">Card •••• 4242</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Paid on</span>
                <span className="text-on-surface">2026-10-02</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Transaction</span>
                <span className="font-mono text-xs text-on-surface">pi_3Nx4k…9f2</span>
              </div>
            </div>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
