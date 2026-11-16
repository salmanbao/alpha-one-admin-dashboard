import { formatMoney } from "@/components/terra/terra-ui";
import type { ComplianceSnapshot } from "@/lib/compliance/compliance-store";

/**
 * Compliance gauges (R7 I2) — SVG arc gauges in the Terra kit.
 *
 * BufferGauge: distance to the drawdown floor as % of the total
 * allowance, color-shifted (and labeled, never color-alone) — the final
 * 20% of buffer is the warning zone that also drives the
 * `compliance.buffer-warning` inbox receipt.
 *
 * ObjectiveGauge: a live gauge for one objective row; `inverted` marks
 * "less is better" rules (daily loss, consistency) so the arc colors
 * run the right way.
 */

const SEMI = Math.PI * 44; // half-circle length for r=44

function ArcGauge({
  pct,
  center,
  caption,
  color,
  ariaLabel,
  size = 132,
}: {
  pct: number;
  center: string;
  caption: string;
  color: string;
  ariaLabel: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <svg
      viewBox="0 0 120 72"
      width={size}
      height={(size * 72) / 120}
      role="meter"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className="shrink-0"
    >
      <path
        d="M 16 60 A 44 44 0 0 1 104 60"
        fill="none"
        stroke="currentColor"
        className="text-surface-container-high"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M 16 60 A 44 44 0 0 1 104 60"
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(SEMI * clamped) / 100} ${SEMI}`}
      />
      <text
        x="60"
        y="52"
        textAnchor="middle"
        className="fill-current font-headline text-[17px] font-bold text-on-surface"
      >
        {center}
      </text>
      <text
        x="60"
        y="66"
        textAnchor="middle"
        className="fill-current text-[8px] font-semibold uppercase tracking-wide text-on-surface-variant"
      >
        {caption}
      </text>
    </svg>
  );
}

/** Remaining drawdown buffer — distance to the floor, color-shifted. */
export function BufferGauge({ snapshot }: { snapshot: ComplianceSnapshot }) {
  const pct = snapshot.total.bufferPct;
  // Final 20% of the buffer = critical (mirrors the warning emission).
  const zone =
    pct < 20
      ? { color: "#e11d48", label: "Critical — final 20%", badge: "error" as const }
      : pct < 50
        ? { color: "#f59e0b", label: "Watch", badge: "tertiary" as const }
        : { color: "#16a34a", label: "Healthy", badge: "success" as const };
  return (
    <div className="flex items-center gap-4">
      <ArcGauge
        pct={pct}
        center={`${Math.round(pct)}%`}
        caption="buffer left"
        color={zone.color}
        ariaLabel={`Drawdown buffer: ${Math.round(pct)}% of the allowance remains — ${zone.label}`}
      />
      <div className="space-y-1.5">
        <p className="font-headline text-xl font-bold tabular-nums text-on-surface">
          {formatMoney(snapshot.total.buffer)}
        </p>
        <p className="text-xs text-on-surface-variant">
          to the floor at {formatMoney(snapshot.total.floor)} (equity{" "}
          {formatMoney(snapshot.equityToday)})
        </p>
        <p className="text-[11px] font-semibold text-on-surface-variant">
          {formatMoney(snapshot.total.used)} of {formatMoney(snapshot.total.limit)} used
        </p>
        <span
          className={
            "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold " +
            (zone.badge === "error"
              ? "bg-error/10 text-error"
              : zone.badge === "tertiary"
                ? "bg-tertiary/15 text-on-tertiary-container"
                : "bg-primary/10 text-primary")
          }
        >
          {zone.label}
        </span>
      </div>
    </div>
  );
}

/**
 * Live gauge for one objective row (R7 I2 — Objectives page).
 * `inverted` = the rule is a cap (daily loss / consistency): more used
 * is worse, so the arc colors run low→green, high→red.
 */
export function ObjectiveGauge({
  label,
  value,
  target,
  unit,
  inverted = false,
  formatValue,
  size = 132,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  inverted?: boolean;
  formatValue?: (n: number) => string;
  size?: number;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 100;
  const healthy = inverted ? pct < 80 : pct >= 100;
  const watch = inverted ? pct >= 80 && pct < 100 : pct >= 70 && pct < 100;
  const color = healthy ? "#16a34a" : watch ? "#f59e0b" : inverted ? "#e11d48" : "#4a7c59";
  const fmt = (n: number) => (formatValue ? formatValue(n) : String(n));
  const stateLabel = healthy
    ? inverted
      ? "within limit"
      : "target met"
    : watch
      ? "watch"
      : inverted
        ? "limit reached"
        : "in progress";
  return (
    <ArcGauge
      pct={pct}
      center={`${Math.round(pct)}%`}
      caption={label}
      color={color}
      size={size}
      ariaLabel={`${label}: ${fmt(value)} of ${fmt(target)}${unit === "USD" ? "" : ` ${unit}`} — ${stateLabel}`}
    />
  );
}

/** Compact gauge footer — value vs target under an ObjectiveGauge. */
export function GaugeFoot({ value, target, unit, format }: {
  value: number;
  target: number;
  unit: string;
  format?: (n: number) => string;
}) {
  const fmt = (n: number) => (format ? format(n) : unit === "USD" ? formatMoney(n) : `${n}${unit === "%" ? "%" : unit === "days" ? " days" : ""}`);
  return (
    <p className="text-xs text-on-surface-variant tabular-nums">
      <span className="font-bold text-on-surface">{fmt(value)}</span> of {fmt(target)}
    </p>
  );
}
