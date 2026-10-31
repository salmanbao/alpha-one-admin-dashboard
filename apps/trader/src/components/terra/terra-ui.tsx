"use client";

/**
 * Terra UI — shared primitives extracted from the stitch screen library.
 * Small building blocks reused across every Terra Trader page.
 */

import { cn } from "@pfaas/ui";
import { formatCurrencyValue, formatSignedCurrencyValue } from "@pfaas/platform-core";
import Link from "next/link";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Canonical money formatting comes from `@pfaas/platform-core`
 * (audit fix #9 — one formatting utility for every dashboard). These
 * thin wrappers keep the Terra call sites unchanged.
 */
export function formatMoney(value: number, currency = "USD"): string {
  return formatCurrencyValue(value, currency);
}

export function formatSignedMoney(value: number, currency = "USD"): string {
  return formatSignedCurrencyValue(value, currency);
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
/* Drawdown meter — persistent daily / total risk visibility           */
/* ------------------------------------------------------------------ */

/**
 * Color-coded usage meter for a drawdown limit (daily loss or max DD).
 * Shows usage vs the program limit with green/amber/red proximity
 * coloring so a trader can see risk at a glance before breaching.
 */
export function TerraDrawdownMeter({
  label,
  used,
  limit,
  remaining,
  description,
}: {
  label: string;
  used: number;
  limit: number;
  remaining: number;
  description?: string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const tone = pct >= 85 ? "error" : pct >= 60 ? "warning" : "safe";
  const toneBar =
    tone === "error" ? "bg-error" : tone === "warning" ? "bg-tertiary" : "bg-primary";
  const toneText =
    tone === "error" ? "text-error" : tone === "warning" ? "text-on-tertiary-container" : "text-primary";
  const toneLabel = tone === "error" ? "Critical" : tone === "warning" ? "Watch" : "Safe";

  return (
    <div
      className="rounded-xl bg-surface-container-low px-4 py-3"
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${Math.round(pct)}% of limit used, ${toneLabel.toLowerCase()}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        <span className={`text-[11px] font-bold ${toneText}`}>{toneLabel}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="font-headline text-lg font-bold tabular-nums text-on-surface">
          {formatMoney(remaining)}
        </span>
        <span className="text-[11px] text-on-surface-variant">
          remaining of {formatMoney(limit)}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-container">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${toneBar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-on-surface-variant">
        <span>{formatMoney(used)} used ({Math.round(pct)}%)</span>
        {description && <span className="truncate pl-2">{description}</span>}
      </div>
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

  // Starting-balance reference line (visual + text) + pattern markers beyond color
  const startVal = values[0];
  const startY = sy(startVal);

  return (
    <>
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
      {/* Starting-balance reference line: a distinct visual + text encoding beyond color alone */}
      <line
        x1={padL}
        x2={W - padR}
        y1={startY}
        y2={startY}
        stroke="#9aa39a"
        strokeWidth="1.2"
        strokeDasharray="6 3"
      />
      <text
        x={padL - 6}
        y={startY - 4}
        textAnchor="end"
        className="fill-current text-[9px] font-medium text-on-surface-variant"
      >
        start {formatValue ? formatValue(startVal) : Math.round(startVal)}
      </text>
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
    {/* Accessible data table: color-independent encoding for screen readers / print */}
    <table className="sr-only" aria-label="Equity curve data (date vs value)">
      <thead><tr><th>Date</th><th>Value</th></tr></thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.x}><td>{d.x}</td><td>{formatValue ? formatValue(d.y) : Math.round(d.y)}</td></tr>
        ))}
      </tbody>
    </table>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Simple inline SVG bar chart (daily P&L pattern — M12)               */
/* ------------------------------------------------------------------ */

export function TerraBarChart({
  data,
  height = 220,
  formatValue,
}: {
  data: { x: string; y: number }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (data.length < 1) return null;

  const W = 680;
  const H = 240;
  const padL = 48;
  const padR = 10;
  const padT = 16;
  const padB = 30;

  const values = data.map((d) => d.y);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;

  const plotW = W - padL - padR;
  const slot = plotW / data.length;
  const barW = Math.max(4, slot * 0.62);
  const sy = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const zeroY = sy(0);

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const tickCount = Math.min(7, data.length);
  const xTickIdx = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / (tickCount - 1 || 1)) * (data.length - 1)),
  );

  return (
    <>
      <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full overflow-visible"
      style={{ height }}
      role="img"
      aria-label="Daily P&L bar chart"
    >
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
      {data.map((d, i) => {
        const x = padL + i * slot + (slot - barW) / 2;
        const y = d.y >= 0 ? sy(d.y) : zeroY;
        const barH = Math.max(1.5, Math.abs(sy(d.y) - zeroY));
        return (
          <g key={`${d.x}-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={2.5}
              fill={d.y >= 0 ? "#4a7c59" : "#b83230"}
              opacity={0.92}
            >
              <title>{`${d.x}: ${formatValue ? formatValue(d.y) : Math.round(d.y)}`}</title>
            </rect>
          </g>
        );
      })}
      <line
        x1={padL}
        x2={W - padR}
        y1={zeroY}
        y2={zeroY}
        stroke="#8f8b83"
        strokeWidth="1"
      />
      {/* Starting-zero reference line: visual + text for accessibility */}
      <line
        x1={padL}
        x2={W - padR}
        y1={zeroY}
        y2={zeroY}
        stroke="#9aa39a"
        strokeWidth="1.2"
        strokeDasharray="4 2"
      />
      <text
        x={padL - 6}
        y={zeroY - 4}
        textAnchor="end"
        className="fill-current text-[9px] font-medium text-on-surface-variant"
      >
        0 {formatValue ? formatValue(0) : '0'}
      </text>
      <g className="fill-current text-[10px] text-on-surface-variant opacity-80">
        {xTickIdx.map((i) => (
          <text
            key={i}
            x={padL + i * slot + slot / 2}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          >
            {data[i].x}
          </text>
        ))}
      </g>
    </svg>
    {/* Accessible data table: color-independent encoding for screen readers / print */}
    <table className="sr-only" aria-label="Daily P&L data (date vs value)">
      <thead><tr><th>Date</th><th>P&L</th></tr></thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.x}><td>{d.x}</td><td>{formatValue ? formatValue(d.y) : Math.round(d.y)}</td></tr>
        ))}
      </tbody>
    </table>
    </>
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
  actionLabel,
  actionHref,
  steps,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary CTA — points the user at the next step for this empty state. */
  actionLabel?: string;
  actionHref?: string;
  /** Optional numbered first-use guidance steps shown under the copy. */
  steps?: string[];
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-on-surface-variant">{icon}</div>}
      <p className="font-headline font-semibold text-on-surface">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-on-surface-variant">{description}</p>
      )}
      {steps && steps.length > 0 && (
        <ol className="mt-4 max-w-sm space-y-1.5 text-left">
          {steps.map((s, i) => (
            <li key={s} className="flex items-start gap-2 text-xs text-on-surface-variant">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-container text-[10px] font-bold text-on-surface-variant">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          {actionLabel}
        </Link>
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
  head: ReactNode[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant/60">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-outline-variant/60 bg-surface-container-low">
            {head.map((h, i) => (
              <th
                key={i}
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
