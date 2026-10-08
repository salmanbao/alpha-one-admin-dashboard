"use client";

/**
 * PFaaS Platform — Account Health Widget (UX Constitution §21)
 *
 * Unified view of account risk metrics:
 * - Daily Loss: current vs limit
 * - Maximum Drawdown: current vs limit
 * - Profit Target: current progress
 *
 * Each shows progress bar + status (Safe / At Risk / Critical / Progress)
 * This is the "consistent visual language throughout the trader experience"
 * that lets traders understand their state within seconds (§85).
 */

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingDown, ShieldAlert, Target, Info } from "lucide-react";
import { useState, type ComponentType } from "react";

interface HealthMetric {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  current: number;
  limit: number;
  unit: "currency" | "percent" | "raw";
  direction: "loss" | "gain";
  explanation: string;
  advancedDetails?: { label: string; value: string }[];
}

type HealthStatus = "safe" | "warning" | "critical" | "progress";

function computeStatus(metric: HealthMetric): HealthStatus {
  if (metric.direction === "gain") return "progress";
  const pct = (metric.current / metric.limit) * 100;
  if (pct >= 90) return "critical";
  if (pct >= 70) return "warning";
  return "safe";
}

const statusConfig: Record<HealthStatus, { label: string; color: string; barColor: string; badgeClass: string }> = {
  safe: { label: "Safe", color: "text-emerald-600 dark:text-emerald-400", barColor: "bg-emerald-500", badgeClass: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" },
  warning: { label: "At Risk", color: "text-amber-600 dark:text-amber-400", barColor: "bg-amber-500", badgeClass: "border-amber-500/40 text-amber-700 dark:text-amber-400" },
  critical: { label: "Critical", color: "text-rose-600 dark:text-rose-400", barColor: "bg-rose-500", badgeClass: "border-rose-500/40 text-rose-700 dark:text-rose-400" },
  progress: { label: "Progress", color: "text-teal-600 dark:text-teal-400", barColor: "bg-teal-500", badgeClass: "border-teal-500/40 text-teal-700 dark:text-teal-400" },
};

function formatValue(v: number, unit: HealthMetric["unit"], currency = "USD"): string {
  if (unit === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  if (unit === "percent") return `${v}%`;
  return v.toLocaleString("en-US");
}

function HealthMetricRow({ metric, currency = "USD" }: { metric: HealthMetric; currency?: string }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const status = computeStatus(metric);
  const config = statusConfig[status];
  const pct = Math.min((metric.current / metric.limit) * 100, 100);
  const remaining = metric.limit - metric.current;

  return (
    <div className="space-y-1.5 rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <metric.icon className={cn("h-3.5 w-3.5", config.color)} />
          <span className="text-xs font-medium text-foreground">{metric.label}</span>
          <Info className="h-3 w-3 cursor-help text-muted-foreground/50" title={metric.explanation} />
        </div>
        <Badge variant="outline" className={cn("text-[9px]", config.badgeClass)}>
          {config.label}
        </Badge>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold tabular-nums text-foreground">
          {formatValue(metric.current, metric.unit, currency)}
          <span className="text-xs font-normal text-muted-foreground"> / {formatValue(metric.limit, metric.unit, currency)}</span>
        </span>
        <span className={cn("text-xs font-medium", config.color)}>{Math.round(pct)}%</span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", config.barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        {metric.direction === "loss" ? (
          <span>Remaining: {formatValue(remaining, metric.unit, currency)}</span>
        ) : (
          <span>Target: {formatValue(metric.limit, metric.unit, currency)}</span>
        )}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-primary hover:underline"
        >
          {showAdvanced ? "Hide details" : "How is this calculated?"}
        </button>
      </div>
      {showAdvanced ? (
        <div className="mt-2 space-y-1 rounded-md border bg-muted/20 p-2 text-[10px]">
          {metric.advancedDetails ? (
            metric.advancedDetails.map((d) => (
              <div key={d.label} className="flex justify-between">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-medium text-foreground">{d.value}</span>
              </div>
            ))
          ) : null}
          <p className="mt-1 text-muted-foreground">{metric.explanation}</p>
        </div>
      ) : null}
    </div>
  );
}

export function AccountHealthWidget({
  dailyLoss = { current: 820, limit: 2000 },
  maxDrawdown = { current: 1840, limit: 5000 },
  profitTarget = { current: 7200, limit: 10000 },
  accountBalance = 10000,
  currency = "USD",
}: {
  dailyLoss?: { current: number; limit: number };
  maxDrawdown?: { current: number; limit: number };
  profitTarget?: { current: number; limit: number };
  accountBalance?: number;
  currency?: string;
}) {
  const metrics: HealthMetric[] = [
    {
      id: "daily-loss",
      label: "Daily Loss",
      icon: TrendingDown,
      current: dailyLoss.current,
      limit: dailyLoss.limit,
      unit: "currency",
      direction: "loss",
      explanation: "You can lose up to this amount per trading day. Resets at 00:00 server time.",
      advancedDetails: [
        { label: "Peak Equity", value: `$${(accountBalance + dailyLoss.current).toLocaleString()}` },
        { label: "Current Equity", value: `$${accountBalance.toLocaleString()}` },
        { label: "Reset Time", value: "00:00 UTC" },
        { label: "Calculation", value: "Peak - Current" },
      ],
    },
    {
      id: "max-drawdown",
      label: "Maximum Drawdown",
      icon: ShieldAlert,
      current: maxDrawdown.current,
      limit: maxDrawdown.limit,
      unit: "currency",
      direction: "loss",
      explanation: "You can lose up to this amount from your highest recorded equity. Does not reset.",
      advancedDetails: [
        { label: "Peak Equity", value: `$${(accountBalance + maxDrawdown.current).toLocaleString()}` },
        { label: "Current Equity", value: `$${accountBalance.toLocaleString()}` },
        { label: "Threshold", value: "Trailing" },
        { label: "Last Updated", value: new Date().toLocaleTimeString() },
      ],
    },
    {
      id: "profit-target",
      label: "Profit Target",
      icon: Target,
      current: profitTarget.current,
      limit: profitTarget.limit,
      unit: "currency",
      direction: "gain",
      explanation: "Reach this profit to pass the current phase and advance to the next step.",
      advancedDetails: [
        { label: "Current Profit", value: `$${profitTarget.current.toLocaleString()}` },
        { label: "Target", value: `$${profitTarget.limit.toLocaleString()}` },
        { label: "Progress", value: `${Math.round((profitTarget.current / profitTarget.limit) * 100)}%` },
        { label: "Days Remaining", value: "12" },
      ],
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account Health</span>
        <Badge variant="outline" className="text-[9px]">Live</Badge>
      </div>
      {metrics.map((m) => (
        <HealthMetricRow key={m.id} metric={m} currency={currency} />
      ))}
    </div>
  );
}
