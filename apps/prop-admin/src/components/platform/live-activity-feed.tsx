"use client";

/**
 * PFaaS Platform — Live Activity Feed Widget
 *
 * Shows real-time platform activity using the live-data simulation.
 * Items auto-append as the simulation ticks. Includes a "Live" badge
 * with pulsing dot and a pause/resume control.
 *
 * Round 7: when the operator is a trader, render their PERSONAL audit
 * entries (getTraderAudit) instead of the singleton live feed — the
 * singleton feed shows other traders' actions ("Elena R. — Created
 * challenge") which is wrong context for Tom.
 */

import { useLiveData, setLivePaused, clearActivityFeed, type ActivityItem } from "@/lib/platform/live-data";
import { usePlatform } from "@/lib/platform/platform-context";
import { getTraderForUser, getTraderAudit } from "@/lib/platform/mock-data";
import { Badge } from "@pfaas/ui/badge";
import { Button } from "@pfaas/ui/button";
import { Radio, Pause, Play, Trash2, Users, ShieldAlert, Brain, Settings, Wallet, Target, BarChart3 } from "lucide-react";
import { cn } from "@pfaas/ui/cn";
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
  info: "bg-teal-500",
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
  const { runtime, user, tenant } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  // Round 7: trader-personal feed (Tom's own audit entries) vs admin live
  // feed (singleton with simulated cross-tenant actions).
  const trader = getTraderForUser(user);
  const traderFeed = trader
    ? getTraderAudit(trader.id, tid).slice(0, 8).map((a) => ({
        id: a.id,
        timestamp: new Date(a.timestamp).getTime(),
        actor: a.actor,
        action: a.action,
        module: a.module ?? "platform",
        tone: a.severity === "critical" ? "critical" : a.severity === "warning" ? "warning" : "info",
      } as ActivityItem))
    : [];
  const live = useLiveData();
  const [paused, setPaused] = useState(false);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    setLivePaused(next);
  };

  // Round 7: trader sees their personal audit feed; admin sees the live singleton.
  const feed = trader ? traderFeed : live.activityFeed;

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
            {trader ? (paused ? "Paused" : "My Activity") : paused ? "Paused" : "Live"}
          </span>
          <Badge variant="outline" className="text-[9px]">{feed.length}</Badge>
        </div>
        {/* Pause/clear controls are admin-only (trader feed is a static snapshot). */}
        {!trader && (
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
        )}
      </div>

      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 280 }}>
        {feed.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
            <Radio className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              {trader ? "No recent activity on your account." : paused ? "Feed paused" : "Waiting for activity…"}
            </p>
          </div>
        ) : (
          <ol className="relative space-y-2.5 border-l pl-4">
            {feed.map((item: ActivityItem) => {
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
