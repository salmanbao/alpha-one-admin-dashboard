"use client";

/**
 * PFaaS Platform — Animated Number
 *
 * Smoothly transitions between numeric values using requestAnimationFrame.
 * Used by KPI cards and live stats to give a polished feel when
 * values update in real-time.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function AnimatedNumber({
  value,
  format,
  className,
  duration = 400,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    const start = performance.now();
    const diff = value - from;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(from + diff * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
        setDisplayValue(value);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = format ? format(displayValue) : Math.round(displayValue).toString();

  return (
    <span className={cn("tabular-nums transition-colors duration-300", className)}>
      {formatted}
    </span>
  );
}
