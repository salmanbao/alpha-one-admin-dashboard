"use client";

/**
 * Risk Dashboard — converted from stitch_screens/risk_dashboard
 * Account health meters, breach history and live risk gauges.
 *
 * P1 upgrades: gauges follow the live session (TradingContext positions
 * feed margin), and the daily-loss panel shows the time until the
 * 00:00 UTC reset plus the equity level at which the limit breaches.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
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
import {
  traderBreachesFallback,
  terraRiskLimits,
} from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { useTrading } from "@/lib/trading/trading-context";

const breaches = traderBreachesFallback;

/** Milliseconds until the next 00:00 UTC daily-loss reset. */
function msUntilUtcMidnight() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

const fmtCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export function RiskDashboardPage() {
  // Risk gauges follow the active trading account (header switcher).
  const { activeAccount: acc } = useActiveAccount();
  const { positions } = useTrading();
  // Program limits come from the shared fixture so this page, the
  // objectives page and the rules page can never disagree.
  const limits = terraRiskLimits[acc.id] ?? { daily: 1000, maxDd: 5000 };
  const dailyUsedPct = Math.max(
    0,
    Math.round(((limits.daily - acc.dailyLossRemaining) / limits.daily) * 100),
  );
  const ddUsedPct = Math.max(
    0,
    Math.round(((limits.maxDd - acc.maxDdRemaining) / limits.maxDd) * 1000) / 10,
  );
  // Live exposure — open positions from the session, not the fixtures.
  const accPositions = positions.filter((p) => p.accountId === acc.id);
  // Mock margin model: $1,000 margin per standard lot.
  const marginUsed = accPositions.reduce((s, p) => s + p.lots * 1000, 0);
  const openLots = accPositions.reduce((s, p) => s + p.lots, 0);
  // Daily-loss breach level: equity at which the remaining allowance runs out.
  const breachLevel = acc.equity - acc.dailyLossRemaining;
  const cushionPct =
    acc.equity > 0
      ? Math.round((acc.dailyLossRemaining / acc.equity) * 1000) / 10
      : 0;

  // Live countdown to the 00:00 UTC reset (tick every second).
  const [untilReset, setUntilReset] = useState(() => msUntilUtcMidnight());
  useEffect(() => {
    const t = setInterval(() => setUntilReset(msUntilUtcMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  const riskScore =
    dailyUsedPct >= 70 || ddUsedPct >= 70
      ? { grade: "C", sub: "Elevated risk", tone: "negative" as const }
      : dailyUsedPct >= 50 || ddUsedPct >= 50
        ? { grade: "B", sub: "Moderate risk", tone: undefined }
        : { grade: "A", sub: "Low risk", tone: "positive" as const };
  const limitsHealthy = acc.status !== "breached" && dailyUsedPct < 70 && ddUsedPct < 70;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Risk Dashboard"
        description={`${acc.name} • Login #${acc.login}`}
        actions={
          <TerraBadge tone={limitsHealthy ? "primary" : "error"} dot pulse={limitsHealthy}>
            {limitsHealthy ? "All limits healthy" : "Limits need attention"}
          </TerraBadge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gauges */}
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle
              title="Drawdown protection"
              description={`Daily allowance resets at 00:00 UTC — ${fmtCountdown(untilReset)} remaining.`}
            />
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
                  <span>Limit {formatMoney(limits.daily)}</span>
                </div>
                <p className="rounded-xl bg-secondary-fixed/60 p-3 text-xs text-on-secondary-fixed-variant">
                  Breach level: equity {formatMoney(breachLevel)} — if account equity falls to
                  that level the daily loss limit is hit. Current cushion{" "}
                  {formatMoney(acc.dailyLossRemaining)} ({cushionPct}% of equity).
                </p>
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
                  <span>Limit {formatMoney(limits.maxDd)}</span>
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
            <TerraSectionTitle title="Exposure" description={`${accPositions.length} open positions (live)`} />
            <div className="grid grid-cols-2 gap-4">
              <TerraStat label="Margin Used" value={formatMoney(marginUsed)} />
              <TerraStat label="Margin Free" value={formatMoney(Math.max(0, acc.equity - marginUsed))} tone="positive" />
              <TerraStat label="Open Lots" value={openLots.toFixed(1)} />
              <TerraStat label="Risk Score" value={riskScore.grade} tone={riskScore.tone} sub={riskScore.sub} />
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
