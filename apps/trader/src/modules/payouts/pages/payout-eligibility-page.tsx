"use client";

/**
 * Payout Eligibility — converted from stitch_screens/payout_eligibility
 * Eligibility checklist + next payout summary.
 */

import { TerraBadge, TerraCard, TerraPageHeader, TerraSectionTitle, TerraStat, formatMoney } from "@/components/terra/terra-ui";
import { primaryAccount, terraPayouts } from "@/lib/fixtures/terra-fixtures";

const checklist = [
  { label: "Account active and in good standing", ok: true, note: "Verified" },
  { label: "Minimum balance > $1,000", ok: true, note: `${primaryAccount.balance} balance` },
  { label: "P&L is positive since last payout", ok: true, note: `+${primaryAccount.pnl}` },
  { label: "No open risk breaches", ok: true, note: "Clear" },
  { label: "Payout method configured", ok: true, note: "Bank Transfer (Wise)" },
  { label: "Bi-weekly window is open", ok: true, note: "Next window opens in 4 days" },
];

export function PayoutEligibilityPage() {
  const last = terraPayouts[0];
  const availableSince = primaryAccount.payoutNote ? "Available in 4 days" : "Aware 14 days";

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Payout Eligibility"
        description={`${primaryAccount.name} • Login #${primaryAccount.login}`}
        actions={
          <>
            <TerraBadge tone="primary">Eligible</TerraBadge>
            <TerraBadge tone="success" dot>
              Payout window open
            </TerraBadge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Eligibility checklist" />
            <div className="space-y-3">
              {checklist.map((c) => (
                <div key={c.label} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{c.label}</p>
                    <p className="text-xs text-on-surface-variant">{c.note}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${c.ok ? "bg-primary-fixed text-on-primary-fixed-variant" : "bg-error-container text-on-error-container"}`}>
                    {c.ok ? "✓" : "✗"}
                  </span>
                </div>
              ))}
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Recent payouts" />
            <div className="space-y-2">
              {terraPayouts.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl bg-surface-container-low px-4 py-3 text-sm">
                  <div>
                    <p className="font-bold text-on-surface">{p.reference}</p>
                    <p className="text-xs text-on-surface-variant">{p.requestedAt.slice(0, 10)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-on-surface">{formatMoney(p.amount)}</p>
                    <TerraBadge tone={p.status === "paid" ? "success" : "tertiary"}>{p.status}</TerraBadge>
                  </div>
                </div>
              ))}
            </div>
          </TerraCard>
        </div>

        <TerraCard className="flex flex-col gap-4">
          <TerraSectionTitle title="Next payout" />
          <div className="space-y-3 rounded-xl bg-surface-container-low p-4">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Eligible amount</span>
              <span className="font-bold text-on-surface">{formatMoney(primaryAccount.balance)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Recommended</span>
              <span className="font-bold text-primary">{formatMoney(primaryAccount.pnl)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Status</span>
              <TerraBadge tone="primary">{availableSince}</TerraBadge>
            </div>
          </div>
          <button type="button" className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-primary/90">
            Open Payout
          </button>
        </TerraCard>
      </div>
    </div>
  );
}
