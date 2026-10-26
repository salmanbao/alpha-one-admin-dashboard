"use client";

/** 
 * PFaaS Platform — KPI Card Component
 * Renders a single KPI metric card with trend indicator
 */

import { StatusBadge } from "@/components/platform/status";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  /** Unique card identifier */
  id: string;
  /** Card title/label */
  title: string;
  /** Card description/subtitle */
  description?: string;
  /** Metric value */
  value: string | number;
  /** Trend direction: "up", "down", "neutral" */
  trendDirection: "up" | "down" | "neutral";
  /** Trend percentage/amount */
  trendValue: number | string;
  /** Card accent color */
  color?: "primary" | "success" | "warning" | "info" | "danger";
  /** Whether to show the trend badge */
  showTrend?: boolean;
};

/**
 * Renders a KPI metric card with value and trend indicator.
 * 
 * Example:
 * <KpiCard
 *   id="traders"
 *   title="Total Traders"
 *   value={76}
 *   trendDirection="up"
 *   trendValue={12}
 *   color="primary"
 * />
 */
export function KpiCard({
  id,
  title,
  description,
  value,
  trendDirection,
  trendValue,
  color = "primary",
  showTrend = true,
}: KpiCardProps) {
  const trendLabel = showTrend 
    ? `${trendDirection === "up" ? "+" : ""}${trendValue}%
    : null;

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5 transition-all hover:border-border/50",
        "flex flex-col h-64",
      )}
    >
      {/* Title and Description */}
      <div className="flex items-start gap-2 mb-4">
        <div className="flex-shrink-0">
          {showTrend && (
            <StatusBadge
              tone={trendDirection === "up" ? "success" : trendDirection === "down" ? "danger" : "muted"}
              className="h-2 w-2"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {title}
          </p>
          {description && (
            <p className="text-[10px] text-muted-foreground truncate">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Value */}
      <div className="text-2xl font-bold text-foreground mb-1">
        {typeof value === "number" ? value : Number(value)}
      </div>

      {/* Trend Indicator */}
      {showTrend && (
        <div className="mt-auto flex items-baseline justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            {trendLabel ?? "no change"}
          </span>
          {trendDirection === "up" && (
            <StatusBadge tone="success" className="h-2 w-2" />
          )}
          {trendDirection === "down" && (
            <StatusBadge tone="danger" className="h-2 w-2" />
          )}
          {trendDirection === "neutral" && (
            <StatusBadge tone="muted" className="h-2 w-2" />
          )}
        </div>
      )}
    </div>
  );
}