"use client";

/**
 * Dashboard Tabs — Accounts / Payouts / Orders / Positions
 *
 * Operational tab pages surfaced under the main Dashboard. Each is a
 * full page component (receives { params }) and follows the UX
 * Constitution §4 model:
 *
 *   KPI strip  →  charts  →  cohort heatmap / grid  →  detail table
 *
 * "What needs my attention?" → "Why?" → "Detail."
 *
 * Terra palette only — forest green / sage / warm amber / cream /
 * emerald / amber-warning / rose-danger. No blue/indigo/violet.
 *
 * All mock data is generated inline with deterministic Math.sin /
 * pseudo-random curves so the dashboard is stable across reloads.
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { AreaSeries, BarSeries } from "@/components/platform/charts";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Gauge,
  Layers,
  Percent,
  ShoppingCart,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Terra palette                                                      */
/* ------------------------------------------------------------------ */

const TERRA = {
  forest: "#4a7c59",
  sage: "#5a7c4a",
  amber: "#705c30",
  cream: "#f5efe6",
  emerald: "#059669",
  teal: "#0d9488",
  green: "#16a34a",
  warning: "#d97706",
  danger: "#e11d48",
  rose: "#dc2626",
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

/* ------------------------------------------------------------------ */
/* Date helpers (stable per render — single module-level reference)   */
/* ------------------------------------------------------------------ */

const now = new Date();
const daysAgo = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const daysAgoShort = (n: number) => {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(5, 10); // MM-DD
};
const monthsAgo = (n: number) => {
  const d = new Date(now);
  d.setMonth(d.getMonth() - n);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};
const monthsAgoShort = (n: number) => {
  const d = new Date(now);
  d.setMonth(d.getMonth() - n);
  return d.toLocaleDateString("en-US", { month: "short" });
};

/* ------------------------------------------------------------------ */
/* Local UI helpers                                                   */
/* ------------------------------------------------------------------ */

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Inline grouped bar chart — used for pass/fail highlights. */
function GroupedBars({
  data,
  xKey,
  series,
  height = 240,
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
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            minTickGap={8}
            angle={-35}
            textAnchor="end"
            height={50}
            interval={2}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={32}
            tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => (formatValue ? formatValue(v) : v)}
            cursor={{ fill: "var(--muted)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Inline horizontal bar chart — for category breakdowns where labels
 *  are long (challenge names, countries). */
function HorizontalBars({
  data,
  labelKey,
  valueKey,
  color = TERRA.forest,
  height = 220,
  formatValue,
}: {
  data: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 24, left: 8, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
          />
          <YAxis
            type="category"
            dataKey={labelKey}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={130}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => (formatValue ? formatValue(v) : v)}
            cursor={{ fill: "var(--muted)" }}
          />
          <Bar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Per-cell colored bar chart — green for positive, rose for negative. */
function ColoredBars({
  data,
  xKey,
  yKey,
  height = 240,
  formatValue,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  height?: number;
  formatValue?: (v: number) => string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            minTickGap={0}
            interval={1}
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v: number) => (formatValue ? formatValue(v) : v)}
            cursor={{ fill: "var(--muted)" }}
          />
          <Bar dataKey={yKey} radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={Number(d[yKey]) >= 0 ? TERRA.emerald : TERRA.rose} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Heatmap cell background — interpolates green → amber → rose by % value. */
function retentionBg(pct: number): string {
  if (pct === 0) return "transparent";
  if (pct >= 85) return "rgba(22,163,74,0.92)";
  if (pct >= 70) return "rgba(22,163,74,0.72)";
  if (pct >= 55) return "rgba(217,119,6,0.72)";
  if (pct >= 40) return "rgba(217,119,6,0.92)";
  return "rgba(225,29,72,0.82)";
}

function retentionText(pct: number): string {
  if (pct === 0) return "var(--muted-foreground)";
  return "#ffffff";
}

function pctRate(pass: number | null, fail: number | null): string {
  if (pass === null || fail === null) return "—";
  const total = pass + fail;
  if (total === 0) return "—";
  return `${Math.round((fail / total) * 100)}%`;
}

/* ------------------------------------------------------------------ */
/* 1. DashboardAccountsTab  (viewId: dashboard-accounts)               */
/* ------------------------------------------------------------------ */

/** Mock: daily pass/fail counts over the last 30 days. */
function buildPassFailSeries() {
  return Array.from({ length: 30 }, (_, i) => {
    const n = 29 - i;
    const pass = Math.max(
      2,
      Math.round(8 + Math.sin(n / 3) * 4 + Math.cos(n / 7) * 2 + n * 0.1),
    );
    const fail = Math.max(
      1,
      Math.round(6 + Math.cos(n / 4) * 3 + n * 0.08),
    );
    return { date: daysAgoShort(n), pass, fail };
  });
}

interface ChallengePerfRow {
  name: string;
  p1Pass: number;
  p1Fail: number;
  p2Pass: number | null;
  p2Fail: number | null;
  funded: number;
}

const CHALLENGE_PERF: ChallengePerfRow[] = [
  { name: "Instant Standard", p1Pass: 312, p1Fail: 88, p2Pass: null, p2Fail: null, funded: 248 },
  { name: "2-Step Turbo", p1Pass: 428, p1Fail: 142, p2Pass: 196, p2Fail: 64, funded: 168 },
  { name: "1-Step Gen Z", p1Pass: 286, p1Fail: 76, p2Pass: null, p2Fail: null, funded: 224 },
  { name: "2-Step Gen Z", p1Pass: 372, p1Fail: 118, p2Pass: 174, p2Fail: 58, funded: 142 },
];

interface RetentionCohortRow {
  month: string;
  d30: number;
  d60: number;
  d90: number;
}

const RETENTION_COHORT: RetentionCohortRow[] = [
  { month: "Jun 2026", d30: 92, d60: 78, d90: 64 },
  { month: "Jul 2026", d30: 88, d60: 71, d90: 0 },
  { month: "Aug 2026", d30: 95, d60: 0, d90: 0 },
];

export function DashboardAccountsTab({ params }: { params: Record<string, string> }) {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  void tid; // tenant scoping hook — mock data is static for the demo
  void params;

  const passFailData = useMemo(() => buildPassFailSeries(), []);

  const totalPass = passFailData.reduce((s, d) => s + d.pass, 0);
  const totalFail = passFailData.reduce((s, d) => s + d.fail, 0);

  return (
    <Page>
      <PageHeader
        title="Accounts Dashboard"
        description="Account lifecycle, breach health, and challenge performance — operational view."
        icon={Users}
      />
      <PageContent>
        {/* KPI strip — 13 cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-7">
          <MetricCard label="Total Accounts" value={2486} delta={5} deltaLabel="vs last 30d" icon={Users} tone="positive" />
          <MetricCard label="Phase 1 Accounts" value={1314} delta={7} deltaLabel="vs last 30d" icon={Layers} />
          <MetricCard label="Phase 2 Accounts" value={482} delta={4} deltaLabel="vs last 30d" icon={Layers} />
          <MetricCard label="Live / Funded" value={690} delta={9} deltaLabel="vs last 30d" icon={CheckCircle2} tone="positive" />
          <MetricCard label="MT5 Active" value={2104} delta={6} deltaLabel="vs last 30d" icon={Activity} tone="positive" />
          <MetricCard label="Daily DD Breached" value={38} delta={-3} deltaLabel="vs last 30d" icon={AlertTriangle} tone="warning" />
          <MetricCard label="Max DD Breached" value={12} delta={-2} deltaLabel="vs last 30d" icon={XCircle} tone="negative" />
          <MetricCard label="Blocked Accounts" value={24} delta={0} deltaLabel="vs last 30d" icon={Ban} tone="negative" />
          <MetricCard label="Passed Accounts" value={totalPass} delta={8} deltaLabel="vs last 30d" icon={UserCheck} tone="positive" />
          <MetricCard label="Total Users" value={1842} delta={4} deltaLabel="vs last 30d" icon={Users} />
          <MetricCard label="Avg Accounts / User" value={1.35} icon={Gauge} />
          <MetricCard label="Avg Pass Time" value="9d 4h" icon={Timer} tone="positive" />
          <MetricCard label="Avg Breach Time" value="14d 7h" icon={Clock} tone="warning" />
        </div>

        {/* Pass/Fail highlights — grouped bar chart */}
        <ChartCard
          title="Pass / Fail Highlights (30 days)"
          subtitle={`Daily challenge pass vs fail count — ${totalPass} passed, ${totalFail} failed over the window.`}
        >
          <GroupedBars
            data={passFailData}
            xKey="date"
            series={[
              { key: "pass", label: "Passed", color: TERRA.emerald },
              { key: "fail", label: "Failed", color: TERRA.rose },
            ]}
            height={260}
            formatValue={(v) => String(v)}
          />
        </ChartCard>

        {/* Retention cohort heatmap */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Account Retention Cohort</p>
            <span className="text-[10px] text-muted-foreground">% of cohort still active at +30/+60/+90 days</span>
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Cohort month</th>
                  <th className="px-3 py-2 text-right">+30d</th>
                  <th className="px-3 py-2 text-right">+60d</th>
                  <th className="px-3 py-2 text-right">+90d</th>
                </tr>
              </thead>
              <tbody>
                {RETENTION_COHORT.map((row) => (
                  <tr key={row.month} className="border-t last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{row.month}</td>
                    {(["d30", "d60", "d90"] as const).map((k) => (
                      <td
                        key={k}
                        className="px-3 py-2 text-right font-semibold tabular-nums"
                        style={{
                          background: retentionBg(row[k]),
                          color: retentionText(row[k]),
                        }}
                      >
                        {row[k] === 0 ? "—" : `${row[k]}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Cells color from green (high retention) through amber to rose (low retention). 90-day
            cells populate as cohorts mature — empty cells indicate the cohort has not yet reached
            that age.
          </p>
        </div>

        {/* Challenge performance grid */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Challenge Performance Grid</p>
            <span className="text-xs text-muted-foreground">
              Pass / fail counts and failure rate per challenge type.
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {CHALLENGE_PERF.map((c) => (
              <div key={c.name} className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  <StatusBadge tone="info">{c.funded} funded</StatusBadge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phase 1 Passes</span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{c.p1Pass}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phase 1 Fails</span>
                    <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">{c.p1Fail}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phase 1 Failure Rate</span>
                    <span className="font-semibold tabular-nums text-foreground">{pctRate(c.p1Pass, c.p1Fail)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phase 2 Passes</span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {c.p2Pass === null ? "—" : c.p2Pass}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phase 2 Fails</span>
                    <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                      {c.p2Fail === null ? "—" : c.p2Fail}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phase 2 Failure Rate</span>
                    <span className="font-semibold tabular-nums text-foreground">{pctRate(c.p2Pass, c.p2Fail)}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                  <span className="text-muted-foreground">Funded Accounts</span>
                  <span className="font-semibold tabular-nums text-foreground">{c.funded}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* 2. DashboardPayoutsTab  (viewId: dashboard-payouts)                */
/* ------------------------------------------------------------------ */

interface WithdrawalRow {
  id: string;
  trader: string;
  amount: number;
  method: string;
  status: string;
  date: string;
}

const WITHDRAWAL_METHODS = ["Bank Wire", "Crypto (USDT)", "Skrill", "PayPal", "Debit Card"] as const;
const WITHDRAWAL_STATUSES = ["paid", "approved", "processing", "pending", "rejected"] as const;
const TRADER_NAMES = [
  "Tom Allen", "Sarah Chen", "Mike Davies", "Emma Wilson", "Luca Romano",
  "Yuki Tanaka", "Carlos Mendez", "Priya Patel", "Jonas Weber", "Aisha Khan",
  "Noah Smith", "Lena Berg", "Omar Farouk", "Ingrid Sørensen", "Diego Vargas",
];

function buildWithdrawals(): WithdrawalRow[] {
  const rows: WithdrawalRow[] = [];
  for (let i = 0; i < 12; i++) {
    const amount = Math.round(1200 + Math.sin(i / 2) * 800 + i * 240);
    rows.push({
      id: `WD-${(10248 - i).toString()}`,
      trader: TRADER_NAMES[i % TRADER_NAMES.length],
      amount,
      method: WITHDRAWAL_METHODS[i % WITHDRAWAL_METHODS.length],
      status: WITHDRAWAL_STATUSES[i % WITHDRAWAL_STATUSES.length],
      date: daysAgo(i).slice(0, 10),
    });
  }
  return rows;
}

function buildPayoutDailySeries() {
  return Array.from({ length: 30 }, (_, i) => {
    const n = 29 - i;
    const v = Math.max(
      1500,
      Math.round(6400 + Math.sin(n / 4) * 2400 + Math.cos(n / 7) * 1200 + (30 - n) * 60),
    );
    return { date: daysAgoShort(n), value: v };
  });
}

const PAYOUT_COHORT: RetentionCohortRow[] = [
  { month: "Jun 2026", d30: 38, d60: 52, d90: 64 },
  { month: "Jul 2026", d30: 41, d60: 55, d90: 0 },
  { month: "Aug 2026", d30: 35, d60: 0, d90: 0 },
];

export function DashboardPayoutsTab({ params }: { params: Record<string, string> }) {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  void tid;
  void params;

  const fmt = (v: number) => formatCurrency(v, currency);

  const dailyPayouts = useMemo(() => buildPayoutDailySeries(), []);
  const totalPayoutAmount = dailyPayouts.reduce((s, d) => s + d.value, 0);
  const withdrawals = useMemo(() => buildWithdrawals(), []);

  const payoutsByChallenge = [
    { label: "Instant Standard", value: 184200 },
    { label: "2-Step Turbo", value: 312800 },
    { label: "1-Step Gen Z", value: 142400 },
    { label: "2-Step Gen Z", value: 228600 },
  ];

  const payoutsByPlatform = [
    { label: "MT5", value: 624300 },
    { label: "DXTrade", value: 243700 },
  ];

  const withdrawalColumns: Column<WithdrawalRow>[] = [
    {
      key: "id",
      header: "Request",
      cell: (r) => <span className="font-mono text-xs font-medium text-foreground">{r.id}</span>,
      sortValue: (r) => r.id,
      width: "110px",
    },
    {
      key: "trader",
      header: "Trader",
      cell: (r) => <span className="font-medium text-foreground">{r.trader}</span>,
      sortValue: (r) => r.trader,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (r) => <span className="font-medium tabular-nums text-foreground">{fmt(r.amount)}</span>,
      sortValue: (r) => r.amount,
      numeric: true,
    },
    {
      key: "method",
      header: "Method",
      cell: (r) => <span className="text-muted-foreground">{r.method}</span>,
      sortValue: (r) => r.method,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge tone={payoutStatusToneLocal(r.status)}>{r.status}</StatusBadge>,
      sortValue: (r) => r.status,
    },
    {
      key: "date",
      header: "Date",
      cell: (r) => <span className="text-muted-foreground tabular-nums">{r.date}</span>,
      sortValue: (r) => r.date,
      numeric: true,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Payouts Dashboard"
        description="Withdrawal requests, payout rates by cohort, and recent trader withdrawals."
        icon={Wallet}
      />
      <PageContent>
        {/* KPI strip — 6 cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Approved Payouts" value={312} delta={6} deltaLabel="vs last 30d" icon={CheckCircle2} tone="positive" />
          <MetricCard label="Total Payout Amount" value={fmt(totalPayoutAmount)} delta={9} deltaLabel="vs last 30d" icon={DollarSign} tone="positive" />
          <MetricCard label="Avg Profit Split" value="78%" delta={2} deltaLabel="pts" icon={Percent} tone="positive" />
          <MetricCard label="Pending Payouts" value={24} delta={-1} deltaLabel="vs last 30d" icon={Clock} tone="warning" />
          <MetricCard label="Rejected Payouts" value={7} delta={-2} deltaLabel="vs last 30d" icon={XCircle} tone="negative" />
          <MetricCard label="Processing Payouts" value={14} delta={1} deltaLabel="vs last 30d" icon={Activity} tone="positive" />
        </div>

        {/* Daily payout movement */}
        <ChartCard
          title="Daily Payout Movement (30 days)"
          subtitle={`Total daily payout amount — ${currency}`}
        >
          <AreaSeries
            data={dailyPayouts}
            xKey="date"
            yKey="value"
            color={TERRA.forest}
            height={240}
            formatValue={(v) => fmt(v)}
          />
        </ChartCard>

        {/* Payout cohort matrix */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Payout Cohort Matrix</p>
            <span className="text-[10px] text-muted-foreground">% of cohort paid out at +30/+60/+90 days</span>
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Cohort month</th>
                  <th className="px-3 py-2 text-right">+30d</th>
                  <th className="px-3 py-2 text-right">+60d</th>
                  <th className="px-3 py-2 text-right">+90d</th>
                </tr>
              </thead>
              <tbody>
                {PAYOUT_COHORT.map((row) => (
                  <tr key={row.month} className="border-t last:border-0">
                    <td className="px-3 py-2 font-medium text-foreground">{row.month}</td>
                    {(["d30", "d60", "d90"] as const).map((k) => (
                      <td
                        key={k}
                        className="px-3 py-2 text-right font-semibold tabular-nums"
                        style={{
                          background: retentionBg(row[k]),
                          color: retentionText(row[k]),
                        }}
                      >
                        {row[k] === 0 ? "—" : `${row[k]}%`}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Payout rate climbs steadily through +30/+60/+90d as funded traders request their first
            and second withdrawals.
          </p>
        </div>

        {/* Payouts by challenge & platform */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Payouts by Challenge" subtitle={`Total payout amount per challenge type — ${currency}`}>
            <HorizontalBars
              data={payoutsByChallenge}
              labelKey="label"
              valueKey="value"
              color={TERRA.forest}
              height={220}
              formatValue={(v) => fmt(v)}
            />
          </ChartCard>
          <ChartCard title="Payouts by Platform" subtitle={`Total payout amount per trading platform — ${currency}`}>
            <HorizontalBars
              data={payoutsByPlatform}
              labelKey="label"
              valueKey="value"
              color={TERRA.amber}
              height={220}
              formatValue={(v) => fmt(v)}
            />
          </ChartCard>
        </div>

        {/* Recent withdrawals table */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Recent Withdrawal Requests</p>
          <DataTable
            columns={withdrawalColumns}
            data={withdrawals}
            rowKey={(r) => r.id}
            searchableText={(r) => `${r.id} ${r.trader} ${r.method} ${r.status}`}
            searchPlaceholder="Search withdrawals…"
            pageSize={8}
          />
        </div>
      </PageContent>
    </Page>
  );
}

/* Local tone helper — keeps the import surface tight. Mirrors the
   shared payoutStatusTone in @/components/platform/status but is
   duplicated here so this file stays self-contained. */
function payoutStatusToneLocal(status: string):
  | "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (status) {
    case "paid":
      return "success";
    case "approved":
    case "processing":
      return "info";
    case "pending":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "muted";
  }
}

/* ------------------------------------------------------------------ */
/* 3. DashboardOrdersTab  (viewId: dashboard-orders)                  */
/* ------------------------------------------------------------------ */

interface CountryRevenueRow {
  country: string;
  orders: number;
  revenue: number;
  avgOrder: number;
  marketShare: number;
}

const COUNTRY_SEED: Array<[string, number, number]> = [
  ["United States", 1842, 312800],
  ["United Kingdom", 968, 168400],
  ["Germany", 724, 122600],
  ["Australia", 612, 98800],
  ["Canada", 548, 94300],
  ["United Arab Emirates", 426, 78200],
  ["Singapore", 318, 61400],
  ["France", 286, 51900],
  ["Netherlands", 224, 41700],
  ["Brazil", 198, 36400],
];

function buildCountryRows(): CountryRevenueRow[] {
  const totalRevenue = COUNTRY_SEED.reduce((s, [, , r]) => s + r, 0);
  return COUNTRY_SEED.map(([country, orders, revenue]) => ({
    country,
    orders,
    revenue,
    avgOrder: Math.round(revenue / orders),
    marketShare: Math.round((revenue / totalRevenue) * 1000) / 10,
  }));
}

function buildHourlyRevenue() {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, "0")}`,
    value: Math.max(
      200,
      Math.round(2400 + Math.sin(h / 3) * 1600 + Math.cos(h / 5) * 800 + (h > 8 && h < 20 ? 1200 : 0)),
    ),
  }));
}

function buildHourlyOrders() {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, "0")}`,
    value: Math.max(
      2,
      Math.round(18 + Math.sin(h / 3) * 12 + Math.cos(h / 5) * 6 + (h > 8 && h < 20 ? 14 : 0)),
    ),
  }));
}

function buildMonthlyRevenue() {
  return Array.from({ length: 12 }, (_, i) => {
    const n = 11 - i;
    const rev = Math.max(
      20000,
      Math.round(84000 + Math.sin(n / 2) * 22000 + n * 1400),
    );
    return { date: monthsAgoShort(n), value: rev };
  });
}

export function DashboardOrdersTab({ params }: { params: Record<string, string> }) {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  void tid;
  void params;

  const fmt = (v: number) => formatCurrency(v, currency);

  const monthlyRevenue = useMemo(() => buildMonthlyRevenue(), []);
  const totalRevenue = monthlyRevenue.reduce((s, d) => s + d.value, 0);
  const totalOrders = 7294;

  const revenueByChallenge = [
    { label: "Instant Standard", value: 248400 },
    { label: "2-Step Turbo", value: 412800 },
    { label: "1-Step Gen Z", value: 196200 },
    { label: "2-Step Gen Z", value: 318600 },
  ];

  const revenueByBroker = [
    { label: "MT5", value: 924300 },
    { label: "DXTrade", value: 251700 },
  ];

  const hourlyRevenue = useMemo(() => buildHourlyRevenue(), []);
  const hourlyOrders = useMemo(() => buildHourlyOrders(), []);
  const countryRows = useMemo(() => buildCountryRows(), []);

  const countryColumns: Column<CountryRevenueRow>[] = [
    {
      key: "country",
      header: "Country",
      cell: (r) => <span className="font-medium text-foreground">{r.country}</span>,
      sortValue: (r) => r.country,
    },
    {
      key: "orders",
      header: "Orders",
      cell: (r) => <span className="tabular-nums text-foreground">{r.orders}</span>,
      sortValue: (r) => r.orders,
      numeric: true,
    },
    {
      key: "revenue",
      header: "Revenue",
      cell: (r) => <span className="font-medium tabular-nums text-foreground">{fmt(r.revenue)}</span>,
      sortValue: (r) => r.revenue,
      numeric: true,
    },
    {
      key: "avgOrder",
      header: "Avg Order Value",
      cell: (r) => <span className="tabular-nums text-muted-foreground">{fmt(r.avgOrder)}</span>,
      sortValue: (r) => r.avgOrder,
      numeric: true,
    },
    {
      key: "marketShare",
      header: "Market Share",
      cell: (r) => (
        <span className="inline-flex items-center gap-2 tabular-nums">
          <span className="font-medium text-foreground">{r.marketShare}%</span>
          <span
            className="h-1.5 rounded-full bg-emerald-500/40"
            style={{ width: `${Math.min(100, r.marketShare * 4)}px` }}
          />
        </span>
      ),
      sortValue: (r) => r.marketShare,
      numeric: true,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Orders Dashboard"
        description="Order volume, revenue attribution, and hourly movement."
        icon={ShoppingCart}
      />
      <PageContent>
        {/* KPI strip — 5 cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Total Orders" value={totalOrders} delta={8} deltaLabel="vs last 30d" icon={ShoppingCart} tone="positive" />
          <MetricCard label="Total Revenue" value={fmt(totalRevenue)} delta={11} deltaLabel="vs last 30d" icon={DollarSign} tone="positive" />
          <MetricCard label="Avg Order Value" value={fmt(Math.round(totalRevenue / totalOrders))} delta={3} deltaLabel="vs last 30d" icon={Target} tone="positive" />
          <MetricCard label="Conversion Rate" value="3.8%" delta={0.4} deltaLabel="pts" icon={TrendingUp} tone="positive" />
          <MetricCard label="Refund Rate" value="1.4%" delta={-0.3} deltaLabel="pts" icon={TrendingDown} tone="positive" />
        </div>

        {/* Revenue by challenge & broker */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Revenue by Challenge" subtitle={`Revenue attributed per challenge type — ${currency}`}>
            <HorizontalBars
              data={revenueByChallenge}
              labelKey="label"
              valueKey="value"
              color={TERRA.forest}
              height={220}
              formatValue={(v) => fmt(v)}
            />
          </ChartCard>
          <ChartCard title="Revenue by Broker" subtitle={`Revenue attributed per broker — ${currency}`}>
            <HorizontalBars
              data={revenueByBroker}
              labelKey="label"
              valueKey="value"
              color={TERRA.amber}
              height={220}
              formatValue={(v) => fmt(v)}
            />
          </ChartCard>
        </div>

        {/* Monthly revenue trend */}
        <ChartCard
          title="Monthly Revenue Trend (12 months)"
          subtitle={`Monthly gross revenue — ${currency}`}
        >
          <AreaSeries
            data={monthlyRevenue}
            xKey="date"
            yKey="value"
            color={TERRA.emerald}
            height={240}
            formatValue={(v) => fmt(v)}
          />
        </ChartCard>

        {/* Hourly revenue / orders movement — side by side */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Hourly Revenue Movement" subtitle={`Revenue per hour (UTC) — ${currency}`}>
            <AreaSeries
              data={hourlyRevenue}
              xKey="hour"
              yKey="value"
              color={TERRA.teal}
              height={220}
              formatValue={(v) => fmt(v)}
            />
          </ChartCard>
          <ChartCard title="Hourly Orders Movement" subtitle="Order count per hour (UTC)">
            <AreaSeries
              data={hourlyOrders}
              xKey="hour"
              yKey="value"
              color={TERRA.amber}
              height={220}
              formatValue={(v) => String(v)}
            />
          </ChartCard>
        </div>

        {/* Revenue by country table */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Revenue by Country</p>
          <DataTable
            columns={countryColumns}
            data={countryRows}
            rowKey={(r) => r.country}
            searchableText={(r) => r.country}
            searchPlaceholder="Search countries…"
            pageSize={10}
          />
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* 4. DashboardPositionsTab  (viewId: dashboard-positions)            */
/* ------------------------------------------------------------------ */

interface SymbolStatRow {
  symbol: string;
  totalPositions: number;
  buyRatio: string;
  totalVolume: number;
  totalPnl: number;
  winRate: number;
}

const SYMBOL_SEED: Array<[string, number, number, number, number]> = [
  // symbol, positions, volume (lots), pnl, winRate%
  ["EURUSD", 1248, 4820, 38400, 58],
  ["GBPUSD", 824, 3120, 22600, 54],
  ["XAUUSD", 968, 2480, -12800, 47],
  ["BTCUSD", 486, 920, 64200, 61],
  ["ETHUSD", 372, 740, 18900, 52],
  ["USDJPY", 612, 2240, -6400, 49],
];

function buildSymbolRows(): SymbolStatRow[] {
  return SYMBOL_SEED.map(([symbol, positions, volume, pnl, winRate]) => {
    const buyPct = 50 + Math.round(Math.sin(symbol.length + positions) * 12);
    return {
      symbol,
      totalPositions: positions,
      buyRatio: `${buyPct}% / ${100 - buyPct}%`,
      totalVolume: volume,
      totalPnl: pnl,
      winRate,
    };
  });
}

function buildTradeDistributionByHour() {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h.toString().padStart(2, "0")}`,
    value: Math.max(
      4,
      Math.round(42 + Math.sin(h / 3) * 22 + Math.cos(h / 5) * 12 + (h > 8 && h < 20 ? 30 : 0)),
    ),
  }));
}

function buildPerformanceByHour() {
  // Total P&L per hour — values can be negative (rose) or positive (emerald)
  return Array.from({ length: 24 }, (_, h) => {
    const base = Math.sin(h / 3) * 4200 + Math.cos(h / 5) * 2400 + (h > 8 && h < 20 ? 3500 : -800);
    return {
      hour: `${h.toString().padStart(2, "0")}`,
      value: Math.round(base),
    };
  });
}

export function DashboardPositionsTab({ params }: { params: Record<string, string> }) {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  void tid;
  void params;

  const fmt = (v: number) => formatCurrency(v, currency);
  const fmtCompactSigned = (v: number) =>
    `${v >= 0 ? "+" : "−"}${formatCompact(Math.abs(v))}`;

  const symbolRows = useMemo(() => buildSymbolRows(), []);
  const totalOpenPositions = symbolRows.reduce((s, r) => s + r.totalPositions, 0);
  const totalVolume = symbolRows.reduce((s, r) => s + r.totalVolume, 0);
  const totalPnl = symbolRows.reduce((s, r) => s + r.totalPnl, 0);
  const winningPositions = 4820;
  const losingPositions = 3386;
  const winRate = Math.round((winningPositions / (winningPositions + losingPositions)) * 100);

  // React Compiler auto-memoizes pure calls — no manual useMemo needed.
  const tradeDistribution = buildTradeDistributionByHour();
  const performanceByHour = buildPerformanceByHour();

  const symbolColumns: Column<SymbolStatRow>[] = [
    {
      key: "symbol",
      header: "Symbol",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-foreground">
          <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.forest }} />
          {r.symbol}
        </span>
      ),
      sortValue: (r) => r.symbol,
    },
    {
      key: "totalPositions",
      header: "Positions",
      cell: (r) => <span className="tabular-nums text-foreground">{r.totalPositions}</span>,
      sortValue: (r) => r.totalPositions,
      numeric: true,
    },
    {
      key: "buyRatio",
      header: "Buy / Sell",
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">{r.buyRatio.split(" / ")[0]}</span>
          {" / "}
          <span className="text-rose-600 dark:text-rose-400">{r.buyRatio.split(" / ")[1]}</span>
        </span>
      ),
      sortValue: (r) => r.buyRatio,
    },
    {
      key: "totalVolume",
      header: "Total Volume",
      cell: (r) => <span className="tabular-nums text-muted-foreground">{formatCompact(r.totalVolume)} lots</span>,
      sortValue: (r) => r.totalVolume,
      numeric: true,
    },
    {
      key: "totalPnl",
      header: "Total P&L",
      cell: (r) => (
        <span
          className={cn(
            "font-medium tabular-nums",
            r.totalPnl >= 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
          )}
        >
          {fmtCompactSigned(r.totalPnl)}
        </span>
      ),
      sortValue: (r) => r.totalPnl,
      numeric: true,
    },
    {
      key: "winRate",
      header: "Win Rate",
      cell: (r) => (
        <StatusBadge tone={r.winRate >= 55 ? "success" : r.winRate >= 50 ? "info" : "warning"}>
          {r.winRate}%
        </StatusBadge>
      ),
      sortValue: (r) => r.winRate,
      numeric: true,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Positions Dashboard"
        description="Open positions by symbol, volume, P&L, and hourly trading distribution."
        icon={ArrowLeftRight}
      />
      <PageContent>
        {/* KPI strip — 6 cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Total Open Positions" value={totalOpenPositions} delta={4} deltaLabel="vs yesterday" icon={ArrowLeftRight} tone="positive" />
          <MetricCard label="Total Volume" value={`${formatCompact(totalVolume)} lots`} delta={6} deltaLabel="vs yesterday" icon={Layers} />
          <MetricCard
            label="Total P&L"
            value={fmtCompactSigned(totalPnl)}
            delta={8}
            deltaLabel="vs yesterday"
            icon={Coins}
            tone={totalPnl >= 0 ? "positive" : "negative"}
          />
          <MetricCard label="Winning Positions" value={winningPositions} delta={5} deltaLabel="vs yesterday" icon={TrendingUp} tone="positive" />
          <MetricCard label="Losing Positions" value={losingPositions} delta={-2} deltaLabel="vs yesterday" icon={TrendingDown} tone="negative" />
          <MetricCard label="Win Rate" value={`${winRate}%`} delta={1} deltaLabel="pts" icon={Gauge} tone="positive" />
        </div>

        {/* Symbol stats table */}
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Symbol Stats</p>
          <DataTable
            columns={symbolColumns}
            data={symbolRows}
            rowKey={(r) => r.symbol}
            searchableText={(r) => r.symbol}
            searchPlaceholder="Search symbols…"
            pageSize={10}
          />
        </div>

        {/* Trade distribution & performance distribution by hour */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Trade Distribution by Hour"
            subtitle="Trade count per hour (UTC) — 24 bars"
          >
            <BarSeries
              data={tradeDistribution}
              xKey="hour"
              yKey="value"
              color={TERRA.forest}
              height={240}
              formatValue={(v) => String(v)}
            />
          </ChartCard>
          <ChartCard
            title="Performance Distribution by Hour"
            subtitle={`Total P&L per hour (UTC) — emerald = positive, rose = negative`}
          >
            <ColoredBars
              data={performanceByHour}
              xKey="hour"
              yKey="value"
              height={240}
              formatValue={(v) => fmt(v)}
            />
            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.emerald }} />
                Positive hour
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.rose }} />
                Negative hour
              </span>
            </div>
          </ChartCard>
        </div>
      </PageContent>
    </Page>
  );
}
