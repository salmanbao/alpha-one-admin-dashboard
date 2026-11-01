"use client";

/**
 * Economic Calendar — converted from stitch_screens/economic_calendar
 * Scheduled economic events with impact and forecast.
 */

import { useMemo, useState, useEffect } from "react";
import { cn } from "@pfaas/ui";
import {
  TerraBadge,
  TerraCard,
  TerraPageHeader,
} from "@/components/terra/terra-ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { economicEvents } from "@/lib/fixtures/terra-fixtures";
import { useToast } from "@/hooks/use-toast";

export function EconomicCalendarPage() {
  const [impactFilter, setImpactFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [savedFilters, setSavedFilters] = useState<string[]>([]);

  const { toast } = useToast();

  const handleImpactChange = (value: string) => {
    setImpactFilter(value);
  };

  const handleCurrencyChange = (value: string) => {
    setCurrencyFilter(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleSaveFilter = (filter: string) => {
    setSavedFilters((prev) => [...prev, filter]);
  };

  const clearFilters = () => {
    setImpactFilter("all");
    setCurrencyFilter("");
    setSearchTerm("");
    setSavedFilters([]);
  };

  // Load saved filters from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("economicCalendarFilters");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSavedFilters(parsed);
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem("economicCalendarFilters", JSON.stringify(savedFilters));
  }, [savedFilters]);

  const allImpacts = ["high", "medium", "low"] as const;
  const impactLabels: Record<string, { tone: string; label: string }> = {
    high: { tone: "error", label: "High" },
    medium: { tone: "tertiary", label: "Medium" },
    low: { tone: "neutral", label: "Low" },
  };

  const filteredEvents = useMemo(() => {
    return economicEvents.filter((e) => {
      // Impact filter
      if (impactFilter !== "all" && e.impact !== impactFilter) return false;
      // Currency filter
      if (currencyFilter && e.currency !== currencyFilter) return false;
      // Search term
      if (searchTerm && !e.event.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [impactFilter, currencyFilter, searchTerm]);

  const times = Array.from(
    new Set(filteredEvents.map((e) => e.time)),
  ).sort();

  const byTime = useMemo(
    () =>
      times.map((t) => ({
        time: t,
        events: filteredEvents.filter((e) => e.time === t),
      })),
    [filteredEvents, times],
  );

  const impactChips = allImpacts.map((impact) => (
    <div key={impact} className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => handleImpactChange(impact)}
        className={`px-2.5 py-0.5 rounded-full text-sm font-medium transition-colors ${
          impactFilter === (impact as string)
            ? "bg-primary text-white"
            : (impact as string) === "all"
            ? "bg-background text-muted-foreground"
            : "bg-gray-100 text-gray-800 hover:bg-gray-200"
        }`}
        aria-pressed={impactFilter === (impact as string)}
        aria-label={`Filter by ${impact === "high" ? "high impact" : impact === "medium" ? "medium impact" : "low impact"}`}
      >
        {impactLabels[impact]?.label}
        <span className="ml-1 text-xs text-muted-foreground">{impact === "high" ? "High" : impact === "medium" ? "Med" : "Low"}</span>
      </button>
    </div>
  ));

  return (
    <div className="space-y-6">
      {/* Filter controls */}
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Impact:</span>
          {impactChips}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Currency:</span>
          <Select
            value={currencyFilter}
            onValueChange={(value) => handleCurrencyChange(value)}
            
          >
            <SelectContent className="max-w-[150px]">
              <SelectItem value="">All currencies</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Search:</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search events..."
            className="rounded-md border border-input bg-background px-2 text-xs text-on-surface w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Saved filters:</span>
          <div className="flex flex-wrap gap-1">
            {savedFilters.map((filter, index) => (
              <div key={index} className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full text-xs">
                {filter}
                <button
                  type="button"
                  onClick={() => handleSaveFilter(filter)}
                  className="ml-1 text-xs text-red-500 hover:text-red-600"
                  aria-label={`Remove ${filter} filter`}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

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
            {filteredEvents.filter((e) => e.impact === "high").map((e) => (
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
            {filteredEvents.filter((e) => e.impact === "medium").map((e) => (
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
