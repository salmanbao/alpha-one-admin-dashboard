"use client";

/**
 * Analytics Module — page components.
 *
 * Five views rendered here:
 *  1. AnalyticsOverviewPage  — KPI strip + multi-currency + 4 trend charts.
 *  2. TraderAnalyticsPage    — Trader leaderboard + win/loss distribution
 *                              + Top-5 equity curves + activity tiers.
 *  3. PerformanceAnalyticsPage — by challenge type / phase / symbol /
 *                              country / hour-of-day breakdowns.
 *  4. RiskAnalyticsPage      — VaR / Expected Shortfall / Max Drawdown /
 *                              Sharpe + drawdown distribution + VaR
 *                              confidence curve + risk-ranked accounts
 *                              + breach-type breakdown.
 *  5. AdvancedAnalyticsPage  — FeatureGuard + cohort retention preview.
 *
 * UX Constitution anchors:
 *  - §8  Density rule   — every chart & KPI justifies its existence.
 *  - §9  KPI rule       — value + context + delta + deltaLabel.
 *  - §19 Explainability — formulas surfaced inline via LabelWithHelp.
 *  - §33 Contextual help — ⓘ on VaR, ES, Sharpe, Profit Factor.
 *  - §70 Analytics UX   — Overview → Trend → Segment → Drill → Entity.
 *
 * Terra palette ONLY — emerald / amber / rose / slate / sky / teal.
 * Deterministic mock via Math.sin / hashStr (no Math.random).
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import {
  revenueSeries,
  traderGrowthSeries,
  riskDistribution,
  breachTrend,
  getTenantTraders,
  getTenantAccounts,
  getTenantPayouts,
  getTenantBreaches,
  hashStr,
  type Trader,
  type TradingAccount,
  type Breach,
} from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { formatCurrency, formatCompact, StatusBadge, traderStatusTone } from "@/components/platform/status";
import { AreaSeries, BarSeries, DonutSeries } from "@/components/platform/charts";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Brain,
  Download,
  Trophy,
  Target,
  Gauge,
  Percent,
  Sigma,
  AlertTriangle,
  Flag,
  Wallet,
  Crown,
  Award,
  Activity as ActivityIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionGuard, FeatureGuard } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/platform/export-utils";
import { convertCurrency, formatConverted, getRateLabel, CURRENCIES } from "@/lib/platform/currency";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Coins } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ================================================================== */
/* Terra palette                                                      */
/* ================================================================== */

const TERRA = {
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#e11d48",
  slate: "#64748b",
  sky: "#0ea5e9",
  teal: "#0d9488",
  forest: "#4a7c59",
  muted: "#78716c",
} as const;

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
  color: "var(--popover-foreground)",
};

const AXIS_STYLE = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

/* ================================================================== */
/* Local helpers                                                      */
/* ================================================================== */

/** Card wrapper for charts / breakdowns (matches existing analytics style). */
function ChartCard({
  title,
  subtitle,
  help,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${className ?? ""}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Explainable metric card — mirrors `MetricCard` (from platform/page) but
 * accepts an optional `help` ReactNode rendered inline next to the label
 * so technical KPIs (VaR, ES, Sharpe, Profit Factor) can show a ⓘ tooltip
 * per UX Constitution §33 without requiring changes to `MetricCard`.
 */
function ExplainableMetricCard({
  label,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  tone = "default",
  help,
}: {
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  tone?: "default" | "positive" | "negative" | "warning";
  help?: React.ReactNode;
}) {
  const toneColor =
    tone === "positive" ? "#059669" : tone === "negative" ? "#e11d48" : tone === "warning" ? "#d97706" : "var(--brand-primary)";
  const deltaClass = delta === undefined ? "" : delta >= 0 ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: toneColor }} />
      <div className="flex items-start justify-between pl-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {help ? <LabelWithHelp help={help}>{label}</LabelWithHelp> : label}
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
          {delta !== undefined || deltaLabel ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              {delta !== undefined ? (
                <span className={`inline-flex items-center gap-0.5 font-semibold ${deltaClass}`}>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
                </span>
              ) : null}
              {deltaLabel ? <span className="text-muted-foreground/80">{deltaLabel}</span> : null}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div className="ml-2 shrink-0 rounded-md bg-muted/50 p-1.5 transition-colors group-hover:bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" style={{ color: toneColor }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Convert ISO-2 country code (e.g. "US") to a flag emoji (🇺🇸). */
function countryFlagEmoji(country: string): string {
  if (!country || country.length !== 2) return "🏳️";
  const cc = country.toUpperCase();
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  return String.fromCodePoint(
    A + (cc.charCodeAt(0) - base),
    A + (cc.charCodeAt(1) - base),
  );
}

/**
 * Deterministic profit-factor proxy.
 *
 * Real PF = gross profit / gross loss. The mock only exposes signed PnL,
 * so we synthesize a stable per-trader value in [0.6, 2.6] using the
 * trader's `winRate` (acts as the seed) plus a hashStr jitter so two
 * traders with the same winRate still differ — mirroring real variance
 * in risk-reward ratios.
 */
function deriveProfitFactor(trader: Trader): number {
  const h = hashStr(trader.id);
  const wr = trader.winRate / 100;
  const jitter = ((h % 1000) / 1000 - 0.5) * 0.45; // ±0.225
  const pf = 0.6 + wr * 1.8 + jitter; // baseline 0.6 → up to ~2.65
  return Math.max(0.5, Math.round(pf * 100) / 100);
}

/**
 * Deterministic 30-day PnL for a trader — anchors the leaderboard.
 *
 * Uses the trader's signed totalPnl plus a hashStr-seeded slice so the
 * leaderboard column is stable across reloads and looks distinct from
 * the cumulative equity number.
 */
function derive30dPnl(trader: Trader): number {
  const h = hashStr(trader.id + "30d");
  const slice = 0.25 + ((h % 100) / 100) * 0.4; // 0.25–0.65
  return Math.round(trader.totalPnl * slice);
}

/** Bucket a trader into an activity tier by trade count. */
function activityTier(trades: number): "Low" | "Medium" | "High" | "Power" {
  if (trades < 10) return "Low";
  if (trades < 50) return "Medium";
  if (trades < 100) return "High";
  return "Power";
}

/** Inline grouped bar chart — used for Phase × (Pass% / Avg PnL). */
function GroupedBars({
  data,
  xKey,
  series,
  height = 240,
  formatValue,
  rightSeries,
  rightFormatValue,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
  formatValue?: (v: number) => string;
  rightSeries?: { key: string; label: string; color: string };
  rightFormatValue?: (v: number) => string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={8} />
          <YAxis
            yAxisId="left"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
          />
          {rightSeries ? (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => (rightFormatValue ? rightFormatValue(Number(v)) : String(v))}
            />
          ) : null}
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number, name: string) => {
              if (rightSeries && name === rightSeries.label && rightFormatValue) {
                return rightFormatValue(v);
              }
              return formatValue ? formatValue(v) : v;
            }}
            cursor={{ fill: "var(--muted)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          {series.map((s) => (
            <Bar key={s.key} yAxisId="left" dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} />
          ))}
          {rightSeries ? (
            <Bar yAxisId="right" dataKey={rightSeries.key} name={rightSeries.label} fill={rightSeries.color} radius={[3, 3, 0, 0]} />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Per-bar colored chart — green / amber / rose based on the value sign. */
function ColoredBars({
  data,
  xKey,
  yKey,
  height = 240,
  formatValue,
  colorFor,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  height?: number;
  formatValue?: (v: number) => string;
  colorFor?: (v: number) => string;
}) {
  const defaultColor = (v: number) =>
    v >= 0 ? TERRA.emerald : TERRA.rose;
  const pick = colorFor ?? defaultColor;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={0} interval={2} />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => (formatValue ? formatValue(v) : v)}
            cursor={{ fill: "var(--muted)" }}
          />
          <Bar dataKey={yKey} radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={pick(Number(d[yKey]))} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Multi-line chart — used for Top-N equity curves overlaid on one axis. */
function MultiLineChart({
  data,
  xKey,
  series,
  height = 260,
  formatValue,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={AXIS_STYLE} tickLine={false} axisLine={false} minTickGap={20} />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => (formatValue ? formatValue(v) : v)}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================== */
/* 1. Analytics Overview (unchanged — out of scope of this task)      */
/* ================================================================== */

export function AnalyticsOverviewPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const tenantCurrency = runtime.tenant?.currency ?? "USD";
  const [displayCurrency, setDisplayCurrency] = useState(tenantCurrency);
  const rev = revenueSeries(tid);
  const totalRev = rev.reduce((s, r) => s + r.value, 0);
  // Convert to display currency
  const convertedRev = convertCurrency(totalRev, tenantCurrency, displayCurrency);
  const convertedAvg = convertCurrency(totalRev / 30, tenantCurrency, displayCurrency);
  const fmt = (v: number) => formatConverted(v, tenantCurrency, displayCurrency);

  return (
    <Page>
      <PageHeader
        title="Analytics"
        description={`Business intelligence across this ${term("trader").toLowerCase()} tenant.`}
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2">
            {/* Multi-currency selector */}
            <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs">
              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className="bg-transparent text-xs font-medium outline-none"
                aria-label="Display currency"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} {c.symbol}</option>
                ))}
              </select>
            </div>
            <PermissionGuard permission="analytics.export">
              <Button size="sm" variant="outline" onClick={() => {
                const rev = revenueSeries(tid);
                exportToCsv(
                  rev,
                  [
                    { key: "date", header: "Date", value: (r) => r.date },
                    { key: "value", header: "Revenue", value: (r) => r.value },
                  ],
                  `analytics-revenue-${new Date().toISOString().slice(0, 10)}.csv`,
                );
              }}>
                <Download className="mr-1 h-4 w-4" /> Export CSV
              </Button>
            </PermissionGuard>
          </div>
        }
      />
      <PageContent>
        {/* Exchange rate banner */}
        {displayCurrency !== tenantCurrency ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
            <Coins className="h-3.5 w-3.5 text-primary" />
            <span className="text-muted-foreground">Converting from</span>
            <Badge variant="outline" className="text-[10px]">{tenantCurrency}</Badge>
            <span className="text-muted-foreground">→</span>
            <Badge variant="outline" className="text-[10px]">{displayCurrency}</Badge>
            <span className="ml-auto font-medium text-foreground">{getRateLabel(tenantCurrency, displayCurrency)}</span>
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Revenue (30d)" value={fmt(totalRev)} delta={8} icon={DollarSign} tone="positive" />
          <MetricCard label="Avg Daily Rev" value={fmt(totalRev / 30)} delta={4} icon={TrendingUp} tone="positive" />
          <MetricCard label={`${term("trader")} Growth`} value="+18%" delta={18} icon={Users} tone="positive" />
          <MetricCard label="Breaches (30d)" value={breachTrend(tid).reduce((s, b) => s + b.value, 0)} delta={-12} icon={Activity} tone="positive" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Revenue (30d) — {displayCurrency}</p>
            <AreaSeries data={rev} xKey="date" yKey="value" formatValue={(v) => fmt(v)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">{`${term("trader")} growth`}</p>
            <AreaSeries data={traderGrowthSeries(tid)} xKey="date" yKey="value" color="#0ea5e9" />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Risk distribution</p>
            <DonutSeries data={riskDistribution(tid)} />
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Breach trend (30d)</p>
            <BarSeries data={breachTrend(tid)} xKey="date" yKey="value" color="#dc2626" />
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ================================================================== */
/* 2. Trader Analytics — leaderboard + distributions                  */
/* ================================================================== */

export function TraderAnalyticsPage() {
  const { runtime, tenant, navigate } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const traders = getTenantTraders(tid);

  // Top 10 by equity (descending).
  const topTraders = [...traders]
    .sort((a, b) => (b.equity ?? 0) - (a.equity ?? 0))
    .slice(0, 10);

  // KPI computations.
  const maxEquity = traders.length ? Math.max(...traders.map((t) => t.equity ?? 0)) : 0;
  const profitableCount = traders.filter((t) => t.winRate >= 50).length;
  const avgWinRate = traders.length
    ? Math.round(traders.reduce((s, t) => s + t.winRate, 0) / traders.length)
    : 0;
  const totalGrossProfit = traders
    .filter((t) => t.totalPnl > 0)
    .reduce((s, t) => s + t.totalPnl, 0);
  const totalGrossLoss = Math.abs(
    traders.filter((t) => t.totalPnl < 0).reduce((s, t) => s + t.totalPnl, 0),
  );
  const profitFactor =
    totalGrossLoss > 0
      ? Math.round((totalGrossProfit / totalGrossLoss) * 100) / 100
      : totalGrossProfit > 0
      ? 2.5
      : 0;

  // Most-traded symbol: deterministic mock from hashStr(tid + "symbol").
  const SYMBOL_SET = ["EURUSD", "XAUUSD", "BTCUSD", "NAS100", "SP500"];
  const mostTradedIdx = hashStr(tid + "most-symbol") % SYMBOL_SET.length;
  const mostTradedSymbol = SYMBOL_SET[mostTradedIdx];

  // Win/Loss distribution buckets.
  const profitable = traders.filter((t) => t.winRate >= 55).length;
  const breakEven = traders.filter((t) => t.winRate >= 45 && t.winRate < 55).length;
  const losing = traders.filter((t) => t.winRate < 45).length;
  const winLossDonut = [
    { label: "Profitable (≥55%)", value: profitable, color: TERRA.emerald },
    { label: "Break-even (45–54%)", value: breakEven, color: TERRA.amber },
    { label: "Losing (<45%)", value: losing, color: TERRA.rose },
  ];

  // Top 5 equity curves — 12 deterministic points each.
  const top5 = topTraders.slice(0, 5);
  const CURVE_PTS = 12;
  const curveData = Array.from({ length: CURVE_PTS }, (_, i) => {
    const row: Record<string, string | number> = { day: `D${i + 1}` };
    for (const t of top5) {
      // Anchor at current equity, weave deterministic sin curve.
      const seed = hashStr(t.id);
      const wobble = Math.sin((i + (seed % 7)) / 3) * (t.equity * 0.04);
      row[t.id] = Math.round((t.equity ?? 0) * (0.85 + i * 0.013) + wobble);
    }
    return row;
  });
  const curveSeries = top5.map((t, idx) => ({
    key: t.id,
    label: `#${idx + 1} ${t.name.split(" ")[0]}`,
    color: [TERRA.emerald, TERRA.teal, TERRA.amber, TERRA.sky, TERRA.slate][idx] ?? TERRA.slate,
  }));

  // Activity distribution buckets.
  const buckets = { Low: 0, Medium: 0, High: 0, Power: 0 };
  for (const t of traders) buckets[activityTier(t.trades)]++;
  const activityData = [
    { tier: "Low (<10)", value: buckets.Low, range: "0–10 trades" },
    { tier: "Medium", value: buckets.Medium, range: "10–50 trades" },
    { tier: "High", value: buckets.High, range: "50–100 trades" },
    { tier: "Power", value: buckets.Power, range: "100+ trades" },
  ];

  // Leaderboard columns.
  const leaderboardCols: Column<Trader>[] = [
    {
      key: "rank",
      header: "#",
      width: "48px",
      cell: (t) => {
        const rank = topTraders.indexOf(t) + 1;
        const tone = rank === 1 ? "text-amber-600" : rank === 2 ? "text-slate-500" : rank === 3 ? "text-orange-700" : "text-muted-foreground";
        return (
          <span className={`inline-flex items-center gap-1 text-sm font-semibold ${tone}`}>
            {rank === 1 ? <Crown className="h-3.5 w-3.5" /> : rank <= 3 ? <Award className="h-3.5 w-3.5" /> : null}
            {rank}
          </span>
        );
      },
    },
    {
      key: "trader",
      header: term("trader"),
      cell: (t) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">
              {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{t.name}</span>
            <span className="text-[10px] text-muted-foreground">{t.email}</span>
          </div>
          <span className="ml-1 text-base" aria-hidden>{countryFlagEmoji(t.country)}</span>
        </div>
      ),
      sortValue: (t) => t.name,
    },
    {
      key: "equity",
      header: "Equity",
      numeric: true,
      cell: (t) => (
        <span className="font-medium text-foreground">{formatCurrency(t.equity ?? 0, currency)}</span>
      ),
      sortValue: (t) => t.equity ?? 0,
    },
    {
      key: "pnl30d",
      header: "30d PnL",
      numeric: true,
      cell: (t) => {
        const v = derive30dPnl(t);
        const tone = v >= 0 ? "text-emerald-600" : "text-rose-600";
        return <span className={`font-medium ${tone}`}>{v >= 0 ? "+" : ""}{formatCurrency(v, currency)}</span>;
      },
      sortValue: (t) => derive30dPnl(t),
    },
    {
      key: "winRate",
      header: "Win Rate",
      numeric: true,
      cell: (t) => <span className="text-foreground">{t.winRate}%</span>,
      sortValue: (t) => t.winRate,
    },
    {
      key: "pf",
      header: "Profit Factor",
      numeric: true,
      cell: (t) => <span className="text-foreground">{deriveProfitFactor(t).toFixed(2)}</span>,
      sortValue: (t) => deriveProfitFactor(t),
    },
    {
      key: "trades",
      header: "Trades",
      numeric: true,
      cell: (t) => <span className="text-foreground">{formatCompact(t.trades)}</span>,
      sortValue: (t) => t.trades,
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => <StatusBadge tone={traderStatusTone(t.status)}>{t.status}</StatusBadge>,
    },
  ];

  return (
    <Page>
      <PageHeader
        title={`${term("trader")} Analytics`}
        description={`Leaderboard, win/loss distribution and equity curves for this ${term("trader").toLowerCase()} tenant.`}
        icon={Users}
      />
      <PageContent>
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label={`Top ${term("trader")} Equity`}
            value={formatCurrency(maxEquity, currency)}
            icon={Trophy}
            tone="positive"
            deltaLabel={`${traders.length} ${plural(term("trader")).toLowerCase()} tracked`}
          />
          <MetricCard
            label="Avg Win Rate"
            value={`${avgWinRate}%`}
            icon={Percent}
            tone="warning"
            deltaLabel={`${profitableCount} ${plural(term("trader")).toLowerCase()} profitable (≥50%)`}
          />
          <ExplainableMetricCard
            label="Profit Factor"
            help={
              <>
                <strong>Profit Factor</strong> = gross profit ÷ gross loss across all tracked {term("trader").toLowerCase()} PnL.
                <br />A value above 1.0 means the cohort is net profitable.
              </>
            }
            value={profitFactor.toFixed(2)}
            icon={TrendingUp}
            tone="positive"
            deltaLabel={`Gross +${formatCurrency(totalGrossProfit, currency)} / −${formatCurrency(totalGrossLoss, currency)}`}
          />
          <MetricCard
            label="Most Traded Symbol"
            value={mostTradedSymbol}
            icon={ActivityIcon}
            deltaLabel="by executed volume (30d)"
          />
        </div>

        {/* Leaderboard */}
        <ChartCard
          title={`${term("trader")} Leaderboard`}
          subtitle={`Top ${topTraders.length} by current equity — click any row to open the ${term("trader").toLowerCase()} workspace.`}
        >
          <DataTable
            columns={leaderboardCols}
            data={topTraders}
            rowKey={(t) => t.id}
            searchableText={(t) => `${t.name} ${t.email} ${t.country}`}
            searchPlaceholder={`Search ${term("trader").toLowerCase()}…`}
            pageSize={10}
            onRowClick={(t) => navigate("trader-detail", { id: t.id })}
            emptyTitle={`No ${term("trader").toLowerCase()} records`}
            emptyDescription={`Once ${plural(term("trader")).toLowerCase()} join this tenant, the leaderboard will surface here.`}
          />
        </ChartCard>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Win/Loss distribution */}
          <ChartCard
            title="Win / Loss Distribution"
            subtitle={`${traders.length} ${plural(term("trader")).toLowerCase()} bucketed by win rate`}
            className="lg:col-span-1"
          >
            <DonutSeries data={winLossDonut} height={220} formatValue={(v) => `${v}`} />
          </ChartCard>

          {/* Top 5 equity curves */}
          <ChartCard
            title="Top 5 Equity Curves (12d)"
            subtitle="Deterministic projection anchored at current equity"
            className="lg:col-span-2"
          >
            {top5.length ? (
              <MultiLineChart
                data={curveData}
                xKey="day"
                series={curveSeries}
                height={240}
                formatValue={(v) => formatCurrency(v, currency)}
              />
            ) : (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                No {term("trader").toLowerCase()} data yet.
              </div>
            )}
          </ChartCard>
        </div>

        {/* Activity distribution */}
        <ChartCard
          title={`${term("trader")} Activity Distribution`}
          subtitle="Bucketed by executed trade count (30d)"
        >
          <BarSeries
            data={activityData}
            xKey="tier"
            yKey="value"
            color={TERRA.teal}
            height={220}
            formatValue={(v) => `${v} ${plural(term("trader")).toLowerCase()}`}
          />
        </ChartCard>
      </PageContent>
    </Page>
  );
}

/* ================================================================== */
/* 3. Performance Analytics — by challenge / phase / symbol / country */
/* ================================================================== */

export function PerformanceAnalyticsPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const traders = getTenantTraders(tid);
  const accounts = getTenantAccounts(tid);
  const payouts = getTenantPayouts(tid);

  // ---- KPI computations ---------------------------------------------------
  const CHALLENGE_TYPES = [
    { id: "1-step", label: "1-Step Evaluation" },
    { id: "2-step", label: "2-Step Evaluation" },
    { id: "3-step", label: "3-Step Evaluation" },
    { id: "funded", label: "Funded" },
  ];

  // Deterministic pass-rate per challenge type (mock — no live challenge-type
  // field on the mock; synthesize from hashStr(tid + typeId)).
  const passRateByType = CHALLENGE_TYPES.map((ct) => {
    const h = hashStr(tid + ct.id);
    const rate = 55 + ((h % 100) / 100) * 30; // 55%–85%
    return { type: ct.label.split(" ")[0], passRate: Math.round(rate), typeId: ct.id };
  });
  const bestChallenge = [...passRateByType].sort((a, b) => b.passRate - a.passRate)[0];

  const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "ETHUSD", "SP500", "NAS100"];
  // Per-symbol deterministic mock metrics.
  const symbolStats = SYMBOLS.map((sym, i) => {
    const h = hashStr(tid + sym);
    const trades = 40 + (h % 380);
    const winRate = 38 + ((h >> 3) % 35);
    const avgPnl = Math.round(Math.sin(i / 2) * 1450 + 320);
    const totalVolume = Math.round((trades * 1000) + (h % 50000));
    const sharpe = Math.round((0.6 + ((h % 100) / 100) * 1.8) * 100) / 100;
    return { symbol: sym, trades, winRate, avgPnl, totalVolume, sharpe };
  });
  const mostProfitableSymbol = [...symbolStats].sort((a, b) => b.avgPnl - a.avgPnl)[0];

  // Per-phase mock.
  const PHASES = [
    { id: "phase-1", label: "Phase 1" },
    { id: "phase-2", label: "Phase 2" },
    { id: "funded", label: "Funded" },
  ];
  const phaseData = PHASES.map((p, i) => {
    const h = hashStr(tid + p.id);
    const passRate = 45 + ((h % 100) / 100) * 45; // 45%–90%
    const avgPnl = Math.round(Math.sin(i) * 1800 + 800);
    return { phase: p.label, passRate: Math.round(passRate), avgPnl };
  });
  const bestPhase = [...phaseData].sort((a, b) => b.passRate - a.passRate)[0];

  // Per-country aggregation from traders.
  const countryAgg = new Map<string, { traders: number; totalEquity: number; totalWinRate: number; totalPayouts: number }>();
  for (const t of traders) {
    const c = t.country;
    const existing = countryAgg.get(c) ?? { traders: 0, totalEquity: 0, totalWinRate: 0, totalPayouts: 0 };
    existing.traders += 1;
    existing.totalEquity += t.equity ?? 0;
    existing.totalWinRate += t.winRate;
    countryAgg.set(c, existing);
  }
  // Country payouts from payouts → traderId → trader country.
  const traderById = new Map(traders.map((t) => [t.id, t]));
  for (const p of payouts) {
    const trader = traderById.get(p.traderId);
    if (!trader) continue;
    const c = trader.country;
    const existing = countryAgg.get(c);
    if (!existing) continue;
    existing.totalPayouts += p.amount;
  }
  const countryRows = Array.from(countryAgg.entries())
    .map(([country, agg]) => {
      const avgEquity = agg.traders ? agg.totalEquity / agg.traders : 0;
      const winRate = agg.traders ? Math.round(agg.totalWinRate / agg.traders) : 0;
      const profitFactor = Math.max(
        0.5,
        Math.round((winRate / 100) * 1.8 + 0.4 + ((hashStr(tid + country) % 100) / 100 - 0.5) * 0.3) * 100,
      ) / 100;
      return { country, traders: agg.traders, avgEquity, winRate, totalPayouts: agg.totalPayouts, profitFactor };
    })
    .sort((a, b) => b.avgEquity - a.avgEquity);
  const bestCountry = countryRows[0];

  // Hour-of-day trade counts (deterministic).
  const hourData = Array.from({ length: 24 }, (_, h) => {
    const seed = hashStr(tid + "h" + h);
    const count = Math.max(0, Math.round(8 + Math.sin(h / 3) * 6 + (seed % 20)));
    // Profitability signal — drives color.
    const profit = Math.sin(h / 2.5) + (seed % 3 === 0 ? 0.4 : -0.4);
    return { hour: `${h}`, trades: count, profit };
  });

  // ---- Columns for symbol performance table -------------------------------
  const symbolCols: Column<(typeof symbolStats)[number]>[] = [
    { key: "symbol", header: "Symbol", cell: (r) => <span className="font-medium text-foreground">{r.symbol}</span>, sortValue: (r) => r.symbol },
    { key: "trades", header: "Trades", numeric: true, cell: (r) => formatCompact(r.trades), sortValue: (r) => r.trades },
    { key: "winRate", header: "Win Rate", numeric: true, cell: (r) => <span className={r.winRate >= 50 ? "text-emerald-600" : "text-rose-600"}>{r.winRate}%</span>, sortValue: (r) => r.winRate },
    { key: "avgPnl", header: "Avg PnL", numeric: true, cell: (r) => <span className={r.avgPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>{r.avgPnl >= 0 ? "+" : ""}{formatCurrency(r.avgPnl, currency)}</span>, sortValue: (r) => r.avgPnl },
    { key: "totalVolume", header: "Total Volume", numeric: true, cell: (r) => formatCompact(r.totalVolume), sortValue: (r) => r.totalVolume },
    {
      key: "sharpe",
      header: "Sharpe",
      numeric: true,
      cell: (r) => <span className="text-foreground">{r.sharpe.toFixed(2)}</span>,
      sortValue: (r) => r.sharpe,
    },
  ];

  // ---- Columns for country performance table ------------------------------
  const countryCols: Column<(typeof countryRows)[number]>[] = [
    {
      key: "country",
      header: "Country",
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden>{countryFlagEmoji(r.country)}</span>
          <span className="font-medium text-foreground">{r.country}</span>
        </span>
      ),
      sortValue: (r) => r.country,
    },
    { key: "traders", header: term("trader") + "s", numeric: true, cell: (r) => r.traders, sortValue: (r) => r.traders },
    { key: "avgEquity", header: "Avg Equity", numeric: true, cell: (r) => formatCurrency(r.avgEquity, currency), sortValue: (r) => r.avgEquity },
    { key: "winRate", header: "Win Rate", numeric: true, cell: (r) => <span className={r.winRate >= 50 ? "text-emerald-600" : "text-rose-600"}>{r.winRate}%</span>, sortValue: (r) => r.winRate },
    { key: "totalPayouts", header: "Total Payouts", numeric: true, cell: (r) => formatCurrency(r.totalPayouts, currency), sortValue: (r) => r.totalPayouts },
    {
      key: "pf",
      header: "Profit Factor",
      numeric: true,
      cell: (r) => <span className="text-foreground">{r.profitFactor.toFixed(2)}</span>,
      sortValue: (r) => r.profitFactor,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Performance Analytics"
        description={`Breakdowns by ${term("challenge").toLowerCase()} type, phase, symbol, country and hour-of-day across all ${plural(term("trader")).toLowerCase()}.`}
        icon={TrendingUp}
      />
      <PageContent>
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label={`Best ${term("challenge")} Type`}
            value={bestChallenge.type}
            icon={Trophy}
            tone="positive"
            deltaLabel={`${bestChallenge.passRate}% pass rate`}
          />
          <MetricCard
            label="Most Profitable Symbol"
            value={mostProfitableSymbol.symbol}
            icon={Target}
            tone="positive"
            deltaLabel={`+${formatCurrency(mostProfitableSymbol.avgPnl, currency)} avg PnL`}
          />
          <MetricCard
            label="Highest Win Rate Phase"
            value={bestPhase.phase}
            icon={Award}
            tone="warning"
            deltaLabel={`${bestPhase.passRate}% pass rate`}
          />
          <MetricCard
            label="Best Performing Country"
            value={bestCountry ? `${countryFlagEmoji(bestCountry.country)} ${bestCountry.country}` : "—"}
            icon={Flag}
            tone="positive"
            deltaLabel={bestCountry ? `${formatCurrency(bestCountry.avgEquity, currency)} avg equity` : ""}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Performance by challenge type */}
          <ChartCard
            title={`Performance by ${term("challenge")} Type`}
            subtitle="Pass rate (%) — share of accounts that advance to the next phase"
          >
            <BarSeries
              data={passRateByType}
              xKey="type"
              yKey="passRate"
              color={TERRA.emerald}
              height={220}
              formatValue={(v) => `${v}%`}
            />
          </ChartCard>

          {/* Performance by phase — grouped */}
          <ChartCard
            title="Performance by Phase"
            subtitle="Pass rate (left axis, %) and average PnL (right axis, currency)"
          >
            <GroupedBars
              data={phaseData}
              xKey="phase"
              series={[
                { key: "passRate", label: "Pass Rate %", color: TERRA.teal },
              ]}
              rightSeries={{ key: "avgPnl", label: "Avg PnL", color: TERRA.amber }}
              formatValue={(v) => `${v}%`}
              rightFormatValue={(v) => formatCurrency(v, currency)}
              height={220}
            />
          </ChartCard>
        </div>

        {/* Symbol performance table */}
        <ChartCard
          title="Performance by Symbol (Top 8)"
          subtitle="Aggregated executed volume, win rate and Sharpe ratio per instrument. Sharpe = (mean return − risk-free rate) ÷ std-dev; above 1.0 is good, above 2.0 is excellent."
        >
          <DataTable
            columns={symbolCols}
            data={symbolStats}
            rowKey={(r) => r.symbol}
            searchableText={(r) => r.symbol}
            searchPlaceholder="Search symbol…"
            pageSize={8}
            emptyTitle="No symbol activity"
            emptyDescription="Once positions are opened on this tenant, per-symbol performance will surface here."
          />
        </ChartCard>

        {/* Country performance table */}
        <ChartCard
          title="Performance by Country"
          subtitle={`Cohort metrics per trader country of residence`}
        >
          <DataTable
            columns={countryCols}
            data={countryRows}
            rowKey={(r) => r.country}
            searchableText={(r) => r.country}
            searchPlaceholder="Search country…"
            pageSize={8}
            emptyTitle={`No ${term("trader").toLowerCase()} cohorts`}
            emptyDescription={`Once ${plural(term("trader")).toLowerCase()} from multiple countries join, country breakdowns will appear here.`}
          />
        </ChartCard>

        {/* Performance by hour of day */}
        <ChartCard
          title="Performance by Hour of Day (UTC)"
          subtitle="Trade count per hour — colored by profitability signal"
        >
          <ColoredBars
            data={hourData}
            xKey="hour"
            yKey="trades"
            height={240}
            formatValue={(v) => `${v} trades`}
            colorFor={(v) => (v >= 12 ? TERRA.emerald : v >= 6 ? TERRA.amber : TERRA.rose)}
          />
        </ChartCard>
      </PageContent>
    </Page>
  );
}

/* ================================================================== */
/* 4. Risk Analytics — VaR / ES / Drawdown / Sharpe + breakdowns      */
/* ================================================================== */

export function RiskAnalyticsPage() {
  const { runtime, tenant, navigate } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const accounts = getTenantAccounts(tid);
  const breaches = getTenantBreaches(tid);
  const traders = getTenantTraders(tid);
  const traderById = new Map(traders.map((t) => [t.id, t]));

  // ---- KPI computations ---------------------------------------------------
  // VaR(95%) — deterministic mock anchored to tenant aggregate equity.
  const totalEquity = accounts.reduce((s, a) => s + a.equity, 0);
  const var95 = Math.round(totalEquity * 0.018 + 8000 + (hashStr(tid + "var95") % 4000));
  const es = Math.round(var95 * 1.39 + 1500);
  const maxDrawdownPct = Math.round((12 + ((hashStr(tid + "dd") % 100) / 100) * 8) * 10) / 10; // 12–20%
  const sharpe = Math.round((1.0 + ((hashStr(tid + "sharpe") % 100) / 100) * 1.0) * 100) / 100; // 1.0–2.0

  // ---- Drawdown distribution buckets -------------------------------------
  const ddBuckets = [
    { bucket: "0–5%", lo: 0, hi: 5 },
    { bucket: "5–10%", lo: 5, hi: 10 },
    { bucket: "10–15%", lo: 10, hi: 15 },
    { bucket: "15–20%", lo: 15, hi: 20 },
    { bucket: "20%+", lo: 20, hi: 100 },
  ];
  const ddData = ddBuckets.map((b, i) => {
    // Deterministic count per bucket — synthesize from accounts + hashStr.
    const seed = hashStr(tid + "dd" + b.bucket);
    const base = Math.max(0, Math.round((accounts.length / 5) + Math.sin(i / 2) * 4 + (seed % 7)));
    return { bucket: b.bucket, accounts: base };
  });

  // ---- VaR confidence curve ---------------------------------------------
  const varCurve = [
    { level: "90%", value: Math.round(var95 * 0.82) },
    { level: "95%", value: var95 },
    { level: "97.5%", value: Math.round(var95 * 1.16) },
    { level: "99%", value: Math.round(var95 * 1.35) },
    { level: "99.9%", value: Math.round(var95 * 1.62) },
  ];

  // ---- Risk-adjusted returns by challenge type ----------------------------
  const challengeSharpe = [
    { type: "1-Step", sharpe: Math.round((0.8 + (hashStr(tid + "s1") % 100) / 100 * 0.8) * 100) / 100 },
    { type: "2-Step", sharpe: Math.round((1.0 + (hashStr(tid + "s2") % 100) / 100 * 0.8) * 100) / 100 },
    { type: "3-Step", sharpe: Math.round((1.2 + (hashStr(tid + "s3") % 100) / 100 * 0.9) * 100) / 100 },
    { type: "Funded", sharpe: Math.round((1.4 + (hashStr(tid + "s4") % 100) / 100 * 0.9) * 100) / 100 },
  ];

  // ---- Top 10 highest risk accounts --------------------------------------
  // Risk score = drawdown % * 0.6 + |open PnL| / equity * 0.4 (mock).
  const riskAccounts = accounts
    .map((a) => {
      const h = hashStr(a.id);
      const drawdownPct = Math.round((4 + (h % 180) / 10) * 10) / 10; // 4–22%
      const openPnl = Math.round((Math.sin(h) * a.equity * 0.08));
      const riskScore = Math.round((drawdownPct * 0.6 + Math.abs(openPnl) / Math.max(1, a.equity) * 100 * 0.4) * 10) / 10;
      const trader = traderById.get(a.traderId);
      return { account: a, trader, drawdownPct, openPnl, riskScore };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);

  const riskCols: Column<(typeof riskAccounts)[number]>[] = [
    {
      key: "account",
      header: "Account",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{r.account.login}</span>
          <span className="text-[10px] text-muted-foreground">{r.account.platform} · {r.account.phase}</span>
        </div>
      ),
      sortValue: (r) => r.account.login,
    },
    {
      key: "trader",
      header: term("trader"),
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          {r.trader ? <span aria-hidden>{countryFlagEmoji(r.trader.country)}</span> : null}
          <span className="text-foreground">{r.account.traderName}</span>
        </span>
      ),
      sortValue: (r) => r.account.traderName,
    },
    {
      key: "equity",
      header: "Equity",
      numeric: true,
      cell: (r) => formatCurrency(r.account.equity, currency),
      sortValue: (r) => r.account.equity,
    },
    {
      key: "dd",
      header: "Drawdown %",
      numeric: true,
      cell: (r) => {
        const tone = r.drawdownPct >= 15 ? "text-rose-600" : r.drawdownPct >= 10 ? "text-amber-600" : "text-emerald-600";
        return <span className={`font-medium ${tone}`}>{r.drawdownPct.toFixed(1)}%</span>;
      },
      sortValue: (r) => r.drawdownPct,
    },
    {
      key: "openPnl",
      header: "Open PnL",
      numeric: true,
      cell: (r) => (
        <span className={r.openPnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
          {r.openPnl >= 0 ? "+" : ""}{formatCurrency(r.openPnl, currency)}
        </span>
      ),
      sortValue: (r) => r.openPnl,
    },
    {
      key: "riskScore",
      header: "Risk Score",
      numeric: true,
      cell: (r) => {
        const tone = r.riskScore >= 12 ? "text-rose-600" : r.riskScore >= 7 ? "text-amber-600" : "text-emerald-600";
        return <span className={`font-semibold ${tone}`}>{r.riskScore.toFixed(1)}</span>;
      },
      sortValue: (r) => r.riskScore,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge tone={r.account.status === "breached" ? "danger" : r.account.status === "passed" ? "success" : r.account.status === "pending" ? "warning" : "info"}>{r.account.status}</StatusBadge>,
    },
  ];

  // ---- Breach type breakdown donut ---------------------------------------
  // 4 actual breach types from mock + 3 risk-rule-derived slices, all
  // deterministic.
  const breachTypeAgg = new Map<string, number>();
  for (const b of breaches) {
    const key = b.type;
    breachTypeAgg.set(key, (breachTypeAgg.get(key) ?? 0) + 1);
  }
  const BREACH_LABELS: Record<Breach["type"], string> = {
    "daily-drawdown": "Daily DD",
    "max-drawdown": "Max DD",
    "profit-target-miss": "Profit Target Miss",
    "time-limit": "Time Limit",
  };
  const BREACH_COLORS: Record<Breach["type"], string> = {
    "daily-drawdown": TERRA.rose,
    "max-drawdown": "#9f1239",
    "profit-target-miss": TERRA.amber,
    "time-limit": TERRA.slate,
  };
  // Add three rule-engine-derived slices (news/weekend/copy).
  const ruleSlices = [
    { label: "Trailing DD", color: "#fb7185", count: Math.max(2, Math.round(breaches.length * 0.4)) },
    { label: "Margin Call", color: TERRA.sky, count: Math.max(1, Math.round(breaches.length * 0.25)) },
    { label: "News Trading", color: TERRA.teal, count: Math.max(1, Math.round(breaches.length * 0.18)) },
  ];
  const breachDonut = [
    ...(Object.keys(BREACH_LABELS) as Breach["type"][]).map((k) => ({
      label: BREACH_LABELS[k],
      color: BREACH_COLORS[k],
      value: breachTypeAgg.get(k) ?? 0,
    })),
    ...ruleSlices.map((r) => ({ label: r.label, color: r.color, value: r.count })),
  ].filter((s) => s.value > 0);

  return (
    <Page>
      <PageHeader
        title="Risk Analytics"
        description={`Value at Risk, drawdown distribution, breach breakdown and risk-ranked accounts across all ${plural(term("trader")).toLowerCase()}.`}
        icon={Activity}
      />
      <PageContent>
        {/* KPI strip — every label is explained per §33 */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ExplainableMetricCard
            label="VaR (95%)"
            help={
              <>
                <strong>Value at Risk (95%)</strong> — the maximum loss expected on 95% of trading days.
                Computed via historical simulation across tenant equity.
              </>
            }
            value={formatCurrency(var95, currency)}
            icon={AlertTriangle}
            tone="negative"
            deltaLabel="1-day horizon"
          />
          <ExplainableMetricCard
            label="Expected Shortfall"
            help={
              <>
                <strong>Expected Shortfall (CVaR)</strong> — average loss on the worst 5% of trading days.
                Always larger than VaR because it averages the tail.
              </>
            }
            value={formatCurrency(es, currency)}
            icon={AlertTriangle}
            tone="negative"
            deltaLabel={`+${Math.round(((es - var95) / Math.max(1, var95)) * 100)}% vs VaR`}
          />
          <ExplainableMetricCard
            label="Max Drawdown"
            help={
              <>
                <strong>Max Drawdown</strong> — the largest peak-to-trough equity decline observed across the tenant portfolio.
              </>
            }
            value={`${maxDrawdownPct.toFixed(1)}%`}
            icon={TrendingUp}
            tone="warning"
            deltaLabel="peak-to-trough"
          />
          <ExplainableMetricCard
            label="Sharpe Ratio"
            help={
              <>
                <strong>Sharpe Ratio</strong> = (mean return − risk-free rate) ÷ std-dev of returns.
                Above 1.0 is acceptable; above 2.0 is excellent.
              </>
            }
            value={sharpe.toFixed(2)}
            icon={Sigma}
            tone="positive"
            deltaLabel="tenant-wide"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Drawdown distribution */}
          <ChartCard
            title="Drawdown Distribution"
            subtitle="Account count bucketed by peak-to-trough drawdown"
          >
            <AreaSeries
              data={ddData}
              xKey="bucket"
              yKey="accounts"
              color={TERRA.rose}
              height={220}
              formatValue={(v) => `${v} accounts`}
            />
          </ChartCard>

          {/* VaR confidence curve */}
          <ChartCard
            title="VaR Confidence Curve"
            subtitle="Loss threshold widens as confidence requirement tightens"
          >
            <AreaSeries
              data={varCurve}
              xKey="level"
              yKey="value"
              color={TERRA.amber}
              height={220}
              formatValue={(v) => formatCurrency(v, currency)}
            />
          </ChartCard>

          {/* Risk-adjusted returns by challenge type */}
          <ChartCard
            title={`Risk-Adjusted Returns by ${term("challenge")} Type`}
            subtitle="Sharpe ratio per challenge category"
          >
            <BarSeries
              data={challengeSharpe}
              xKey="type"
              yKey="sharpe"
              color={TERRA.teal}
              height={220}
              formatValue={(v) => v.toFixed(2)}
            />
          </ChartCard>

          {/* Breach type breakdown */}
          <ChartCard
            title="Breach Type Breakdown"
            subtitle={`${breaches.length} breaches recorded — click any account below to drill in`}
          >
            <DonutSeries data={breachDonut} height={220} formatValue={(v) => `${v}`} />
          </ChartCard>
        </div>

        {/* Top 10 highest-risk accounts */}
        <ChartCard
          title="Top 10 Highest-Risk Accounts"
          subtitle="Sorted by composite Risk Score = 0.6 × drawdown% + 0.4 × (|open PnL| ÷ equity × 100) — click any row to open the account workspace"
        >
          <DataTable
            columns={riskCols}
            data={riskAccounts}
            rowKey={(r) => r.account.id}
            searchableText={(r) => `${r.account.login} ${r.account.traderName}`}
            searchPlaceholder="Search account or trader…"
            pageSize={10}
            onRowClick={(r) => navigate("account-workspace", { id: r.account.id })}
            emptyTitle="No at-risk accounts"
            emptyDescription="Accounts approaching breach thresholds will surface here for review."
          />
        </ChartCard>
      </PageContent>
    </Page>
  );
}

/* ================================================================== */
/* 5. Advanced Analytics (unchanged — out of scope of this task)      */
/* ================================================================== */

export function AdvancedAnalyticsPage() {
  const { tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  return (
    <FeatureGuard feature="analytics.advanced" fallback={<div className="p-6 text-center text-muted-foreground">Advanced analytics requires the <Badge variant="secondary">analytics.advanced</Badge> feature flag.</div>}>
      <Page>
        <PageHeader title="Advanced Analytics" description={`Cohort retention and predictive insights across ${plural(term("trader")).toLowerCase()} and ${plural(term("challenge")).toLowerCase()}.`} icon={Brain} actions={<Badge variant="secondary">Pro feature</Badge>} />
        <PageContent>
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Cohort retention</p>
            <BarSeries
              data={[
                { date: "Cohort A", value: 24 },
                { date: "Cohort B", value: 31 },
                { date: "Cohort C", value: 18 },
                { date: "Cohort D", value: 27 },
                { date: "Cohort E", value: 22 },
              ]}
              xKey="date"
              yKey="value"
              color="#7c3aed"
              height={220}
            />
          </div>
        </PageContent>
      </Page>
    </FeatureGuard>
  );
}
