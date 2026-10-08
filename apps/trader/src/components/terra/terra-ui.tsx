"use client";

/**
 * Terra UI — shared primitives extracted from the stitch screen library.
 * Small building blocks reused across every Terra Trader page.
 */

import { cn } from "@pfaas/ui";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

export function formatMoney(value: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSignedMoney(value: number, currency = "USD"): string {
  const sign = value >= 0 ? "+" : "−";
  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/* ------------------------------------------------------------------ */
/* Status pill — the M3 badge used across all stitch screens           */
/* ------------------------------------------------------------------ */

export type TerraTone =
  | "primary"
  | "secondary"
  | "tertiary"
  | "error"
  | "neutral"
  | "success";

const toneClasses: Record<TerraTone, string> = {
  primary: "bg-primary-fixed text-on-primary-fixed-variant",
  success: "bg-primary-fixed text-on-primary-fixed-variant",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  error: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container-high text-on-surface-variant",
};

export function TerraBadge({
  children,
  tone = "neutral",
  dot = false,
  pulse = false,
  className,
}: {
  children: ReactNode;
  tone?: TerraTone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const dotColor =
    tone === "error"
      ? "bg-error"
      : tone === "tertiary"
        ? "bg-tertiary"
        : tone === "secondary"
          ? "bg-secondary"
          : "bg-primary";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotColor, pulse && "animate-pulse")}
        />
      )}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function TerraCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "terra-card rounded-xl bg-surface-container-lowest p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TerraSectionTitle({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
      <div>
        <h2 className="font-headline text-lg sm:text-xl font-bold text-on-surface">
          {title}
        </h2>
        {description && (
          <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
            {description}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress bar (stitch pattern: h-2/h-3 rounded track + fill)         */
/* ------------------------------------------------------------------ */

export function TerraProgress({
  value,
  className,
  barClassName,
  height = "h-2",
}: {
  value: number; // 0..100
  className?: string;
  barClassName?: string;
  height?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-surface-container",
        height,
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-all duration-700 ease-out",
          barClassName,
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI stat block                                                      */
/* ------------------------------------------------------------------ */

export function TerraStat({
  label,
  value,
  sub,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "positive" | "negative";
  className?: string;
}) {
  const valueColor =
    tone === "positive"
      ? "text-primary"
      : tone === "negative"
        ? "text-error"
        : "text-on-surface";
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className={cn("block truncate text-sm font-bold tabular-nums", valueColor)}>
        {value}
      </span>
      {sub && <span className="block text-[10px] font-medium text-on-surface-variant">{sub}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Simple inline SVG area chart (equity curve pattern from stitch)     */
/* ------------------------------------------------------------------ */

export function TerraAreaChart({
  data,
  height = 220,
  formatValue,
}: {
  data: { x: string; y: number }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (data.length < 2) return null;

  const W = 680;
  const H = 240;
  const padL = 48;
  const padR = 10;
  const padT = 16;
  const padB = 30;

  const values = data.map((d) => d.y);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;

  const sx = (i: number) => padL + (i / (data.length - 1)) * (W - padL - padR);
  const sy = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

  // Smooth cubic path
  let line = `M ${sx(0)} ${sy(values[0])}`;
  for (let i = 1; i < data.length; i++) {
    const mx = (sx(i - 1) + sx(i)) / 2;
    line += ` C ${mx} ${sy(values[i - 1])}, ${mx} ${sy(values[i])}, ${sx(i)} ${sy(values[i])}`;
  }
  const area = `${line} L ${sx(data.length - 1)} ${H - padB} L ${sx(0)} ${H - padB} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const lastX = sx(data.length - 1);
  const lastY = sy(values[values.length - 1]);

  const tickCount = 4;
  const xTickIdx = Array.from({ length: Math.min(tickCount, data.length) }, (_, i) =>
    Math.round((i / (tickCount - 1 || 1)) * (data.length - 1)),
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full overflow-visible"
      style={{ height }}
      role="img"
      aria-label="Area chart"
    >
      <defs>
        <linearGradient id="terraChartGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.28" />
          <stop offset="85%" stopColor="#4a7c59" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#4a7c59" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g opacity="0.4">
        {gridLines.map((g) => {
          const y = padT + g * (H - padT - padB);
          const v = hi - g * (hi - lo);
          return (
            <g key={g}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y}
                y2={y}
                stroke="#c4c8bc"
                strokeDasharray="4 4"
                strokeWidth="0.8"
              />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-current text-[9px] text-on-surface-variant"
              >
                {formatValue ? formatValue(v) : Math.round(v)}
              </text>
            </g>
          );
        })}
      </g>
      <path d={area} fill="url(#terraChartGrad)" />
      <path d={line} fill="none" stroke="#4a7c59" strokeWidth="3" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} fill="#4a7c59" r="5" />
      <circle className="animate-pulse" cx={lastX} cy={lastY} fill="#4a7c59" opacity="0.25" r="10" />
      <g className="fill-current text-[10px] text-on-surface-variant opacity-80">
        {xTickIdx.map((i) => (
          <text
            key={i}
            x={sx(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          >
            {data[i].x}
          </text>
        ))}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page header (content pages inside the shell)                        */
/* ------------------------------------------------------------------ */

export function TerraPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
      <div>
        <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 text-sm text-on-surface-variant">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function TerraEmpty({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-on-surface-variant">{icon}</div>}
      <p className="font-headline font-semibold text-on-surface">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-on-surface-variant">{description}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Simple table                                                        */
/* ------------------------------------------------------------------ */

export function TerraTable({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/60">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-outline-variant/60 bg-surface-container-low">
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-outline-variant/40 last:border-0 hover:bg-surface-container-low/60"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-on-surface">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
