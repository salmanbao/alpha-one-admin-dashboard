"use client";

/**
 * Risk-warning banner (R3-05 / AUDIT-R3 §6 item 5).
 *
 * Renders once the trader's remaining allowance is at or below the 30%
 * warning threshold — on the dashboard, the open-positions page and the
 * order ticket, wherever the account is being traded. Dismissing hides it
 * for the rest of the session (sessionStorage keyed by account); the
 * inbox message pushed by useRiskWarning is the non-dismissible record.
 */

import { useState } from "react";
import { cn } from "@pfaas/ui";
import { formatMoney } from "@/components/terra/terra-ui";
import { TerraBadge } from "@/components/terra/terra-ui";
import type { TerraAccount } from "@/lib/fixtures/terra-fixtures";
import { RISK_WARNING_THRESHOLD_PCT } from "@/lib/trading/risk-warning";

interface RiskWarningBannerProps {
  account: TerraAccount;
  /** % of the daily-loss allowance still remaining. */
  dailyPct: number;
  /** % of the max-drawdown allowance still remaining. */
  maxDdPct: number;
  /** Which allowance triggered the warning. */
  breach: "daily" | "maxDd" | null;
  limits: { daily: number; maxDd: number } | null;
}

export function RiskWarningBanner({
  account,
  dailyPct,
  maxDdPct,
  breach,
  limits,
}: RiskWarningBannerProps) {
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem(`pfaas:trader:risk-warning-dismissed:${account.id}`) === "1"
      : false,
  );
  if (dismissed) return null;

  const dailyLimit = limits?.daily ?? 0;
  const maxDdLimit = limits?.maxDd ?? 0;
  const metric = breach === "maxDd" ? "max drawdown" : "daily loss";
  const pct = breach === "maxDd" ? maxDdPct : dailyPct;
  const remaining = breach === "maxDd" ? account.maxDdRemaining : account.dailyLossRemaining;
  const cap = breach === "maxDd" ? maxDdLimit : dailyLimit;

  return (
    <div
      role="alert"
      aria-label="Risk warning"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-tertiary/50 bg-tertiary/40 p-4",
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
        <TerraBadge tone="tertiary" className="text-[10px]">
          WARNING
        </TerraBadge>
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Risk warning — {metric} limit
        </p>
        <p className="text-sm font-bold text-on-surface">
          {formatMoney(remaining)} remaining ({pct}% of the {formatMoney(cap)} allowance)
          {" — at or below the "}
          {RISK_WARNING_THRESHOLD_PCT}
          {"% warning threshold. Cut size or pause trading now — breaches are permanent."}
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss risk warning"
        onClick={() => {
          try {
            sessionStorage.setItem(`pfaas:trader:risk-warning-dismissed:${account.id}`, "1");
          } catch {
            /* sessionStorage unavailable — dismiss lasts this render only */
          }
          setDismissed(true);
        }}
        className="rounded-lg p-1.5 text-on-surface-variant/60 hover:bg-surface-container transition-colors"
      >
        <span className="sr-only">Dismiss</span>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
