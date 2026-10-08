"use client";

/**
 * PFaaS Platform — Chart primitives
 *
 * Spec section 28. Reusable chart wrappers on top of recharts. Handles
 * loading, empty, tooltip, legend, responsive sizing, date & currency
 * formatting. Modules consume these instead of building their own.
 */

import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Loader2, Inbox } from "lucide-react";

export interface SeriesPoint {
  [key: string]: string | number;
}

const AXIS_STYLE = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
  color: "var(--popover-foreground)",
};

function useHasSize(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [hasSize, setHasSize] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") {
      // Fallback: assume size exists (avoids permanently hidden charts).
      // Deferred to a rAF so we don't setState synchronously in the effect.
      const raf = requestAnimationFrame(() => setHasSize(true));
      return () => cancelAnimationFrame(raf);
    }
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      setHasSize(!!box && box.width > 0 && box.height > 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return hasSize;
}

function ChartFrame({ height = 200, children }: { height?: number; children: React.ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const hasSize = useHasSize(frameRef);
  return (
    <div ref={frameRef} style={{ width: "100%", height }}>
      {/* Mounting ResponsiveContainer inside a zero-size parent (hidden tab,
          unsized GridStack item, collapsed panel) makes recharts spam
          "width(0) and height(0)" warnings and can render invisible charts.
          Wait for a real box before mounting. */}
      {hasSize ? (
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

export function ChartLoading({ height = 200 }: { height?: number }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-muted-foreground" style={{ height }}>
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

export function ChartEmpty({ label = "No data", height = 200 }: { label?: string; height?: number }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground" style={{ height }}>
      <Inbox className="h-5 w-5" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

/* Line chart — for equity curves, trends */
export function LineSeries({
  data,
  xKey,
  yKey,
  color = "var(--brand-primary)",
  height = 200,
  formatValue,
}: {
  data: SeriesPoint[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return <ChartEmpty height={height} />;
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => formatValue ? formatValue(Number(v)) : String(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatValue ? formatValue(v) : v} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ChartFrame>
  );
}

/* Area chart — for revenue, growth */
export function AreaSeries({
  data,
  xKey,
  yKey,
  color = "var(--brand-primary)",
  height = 200,
  formatValue,
}: {
  data: SeriesPoint[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return <ChartEmpty height={height} />;
  const gid = `area-${yKey}-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => formatValue ? formatValue(Number(v)) : String(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatValue ? formatValue(v) : v} />
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} fill={`url(#${gid})`} />
      </AreaChart>
    </ChartFrame>
  );
}

/* Bar chart — for comparisons. Auto-rotates long axis labels. */
export function BarSeries({
  data,
  xKey,
  yKey,
  color = "var(--brand-primary)",
  height = 200,
  formatValue,
}: {
  data: SeriesPoint[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return <ChartEmpty height={height} />;
  // Rotate labels if any are longer than 6 chars
  const maxLabelLen = Math.max(...data.map((d) => String(d[xKey] ?? "").length));
  const shouldRotate = maxLabelLen > 6;
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: shouldRotate ? 40 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_STYLE}
          tickLine={false}
          axisLine={false}
          minTickGap={4}
          angle={shouldRotate ? -35 : 0}
          textAnchor={shouldRotate ? "end" : "middle"}
          height={shouldRotate ? 50 : 30}
          interval={0}
        />
        <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => formatValue ? formatValue(Number(v)) : String(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatValue ? formatValue(v) : v} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

/* Donut — for distributions */
export function DonutSeries({
  data,
  height = 200,
  formatValue,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  if (!data.length) return <ChartEmpty height={height} />;
  const total = data.reduce((s, d) => s + d.value, 0);
  const chartData = data.map((d) => ({ name: d.label, value: d.value, fill: d.color }));
  return (
    <div className="flex flex-col items-center gap-2 sm:flex-row" style={{ minHeight: height }}>
      <ChartFrame height={height}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatValue ? formatValue(v) : v} />
        </PieChart>
      </ChartFrame>
      <div className="flex flex-col gap-1 text-xs">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: d.color }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-medium text-foreground">
              {total ? Math.round((d.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Sparkline — tiny trend for metric cards */
export function Sparkline({
  data,
  color = "var(--brand-primary)",
  height = 40,
}: {
  data: number[];
  color?: string;
  height?: number;
}) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ChartFrame height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill="url(#spark)" />
      </AreaChart>
    </ChartFrame>
  );
}
