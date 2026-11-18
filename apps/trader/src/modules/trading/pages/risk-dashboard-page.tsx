"use client";

/**
 * Risk Dashboard — compliance & payout-readiness rebuild (R7 I2).
 *
 * TradesViz/FTMO-class widgets, every figure computed from the
 * compliance + trading stores (no fixture arrays):
 *   • drawdown buffer gauge (distance to floor, color-shifted)
 *   • daily-loss tracker with the 00:00 UTC reset countdown
 *   • profit-target progress, consistency score, trading-days counter
 *   • payout-readiness indicator (all green → "Payout eligible")
 *   • violation list with detection timestamps (computed by
 *     lib/compliance/compliance-engine, persisted under
 *     pfaas:trader:compliance, surfaced to the inbox by the bridge)
 *   • equity-vs-drawdown-floor chart (floor shaped by the stored
 *     drawdown model — change it in Compliance settings and re-renders)
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraProgress,
  TerraSectionTitle,
  TerraStat,
  TerraDrawdownMeter,
  formatMoney,
} from "@/components/terra/terra-ui";
import { detectTerraPatterns } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";
import { useLifecycleLog } from "@pfaas/lifecycle";
import { useTrading } from "@/lib/trading/trading-context";
import { useComplianceSnapshot } from "@/lib/compliance/compliance-store";
import { versionLabelFromId } from "@/lib/rules/rules-store";
import {
  BufferGauge,
} from "@/components/compliance/buffer-gauge";
import {
  ComplianceSettingsCard,
  ConsistencyScore,
  EquityFloorChart,
  PayoutReadiness,
  TradingDaysCounter,
  ViolationList,
} from "@/components/compliance/compliance-widgets";

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
  // Compliance follows the active trading account (header switcher).
  const { activeAccount: acc } = useActiveAccount();
  const { positions, closedTrades, realizedByAccount } = useTrading();
  const snapshot = useComplianceSnapshot(acc.id);
  const lifecycleEvents = useLifecycleLog();
  const operatorWarnings = lifecycleEvents.filter(
    (e) => e.name === "risk.alert.raised" && (e.entity?.id === acc.id || e.payload?.accountId === acc.id),
  );
  const trading = useMemo(
    () => ({ positions, closedTrades, realizedByAccount }),
    [positions, closedTrades, realizedByAccount],
  );

  // Live countdown to the 00:00 UTC reset (tick every second). Starts as
  // null until mounted — the SSR text and first client render must match
  // (a `Date.now()`-derived string in the initial render hydrates wrong
  // whenever the second ticks over between server and client).
  const [untilReset, setUntilReset] = useState<number | null>(null);
  useEffect(() => {
    setUntilReset(msUntilUtcMidnight());
    const t = setInterval(() => setUntilReset(msUntilUtcMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  // Exposure — open positions from the trading store, not fixtures.
  const accPositions = positions.filter((p) => p.accountId === acc.id);
  // Mock margin model: $1,000 margin per standard lot.
  const marginUsed = accPositions.reduce((s, p) => s + p.lots * 1000, 0);
  const openLots = accPositions.reduce((s, p) => s + p.lots, 0);

  // Pattern detections — the same derivation the Pattern Monitor screen
  // uses, so the two surfaces can never disagree.
  const patterns = useMemo(() => detectTerraPatterns(closedTrades), [closedTrades]);
  const patternCounts = useMemo(
    () => ({
      copy: patterns.filter((p) => p.kind === "copy").length,
      inverse: patterns.filter((p) => p.kind === "inverse").length,
      weekend: patterns.filter((p) => p.kind === "weekend").length,
    }),
    [patterns],
  );

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <TerraPageHeader title="Risk Dashboard" description={`${acc.name} • Login #${acc.login}`} />
        <TerraCard>
          <p className="text-sm text-on-surface-variant">Loading compliance standing…</p>
        </TerraCard>
      </div>
    );
  }

  const dailyPct = snapshot.daily.usedPct;
  const ddPct = snapshot.total.usedPct;
  const breachLevel = snapshot.equityToday - snapshot.daily.remaining;
  const cushionPct =
    snapshot.equityToday > 0
      ? Math.round((snapshot.daily.remaining / snapshot.equityToday) * 1000) / 10
      : 0;
  const violations = snapshot.violations;

  const riskScore =
    dailyPct >= 70 || ddPct >= 70
      ? { grade: "C", sub: "Elevated risk", tone: "negative" as const }
      : dailyPct >= 50 || ddPct >= 50
        ? { grade: "B", sub: "Moderate risk", tone: undefined }
        : { grade: "A", sub: "Low risk", tone: "positive" as const };
  const limitsHealthy =
    acc.status !== "breached" &&
    violations.length === 0 &&
    dailyPct < 70 &&
    ddPct < 70 &&
    snapshot.total.bufferPct >= 20;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Risk Dashboard"
        description={`${acc.name} • Login #${acc.login} • compliance & payout readiness`}
        actions={
          <>
            {/* R9 W1 — which published rule version these numbers are
                computed from (ComplianceConfig.ruleVersionId). */}
            <TerraBadge tone="neutral">
              {versionLabelFromId(snapshot.config.ruleVersionId) ?? "Rules v1"} enforced
            </TerraBadge>
            <TerraBadge tone={limitsHealthy ? "primary" : "error"} dot pulse={limitsHealthy}>
              {limitsHealthy
                ? "All limits healthy"
                : violations.length > 0
                  ? `${violations.length} rule violation${violations.length === 1 ? "" : "s"}`
                  : "Limits need attention"}
            </TerraBadge>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Gauges + chart + violations */}
        <div className="space-y-6 lg:col-span-2">
          <TerraCard>
            <TerraSectionTitle
              title="Drawdown protection"
              description={
                untilReset === null
                  ? "Daily allowance resets at 00:00 UTC."
                  : `Daily allowance resets at 00:00 UTC — ${fmtCountdown(untilReset)} remaining.`
              }
            />
            <div className="space-y-5">
              <BufferGauge snapshot={snapshot} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TerraDrawdownMeter
                  label="Daily loss limit"
                  used={snapshot.daily.used}
                  limit={snapshot.daily.limit}
                  remaining={snapshot.daily.remaining}
                  description={snapshot.daily.resetNote}
                />
                <TerraDrawdownMeter
                  label="Maximum drawdown"
                  used={snapshot.total.used}
                  limit={snapshot.total.limit}
                  remaining={snapshot.total.buffer}
                  description={snapshot.config.drawdownType.replace(/-/g, " ")}
                />
              </div>
              <p className="rounded-xl bg-secondary-fixed/60 p-3 text-xs text-on-secondary-fixed-variant">
                Breach level: equity {formatMoney(breachLevel)} — if account equity falls to that
                level the daily loss limit is hit. Current cushion{" "}
                {formatMoney(snapshot.daily.remaining)} ({cushionPct}% of equity).
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-on-surface">{snapshot.profit.name}</span>
                  <span className="tabular-nums text-primary">{snapshot.profit.pct}%</span>
                </div>
                <TerraProgress value={snapshot.profit.pct} height="h-3" />
                <div className="flex justify-between text-[11px] text-on-surface-variant">
                  <span>
                    {formatMoney(snapshot.profit.current)} of {formatMoney(snapshot.profit.target)}
                  </span>
                  <span>target {snapshot.config.profitTargetPct}% of start</span>
                </div>
              </div>
            </div>
          </TerraCard>

          {/* Equity vs drawdown floor — the floor follows the stored model */}
          <TerraCard>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-headline font-semibold text-on-surface">
                  Equity vs drawdown floor
                </h3>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  Last 14 days — the floor line is the level that breaches the total drawdown
                  rule.
                </p>
              </div>
              <TerraBadge tone={snapshot.total.bufferPct < 20 ? "error" : "secondary"}>
                Buffer {Math.round(snapshot.total.bufferPct)}%
              </TerraBadge>
            </div>
            <EquityFloorChart snapshot={snapshot} trading={trading} days={14} />
          </TerraCard>

          {/* Violations — computed by the compliance engine, persisted */}
          <TerraCard>
            <TerraSectionTitle
              title="Rule violations"
              description="Computed from your trading store the moment a rule breaks — each one also arrives in your inbox."
            />
            <ViolationList snapshot={snapshot} />
          </TerraCard>
        </div>

        {/* Side summary */}
        <div className="space-y-6">
          <ComplianceSettingsCard snapshot={snapshot} />

          <TerraCard>
            <TerraSectionTitle title="Rule standing" description="Live from the same stores as Objectives." />
            <div className="space-y-5">
              <ConsistencyScore snapshot={snapshot} />
              <TradingDaysCounter snapshot={snapshot} />
              <PayoutReadiness snapshot={snapshot} />
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle title="Exposure" description={`${accPositions.length} open positions (live)`} />
            <div className="grid grid-cols-2 gap-4">
              <TerraStat label="Margin Used" value={formatMoney(marginUsed)} />
              <TerraStat label="Margin Free" value={formatMoney(Math.max(0, snapshot.equityToday - marginUsed))} tone="positive" />
              <TerraStat label="Open Lots" value={openLots.toFixed(1)} />
              <TerraStat label="Risk Score" value={riskScore.grade} tone={riskScore.tone} sub={riskScore.sub} />
            </div>
          </TerraCard>

          <TerraCard>
            <TerraSectionTitle
              title="Pattern monitoring"
              description="Trades checked across your linked accounts — copy, inverse and weekend entries."
            />
            <div className="flex flex-wrap gap-2">
              <TerraBadge tone={patternCounts.copy > 0 ? "error" : "success"}>
                {patternCounts.copy} copy
              </TerraBadge>
              <TerraBadge tone={patternCounts.inverse > 0 ? "error" : "success"}>
                {patternCounts.inverse} inverse
              </TerraBadge>
              <TerraBadge tone={patternCounts.weekend > 0 ? "error" : "success"}>
                {patternCounts.weekend} weekend
              </TerraBadge>
            </div>
            <Link
              href="/trading-patterns"
              className="mt-4 block rounded-xl border border-outline-variant/60 bg-surface-container-low px-4 py-2.5 text-center text-xs font-bold text-on-surface hover:bg-surface-container"
            >
              Review detections &amp; how to avoid them
            </Link>
          </TerraCard>

          <TerraCard className="bg-primary-fixed/40">
            <h3 className="font-headline font-bold text-on-primary-fixed-variant">Risk tips</h3>
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

      {/* R7 I5 — operator warnings panel fed by risk.alert.raised events. */}
      <TerraCard>
        <TerraSectionTitle title="Operator warnings" />
        {operatorWarnings.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No operator warnings for this account. (Demo)</p>
        ) : (
          <ul className="space-y-2">
            {operatorWarnings.map((w) => (
              <li key={w.id} className="rounded-xl border border-outline-variant/40 bg-surface-container px-3 py-2 text-sm">
                <div className="font-medium">{String(w.payload?.ruleName ?? "Risk rule")}</div>
                <div className="text-xs text-on-surface-variant">{String(w.payload?.detail ?? "")}</div>
                <div className="text-[10px] text-on-surface-variant">{new Date(w.at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </TerraCard>
    </div>
  );
}
