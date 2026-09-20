"use client";

/**
 * PFaaS Platform — Live Equity Curve Widget
 *
 * Shows a real-time updating equity curve that appends a new point
 * every tick. Demonstrates the live data simulation feeding into
 * a chart visualization.
 */

import { useLiveData } from "@/lib/platform/live-data";
import { usePlatform } from "@/lib/platform/platform-context";
import { AreaSeries } from "@/components/platform/charts";
import { formatCurrency } from "@/components/platform/status";
import { useEffect, useState, useRef } from "react";
import { TrendingUp, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Point {
  t: string;
  v: number;
}

const MAX_POINTS = 30;

export function LiveEquityCurveWidget() {
  const { runtime } = usePlatform();
  const live = useLiveData();
  const currency = runtime.tenant?.currency ?? "USD";
  const baseEquity = useRef<number>(0);
  const [points, setPoints] = useState<Point[]>([]);

  // Initialize base equity from tenant accounts
  useEffect(() => {
    // Lazy import to avoid circular deps
    import("@/lib/platform/mock-data").then(({ getTenantAccounts }) => {
      const tid = runtime.tenant?.id ?? "platform";
      const accounts = getTenantAccounts(tid);
      baseEquity.current = accounts.reduce((s, a) => s + a.equity, 0);
      // Seed initial points
      const now = Date.now();
      const seed: Point[] = Array.from({ length: 10 }, (_, i) => ({
        t: new Date(now - (10 - i) * 3500).toLocaleTimeString(),
        v: Math.round(baseEquity.current + (Math.random() - 0.5) * baseEquity.current * 0.01),
      }));
      setPoints(seed);
    });
  }, [runtime.tenant?.id]);

  // Append a new point on each tick
  useEffect(() => {
    if (live.tick === 0 || !baseEquity.current) return;
    const newPoint: Point = {
      t: new Date(live.lastUpdate).toLocaleTimeString(),
      v: Math.round(baseEquity.current + live.equityPulse * baseEquity.current * 0.001 + (Math.random() - 0.5) * baseEquity.current * 0.005),
    };
    setPoints((prev) => [...prev.slice(-MAX_POINTS + 1), newPoint]);
  }, [live.tick, live.equityPulse, live.lastUpdate]);

  const latest = points[points.length - 1]?.v ?? baseEquity.current;
  const first = points[0]?.v ?? latest;
  const delta = latest - first;
  const deltaPct = first ? (delta / first) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tabular-nums text-foreground">
              {formatCurrency(latest, currency)}
            </span>
            <Badge
              variant="outline"
              className={`gap-0.5 text-[10px] ${delta >= 0 ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-rose-500/40 text-rose-700 dark:text-rose-400"}`}
            >
              {delta >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(2)}%
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">Total equity · live</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Live</span>
        </div>
      </div>
      {points.length > 1 ? (
        <AreaSeries data={points} xKey="t" yKey="v" color={delta >= 0 ? "#16a34a" : "#dc2626"} height={120} formatValue={(v) => formatCurrency(v, currency)} />
      ) : (
        <div className="flex h-[120px] items-center justify-center text-xs text-muted-foreground">
          <Activity className="mr-2 h-4 w-4 animate-pulse" /> Loading equity data…
        </div>
      )}
    </div>
  );
}
