"use client";

import { useMemo } from "react";
import { CalendarDays, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import {
  TerraAreaChart,
  TerraBadge,
  TerraCard,
  TerraProgress,
  TerraSectionTitle,
  formatMoney,
} from "@/components/terra/terra-ui";
import {
  DRAWDOWN_TYPES,
  DRAWDOWN_TYPE_LABEL,
  DRAWDOWN_TYPE_NOTE,
  configFor,
  equityFloorSeries,
  setDrawdownType,
  type ComplianceSnapshot,
  type ComplianceTrading,
  type DrawdownType,
} from "@/lib/compliance/compliance-store";
import { useAccountPause, activePauseFor } from "@/lib/account/account-pause-store";

/* ------------------------------------------------------------------ */
/* Consistency score                                                   */
/* ------------------------------------------------------------------ */

/** Best-day share of total profit vs the stored cap. */
export function ConsistencyScore({ snapshot }: { snapshot: ComplianceSnapshot }) {
  const { bestDayPct, capPct, headroomPct, ok } = snapshot.consistency;
  const pct = Math.min(100, (bestDayPct / Math.max(1, capPct)) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-on-surface">Consistency score</span>
        <span
          className={`font-headline text-sm font-bold tabular-nums ${ok ? "text-primary" : "text-error"}`}
        >
          {Math.round(bestDayPct)}% / {capPct}%
        </span>
      </div>
      <TerraProgress value={pct} height="h-2.5" />
      <p className="text-[11px] text-on-surface-variant">
        {ok
          ? `Best trading day is ${Math.round(headroomPct)}% under the cap.`
          : "Best day exceeds the cap — a payout or phase pass would fail this rule."}
      </p>
      <TerraBadge tone={ok ? "success" : "error"}>{ok ? "Within cap" : "Cap exceeded"}</TerraBadge>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trading days counter                                                */
/* ------------------------------------------------------------------ */

export function TradingDaysCounter({ snapshot }: { snapshot: ComplianceSnapshot }) {
  // R9 W5 UC-T9 — an in-force account pause freezes the day counter.
  const pauses = useAccountPause();
  const frozen = activePauseFor(snapshot.accountId, pauses);
  const days = snapshot.days;
  if (!days) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
          <CalendarDays className="h-4 w-4 text-on-surface-variant" aria-hidden />
          Trading days
        </span>
        <span className="font-headline text-sm font-bold tabular-nums text-on-surface">
          {days.current} / {days.target}
        </span>
      </div>
      <TerraProgress value={days.target > 0 ? Math.min(100, (days.current / days.target) * 100) : 100} height="h-2.5" />
      <p className="text-[11px] text-on-surface-variant">
        {frozen
          ? `Day counter frozen until ${new Date(frozen.until).toLocaleDateString()} — the pause stops the clock, it does not add days.`
          : days.met
            ? "Minimum met — every other rule can unlock the next step."
            : `${days.target - days.current} more active trading day${days.target - days.current === 1 ? "" : "s"} required.`}
      </p>
      {frozen ? (
        <TerraBadge tone="tertiary">⏸ Paused until {new Date(frozen.until).toLocaleDateString()}</TerraBadge>
      ) : (
        <TerraBadge tone={days.met ? "success" : "secondary"}>
          {days.met ? "Minimum met" : "In progress"}
        </TerraBadge>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payout readiness                                                    */
/* ------------------------------------------------------------------ */

/** All-green → "Payout eligible"; otherwise the outstanding count. */
export function PayoutReadiness({ snapshot }: { snapshot: ComplianceSnapshot }) {
  const p = snapshot.payout;
  const Icon = p.ready ? ShieldCheck : p.outstanding > 0 ? ShieldAlert : ShieldX;
  const copy = p.ready
    ? "Payout eligible"
    : !p.funded
      ? "Unlocks when funded"
      : `${p.outstanding} requirement${p.outstanding === 1 ? "" : "s"} outstanding`;
  const tone = p.ready ? "success" : !p.funded ? "secondary" : "tertiary";
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-on-surface">Payout readiness</span>
        <span className="font-headline text-sm font-bold tabular-nums text-on-surface">
          {formatMoney(p.withdrawable)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Icon
          className={`h-5 w-5 ${p.ready ? "text-primary" : !p.funded ? "text-on-surface-variant" : "text-tertiary"}`}
          aria-hidden
        />
        <TerraBadge tone={tone}>{copy}</TerraBadge>
      </div>
      <p className="text-[11px] text-on-surface-variant">
        {p.unmet.length > 0 ? `Open: ${p.unmet.slice(0, 2).join(" · ")}` : "Every payout rule checked live from your store."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Violation list                                                      */
/* ------------------------------------------------------------------ */

/** Computed rule breaks with detection timestamps (R7 I2). */
export function ViolationList({ snapshot }: { snapshot: ComplianceSnapshot }) {
  if (snapshot.violations.length === 0) {
    return (
      <p className="rounded-xl bg-primary-fixed/50 p-3 text-xs font-semibold text-on-primary-fixed-variant">
        ✓ No rule breaks recorded — evaluated live from your trading store (Demo).
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {snapshot.violations.map((v) => (
        <li
          key={v.id}
          className="flex flex-wrap items-start gap-3 rounded-xl border border-error/30 bg-error/5 p-3"
        >
          <TerraBadge tone={v.severity === "high" ? "error" : "tertiary"}>
            {v.type.replace("-", " ")}
          </TerraBadge>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-on-surface">{v.detail}</p>
            <p className="mt-0.5 text-[11px] text-on-surface-variant">
              Detected {new Date(v.at).toLocaleString("en-US", {
                month: "short",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              UTC
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Equity vs drawdown floor                                            */
/* ------------------------------------------------------------------ */

/** Equity curve with the stored model's floor line overlaid. */
export function EquityFloorChart({
  snapshot,
  trading,
  days = 14,
}: {
  snapshot: ComplianceSnapshot;
  trading: ComplianceTrading;
  days?: number;
}) {
  const { equity, floor } = useMemo(
    () => equityFloorSeries(snapshot, days, trading),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trading object identity changes per store read; the series is cheap and deterministic
    [snapshot, days, trading.closedTrades, trading.positions, trading.realizedByAccount],
  );
  const typeLabel = DRAWDOWN_TYPE_LABEL[snapshot.config.drawdownType];
  if (equity.length < 2) return null;
  return (
    <div className="mt-4">
      <TerraAreaChart
        data={equity}
        height={260}
        formatValue={(v) => formatMoney(v)}
        overlay={
          floor.length > 0
            ? {
                data: floor,
                label: `floor · ${typeLabel}`,
              }
            : undefined
        }
      />
      <p className="mt-2 text-[11px] text-on-surface-variant">
        The dashed line is your drawdown floor under the{" "}
        <span className="font-semibold text-on-surface">{typeLabel.toLowerCase()}</span> model —
        equity below it would breach. Today&apos;s floor {formatMoney(snapshot.total.floor)} sits{" "}
        {formatMoney(snapshot.total.buffer)} under equity.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compliance settings (drawdown model)                                */
/* ------------------------------------------------------------------ */

/**
 * The settings control for the stored drawdown model — changing it
 * re-renders the floor line, buffer gauge and meters everywhere
 * (persisted under pfaas:trader:compliance).
 */
export function ComplianceSettingsCard({ snapshot }: { snapshot: ComplianceSnapshot }) {
  const type = snapshot.config.drawdownType;
  return (
    <TerraCard>
      <TerraSectionTitle
        title="Compliance settings"
        description="Rule configuration stored per account in this browser (Demo)."
      />
      <label
        htmlFor="drawdown-type"
        className="text-xs font-semibold text-on-surface-variant"
      >
        Drawdown model
      </label>
      <select
        id="drawdown-type"
        value={type}
        onChange={(e) => setDrawdownType(snapshot.accountId, e.target.value as DrawdownType)}
        className="mt-1.5 w-full rounded-xl border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-sm font-bold text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {DRAWDOWN_TYPES.map((t) => (
          <option key={t} value={t}>
            {DRAWDOWN_TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[11px] leading-relaxed text-on-surface-variant">
        {DRAWDOWN_TYPE_NOTE[type]}
      </p>
      <p className="mt-2 text-[11px] text-on-surface-variant">
        Daily {snapshot.config.maxDailyLossPct}% · total {snapshot.config.maxTotalDrawdownPct}% ·
        target {snapshot.config.profitTargetPct}% · min {snapshot.config.minTradingDays} days ·
        consistency {snapshot.config.consistencyPct}%
      </p>
    </TerraCard>
  );
}
