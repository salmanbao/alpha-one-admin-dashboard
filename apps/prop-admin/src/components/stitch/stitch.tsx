"use client";

/**
 * PFaaS — Stitch Design System Primitives
 *
 * Shared component vocabulary extracted from the Stitch screen set
 * (stitch_screens/**). Every prop-admin screen converted to the Stitch
 * design language composes these primitives — this keeps the 250+ base
 * screens and their 500+ state screens visually and interactively
 * consistent (UX Constitution §37, §38, §76).
 *
 * Tokens live in globals.css (`--sfc-*`, `--terra-*` layers, exposed as
 * Tailwind colors sfc-lowest … sfc-highest, tp, tp-container, tp-fixed,
 * tt, tt-container, tsc, tsc-container, terr, terr-container, ink,
 * ink-variant, ink-soft, ink-muted, outline-variant).
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, Info, X } from "lucide-react";

/* ──────────────────────────────────────────────────────────────── */
/* Icons — Material Symbols via ligature (matches stitch HTML)      */
/* ──────────────────────────────────────────────────────────────── */

declare global {
  interface Window {
    MaterialSymbolsLoaded?: boolean;
  }
}

/** Material Symbols ligature icon. Renders the named glyph. */
export function MsIcon({
  name,
  className,
  fill = false,
  weight,
}: {
  name: string;
  className?: string;
  fill?: boolean;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ms-icon select-none leading-none",
        className,
      )}
      style={{
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}${weight ? `, 'wght' ${weight}` : ""}`,
      }}
    >
      {name}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Surfaces                                                          */
/* ──────────────────────────────────────────────────────────────── */

/** Stitch card — white elevated surface with warm shadow. */
export function StitchCard({
  className,
  children,
  as: As = "div",
  interactive = false,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType; interactive?: boolean }) {
  return (
    <As
      className={cn(
        "rounded-xl bg-sfc-lowest p-5 shadow-sm",
        interactive && "transition-all hover:shadow-md cursor-pointer",
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

/** Section header inside a stitch card: icon + title + optional right slot. */
export function StitchCardHeader({
  icon,
  title,
  description,
  right,
  className,
}: {
  icon?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 pb-4", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tp/10 text-tp">
            <MsIcon name={icon} className="text-[20px]" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-serif text-base font-bold tracking-tight text-ink truncate">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-ink-variant leading-snug">{description}</p>
          ) : null}
        </div>
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

/** Page header block — stitch icon tile + serif display title + subtitle. */
export function StitchPageHeader({
  icon,
  title,
  subtitle,
  chip,
  actions,
  className,
}: {
  icon: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  chip?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col lg:flex-row lg:items-center justify-between gap-5", className)}>
      <div className="flex items-start gap-4 min-w-0">
        <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tp/10 text-tp shadow-sm">
          <MsIcon name={icon} className="text-[28px]" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-ink">
              {title}
            </h1>
            {chip}
          </div>
          {subtitle ? <p className="mt-1 text-sm text-ink-variant">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* KPI metric card — stitch pattern (label + delta pill + value)     */
/* ──────────────────────────────────────────────────────────────── */

export function StitchKpi({
  label,
  value,
  delta,
  deltaLabel,
  hint,
  icon,
  tone = "default",
  href,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: string;
  deltaLabel?: string;
  hint?: React.ReactNode;
  icon?: string;
  tone?: "default" | "positive" | "negative" | "warning" | "info";
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const deltaTone =
    tone === "positive" || delta?.startsWith("+")
      ? "bg-tp-fixed text-tp-fixed-variant"
      : delta?.startsWith("-") || tone === "negative"
        ? "bg-terr-container text-terr"
        : tone === "warning"
          ? "bg-tt-fixed text-tt-fixed-variant"
          : tone === "info"
            ? "bg-tsc-container text-tsc"
            : "bg-sfc-high text-ink-variant";
  const Comp: React.ElementType = href ? "a" : onClick ? "button" : "div";
  return (
    <Comp
      href={href}
      onClick={onClick}
      className={cn(
        "group flex flex-col justify-between rounded-xl bg-sfc-lowest p-5 shadow-sm transition-all",
        (href || onClick) && "cursor-pointer hover:shadow-md",
        className,
      )}
      {...(onClick && Comp === "button" ? { type: "button" } : {})}
    >
      <div className="flex items-center justify-between pb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-variant">{label}</span>
        {delta || icon ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
              deltaTone,
            )}
          >
            {icon ? <MsIcon name={icon} className="text-[13px]" /> : null}
            {delta}
          </span>
        ) : null}
      </div>
      <div>
        <div className="font-serif text-2xl lg:text-3xl font-bold tracking-tight text-ink group-hover:text-tp transition-colors">
          {value}
        </div>
        {hint ? (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-variant">
            <span className="truncate">{hint}</span>
            {href || onClick ? (
              <MsIcon
                name="arrow_right_alt"
                className="shrink-0 text-[16px] text-tp opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100"
              />
            ) : null}
          </div>
        ) : null}
      </div>
      {deltaLabel ? <span className="sr-only">{deltaLabel}</span> : null}
    </Comp>
  );
}

/** Small stat cell used inside detail pages (label + value + foot). */
export function StitchStat({
  label,
  value,
  foot,
  icon,
  valueClass,
  className,
}: {
  label: string;
  value: React.ReactNode;
  foot?: React.ReactNode;
  icon?: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col justify-between rounded-xl bg-sfc-lowest p-4 shadow-sm", className)}>
      <div className="mb-2 flex items-center justify-between text-tsc">
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        {icon ? <MsIcon name={icon} className="text-[16px] text-tt" /> : null}
      </div>
      <div>
        <p className={cn("font-serif text-sm font-bold text-ink", valueClass)}>{value}</p>
        {foot ? <p className="mt-2 text-[10px] font-semibold text-tp">{foot}</p> : null}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Badges & pills                                                    */
/* ──────────────────────────────────────────────────────────────── */

export type StitchTone = "default" | "positive" | "negative" | "warning" | "info" | "muted";

const pillTone: Record<StitchTone, string> = {
  default: "bg-sfc-high text-ink-variant",
  positive: "bg-tp-fixed text-tp-fixed-variant",
  negative: "bg-terr-container text-terr",
  warning: "bg-tt-fixed text-tt-fixed-variant",
  info: "bg-tsc-container text-tsc",
  muted: "bg-sfc text-ink-variant",
};

/** Semantic pill badge — maps UX tones onto stitch container colors. */
export function StitchPill({
  tone = "default",
  icon,
  children,
  className,
}: {
  tone?: StitchTone;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        pillTone[tone],
        className,
      )}
    >
      {icon ? <MsIcon name={icon} className="text-[13px]" /> : null}
      {children}
    </span>
  );
}

/** Mono chip — for IDs / hashes / machine values. */
export function StitchMonoChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-sfc-high px-2 py-0.5 font-mono text-xs font-semibold text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Filter chip row — the platform-filter pattern from trading_overview. */
export function StitchFilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; count?: number; dotClass?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex items-center gap-2 overflow-x-auto pb-1", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs shadow-sm transition-colors",
              active
                ? "bg-tp font-semibold text-on-primary"
                : "bg-sfc font-medium text-ink hover:bg-sfc-high",
            )}
          >
            {opt.dotClass ? <span className={cn("h-1.5 w-1.5 rounded-full", opt.dotClass)} /> : null}
            <span>{opt.label}</span>
            {opt.count !== undefined ? (
              <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-black/10" : "text-ink-variant")}>
                {opt.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Buttons — stitch surface buttons                                  */
/* ──────────────────────────────────────────────────────────────── */

export function StitchButton({
  children,
  icon,
  variant = "surface",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  variant?: "surface" | "primary" | "ghost" | "destructive" | "outline";
}) {
  const styles: Record<string, string> = {
    surface:
      "bg-sfc text-ink-variant hover:bg-sfc-high hover:text-ink",
    primary:
      "bg-tp text-on-primary hover:bg-tp/90 shadow-sm",
    ghost: "text-tp hover:bg-sfc",
    destructive:
      "bg-terr-container/40 text-terr hover:bg-terr-container",
    outline:
      "border border-outline-variant bg-sfc-lowest text-ink-variant hover:bg-sfc",
  };
  return (
    <Button
      className={cn(
        "h-9 gap-1.5 rounded-xl px-3.5 text-xs font-semibold",
        styles[variant],
        className,
      )}
      {...rest}
    >
      {icon ? <MsIcon name={icon} className="text-[16px]" /> : null}
      {children}
    </Button>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Timeline — vertical activity / audit / lifecycle pattern          */
/* ──────────────────────────────────────────────────────────────── */

export function StitchTimeline({
  items,
  className,
}: {
  items: {
    icon?: React.ReactNode;
    dotClass?: string;
    title: React.ReactNode;
    time?: React.ReactNode;
    body?: React.ReactNode;
    meta?: React.ReactNode;
  }[];
  className?: string;
}) {
  return (
    <div className={cn("relative flex flex-col", className)}>
      <div className="absolute bottom-3 left-3 top-3 z-0 w-0.5 bg-sfc-high" />
      <div className="z-10 flex flex-col gap-5">
        {items.map((item, i) => (
          <div key={i} className="group flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sfc-lowest",
              )}
            >
              {item.icon ?? (
                <span className={cn("h-2.5 w-2.5 rounded-full", item.dotClass ?? "bg-tp")} />
              )}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-bold text-ink group-hover:text-tp transition-colors">
                  {item.title}
                </span>
                {item.time ? (
                  <span className="shrink-0 text-[11px] font-medium text-ink-variant">{item.time}</span>
                ) : null}
              </div>
              {item.body ? (
                <p className="mt-0.5 text-xs leading-snug text-ink-variant">{item.body}</p>
              ) : null}
              {item.meta ? <div className="mt-1.5 flex items-center gap-2">{item.meta}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Stepper — lifecycle / wizard pattern                              */
/* ──────────────────────────────────────────────────────────────── */

export function StitchStepper({
  steps,
  className,
}: {
  steps: {
    label: string;
    time?: string;
    body?: React.ReactNode;
    state: "done" | "active" | "pending";
    badge?: React.ReactNode;
  }[];
  className?: string;
}) {
  return (
    <div className={cn("relative space-y-7 pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-2 before:w-0.5 before:bg-tp/40", className)}>
      {steps.map((s, i) => (
        <div key={i} className="group relative">
          <div
            className={cn(
              "absolute -left-6 top-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-sm",
              s.state === "done"
                ? "bg-tp text-on-primary"
                : s.state === "active"
                  ? "bg-tt text-white"
                  : "bg-sfc-high text-ink-variant",
            )}
          >
            {s.state === "done" ? <Check className="h-3 w-3" /> : i + 1}
          </div>
          <div
            className={cn(
              "ml-2 rounded-xl p-4",
              s.state === "pending" ? "bg-sfc" : "bg-sfc-low shadow-sm",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wide",
                  s.state === "done" ? "text-ink" : s.state === "active" ? "text-tt-fixed-variant" : "text-ink-variant",
                )}
              >
                {i + 1}. {s.label}
              </span>
              {s.time ? <span className="font-mono text-[11px] text-tsc">{s.time}</span> : null}
            </div>
            {s.body ? <p className="mt-1.5 text-xs leading-relaxed text-ink-variant">{s.body}</p> : null}
            {s.badge ? <div className="mt-2.5 flex flex-wrap gap-2">{s.badge}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Attention strip — Action Required / Warnings / Info               */
/* ──────────────────────────────────────────────────────────────── */

export function StitchAttentionStrip({
  items,
  className,
}: {
  items: {
    tone: StitchTone;
    icon: string;
    label: string;
    detail: string;
    onClick?: () => void;
  }[];
  className?: string;
}) {
  const toneIcon: Record<StitchTone, string> = {
    positive: "bg-tp-fixed text-tp-fixed-variant",
    negative: "bg-terr-container text-terr",
    warning: "bg-tt-fixed text-tt-fixed-variant",
    info: "bg-tsc-container text-tsc",
    default: "bg-sfc-high text-ink-variant",
    muted: "bg-sfc text-ink-variant",
  };
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-xl bg-sfc-low p-2.5 shadow-sm", className)}>
      <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-tsc">Needs attention</span>
      {items.length === 0 ? (
        <span className="px-1 text-xs text-ink-variant">All clear — nothing requires action.</span>
      ) : (
        items.map((it, i) => (
          <button
            key={i}
            type="button"
            onClick={it.onClick}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-shadow hover:shadow-sm",
              toneIcon[it.tone],
            )}
          >
            <MsIcon name={it.icon} className="text-[14px]" />
            {it.label}
            <span className="font-mono text-[10px] opacity-70">{it.detail}</span>
          </button>
        ))
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Table — warm stitch table with uppercase micro headers            */
/* ──────────────────────────────────────────────────────────────── */

export function StitchTable<T>({
  columns,
  rows,
  onRowClick,
  emptyState,
  keyOf,
  className,
}: {
  columns: {
    header: React.ReactNode;
    cell: (row: T) => React.ReactNode;
    className?: string;
    numeric?: boolean;
  }[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  keyOf: (row: T) => React.Key;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl bg-sfc-low/40", className)}>
      {rows.length === 0 && emptyState ? (
        <div className="p-8">{emptyState}</div>
      ) : (
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-sfc text-[11px] font-semibold uppercase tracking-wider text-ink">
              {columns.map((c, i) => (
                <th
                  key={i}
                  className={cn(
                    "whitespace-nowrap px-3.5 py-3",
                    c.numeric && "text-right tabular-nums",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-sfc-high/60 text-ink-variant">
            {rows.map((row) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "transition-colors hover:bg-sfc-high/30",
                  onRowClick && "cursor-pointer",
                )}
              >
                {columns.map((c, i) => (
                  <td
                    key={i}
                    className={cn("px-3.5 py-3", c.numeric && "text-right tabular-nums", c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Sheets / dialogs — stitch-state wrappers                          */
/* ──────────────────────────────────────────────────────────────── */

export function StitchSheet({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[85vh] gap-0 overflow-hidden rounded-2xl bg-sfc-low p-0 sm:max-w-lg",
          wide && "sm:max-w-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sfc-high bg-sfc-low px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tp/10 text-tp">
                <MsIcon name={icon} className="text-[18px]" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h3 className="font-serif text-base font-bold text-ink truncate">{title}</h3>
              {description ? (
                <p className="mt-0.5 truncate text-xs text-ink-variant">{description}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-ink-variant transition-colors hover:bg-sfc hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-sfc-high bg-sfc-low px-6 py-3.5">
            {footer}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Destructive confirmation — stitch AlertDialog pattern (UX §24). */
export function StitchConfirm({
  open,
  onOpenChange,
  icon = "warning",
  title,
  body,
  confirmLabel,
  onConfirm,
  destructive = true,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  icon?: string;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <StitchSheet
      open={open}
      onOpenChange={onOpenChange}
      icon={icon}
      title={title}
      footer={
        <>
          <StitchButton variant="surface" onClick={() => onOpenChange(false)}>
            Cancel
          </StitchButton>
          <StitchButton
            variant={destructive ? "destructive" : "primary"}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </StitchButton>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-ink-variant">{body}</p>
        {children}
      </div>
    </StitchSheet>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Empty states — explanatory (UX §30)                               */
/* ──────────────────────────────────────────────────────────────── */

export function StitchEmpty({
  icon = "inbox",
  title,
  body,
  action,
  className,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-14 text-center", className)}>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sfc text-ink-muted">
        <MsIcon name={icon} className="text-[28px]" />
      </span>
      <h3 className="font-serif text-base font-bold text-ink">{title}</h3>
      <p className="max-w-sm text-xs leading-relaxed text-ink-variant">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */
/* Progress + meters                                                 */
/* ──────────────────────────────────────────────────────────────── */

export function StitchProgress({
  value,
  tone = "positive",
  className,
}: {
  value: number;
  tone?: StitchTone;
  className?: string;
}) {
  const bar: Record<StitchTone, string> = {
    positive: "bg-tp",
    negative: "bg-terr",
    warning: "bg-tt",
    info: "bg-tsc",
    default: "bg-tp",
    muted: "bg-ink-muted",
  };
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-sfc-high", className)}>
      <div
        className={cn("h-full rounded-full transition-all", bar[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Segmented control — 7d/30d/90d style pill toggle. */
export function StitchSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-sfc-low p-1 text-xs font-semibold text-ink-variant", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 transition-colors",
            o.value === value ? "bg-tp text-on-primary shadow-sm" : "hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Info hint — contextual help popover (UX §33). */
export function StitchInfoHint({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("group relative inline-flex", className)} tabIndex={0}>
      <Info className="h-3.5 w-3.5 cursor-help text-ink-muted transition-colors hover:text-ink" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-[11px] font-medium leading-snug text-cream opacity-0 shadow-xl transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

/** Detail row — label/value row used across detail pages. */
export function StitchDetailRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg bg-sfc-low px-3 py-2 text-xs",
        className,
      )}
    >
      <span className="font-medium text-tsc">{label}</span>
      <span className="truncate text-right font-semibold text-ink">{value}</span>
    </div>
  );
}

/** Collapsible section card (Account Configuration pattern). */
export function StitchSection({
  icon,
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <StitchCard className={cn("p-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tp/10 text-tp">
              <MsIcon name={icon} className="text-[18px]" />
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="block font-serif text-sm font-bold text-ink">{title}</span>
            {description ? (
              <span className="block text-xs text-ink-variant">{description}</span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-ink-variant transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? <div className="border-t border-sfc-high px-5 py-4">{children}</div> : null}
    </StitchCard>
  );
}

/** Breadcrumb sub-header — detail-page pattern (back link + trail). */
export function StitchSubHeader({
  back,
  trail,
  right,
}: {
  back?: { label: string; onClick?: () => void; href?: string };
  trail?: string[];
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-sfc-low px-5 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {back ? (
          <a
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-tp transition-colors hover:bg-sfc"
            href={back.href ?? "#"}
            onClick={(e) => {
              if (!back.href) e.preventDefault();
              back.onClick?.();
            }}
          >
            <MsIcon name="arrow_back" className="text-[16px]" />
            {back.label}
          </a>
        ) : null}
        {back && trail ? <div className="h-4 w-px bg-outline-variant/60" /> : null}
        {trail ? (
          <nav className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-tsc">
            {trail.map((t, i) => (
              <React.Fragment key={i}>
                {i > 0 ? <span className="text-outline-variant">/</span> : null}
                <span className={i === trail.length - 1 ? "text-ink" : ""}>{t}</span>
              </React.Fragment>
            ))}
          </nav>
        ) : null}
      </div>
      {right ? <div className="flex flex-wrap items-center gap-3">{right}</div> : null}
    </div>
  );
}

/** Sticky bottom action bar — entity detail pattern. */
export function StitchActionBar({
  left,
  right,
  className,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-30 -mx-4 mt-2 flex flex-wrap items-center justify-between gap-4 border-t border-sfc-high bg-sfc-lowest/95 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3">{left}</div>
      <div className="flex flex-wrap items-center gap-2.5">{right}</div>
    </div>
  );
}

/** Explainable state badge — stitch wrapper with meaning (UX §17/§18). */
export function StitchStateBadge({
  state,
  meaning,
  tone = "default",
  className,
}: {
  state: string;
  meaning?: string;
  tone?: StitchTone;
  className?: string;
}) {
  return (
    <span title={meaning} className={cn("inline-flex", className)}>
      <StitchPill tone={tone} icon={tone === "negative" ? "error" : undefined}>
        {state}
      </StitchPill>
    </span>
  );
}

export { Badge };
