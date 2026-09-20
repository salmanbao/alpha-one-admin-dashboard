"use client";

/**
 * PFaaS Platform — Activity Ticker
 *
 * A compact, auto-rotating strip in the topbar showing the latest
 * platform events. Aggregated across modules.
 */

import { useEffect, useState } from "react";
import { TrendingUp, AlertTriangle, Wallet, UserPlus, ShieldCheck, Brain, Zap } from "lucide-react";

const EVENTS = [
  { icon: UserPlus, text: "New trader registered — Tom Allen", tone: "info" },
  { icon: Wallet, text: "Payout approved — $4,250 to Sarah Chen", tone: "success" },
  { icon: AlertTriangle, text: "Breach detected — account acct-beta-7", tone: "warning" },
  { icon: TrendingUp, text: "Revenue milestone — £82,313 this week", tone: "success" },
  { icon: ShieldCheck, text: "KYC approved — 3 new verifications", tone: "info" },
  { icon: Brain, text: "AI insight — payout spike predicted (+38%)", tone: "info" },
  { icon: Zap, text: "Module enabled — Analytics for Beta Trading", tone: "success" },
];

const toneColor = {
  info: "text-sky-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
};

export function ActivityTicker() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % EVENTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const event = EVENTS[idx];
  const Icon = event.icon;

  return (
    <div className="hidden h-9 items-center gap-2 overflow-hidden rounded-md border bg-muted/30 px-3 lg:flex lg:max-w-md xl:max-w-lg">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneColor[event.tone as keyof typeof toneColor]}`} />
      <span key={idx} className="truncate text-xs text-muted-foreground animate-in fade-in slide-in-from-left-2 duration-300">
        {event.text}
      </span>
    </div>
  );
}
