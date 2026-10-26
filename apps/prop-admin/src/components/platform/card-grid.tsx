"use client";

/** 
 * PFaaS Platform — Card Grid Component
 * Renders a responsive grid of KPI cards with trend indicators
 */

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type KpiCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color?: "primary" | "success" | "warning" | "info";
  value: number;
  trend: number;
  trendDirection: "up" | "down" | "neutral";
  subtitle: string;
};

type CardGridProps = {
  cards: KpiCard[];
};

/**
 * Renders KPI cards in a responsive grid.
 * - 1 column on mobile
 * - 2 columns on tablet (sm:grid-cols-2)
 * - 4 columns on desktop (grid-cols-4)
 */
export function CardGrid({ cards }: CardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className={cn(
            "group rounded-lg border bg-card p-5 transition-all hover:border-border/50",
            "flex flex-col h-64",
          )}
        >
          {/* Icon + Title Section */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className={cn(
                "rounded-md p-2",
                `bg-${card.color}10`,
                `text-${card.color}50`,
                "flex-shrink-0",
              )}
            >
              <Plus className="h-4 w-4" />
              {/* Icon placeholder - would use lucide-react icon components */}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {card.title}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {card.description}
              </p>
            </div>
          </div>

          {/* Value + Trend */}
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {card.value}
              </p>
              <p className="text-[11px] font-medium">
                {card.subtitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {card.trendDirection === "up" && (
                <StatusBadge
                  tone="success"
                  className="h-2 w-2"
                />
              )}
              {card.trendDirection === "down" && (
                <StatusBadge
                  tone="danger"
                  className="h-2 w-2"
                />
              )}
              {card.trendDirection === "neutral" && (
                <StatusBadge
                  tone="muted"
                  className="h-2 w-2"
                />
              )}
              <span className="text-[10px] font-medium text-muted-foreground">
                {card.trend > 0 ? "+" : ""}{card.trend}%
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}