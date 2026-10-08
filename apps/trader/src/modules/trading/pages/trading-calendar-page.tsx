"use client";

/**
 * Trading Calendar — converted from stitch_screens/trading_calendar
 * Monthly trading activity grid with daily P&L heat map.
 */

import { useState } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraCard,
  TerraPageHeader,
  TerraStat,
  formatSignedMoney,
} from "@/components/terra/terra-ui";
import { terraTrades } from "@/lib/fixtures/terra-fixtures";

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function seedPnl(day: number): number | null {
  // deterministic demo heat map
  const h = (day * 2654435761) % 100;
  if (h < 40) return null;
  if (h < 55) return -(h % 60);
  if (h < 75) return 40 + (h % 90);
  return 120 + (h % 140);
}

export function TradingCalendarPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();

  const cells = (() => {
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  })();

  const dayPnl = (d: number | null) => (d ? seedPnl(d + month * 31) : null);
  const tradingDays = cells.filter((d): d is number => d !== null && dayPnl(d) !== null);
  const total = tradingDays.reduce((s, d) => s + (dayPnl(d) ?? 0), 0);

  const heat = (pnl: number | null) => {
    if (pnl === null) return "";
    if (pnl > 150) return "bg-primary text-on-primary";
    if (pnl > 0) return "bg-primary-fixed text-on-primary-fixed-variant";
    if (pnl < -50) return "bg-error-container text-on-error-container";
    return "bg-error/20 text-error";
  };

  return (
    <div className="space-y-6">
      <TerraPageHeader title="Trading Calendar" description="Daily P&L across your accounts" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TerraCard className="p-5">
          <TerraStat label="Month P&L" value={formatSignedMoney(total)} tone={total >= 0 ? "positive" : "negative"} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Trading Days" value={tradingDays.length} sub="of the month" />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Green Days" value={tradingDays.filter((d) => (dayPnl(d) ?? 0) > 0).length} />
        </TerraCard>
        <TerraCard className="p-5">
          <TerraStat label="Red Days" value={tradingDays.filter((d) => (dayPnl(d) ?? 0) < 0).length} />
        </TerraCard>
      </div>

      <TerraCard>
        <div className="flex items-center justify-between pb-4">
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m - 1)}
            className="rounded-lg bg-surface-container-low px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            ← Prev
          </button>
          <h2 className="font-headline text-lg font-bold text-on-surface">
            {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            onClick={() => setMonthOffset((m) => m + 1)}
            className="rounded-lg bg-surface-container-low px-3 py-1.5 text-sm font-semibold text-on-surface hover:bg-surface-container"
          >
            Next →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekDays.map((w) => (
            <div key={w} className="pb-1 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            const pnl = dayPnl(d);
            return (
              <div
                key={i}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center rounded-lg text-xs",
                  d === null && "opacity-0",
                  d !== null && pnl === null && "bg-surface-container-low text-on-surface-variant",
                  heat(pnl),
                )}
              >
                <span className="font-bold">{d}</span>
                {pnl !== null && (
                  <span className="mt-0.5 hidden text-[9px] font-bold tabular-nums sm:block">
                    {pnl >= 0 ? "+" : ""}
                    {pnl}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3 text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary" /> +150+</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary-fixed" /> 0–150</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-error-container" /> losses</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-surface-container-low" /> no trades</span>
        </div>
      </TerraCard>
    </div>
  );
}
