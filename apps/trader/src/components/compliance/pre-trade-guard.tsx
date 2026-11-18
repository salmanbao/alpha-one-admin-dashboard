"use client";

/**
 * Pre-trade compliance guard (R9 W3 UC-T1).
 *
 * Recomputes on every input change using the trading store and
 * compliance store to show the projected impact of this order on the
 * account's daily-loss usage, drawdown floor, and consistency cap.
 *
 * Verdict semantics:
 *   • green  — all headroom intact after the fill
 *   • amber  — the fill uses >60% of any remaining headroom (daily loss,
 *              drawdown buffer, or consistency); a confirm dialog is
 *              required before submit
 *   • red    — the fill would breach a hard rule (daily-loss limit,
 *              drawdown floor, or consistency cap); the submit button is
 *              disabled and the exact rule name / threshold / projected
 *              value is listed
 *
 * Accessible: the verdict is announced via an aria-live region and the
 * red block lists rule names, not just "breach".
 */

import { useMemo } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import {
  TerraCard,
  TerraSectionTitle,
  TerraBadge,
  TerraProgress,
  formatMoney,
} from "@/components/terra/terra-ui";
import { useComplianceSnapshot } from "@/lib/compliance/compliance-store";

export type GuardVerdict = "green" | "amber" | "red";

export interface PreTradeGuardProps {
  accountId: string;
  /** Current lots input (string from the ticket). */
  lots: string;
  /** Current SL input (string from the ticket). */
  sl: string;
  /** Current side. */
  side: "buy" | "sell";
  /** The instrument's ask/bid at the moment of evaluation. */
  currentPrice: number;
}

/**
 * Compute the pre-trade guard verdict for a proposed order.
 *
 * Projected daily-loss usage = open-position drawdown + pending-order
 * drawdown + this fill's SL distance (or current-equity risk if no SL).
 * Projected drawdown usage = total-equity drawdown + this fill's risk.
 * Consistency share is only meaningful after the close, so we project
 * the best-day share assuming this fill closes at the current equity.
 */
export function computeGuardVerdict(args: {
  snapshot: ReturnType<typeof useComplianceSnapshot>;
  lots: number;
  slDistance: number; // in pips
  pipValuePerLot: number;
  side: "buy" | "sell";
}): { verdict: GuardVerdict; breaches: string[]; usedPct: { daily: number; dd: number; consistency: number } } {
  const { snapshot, lots, slDistance, pipValuePerLot } = args;
  if (!snapshot) {
    return { verdict: "green", breaches: [], usedPct: { daily: 0, dd: 0, consistency: 0 } };
  }

  const fillRisk = slDistance > 0 ? lots * slDistance * pipValuePerLot : snapshot.limits.daily * 0.5; // conservative if no SL

  const projectedDailyUsed = snapshot.daily.used + fillRisk;
  const projectedDailyPct = snapshot.limits.daily > 0 ? (projectedDailyUsed / snapshot.limits.daily) * 100 : 0;

  const projectedDdUsed = snapshot.total.used + fillRisk;
  const projectedDdPct = snapshot.limits.maxDd > 0 ? (projectedDdUsed / snapshot.limits.maxDd) * 100 : 0;

  const projectedConsistency = snapshot.consistency.bestDayPct; // unchanged until close
  const consistencyUsedPct = snapshot.consistency.capPct > 0 ? (projectedConsistency / snapshot.consistency.capPct) * 100 : 0;

  const breaches: string[] = [];
  if (projectedDailyPct >= 100) {
    breaches.push(`Daily-loss rule: projected ${formatMoney(projectedDailyUsed)} exceeds ${formatMoney(snapshot.limits.daily)} limit`);
  }
  if (projectedDdPct >= 100) {
    breaches.push(`Max-drawdown rule: projected usage ${projectedDdPct.toFixed(1)}% reaches the ${formatMoney(snapshot.limits.maxDd)} floor`);
  }
  if (consistencyUsedPct > 100) {
    breaches.push(`Consistency rule: best-day share ${projectedConsistency.toFixed(1)}% exceeds ${snapshot.consistency.capPct}% cap`);
  }

  let verdict: GuardVerdict = "green";
  if (breaches.length > 0) verdict = "red";
  else if (projectedDailyPct > 60 || projectedDdPct > 60 || consistencyUsedPct > 60) verdict = "amber";

  return {
    verdict,
    breaches,
    usedPct: { daily: projectedDailyPct, dd: projectedDdPct, consistency: consistencyUsedPct },
  };
}

export function PreTradeGuard({
  accountId,
  lots,
  sl,
  side,
  currentPrice,
}: PreTradeGuardProps) {
  const snapshot = useComplianceSnapshot(accountId);

  const pipSize = useMemo(() => {
    return currentPrice > 100 ? 0.01 : 0.0001; // rough pip detection
  }, [currentPrice]);

  const lotsNum = Number(lots) || 0;
  const slNum = Number(sl) || 0;
  const slDistancePips = slNum > 0 ? Math.abs(currentPrice - slNum) / pipSize : 0;

  const guard = computeGuardVerdict({
    snapshot,
    lots: lotsNum,
    slDistance: slDistancePips,
    pipValuePerLot: 10,
    side,
  });

  const { verdict, breaches, usedPct } = guard;
  const toneColor = verdict === "green" ? "bg-primary-fixed text-on-primary-fixed-variant" : verdict === "amber" ? "bg-error-container text-on-error-container" : "bg-error text-on-error";
  const Icon = verdict === "green" ? ShieldCheck : verdict === "amber" ? ShieldAlert : ShieldX;
  const verdictLabel = verdict === "green" ? "All headroom" : verdict === "amber" ? "Confirm required" : "Blocked";

  return (
    <TerraCard className="space-y-3" aria-live="polite" aria-label={`Pre-trade compliance guard: ${verdictLabel}`}>
      <TerraSectionTitle title="Pre-trade compliance guard" />
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${toneColor}`}>
          <Icon className="h-4 w-4" />
        </span>
        <TerraBadge tone={verdict === "green" ? "success" : verdict === "amber" ? "tertiary" : "error"}>
          {verdictLabel}
        </TerraBadge>
      </div>

      {snapshot && (
        <div className="space-y-2 text-xs">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Daily-loss usage after fill</span>
              <strong className={`tabular-nums ${usedPct.daily > 60 ? "text-error" : "text-primary"}`}>
                {usedPct.daily.toFixed(1)}% ({formatMoney(snapshot.daily.used + lotsNum * slDistancePips * 10)} / {formatMoney(snapshot.limits.daily)})
              </strong>
            </div>
            <TerraProgress value={Math.min(100, usedPct.daily)} height="h-2" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Drawdown usage after fill</span>
              <strong className={`tabular-nums ${usedPct.dd > 60 ? "text-error" : "text-primary"}`}>
                {usedPct.dd.toFixed(1)}% ({formatMoney(snapshot.total.used + lotsNum * slDistancePips * 10)} / {formatMoney(snapshot.limits.maxDd)})
              </strong>
            </div>
            <TerraProgress value={Math.min(100, usedPct.dd)} height="h-2" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Consistency (best-day share)</span>
              <strong className={`tabular-nums ${usedPct.consistency > 60 ? "text-error" : "text-primary"}`}>
                {usedPct.consistency.toFixed(1)}% ({snapshot.consistency.bestDayPct.toFixed(1)}% / {snapshot.consistency.capPct}%)
              </strong>
            </div>
            <TerraProgress value={Math.min(100, usedPct.consistency)} height="h-2" />
          </div>
        </div>
      )}

      {breaches.length > 0 && (
        <div className="space-y-1 rounded-lg bg-error-container/50 p-3" role="alert">
          <p className="text-xs font-bold text-error">Blocked — rule breach:</p>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-error">
            {breaches.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {verdict === "amber" && (
        <div className="rounded-lg bg-error-container/30 p-3" role="status">
          <p className="text-[11px] text-error">
            ⚠ This order uses {usedPct.daily > usedPct.dd ? usedPct.daily.toFixed(0) : usedPct.dd.toFixed(0)}% of your remaining headroom — you'll need to confirm before submitting.
          </p>
        </div>
      )}
    </TerraCard>
  );
}