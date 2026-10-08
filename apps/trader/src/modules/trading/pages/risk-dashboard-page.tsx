"use client";

/**
 * Risk Dashboard — converted from stitch_screens/risk_dashboard
 * Account health meters, breach history and live risk gauges.
 */

import Link from "next/link";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraSectionTitle,
  TerraStat,
  TerraProgress,
  TerraTable,
  formatMoney,
} from "@/components/terra/terra-ui";
import { primaryAccount, traderBreachesFallback } from "@/lib/fixtures/terra-fixtures";

const breaches = traderBreachesFallback;

export function RiskDashboardPage() {
  const acc = primaryAccount;
  const dailyUsedPct = 40; // demo: 40% of daily allowance used
  const ddUsedPct = 21.5;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Risk Dashboard"
        description={`${acc.name} • Login #${acc.login}`}
        actions={
          <TerraBadge tone="primary" dot pulse>
            All limits healthy
          </TerraBadge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gauges */}
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle title="Drawdown protection" />
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-on-surface">Daily loss allowance</span>
                  <span className="tabular-nums text-on-surface-variant">
                    {formatMoney(acc.dailyLossRemaining)} remaining
                  </span>
                </div>
                <TerraProgress value={dailyUsedPct} height="h-3" />
                <div className="flex justify-between text-[11px] text-on-surface-variant">
                  <span>{dailyUsedPct}% used</span>
                  <span>Limit {formatMoney(3000)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-on-surface">Maximum drawdown</span>
                  <span className="tabular-nums text-on-surface-variant">
                    {formatMoney(acc.maxDdRemaining)} remaining
                  </span>
                </div>
                <TerraProgress value={ddUsedPct} height="h-3" />
                <div className="flex justify-between text-[11px] text-on-surface-variant">
                  <span>{ddUsedPct}% used</span>
                  <span>Limit {formatMoney(8000)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-on-surface">Profit target progress</span>
                  <span className="tabular-nums text-primary">
                    {acc.targetProgress}%
                  </span>
                </div>
                <TerraProgress value={acc.targetProgress} height="h-3" />
              </div>
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Risk breaches" description="Recent limit events on your accounts" />
            {breaches.length > 0 ? (
              <TerraTable
                head={["Type", "Severity", "Description", "Status"]}
                rows={breaches.map((b) => [
                  <span key="t" className="font-semibold">{b.type}</span>,
                  <TerraBadge
                    key="s"
                    tone={b.severity === "high" ? "error" : b.severity === "medium" ? "tertiary" : "neutral"}
                  >
                    {b.severity}
                  </TerraBadge>,
                  <span key="d" className="text-on-surface-variant">{b.description}</span>,
                  <TerraBadge key="st" tone={b.status === "resolved" ? "success" : "secondary"}>
                    {b.status}
                  </TerraBadge>,
                ])}
              />
            ) : (
              <p className="text-sm text-on-surface-variant">No breaches recorded.</p>
            )}
          </TerraCard>
        </div>

        {/* Side summary */}
        <div className="space-y-6">
          <TerraCard>
            <TerraSectionTitle title="Exposure" />
            <div className="grid grid-cols-2 gap-4">
              <TerraStat label="Margin Used" value="$1,800" />
              <TerraStat label="Margin Free" value="$8,200" tone="positive" />
              <TerraStat label="Open Lots" value="2.9" />
              <TerraStat label="Risk Score" value="A" tone="positive" sub="Low risk" />
            </div>
          </TerraCard>
          <TerraCard className="bg-primary-fixed/40">
            <h3 className="font-headline font-bold text-on-primary-fixed-variant">
              Risk tips
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-on-surface-variant">
              <li>• Keep daily risk under 2% per trade.</li>
              <li>• Move stops to breakeven after +1R.</li>
              <li>• Stop trading after 2 daily stop-outs.</li>
              <li>• Check the economic calendar before news windows.</li>
            </ul>
            <Link
              href="/risk-consultation"
              className="mt-4 block rounded-xl bg-primary px-4 py-2.5 text-center text-xs font-bold text-on-primary hover:bg-primary/90"
            >
              Book a risk consultation
            </Link>
          </TerraCard>
        </div>
      </div>
    </div>
  );
}
