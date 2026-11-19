"use client";

/**
 * R10-A4 — Add-On Entitlements (operator-facing).
 *
 * Operator view over `add-on-entitlements-store`:
 *   • Purchasable add-on catalog (express-payout, weekend-trading, etc.).
 *   • Per-account entitlement checks (`getPayoutGateEntitlements`).
 *   • Express payout eligibility (`checkExpressPayoutEligibility`).
 *   • 60s expiry sweep.
 *   • Consume entitlements (usesRemaining).
 *
 * Registered in the economics/challenges manifest + view-router; reachable via
 * direct link.
 */

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable } from "@/components/platform/data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  addAddOnProduct,
  getAddOnProducts,
  getAddOnStats,
  getPayoutGateEntitlements,
  getPurchases,
  purchaseAddOn,
  refundAddOn,
  useAddOnVersion,
} from "@/lib/add-on-entitlements-store";
import { usePlatform } from "@/lib/platform/platform-context";

export function AddOnEntitlementsPage() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  useAddOnVersion(); // re-render on any mutation

  const products = getAddOnProducts();
  const purchases = getPurchases();
  const stats = getAddOnStats();

  return (
    <Page>
      <PageHeader
        title="Add-On Entitlements"
        description="Purchasable add-on catalog with entitlement checks at payout time. The payout gate reads getPayoutGateEntitlements(traderId, accountId) for express-payout, weekend-trading, priority-support, custom-leverage, and extended-drawdown. 60s expiry sweep flips expired purchases."
        icon={ArrowLeft}
      />
      <PageContent>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Products" value={stats.totalProducts} />
          <MetricCard label="Active Products" value={stats.activeProducts} />
          <MetricCard label="Total Revenue" value={String(stats.totalRevenue)} />
          <MetricCard label="Active Entitlements" value={stats.activeEntitlements} />
        </div>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Add-On Catalog</h2>
          <DataTable
            columns={[
              { key: "name", header: "Name", cell: (p) => <span>{p.name}</span> },
              { key: "type", header: "Entitlement", cell: (p) => <span>{p.entitlementType}</span> },
              { key: "price", header: "Price", cell: (p) => <span>${p.price} ${p.currency}</span> },
              { key: "duration", header: "Duration (days)", cell: (p) => <span>{p.durationDays === 0 ? "lifetime" : String(p.durationDays)}</span> },
              { key: "uses", header: "Max Uses", cell: (p) => <span>{p.maxUses === 0 ? "∞" : String(p.maxUses)}</span> },
              { key: "phases", header: "Phases", cell: (p) => <span>{p.applicablePhases.join(", ")}</span> },
            ]}
            data={products}
            rowKey={(p) => p.id}
            pageSize={8}
          />
        </section>

        <section className="border rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold mb-3">Purchases</h2>
          <DataTable
            columns={[
              { key: "addOnName", header: "Add-On", cell: (p) => <span>{p.addOnName}</span> },
              { key: "traderId", header: "Trader", cell: (p) => <span>{p.traderId}</span> },
              { key: "status", header: "Status", cell: (p) => <span>{p.status}</span> },
              { key: "usesRemaining", header: "Uses Left", cell: (p) => <span>{String(p.usesRemaining)}</span> },
              { key: "expiresAt", header: "Expires", cell: (p) => <span>{p.expiresAt ?? "—"}</span> },
            ]}
            data={purchases}
            rowKey={(p) => p.id}
            pageSize={8}
          />
        </section>
      </PageContent>
    </Page>
  );
}