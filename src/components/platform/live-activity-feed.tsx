"use client";

/**
 * PFaaS Platform — Live Activity Feed Widget
 *
 * Shows real-time platform activity using the live-data simulation.
 * Items auto-append as the simulation ticks. Includes a "Live" badge
 * with pulsing dot and a pause/resume control.
 */

import { useLiveData, setLivePaused, clearActivityFeed, type ActivityItem } from "@/lib/platform/live-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, Pause, Play, Trash2, Users, ShieldAlert, Brain, Settings, Wallet, Target, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const moduleIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  payouts: Wallet,
  risk: ShieldAlert,
  kyc: Users,
  settings: Settings,
  ai: Brain,
  challenges: Target,
  analytics: BarChart3,
};

const toneColor: Record<string, string> = {
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

export function LiveActivityFeedWidget() {
  const live = useLiveData();
  const [paused, setPaused] = useState(false);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    setLivePaused(next);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {!paused ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-muted-foreground" />
            )}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {paused ? "Paused" : "Live"}
          </span>
          <Badge variant="outline" className="text-[9px]">{live.activityFeed.length}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={togglePause}
            aria-label={paused ? "Resume live feed" : "Pause live feed"}
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={clearActivityFeed}
            aria-label="Clear activity feed"
            title="Clear"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 280 }}>
        {live.activityFeed.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <Radio className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {paused ? "Feed paused" : "Waiting for activity…"}
            </p>
          </div>
        ) : (
          <ol className="relative space-y-2.5 border-l pl-4">
            {live.activityFeed.map((item: ActivityItem) => {
              const Icon = moduleIcon[item.module] ?? Radio;
              return (
                <li key={item.id} className="relative animate-in fade-in slide-in-from-left-2 duration-300">
                  <span
                    className={cn("absolute -left-[21px] top-1 h-2 w-2 rounded-full border-2 border-background", toneColor[item.tone])}
                  />
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs text-foreground">
                        <span className="font-medium">{item.actor}</span>{" "}
                        <span className="text-muted-foreground">{item.action}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/70">
                        {timeAgo(item.timestamp)} · {item.module}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
