"use client";

/**
 * Referral Dashboard — converted from stitch_screens/referral_dashboard
 * Referral stats, shareable code and referral history.
 */

import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";
import { referralHistory, referralStats } from "@/lib/fixtures/terra-fixtures";

export function ReferralDashboardPage() {
  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Referral Dashboard"
        description="Invite traders and earn from every challenge they buy"
        actions={<TerraBadge tone="primary">{referralStats.rate}</TerraBadge>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Total Referrals" value={referralStats.referrals} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Active" value={referralStats.active} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Earned" value={formatMoney(referralStats.earned)} tone="positive" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Pending" value={formatMoney(referralStats.pending)} />
        </TerraCard>
      </div>

      <TerraCard className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Your referral code
          </p>
          <p className="font-headline text-2xl font-bold tracking-widest text-primary">
            {referralStats.code}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(`https://terra.trader/r/${referralStats.code}`)}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
          >
            Copy link
          </button>
          <button
            type="button"
            className="rounded-xl bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Share
          </button>
        </div>
      </TerraCard>

      <TerraCard>
        <TerraSectionTitle title="Referral history" />
        <TerraTable
          head={["User", "Joined", "Status", "Reward"]}
          rows={referralHistory.map((r) => [
            <span key="w" className="font-mono text-xs font-semibold">{r.who}</span>,
            r.joined.slice(0, 10),
            <TerraBadge key="s" tone={r.status === "purchased" ? "primary" : "secondary"}>
              {r.status}
            </TerraBadge>,
            <span key="r" className={`font-bold tabular-nums ${r.reward > 0 ? "text-primary" : "text-on-surface-variant"}`}>
              {r.reward > 0 ? `+${formatMoney(r.reward)}` : "—"}
            </span>,
          ])}
        />
      </TerraCard>
    </div>
  );
}
