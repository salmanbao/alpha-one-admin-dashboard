"use client";

/**
 * Objectives — converted from stitch_screens/objectives_progress
 * Evaluation objectives with progress bars and status badges.
 *
 * Audit #3 fix #3: added a rule-adherence risk panel — minimum trading
 * days counter, consistency-rule meter, breach-proximity warnings, and a
 * composite risk score with educational tooltips, so traders see their
 * full rule standing (not just drawdown) next to profit progress.
 */

import { useMemo } from "react";
import {
  TerraBadge,
  TerraCard,
  TerraDrawdownMeter,
  TerraPageHeader,
  TerraProgress,
  formatMoney,
} from "@/components/terra/terra-ui";
import { objectivesFor, terraRiskLimits } from "@/lib/fixtures/terra-fixtures";
import { useActiveAccount } from "@/lib/platform/account-context";

/* ------------------------------------------------------------------ */
/* Rule adherence panel (audit #3 fix #3)                              */
/* ------------------------------------------------------------------ */

/** Composite risk score (0–100, higher = healthier standing). */
function riskScore(parts: {
  dailyPct: number;
  maxDdPct: number;
  consistencyHeadroomPct: number; // 0 = at the cap
  minDaysPct: number;
}): number {
  // Weighted: drawdown usage dominates (50%), then consistency (30%),
  // then min-days progress bonus (20% — being under-min is a real risk).
  const ddHealth = 100 - (parts.dailyPct * 0.5 + parts.maxDdPct * 0.5);
  const consHealth = Math.max(0, Math.min(100, parts.consistencyHeadroomPct));
  const daysHealth = Math.min(100, parts.minDaysPct * 100);
  return Math.round(Math.max(0, Math.min(100, ddHealth * 0.5 + consHealth * 0.3 + daysHealth * 0.2)));
}

function scoreTone(score: number): { label: string; cls: string; dot: string } {
  if (score >= 75) return { label: "Healthy", cls: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
  if (score >= 50) return { label: "Watch", cls: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
  return { label: "At risk", cls: "text-rose-600 dark:text-rose-400", dot: "bg-rose-500" };
}

function RuleRow({
  title,
  tooltip,
  value,
  caption,
  meterPct,
  meterTone,
  warn,
}: {
  title: string;
  tooltip: string;
  value: string;
  caption: string;
  meterPct: number;
  meterTone: "success" | "warning" | "danger";
  warn?: string;
}) {
  const toneCls =
    meterTone === "success"
      ? "bg-emerald-500"
      : meterTone === "warning"
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="flex items-center gap-1 text-xs font-semibold text-on-surface"
          title={tooltip}
        >
          {title}
          <span
            aria-hidden
            className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border text-[8px] font-bold text-on-surface-variant"
            title={tooltip}
          >
            ?
          </span>
        </span>
        <span className="font-headline text-sm font-bold tabular-nums text-on-surface">{value}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-surface-container-high">
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${toneCls}`}
          style={{ width: `${Math.max(2, Math.min(100, meterPct))}%` }}
          role="progressbar"
          aria-valuenow={Math.round(meterPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${title}: ${value}`}
        />
      </div>
      <p className="text-[11px] text-on-surface-variant">{caption}</p>
      {warn ? (
        <p className="flex items-start gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
          <span aria-hidden>⚠</span> {warn}
        </p>
      ) : null}
    </div>
  );
}

export function ObjectivesPage() {
  // Objectives are scoped to the account currently selected in the header
  // switcher — the header copy follows it so the trader always knows which
  // account's targets they are reviewing. Funded accounts get payout /
  // scaling objectives instead of a Phase 1 profit target.
  const { activeAccount } = useActiveAccount();
  const objectives = objectivesFor(activeAccount.id);
  const completed = objectives.filter((o) => o.status === "complete").length;
  // Persistent drawdown meters (audit #6) — daily + total risk usage for
  // the selected account, always visible above the objectives list.
  const limits = terraRiskLimits[activeAccount.id] ?? { daily: 1000, maxDd: 5000 };
  const dailyUsed = Math.max(0, limits.daily - activeAccount.dailyLossRemaining);
  const ddUsed = Math.max(0, limits.maxDd - activeAccount.maxDdRemaining);

  // Rule adherence metrics (audit #3 fix #3) — min days, consistency,
  // and a composite score computed from the same objective data.
  const adherence = useMemo(() => {
    const minDays = objectives.find((o) => o.id === "obj-min-days");
    const consistency = objectives.find((o) => o.id === "obj-consistency");
    // Funded accounts have neither rule (scaling objectives instead) —
    // hide the rows rather than rendering a phantom "0 / 4".
    const hasMinDays = Boolean(minDays);
    const hasConsistency = Boolean(consistency);
    const daysCurrent = minDays?.current ?? 0;
    const daysTarget = Math.max(1, minDays?.target ?? 4);
    const bestDay = consistency?.current ?? 0;
    const consCap = Math.max(1, consistency?.target ?? 45);
    const dailyPct = limits.daily > 0 ? (dailyUsed / limits.daily) * 100 : 0;
    const maxDdPct = limits.maxDd > 0 ? (ddUsed / limits.maxDd) * 100 : 0;
    const consHeadroom = ((consCap - bestDay) / consCap) * 100;
    const minDaysPct = hasMinDays ? daysCurrent / daysTarget : 1;
    const score = riskScore({
      dailyPct,
      maxDdPct,
      consistencyHeadroomPct: hasConsistency ? consHeadroom : 100,
      minDaysPct,
    });
    return { hasMinDays, hasConsistency, daysCurrent, daysTarget, bestDay, consCap, dailyPct, maxDdPct, consHeadroom, score };
  }, [objectives, limits, dailyUsed, ddUsed]);

  const tone = scoreTone(adherence.score);
  const daysMet = adherence.daysCurrent >= adherence.daysTarget;
  const consWarn =
    adherence.consHeadroom <= 10
      ? `Best trading day is ${Math.round(adherence.bestDay)}% of total profit — breaching the ${adherence.consCap}% consistency cap would fail the evaluation.`
      : undefined;
  const ddWarn =
    adherence.dailyPct >= 80
      ? `Daily loss limit is ${Math.round(adherence.dailyPct)}% consumed — one more adverse day could breach the account.`
      : undefined;

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Objectives Progress"
        description={`${activeAccount.name} • Login #${activeAccount.login} • ${
          activeAccount.phase === "Funded"
            ? "funded account objectives"
            : `${activeAccount.phase} evaluation objectives`
        }`}
        actions={
          <TerraBadge tone="primary">
            {completed}/{objectives.length} complete
          </TerraBadge>
        }
      />

      {/* Drawdown meters — the two limits that end evaluations */}
      <TerraCard>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TerraDrawdownMeter
            label="Daily loss limit"
            used={dailyUsed}
            limit={limits.daily}
            remaining={activeAccount.dailyLossRemaining}
            description="resets at 5pm ET"
          />
          <TerraDrawdownMeter
            label="Maximum drawdown"
            used={ddUsed}
            limit={limits.maxDd}
            remaining={activeAccount.maxDdRemaining}
            description="trailing — never resets"
          />
        </div>
      </TerraCard>

      {/* Rule adherence — min days, consistency, risk score (audit #3 fix #3) */}
      <TerraCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-headline font-semibold text-on-surface">Rule Adherence</h3>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Everything that can fail this evaluation besides drawdown — tracked live.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-surface-container-high bg-surface-container-low px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden />
            <span className="text-xs font-semibold text-on-surface">Risk score</span>
            <span className={`font-headline text-lg font-bold tabular-nums ${tone.cls}`}>
              {adherence.score}
            </span>
            <span className="text-xs text-on-surface-variant">/100 · {tone.label}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-3">
          {adherence.hasMinDays ? (
            <RuleRow
              title="Minimum trading days"
              tooltip="Most programs require a minimum number of active trading days before a funded transition or payout. Days with no closed trades don't count."
              value={`${adherence.daysCurrent} / ${adherence.daysTarget}`}
              caption={
                daysMet
                  ? "Minimum met — you can request a payout / phase change once other rules pass."
                  : `${adherence.daysTarget - adherence.daysCurrent} more active trading day${
                      adherence.daysTarget - adherence.daysCurrent === 1 ? "" : "s"
                    } required.`
              }
              meterPct={(adherence.daysCurrent / adherence.daysTarget) * 100}
              meterTone={daysMet ? "success" : "warning"}
            />
          ) : null}
          {adherence.hasConsistency ? (
            <RuleRow
              title="Consistency rule"
              tooltip="Your best trading day must stay below the cap as a share of total profit. A single outsized day can fail an otherwise passing evaluation."
              value={`${Math.round(adherence.bestDay)}% / ${adherence.consCap}%`}
              caption={`Headroom: ${Math.max(0, Math.round(adherence.consHeadroom))}% before the consistency cap.`}
              meterPct={100 - adherence.consHeadroom}
              meterTone={adherence.consHeadroom <= 10 ? "danger" : adherence.consHeadroom <= 30 ? "warning" : "success"}
              warn={consWarn}
            />
          ) : null}
          <RuleRow
            title="Daily loss proximity"
            tooltip="How much of today's loss allowance is consumed. Resets at 5pm ET. Touching the limit ends the account immediately."
            value={`${Math.round(adherence.dailyPct)}% used`}
            caption={`${formatMoney(activeAccount.dailyLossRemaining)} remaining today.`}
            meterPct={adherence.dailyPct}
            meterTone={adherence.dailyPct >= 80 ? "danger" : adherence.dailyPct >= 50 ? "warning" : "success"}
            warn={ddWarn}
          />
        </div>
      </TerraCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {objectives.map((obj) => {
          const pct =
            obj.status === "complete"
              ? 100
              : obj.target > 0
                ? Math.min(100, (obj.current / obj.target) * 100)
                : 0;
          return (
            <TerraCard key={obj.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-headline font-semibold text-on-surface">{obj.name}</h3>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{obj.description}</p>
                </div>
                {obj.status === "complete" ? (
                  <TerraBadge tone="success">Complete</TerraBadge>
                ) : (
                  <TerraBadge tone="primary">On Track</TerraBadge>
                )}
              </div>
              {obj.target > 0 && (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="font-headline text-2xl font-bold tabular-nums text-on-surface">
                      {obj.unit === "USD"
                        ? formatMoney(obj.current)
                        : `${obj.current}${obj.unit === "%" ? "%" : ""}`}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      of{" "}
                      {obj.unit === "USD"
                        ? formatMoney(obj.target)
                        : `${obj.target}${obj.unit === "%" ? "%" : ""}`}
                    </span>
                  </div>
                  <TerraProgress value={pct} height="h-3" />
                </>
              )}
              {obj.target === 0 && (
                <div className="rounded-xl bg-primary-fixed/50 px-3 py-2 text-xs font-semibold text-on-primary-fixed-variant">
                  ✓ No violations recorded
                </div>
              )}
            </TerraCard>
          );
        })}
      </div>
    </div>
  );
}
