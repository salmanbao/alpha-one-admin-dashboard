"use client";

/**
 * RiskContextPanel — shared payout-approval risk context (audit #1 fix).
 *
 * The payout approval queue needs risk context (recent breaches, risk
 * scores, account health metrics) next to the amount being approved.
 * This panel surfaces that context in a compact, scannable format:
 *
 *   • Risk score trend (0-100) with color-coded band
 *   • Recent breach count + severity breakdown
 *   • Account health metrics (equity vs balance, drawdown usage)
 *   • Quick link to the trader's risk profile for deep analysis
 *
 * Used in PayoutRejectDialog, PayoutQueueWidget, and EnhancedWithdrawals
 * Page so every payout decision surface carries the same risk context.
 */

import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/components/platform/status";

export interface PayoutTraderRisk {
  traderId: string;
  riskScore: number;
  riskTrend: "improving" | "stable" | "deteriorating";
  breaches: {
    total: number;
    open: number;
    critical: number;
    warning: number;
    recent: Array<{
      type: string;
      severity: string;
      triggeredAt: string;
      status: string;
    }>;
  };
  accountHealth: {
    equity: number;
    balance: number;
    dailyLossLimit: number;
    maxDrawdownLimit: number;
    dailyLossUsed: number;
    maxDrawdownUsed: number;
    consistencyScore: number;
  };
}

const RISK_BANDS = {
  0: { label: "Critical", color: "text-rose-600", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  30: { label: "High Risk", color: "text-orange-600", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  50: { label: "Moderate", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  70: { label: "Low Risk", color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  100: { label: "Very Low", color: "text-emerald-500", bg: "bg-emerald-500/5", border: "border-emerald-500/20" },
} as const;

function riskBand(score: number) {
  const bands = Object.keys(RISK_BANDS)
    .map(Number)
    .sort((a, b) => b - a);
  for (const threshold of bands) {
    if (score >= threshold) return RISK_BANDS[threshold as keyof typeof RISK_BANDS];
  }
  return RISK_BANDS[0];
}

function trendIcon(trend: string) {
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-label="Improving" />;
    case "deteriorating":
      return <TrendingDown className="h-3.5 w-3.5 text-rose-600" aria-label="Deteriorating" />;
    default:
      return <span className="h-3.5 w-3.5 inline-block" aria-label="Stable" />;
  }
}

function breachSeverityTone(severity: string) {
  return severity === "critical" ? "text-rose-600" : "text-amber-600";
}

function breachStatusLabel(status: string) {
  return status === "open" ? "Open" : "Resolved";
}

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RiskContextPanel({
  risk,
  currency = "USD",
  compact = false,
}: {
  risk: PayoutTraderRisk | undefined;
  currency?: string;
  compact?: boolean;
}) {
  if (!risk) return null;

  const band = riskBand(risk.riskScore);
  const hasOpenBreaches = risk.breaches.open > 0;
  const criticalOpen = risk.breaches.critical > 0 && risk.breaches.open > 0;
  const equityPct =
    risk.accountHealth.balance > 0
      ? ((risk.accountHealth.equity / risk.accountHealth.balance) * 100).toFixed(1)
      : "0";
  const dailyLossPct =
    risk.accountHealth.dailyLossLimit > 0
      ? ((risk.accountHealth.dailyLossUsed / risk.accountHealth.dailyLossLimit) * 100).toFixed(0)
      : "0";
  const maxDdPct =
    risk.accountHealth.maxDrawdownLimit > 0
      ? ((risk.accountHealth.maxDrawdownUsed / risk.accountHealth.maxDrawdownLimit) * 100).toFixed(0)
      : "0";

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <span className={cn("font-semibold tabular-nums", band.color)}>
          {risk.riskScore}
        </span>
        <span className="text-muted-foreground">risk</span>
        {trendIcon(risk.riskTrend)}
        {hasOpenBreaches && (
          <span className={cn("flex items-center gap-0.5", criticalOpen ? "text-rose-600" : "text-amber-600")}>
            <AlertTriangle className="h-3 w-3" />
            {risk.breaches.open}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2.5 rounded-md border p-3", band.border, band.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-medium text-foreground">Risk Context</span>
        </div>
        <a
          href={`/risk/trader-risk-scoring?id=${risk.traderId}`}
          className="text-[11px] font-medium text-primary hover:text-primary/80"
        >
          View full risk profile →
        </a>
      </div>

      {/* Risk Score + Trend */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: band.bg }}>
          <span className={cn("text-sm font-bold", band.color)}>{risk.riskScore}</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className={cn("text-xs font-semibold", band.color)}>{band.label}</span>
            {trendIcon(risk.riskTrend)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Risk score {risk.riskScore}/100 · {risk.riskTrend}
          </div>
        </div>
      </div>

      {/* Breach Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded bg-background/50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Open Breaches</div>
          <div className="flex items-center gap-1">
            <span className={cn("text-sm font-bold", hasOpenBreaches ? breachSeverityTone(risk.breaches.critical > 0 ? "critical" : "warning") : "text-emerald-600")}>
              {risk.breaches.open}
            </span>
            <span className="text-[10px] text-muted-foreground">
              of {risk.breaches.total}
            </span>
          </div>
        </div>
        <div className="rounded bg-background/50 p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Critical / Warning</div>
          <div className="text-sm font-bold tabular-nums">
            <span className="text-rose-600">{risk.breaches.critical}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="text-amber-600">{risk.breaches.warning}</span>
          </div>
        </div>
      </div>

      {/* Account Health */}
      <div className="space-y-1.5 rounded bg-background/50 p-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Equity</span>
          <span className="font-medium tabular-nums">
            {formatCurrency(risk.accountHealth.equity, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-medium tabular-nums">
            {formatCurrency(risk.accountHealth.balance, currency)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Daily Loss Used</span>
          <span className={cn("font-medium tabular-nums", parseInt(dailyLossPct) > 80 ? "text-rose-600" : parseInt(dailyLossPct) > 50 ? "text-amber-600" : "text-emerald-600")}>
            {dailyLossPct}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Max Drawdown Used</span>
          <span className={cn("font-medium tabular-nums", parseInt(maxDdPct) > 80 ? "text-rose-600" : parseInt(maxDdPct) > 50 ? "text-amber-600" : "text-emerald-600")}>
            {maxDdPct}%
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Consistency</span>
          <span className={cn("font-medium tabular-nums", risk.accountHealth.consistencyScore < 50 ? "text-rose-600" : risk.accountHealth.consistencyScore < 75 ? "text-amber-600" : "text-emerald-600")}>
            {risk.accountHealth.consistencyScore}%
          </span>
        </div>
      </div>

      {/* Recent Breaches (if any) */}
      {risk.breaches.recent.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Recent Breaches
          </div>
          {risk.breaches.recent.slice(0, 3).map((b, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", b.severity === "critical" ? "bg-rose-500" : "bg-amber-500")} />
                <span className="text-muted-foreground">{b.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{formatTimeAgo(b.triggeredAt)}</span>
                <span className={b.status === "open" ? "text-rose-600" : "text-emerald-600"}>
                  {breachStatusLabel(b.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warning Callout if Open Critical Breaches */}
      {criticalOpen && (
        <div className="flex items-center gap-1.5 rounded border border-rose-500/30 bg-rose-500/5 p-2 text-[11px] text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="font-medium">Open critical breach detected — review before approving payout.</span>
        </div>
      )}
    </div>
  );
}
