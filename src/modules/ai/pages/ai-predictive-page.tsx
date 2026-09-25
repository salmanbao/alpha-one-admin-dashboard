"use client";

/**
 * AI Predictive Analytics
 *
 * Predicts future outcomes across the tenant: trader churn risk, payout
 * fraud risk, trader success probability, and 30d signup forecast.
 *
 * Deterministic mock data — no Math.random. All values derive from
 * `hashStr(tenantId + key)` + `Math.sin(i / n)` patterns so the same
 * tenant renders the same numbers across reloads.
 *
 * File ownership: impl-ai-predictive-anomaly-cost
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { hashStr, getTenantTraders, getTenantPayouts } from "@/lib/platform/mock-data";
import type { Trader, Payout } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { AreaSeries, BarSeries } from "@/components/platform/charts";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { exportToCsv } from "@/lib/platform/export-utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  TrendingUp,
  Target,
  AlertTriangle,
  ShieldCheck,
  Download,
  Sparkles,
  Crown,
  Award,
  Medal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const TERRA = {
  emerald: "#059669",
  amber: "#d97706",
  rose: "#e11d48",
  slate: "#475569",
  sky: "#0d9488",
  teal: "#0d9488",
} as const;

const AXIS_STYLE = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

/** Trader churn risk score (0–100). Combines inactivity + low winRate + low
 * equity + a deterministic per-trader seed. Higher = more likely to churn. */
function churnScore(trader: Trader): number {
  const seed = hashStr(trader.id + "churn");
  const joinedDays = Math.floor(
    (Date.now() - new Date(trader.joinedAt).getTime()) / (1000 * 60 * 60 * 24),
  );
  const inactivity = Math.min(30, Math.floor((seed % 30) + joinedDays / 12));
  const winPenalty = Math.max(0, 50 - trader.winRate) * 0.6;
  const pnlPenalty = trader.totalPnl < 0 ? 18 : 4;
  const equityLow = trader.equity < 8000 ? 10 : 0;
  const base = 18 + (seed % 22);
  return Math.max(2, Math.min(99, Math.round(base + inactivity * 0.4 + winPenalty + pnlPenalty + equityLow)));
}

/** Recommended retention action based on churn score. */
function recommendedAction(score: number): string {
  if (score >= 80) return "Schedule check-in call";
  if (score >= 60) return "Offer retention bonus";
  if (score >= 40) return "Send re-engagement email";
  if (score >= 20) return "Send weekly digest";
  return "Monitor only";
}

/** Deterministic days-since-last-activity proxy (0–45d). */
function daysInactive(trader: Trader): number {
  const seed = hashStr(trader.id + "inactive");
  return Math.min(45, Math.max(0, (seed % 28) + Math.floor(churnScore(trader) / 4)));
}

/** Payout fraud risk score (0–100). Seeded by payout.id + amount + method. */
function payoutRisk(p: Payout): number {
  const seed = hashStr(p.id + p.amount + p.method);
  const amountPenalty = p.amount > 8000 ? 24 : p.amount > 4000 ? 12 : 4;
  const methodPenalty = p.method === "crypto" ? 14 : p.method === "skrill" ? 8 : 2;
  const recent = Date.now() - new Date(p.createdAt).getTime() < 1000 * 60 * 60 * 24 * 7 ? 6 : 0;
  const base = 22 + (seed % 35);
  return Math.max(3, Math.min(98, Math.round(base + amountPenalty + methodPenalty + recent)));
}

/** Risk factor badges for a payout. */
function payoutRiskFactors(p: Payout): string[] {
  const factors: string[] = [];
  if (p.amount > 8000) factors.push("High value");
  const seed = hashStr(p.id + "factors");
  if (seed % 3 === 0) factors.push("Multiple IPs");
  if (seed % 4 === 0) factors.push("New account");
  if (seed % 5 === 0) factors.push("Unusual pattern");
  if (p.method === "crypto") factors.push("Crypto method");
  return factors.length ? factors : ["None"];
}

/** Trader success probability (0–100). Higher = more likely to succeed. */
function successProbability(trader: Trader): number {
  const seed = hashStr(trader.id + "success");
  const win = trader.winRate * 0.8;
  const pnlBonus = trader.totalPnl > 0 ? 18 : trader.totalPnl < 0 ? -10 : 2;
  const tradeBonus = Math.min(15, trader.trades / 20);
  const base = 28 + (seed % 22);
  return Math.max(8, Math.min(98, Math.round(base + win + pnlBonus + tradeBonus)));
}

/* ------------------------------------------------------------------ */
/* Mock data generators                                                */
/* ------------------------------------------------------------------ */

interface ChurnRow {
  rank: number;
  id: string;
  name: string;
  email: string;
  churnScore: number;
  daysInactive: number;
  equity: number;
  lastActivity: string;
  action: string;
}

interface PayoutRiskRow {
  payoutId: string;
  traderId: string;
  traderName: string;
  amount: number;
  currency: string;
  riskScore: number;
  riskFactors: string[];
  reviewer: string;
}

interface SuccessRow {
  rank: number;
  traderId: string;
  name: string;
  email: string;
  probability: number;
  tier: "high" | "medium" | "low";
}

function buildChurnRows(traders: Trader[]): ChurnRow[] {
  return traders
    .map((t) => ({
      rank: 0,
      id: t.id,
      name: t.name,
      email: t.email,
      churnScore: churnScore(t),
      daysInactive: daysInactive(t),
      equity: t.equity,
      lastActivity: `${daysInactive(t)}d ago`,
      action: recommendedAction(churnScore(t)),
    }))
    .sort((a, b) => b.churnScore - a.churnScore)
    .slice(0, 10)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function buildPayoutRiskRows(payouts: Payout[]): PayoutRiskRow[] {
  const reviewers = ["Sarah Chen", "Marcus Webb", "Priya Nair", "Elena Rossi"];
  return payouts
    .map((p) => {
      const score = payoutRisk(p);
      return {
        payoutId: p.reference || p.id,
        traderId: p.traderId,
        traderName: p.traderName,
        amount: p.amount,
        currency: p.currency,
        riskScore: score,
        riskFactors: payoutRiskFactors(p),
        reviewer: reviewers[hashStr(p.id) % reviewers.length],
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);
}

function buildSuccessRows(traders: Trader[]): SuccessRow[] {
  return traders
    .filter((t) => t.status === "active")
    .map((t) => {
      const probability = successProbability(t);
      const tier: SuccessRow["tier"] =
        probability >= 70 ? "high" : probability >= 40 ? "medium" : "low";
      return {
        rank: 0,
        traderId: t.id,
        name: t.name,
        email: t.email,
        probability,
        tier,
      };
    })
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 20)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function buildChurnBuckets(traders: Trader[]) {
  const buckets = [
    { label: "Very Low", lo: 0, hi: 20, count: 0 },
    { label: "Low", lo: 20, hi: 40, count: 0 },
    { label: "Medium", lo: 40, hi: 60, count: 0 },
    { label: "High", lo: 60, hi: 80, count: 0 },
    { label: "Critical", lo: 80, hi: 101, count: 0 },
  ];
  for (const t of traders) {
    const score = churnScore(t);
    const bucket = buckets.find((b) => score >= b.lo && score < b.hi);
    if (bucket) bucket.count += 1;
  }
  return buckets.map((b) => ({ label: b.label, count: b.count }));
}

function buildSignupForecast(tid: string) {
  // 30d deterministic forecast — daily predicted new signups with a
  // confidence band (±N). Sin-based baseline + weekly seasonality.
  const seed = hashStr(tid + "signup-forecast");
  const baseline = 8 + (seed % 6); // 8–13 baseline
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const seasonal = Math.sin((i + (seed % 7)) / 3) * 3.2;
    const weekly = i % 7 === 0 || i % 7 === 6 ? -2.5 : 0;
    const growth = i * 0.18;
    const predicted = Math.max(2, Math.round(baseline + seasonal + weekly + growth));
    const band = Math.max(1, Math.round(predicted * 0.22));
    return {
      day: `D${day}`,
      predicted,
      low: Math.max(0, predicted - band),
      high: predicted + band,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Tone helpers                                                         */
/* ------------------------------------------------------------------ */

function churnToneFor(score: number): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  if (score >= 80) return "danger";
  if (score >= 60) return "warning";
  if (score >= 40) return "info";
  return "success";
}

function riskToneFor(score: number): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  if (score >= 75) return "danger";
  if (score >= 50) return "warning";
  if (score >= 30) return "info";
  return "success";
}

function churnColor(score: number): string {
  if (score >= 80) return TERRA.rose;
  if (score >= 60) return TERRA.amber;
  if (score >= 40) return TERRA.sky;
  return TERRA.emerald;
}

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-amber-600" />;
  if (rank === 2) return <Award className="h-4 w-4 text-slate-500" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-700" />;
  return <span className="text-xs font-medium text-muted-foreground tabular-nums">{rank}</span>;
}

/* ------------------------------------------------------------------ */
/* Chart card                                                           */
/* ------------------------------------------------------------------ */

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
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {help ? <LabelWithHelp help={help}>{title}</LabelWithHelp> : title}
          </p>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AiPredictivePage() {
  const { runtime, tenant, navigate } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  const traders = useMemo(() => getTenantTraders(tid), [tid]);
  const payouts = useMemo(() => getTenantPayouts(tid), [tid]);

  // ---- KPI computations (deterministic) ---------------------------------
  const predictions30d = 240 + (hashStr(tid + "predictions") % 80); // 240–319
  const modelAccuracy = Math.round((84 + ((hashStr(tid + "acc") % 80) / 100)) * 10) / 10; // 84.0–84.8
  const highRiskTraders = traders.filter((t) => churnScore(t) >= 60).length;
  const fraudPrevented = 24000 + (hashStr(tid + "fraud") % 9000); // $24,000–$32,999

  // ---- Tables + chart data ---------------------------------------------
  const churnRows = useMemo(() => buildChurnRows(traders), [traders]);
  const payoutRows = useMemo(() => buildPayoutRiskRows(payouts), [payouts]);
  const successRows = useMemo(() => buildSuccessRows(traders), [traders]);
  const churnBuckets = useMemo(() => buildChurnBuckets(traders), [traders]);
  const signupForecast = useMemo(() => buildSignupForecast(tid), [tid]);

  // ---- CSV export -------------------------------------------------------
  const handleExportChurn = () =>
    exportToCsv(
      churnRows,
      [
        { key: "rank", header: "Rank", value: (r) => r.rank },
        { key: "id", header: "Trader ID", value: (r) => r.id },
        { key: "name", header: "Name", value: (r) => r.name },
        { key: "email", header: "Email", value: (r) => r.email },
        { key: "churnScore", header: "Churn Risk Score", value: (r) => r.churnScore },
        { key: "daysInactive", header: "Days Inactive", value: (r) => r.daysInactive },
        { key: "equity", header: "Equity", value: (r) => r.equity },
        { key: "lastActivity", header: "Last Activity", value: (r) => r.lastActivity },
        { key: "action", header: "Recommended Action", value: (r) => r.action },
      ],
      `ai-predictive-churn-${tid}.csv`,
    );

  const handleExportPayouts = () =>
    exportToCsv(
      payoutRows,
      [
        { key: "payoutId", header: "Payout ID", value: (r) => r.payoutId },
        { key: "traderId", header: "Trader ID", value: (r) => r.traderId },
        { key: "traderName", header: "Trader", value: (r) => r.traderName },
        { key: "amount", header: "Amount", value: (r) => `${r.amount} ${r.currency}` },
        { key: "riskScore", header: "Risk Score", value: (r) => r.riskScore },
        { key: "riskFactors", header: "Risk Factors", value: (r) => r.riskFactors.join("; ") },
        { key: "reviewer", header: "Recommended Reviewer", value: (r) => r.reviewer },
      ],
      `ai-predictive-payouts-${tid}.csv`,
    );

  return (
    <Page>
      <PageHeader
        title="Predictive Analytics"
        description={`Forecast ${term("trader").toLowerCase()} churn, payout fraud, and success probability across this tenant.`}
        icon={TrendingUp}
        term={`${term("trader")} tenant · ${predictions30d} predictions (30d)`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportChurn}>
              <Download className="mr-1 h-4 w-4" />
              Export churn
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPayouts}>
              <Download className="mr-1 h-4 w-4" />
              Export payouts
            </Button>
          </>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Predictions Made (30d)"
            value={predictions30d}
            icon={Brain}
            deltaLabel="across churn · fraud · success"
          />
          <MetricCard
            label="Model Accuracy"
            value={`${modelAccuracy}%`}
            icon={Target}
            tone="positive"
            delta={4}
            deltaLabel="vs industry avg 82%"
          />
          <MetricCard
            label={`High-Risk ${plural(term("trader"))} Flagged`}
            value={highRiskTraders}
            icon={AlertTriangle}
            tone="negative"
            deltaLabel={`churn score ≥ 60`}
          />
          <MetricCard
            label="Fraud Prevented"
            value={formatCurrency(fraudPrevented, currency)}
            icon={ShieldCheck}
            tone="positive"
            deltaLabel="last 30 days"
          />
        </div>

        {/* Section 1: Churn Risk Distribution */}
        <ChartCard
          title={`${term("trader")} Churn Risk Distribution`}
          subtitle={`Bucketed by predicted churn score across all ${traders.length} ${plural(term("trader")).toLowerCase()} on this tenant`}
          help={
            <p>
              Churn risk is computed from inactivity days, win rate, recent PnL and account equity.
              Scores in the <strong>Critical</strong> bucket (80–100) require immediate retention
              outreach per the action matrix below.
            </p>
          }
        >
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={churnBuckets} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {churnBuckets.map((b, i) => {
                    const color =
                      i === 0 ? TERRA.emerald :
                      i === 1 ? TERRA.teal :
                      i === 2 ? TERRA.sky :
                      i === 3 ? TERRA.amber :
                      TERRA.rose;
                    return <Cell key={i} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            {churnBuckets.map((b, i) => (
              <span key={b.label} className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{
                    background:
                      i === 0 ? TERRA.emerald :
                      i === 1 ? TERRA.teal :
                      i === 2 ? TERRA.sky :
                      i === 3 ? TERRA.amber :
                      TERRA.rose,
                  }}
                />
                {b.label} <span className="tabular-nums">{b.count}</span>
              </span>
            ))}
          </div>
        </ChartCard>

        {/* Section 2: Top 10 Churn-Risk Traders */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                <LabelWithHelp
                  help={
                    <p>
                      Top 10 {term("trader").toLowerCase()}s ranked by predicted churn risk score. The
                      <strong>Recommended Action</strong> column surfaces the retention playbook step
                      aligned to the score band.
                    </p>
                  }
                >
                  Top 10 Churn-Risk {plural(term("trader"))}
                </LabelWithHelp>
              </p>
              <p className="text-xs text-muted-foreground">Click a row to open the {term("trader").toLowerCase()} detail page</p>
            </div>
            <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
              {churnRows.filter((r) => r.churnScore >= 60).length} need action
            </Badge>
          </div>
          <DataTable
            data={churnRows}
            rowKey={(r) => r.id}
            pageSize={5}
            searchableText={(r) => `${r.name} ${r.email}`}
            searchPlaceholder={`Search ${term("trader").toLowerCase()}…`}
            onRowClick={(r) => navigate("trader-detail", { id: r.id })}
            emptyTitle={`No ${term("trader").toLowerCase()} flagged`}
            emptyDescription="No churn risk predictions available for this tenant yet."
            columns={[
              {
                key: "rank",
                header: "Rank",
                width: "56px",
                cell: (r) => <div className="flex h-5 w-5 items-center justify-center">{rankIcon(r.rank)}</div>,
              },
              {
                key: "name",
                header: term("trader"),
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{r.name}</span>
                    <span className="text-[11px] text-muted-foreground">{r.email}</span>
                  </div>
                ),
                sortValue: (r) => r.name,
              },
              {
                key: "churnScore",
                header: "Churn Risk",
                numeric: true,
                cell: (r) => (
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge tone={churnToneFor(r.churnScore)}>{r.churnScore}</StatusBadge>
                    <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${r.churnScore}%`, background: churnColor(r.churnScore) }}
                      />
                    </div>
                  </div>
                ),
                sortValue: (r) => r.churnScore,
              },
              {
                key: "daysInactive",
                header: "Days Inactive",
                numeric: true,
                cell: (r) => <span className="tabular-nums">{r.daysInactive}d</span>,
                sortValue: (r) => r.daysInactive,
              },
              {
                key: "equity",
                header: "Equity",
                numeric: true,
                cell: (r) => <span className="tabular-nums">{formatCurrency(r.equity, currency)}</span>,
                sortValue: (r) => r.equity,
              },
              {
                key: "lastActivity",
                header: "Last Activity",
                cell: (r) => <span className="text-xs text-muted-foreground">{r.lastActivity}</span>,
              },
              {
                key: "action",
                header: "Recommended Action",
                cell: (r) => (
                  <Badge variant="outline" className="border-border bg-muted/60 font-medium">
                    {r.action}
                  </Badge>
                ),
              },
            ]}
          />
        </div>

        {/* Section 3: Payout Fraud Risk */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                <LabelWithHelp
                  help={
                    <p>
                      Each {term("payout").toLowerCase()} request is scored 0–100 by the fraud model based on
                      amount, method, account age, IP diversity, and behavioural pattern. Scores ≥ 75 are
                      flagged for senior reviewer attention before approval.
                    </p>
                  }
                >
                  {term("payout")} Fraud Risk
                </LabelWithHelp>
              </p>
              <p className="text-xs text-muted-foreground">Pending {term("payout").toLowerCase()}s ranked by predicted fraud score</p>
            </div>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              {payoutRows.filter((r) => r.riskScore >= 50).length} flagged
            </Badge>
          </div>
          <DataTable
            data={payoutRows}
            rowKey={(r) => r.payoutId}
            pageSize={5}
            searchableText={(r) => `${r.traderName} ${r.payoutId}`}
            searchPlaceholder="Search payout / trader…"
            onRowClick={(r) => navigate("payouts-pending", { id: r.payoutId })}
            emptyTitle="No payouts flagged"
            emptyDescription="No pending payouts to score for this tenant."
            columns={[
              {
                key: "payoutId",
                header: `${term("payout")} ID`,
                cell: (r) => <span className="font-mono text-xs text-foreground">{r.payoutId}</span>,
                sortValue: (r) => r.payoutId,
              },
              {
                key: "trader",
                header: term("trader"),
                cell: (r) => <span className="font-medium text-foreground">{r.traderName}</span>,
                sortValue: (r) => r.traderName,
              },
              {
                key: "amount",
                header: "Amount",
                numeric: true,
                cell: (r) => <span className="tabular-nums">{formatCurrency(r.amount, r.currency)}</span>,
                sortValue: (r) => r.amount,
              },
              {
                key: "riskScore",
                header: "Risk Score",
                numeric: true,
                cell: (r) => (
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge tone={riskToneFor(r.riskScore)}>{r.riskScore}</StatusBadge>
                    <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.riskScore}%`,
                          background:
                            r.riskScore >= 75 ? TERRA.rose :
                            r.riskScore >= 50 ? TERRA.amber :
                            r.riskScore >= 30 ? TERRA.sky :
                            TERRA.emerald,
                        }}
                      />
                    </div>
                  </div>
                ),
                sortValue: (r) => r.riskScore,
              },
              {
                key: "factors",
                header: "Risk Factors",
                cell: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.riskFactors.map((f) => (
                      <Badge
                        key={f}
                        variant="outline"
                        className={
                          f === "None"
                            ? "border-border bg-muted/40 text-muted-foreground"
                            : "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                        }
                      >
                        {f}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                key: "reviewer",
                header: "Recommended Reviewer",
                cell: (r) => <span className="text-sm text-foreground">{r.reviewer}</span>,
              },
              {
                key: "actions",
                header: "Actions",
                width: "120px",
                cell: (r) => (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("payouts-pending", { id: r.payoutId });
                    }}
                  >
                    Review
                  </Button>
                ),
              },
            ]}
          />
        </div>

        {/* Section 4: Trader Success Probability */}
        <ChartCard
          title={`${term("trader")} Success Probability`}
          subtitle={`Top 20 active ${plural(term("trader")).toLowerCase()} by predicted success score (0–100%)`}
          help={
            <p>
              Success probability combines win rate, profitable PnL, and trade volume. Traders in the
              <strong>high tier (≥70%)</strong> are prime candidates for upgraded account sizes or funded
              promotions.
            </p>
          }
        >
          <BarSeries
            data={successRows.map((r) => ({
              label: r.name.split(" ")[0],
              value: r.probability,
            }))}
            xKey="label"
            yKey="value"
            color={TERRA.emerald}
            height={260}
            formatValue={(v) => `${v}%`}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.emerald }} />
              High (≥70%) — {successRows.filter((r) => r.tier === "high").length}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.amber }} />
              Medium (40–69%) — {successRows.filter((r) => r.tier === "medium").length}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.rose }} />
              Low (&lt;40%) — {successRows.filter((r) => r.tier === "low").length}
            </span>
          </div>
        </ChartCard>

        {/* Section 5: 30-day Forecast */}
        <ChartCard
          title="Forecast — Next 30 Days"
          subtitle="Predicted new trader signups per day (with confidence band)"
          help={
            <p>
              Daily forecast with a ±22% confidence band driven by model uncertainty. The shaded area
              represents the expected range; the solid line is the median prediction. Values use
              deterministic seasonality — no live data is consumed.
            </p>
          }
        >
          <AreaSeries
            data={signupForecast}
            xKey="day"
            yKey="predicted"
            color={TERRA.emerald}
            height={240}
            formatValue={(v) => `${v} signups`}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Confidence band: ±22% of predicted value · model uncertainty seeded by tenant ID
          </p>
        </ChartCard>

        {/* Methodology card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <LabelWithHelp
                help={
                  <p>
                    Predictions are generated by the tenant&apos;s configured AI model (see AI Configure).
                    All scores are deterministic for the demo; production deployments call the live model
                    every 6 hours and persist results for audit.
                  </p>
                }
              >
                How predictions are calculated
              </LabelWithHelp>
            </CardTitle>
            <CardDescription>Model inputs, scoring bands, and action matrix</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Churn inputs</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· Days since last activity</li>
                <li>· Win rate (last 30d)</li>
                <li>· Recent PnL direction</li>
                <li>· Account equity band</li>
                <li>· Tenant-specific seed</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fraud inputs</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· {term("payout").toLowerCase()} amount</li>
                <li>· Method risk profile</li>
                <li>· Account age (days)</li>
                <li>· IP diversity</li>
                <li>· Behavioural pattern</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action matrix</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· 80–100 — Check-in call</li>
                <li>· 60–79 — Retention bonus</li>
                <li>· 40–59 — Re-engagement email</li>
                <li>· 20–39 — Weekly digest</li>
                <li>· 0–19 — Monitor only</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Toast trigger help */}
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              toast({
                title: "Predictive model status",
                description: `Accuracy ${modelAccuracy}% · ${predictions30d} predictions in the last 30 days · ${highRiskTraders} high-risk ${plural(term("trader")).toLowerCase()} flagged.`,
              })
            }
          >
            <Sparkles className="mr-1 h-4 w-4" />
            Model status
          </Button>
        </div>
      </PageContent>
    </Page>
  );
}
