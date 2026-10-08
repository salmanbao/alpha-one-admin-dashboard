"use client";

/**
 * Economic Calendar — converted from stitch_screens/economic_calendar
 * Scheduled economic events with impact and forecast.
 */

import { useMemo } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
  TerraTable,
} from "@/components/terra/terra-ui";
import { economicEvents } from "@/lib/fixtures/terra-fixtures";

const times = Array.from(
  new Set(economicEvents.map((e) => e.time)),
).sort();

export function EconomicCalendarPage() {
  const byTime = useMemo(
    () =>
      times.map((t) => ({
        time: t,
        events: economicEvents.filter((e) => e.time === t),
      })),
    [],
  );

  return (
    <div className="space-y-6">
      <TerraPageHeader
        title="Economic Calendar"
        description="High-impact scheduled events affecting your positions"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TerraCard className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            High Impact
          </h3>
          <div className="space-y-2 text-sm">
            {economicEvents.filter((e) => e.impact === "high").map((e) => (
              <div key={e.id} className="rounded-xl bg-surface-container-low px-3 py-2">
                <span className="font-bold text-primary">{e.time}</span>
                <span className="block text-xs text-on-surface-variant">
                  {e.currency} · {e.event}
                </span>
              </div>
            ))}
          </div>
        </TerraCard>
        <TerraCard className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Medium Impact
          </h3>
          <div className="space-y-2 text-sm">
            {economicEvents.filter((e) => e.impact === "medium").map((e) => (
              <div key={e.id} className="rounded-xl bg-surface-container-low px-3 py-2">
                <span className="font-bold text-tertiary">{e.time}</span>
                <span className="block text-xs text-on-surface-variant">
                  {e.currency} · {e.event}
                </span>
              </div>
            ))}
          </div>
        </TerraCard>
        <TerraCard className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Legend
          </h3>
          <div className="space-y-2 text-xs">
            <div className="rounded-xl bg-surface-container-low px-3 py-2 flex items-center gap-2">
              <TerraBadge tone="error">High</TerraBadge>
              <span>Big moves expected</span>
            </div>
            <div className="rounded-xl bg-surface-container-low px-3 py-2 flex items-center gap-2">
              <TerraBadge tone="tertiary">Medium</TerraBadge>
              <span>Moderate moves</span>
            </div>
          </div>
        </TerraCard>
      </div>

      <TerraCard>
        <h2 className="pb-4 font-headline text-lg font-bold text-on-surface">
          Today's scheduled events
        </h2>
        {byTime.map(({ time, events }) => (
          <div key={time} className="mb-4">
            <span className="mb-1.5 inline-block border-b border-outline-variant/60 pb-2 text-sm font-bold text-on-surface">
              {time} UTC
            </span>
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="rounded-xl bg-surface-container-low px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-on-surface">{e.event}</span>
                    <TerraBadge
                      tone={
                        e.impact === "high"
                          ? "error"
                          : e.impact === "medium"
                            ? "tertiary"
                            : "neutral"
                      }
                    >
                      {e.impact}
                    </TerraBadge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-on-surface-variant">
                    <span>{e.currency}</span>
                    <span>Forecast: {e.forecast}</span>
                    <span>Previous: {e.previous}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </TerraCard>
    </div>
  );
}
