"use client";

/**
 * Competition countdown — live tick chip for the hub and detail pages.
 *
 * Shows `13d 04h 22m 09s` style remaining time, switching copy per
 * status ("Starts in / Ends in / Final day"). Honors
 * `prefers-reduced-motion: reduce`: no 1s interval, a static
 * "Ends Fri, Nov 21" string instead (a11y requirement).
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Mode = "countdown" | "ended";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function staticLabel(target: Date, mode: Mode): string {
  const day = target.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return mode === "ended" ? `Ended ${day}` : `Ends ${day}`;
}

function partsUntil(target: number, now: number): {
  d: number;
  h: number;
  m: number;
  s: number;
  totalMs: number;
} {
  const totalMs = Math.max(0, target - now);
  const totalSec = Math.floor(totalMs / 1000);
  return {
    d: Math.floor(totalSec / 86_400),
    h: Math.floor((totalSec % 86_400) / 3600),
    m: Math.floor((totalSec % 3600) / 60),
    s: totalSec % 60,
    totalMs,
  };
}

export function CompetitionCountdown({
  startsAt,
  endsAt,
  status,
  className,
  /** Renders the label ("Starts in" / "Ends in" / "Final day") too. */
  withLabel = true,
}: {
  startsAt: string;
  endsAt: string;
  status: "active" | "upcoming" | "ended";
  className?: string;
  withLabel?: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  const [reduced, setReduced] = useState(false);

  // Reduced-motion: no ticking at all (static string, no 1s re-render).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const ended = status === "ended";
  useEffect(() => {
    if (reduced || ended) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [reduced, ended]);

  const targetIso = status === "upcoming" ? startsAt : endsAt;
  const target = new Date(targetIso).getTime();

  if (ended) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant", className)}>
        {staticLabel(new Date(target), "ended")}
      </span>
    );
  }

  if (reduced || now === null) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-on-surface-variant", className)}>
        {withLabel && <span aria-hidden="true">Ends </span>}
        {staticLabel(new Date(target), "countdown")}
      </span>
    );
  }

  const { d, h, m, s, totalMs } = partsUntil(target, now);
  const finalDay = status === "active" && totalMs <= 86_400_000;
  const prefix = status === "upcoming" ? "Starts in" : finalDay ? "Final day" : "Ends in";

  return (
    <span
      role="timer"
      aria-label={
        status === "upcoming"
          ? `Starts in ${d} days ${h} hours`
          : `Ends in ${d} days ${h} hours`
      }
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums",
        finalDay
          ? "bg-error-container text-on-error-container"
          : "bg-surface-container-high text-on-surface-variant",
        className,
      )}
    >
      {withLabel && <span>{prefix}</span>}
      <span>
        {d}d {pad(h)}h {pad(m)}m {pad(s)}s
      </span>
    </span>
  );
}
