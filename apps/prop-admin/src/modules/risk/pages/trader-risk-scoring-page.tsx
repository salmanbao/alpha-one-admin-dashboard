"use client";

/**
 * Trader Risk Scoring — audit finding #4 (MEDIUM).
 *
 * Risk monitoring existed (breaches, cases, statistics) but there was
 * no per-trader composite risk score: admins couldn't rank their
 * traders by who is most likely to cause an unexpected loss, spot
 * deteriorating standing, or configure thresholds for automated
 * actions. This screen adds:
 *
 *  - A deterministic composite score (0–100) per trader across four
 *    explainable dimensions: rule adherence (breach history), drawdown
 *    behavior (equity vs balance), consistency (win rate), and trading
 *    pattern flags (churn vs P&L)
 *  - 7-day risk trend with deterioration alerts (drop ≥ 8 points)
 *  - Risk-band filtering and configurable thresholds: flag-for-review
 *    and suspend-recommendation cutoffs (risk.configure gated)
 *  - Drill-down to the trader detail view for investigation
 *
 * All scores derive from mock fixtures + a deterministic hash — no
 * Math.random(), stable across renders. Mirrors the tenant-level
 * explainable-scoring approach on Risk Overview (§19).
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { getTenantBreaches, getTenantTraders, type Trader } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Gauge,
  Lock,
  Save,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Deterministic scoring                                               */
/* ------------------------------------------------------------------ */

/** Deterministic hash → int (same approach as Risk Overview §19). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

interface TraderScore {
  trader: Trader;
  adherence: number;
  drawdown: number;
  consistency: number;
  patterns: number;
  composite: number;
  /** Oldest → newest, ends at composite. */
  trend: number[];
  drop7d: number;
  breachCount: number;
}

function scoreTrader(
  trader: Trader,
  breachCount: number,
  criticalBreaches: number,
): TraderScore {
  // 1. Rule adherence (30%) — breach history caps the dimension.
  let adherence = 100 - criticalBreaches * 25 - Math.max(0, breachCount - criticalBreaches) * 10;
  if (trader.status === "breached") adherence = Math.min(adherence, 40);
  if (trader.status === "suspended") adherence = Math.min(adherence, 30);
  adherence = clamp(adherence);

  // 2. Drawdown behavior (25%) — equity shortfall vs starting balance.
  const ddPct = Math.max(0, ((trader.accountBalance - trader.equity) / Math.max(1, trader.accountBalance)) * 100);
  const drawdown = clamp(100 - ddPct * 5);

  // 3. Consistency (25%) — win rate scaled from the realistic 30–60 band.
  const consistency = clamp((trader.winRate / 55) * 100);

  // 4. Trading patterns (20%) — deterministic flags + churn check.
  let flags = hashStr(trader.id + "|patterns") % 3;
  if (trader.trades > 200 && trader.totalPnl < 0) flags += 1;
  const patterns = clamp(100 - flags * 18);

  const composite = Math.round(
    adherence * 0.3 + drawdown * 0.25 + consistency * 0.25 + patterns * 0.2,
  );

  // 7-day trend — deterministic offsets ending at today's composite.
  const h = hashStr(trader.id + "|trend");
  const trend = Array.from({ length: 7 }, (_, i) =>
    clamp(composite + ((h >> (i * 2)) % 17) - 8),
  );
  trend[6] = composite;
  const drop7d = trend[0] - trend[6];

  return { trader, adherence, drawdown, consistency, patterns, composite, trend, drop7d, breachCount };
}

/* ------------------------------------------------------------------ */
/* Presentation helpers                                                */
/* ------------------------------------------------------------------ */

function bandOf(score: number, review: number, suspend: number): "critical" | "high" | "watch" | "healthy" {
  if (score < suspend) return "critical";
  if (score < review) return "high";
  if (score < review + 15) return "watch";
  return "healthy";
}

const bandBadge: Record<string, { label: string; variant: "destructive" | "secondary" | "default" | "outline" }> = {
  critical: { label: "Critical", variant: "destructive" },
  high: { label: "High risk", variant: "secondary" },
  watch: { label: "Watch", variant: "default" },
  healthy: { label: "Healthy", variant: "outline" },
};

const bandDot: Record<string, string> = {
  critical: "bg-rose-500",
  high: "bg-amber-500",
  watch: "bg-sky-500",
  healthy: "bg-emerald-500",
};

function MiniTrend({ series }: { series: number[] }) {
  const max = 100;
  const w = 48;
  const h = 16;
  const step = w / (series.length - 1);
  const points = series.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="7-day score trend" role="img">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DimBar({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center gap-1" title={`${label}: ${value}/100`}>
      <span className="w-4 text-[9px] font-bold uppercase text-muted-foreground">{label}</span>
      <span className="h-1.5 w-9 overflow-hidden rounded-full bg-muted">
        <span
          className={`block h-full rounded-full ${
            value >= 70 ? "bg-emerald-500" : value >= 45 ? "bg-amber-500" : "bg-rose-500"
          }`}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="w-5 text-[10px] font-bold tabular-nums">{value}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function TraderRiskScoringPage() {
  const { runtime, navigate, user } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const canConfigure = hasPermission(user, "risk.configure");

  const [band, setBand] = useState<"all" | "critical" | "high" | "watch" | "healthy">("all");
  const [reviewThreshold, setReviewThreshold] = useState(55);
  const [suspendThreshold, setSuspendThreshold] = useState(35);

  const scores = useMemo(() => {
    const traders = getTenantTraders(tid);
    const breaches = getTenantBreaches(tid);
    return traders.map((t) => {
      const mine = breaches.filter((b) => b.traderId === t.id);
      const critical = mine.filter((b) => b.severity === "critical").length;
      return scoreTrader(t, mine.length, critical);
    });
  }, [tid]);

  const rows = useMemo(
    () =>
      scores
        .map((s) => ({ ...s, band: bandOf(s.composite, reviewThreshold, suspendThreshold) }))
        .filter((s) => band === "all" || s.band === band)
        .sort((a, b) => a.composite - b.composite),
    [scores, band, reviewThreshold, suspendThreshold],
  );

  const avgScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s.composite, 0) / scores.length)
    : 0;
  const highRisk = scores.filter((s) => s.composite < reviewThreshold).length;
  const deteriorating = scores.filter((s) => s.drop7d >= 8).length;
  const critical = scores.filter((s) => s.composite < suspendThreshold).length;

  const saveThresholds = () => {
    toast({
      title: "Risk thresholds saved",
      description: `Traders scoring below ${reviewThreshold} are flagged for review; below ${suspendThreshold} triggers a suspend recommendation. ${highRisk} trader${highRisk === 1 ? "" : "s"} match today.`,
    });
  };
  const lockTitle = canConfigure ? undefined : "Requires risk.configure";

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "trader",
      header: "Trader",
      cell: (s) => (
        <button
          type="button"
          className="font-medium text-foreground underline-offset-2 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate("trader-detail", { id: s.trader.id });
          }}
        >
          {s.trader.name}
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
            {s.trader.country} · {s.trader.challengePhase ?? "—"}
          </span>
        </button>
      ),
      sortValue: (s) => s.trader.name,
    },
    {
      key: "score",
      header: "Risk score",
      cell: (s) => (
        <span className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${bandDot[s.band]}`} aria-hidden />
          <span className="font-headline text-base font-bold tabular-nums">{s.composite}</span>
          <Badge variant={bandBadge[s.band].variant}>{bandBadge[s.band].label}</Badge>
        </span>
      ),
      sortValue: (s) => s.composite,
    },
    {
      key: "dimensions",
      header: "Dimensions",
      cell: (s) => (
        <span className="flex flex-wrap items-center gap-2">
          <DimBar label="R" value={s.adherence} />
          <DimBar label="D" value={s.drawdown} />
          <DimBar label="C" value={s.consistency} />
          <DimBar label="P" value={s.patterns} />
        </span>
      ),
      sortValue: (s) => s.composite,
    },
    {
      key: "trend",
      header: "7-day trend",
      cell: (s) => (
        <span
          className={`flex items-center gap-1 ${
            s.drop7d >= 8 ? "text-rose-600 dark:text-rose-400" : s.drop7d <= -8 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}
        >
          <MiniTrend series={s.trend} />
          {s.drop7d > 0 ? <ArrowDown className="h-3 w-3" /> : s.drop7d < 0 ? <ArrowUp className="h-3 w-3" /> : null}
          <span className="text-[11px] font-bold tabular-nums">{Math.abs(s.drop7d)}</span>
        </span>
      ),
      sortValue: (s) => s.drop7d,
    },
    {
      key: "breaches",
      header: "Breaches",
      cell: (s) =>
        s.breachCount === 0 ? (
          <span className="text-xs text-muted-foreground">None</span>
        ) : (
          <Badge variant="outline">{s.breachCount} recorded</Badge>
        ),
      sortValue: (s) => s.breachCount,
    },
    {
      key: "alerts",
      header: "Alerts",
      cell: (s) => {
        const alerts: { label: string; variant: "destructive" | "secondary" }[] = [];
        if (s.composite < suspendThreshold) alerts.push({ label: "Suspend review", variant: "destructive" });
        else if (s.composite < reviewThreshold) alerts.push({ label: "Flag for review", variant: "secondary" });
        if (s.drop7d >= 8) alerts.push({ label: "Deteriorating", variant: "destructive" });
        if (s.adherence < 60) alerts.push({ label: "Rule adherence", variant: "secondary" });
        return alerts.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {alerts.map((a) => (
              <Badge key={a.label} variant={a.variant}>
                {a.label}
              </Badge>
            ))}
          </span>
        );
      },
      sortValue: (s) => (s.composite < suspendThreshold ? 0 : s.composite < reviewThreshold ? 1 : 2),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (s) => (
        <span className="flex items-center justify-end gap-1">
          {/* Audit finding #2 — jump straight into coaching for the
              trader this row just flagged. */}
          <Button
            size="sm"
            variant="ghost"
            title="Open the coaching tab to send feedback or schedule a follow-up"
            onClick={(e) => {
              e.stopPropagation();
              navigate("trader-detail", { id: s.trader.id, tab: "Coaching" });
            }}
          >
            Coach
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Open the trader profile to investigate"
            onClick={(e) => {
              e.stopPropagation();
              navigate("trader-detail", { id: s.trader.id });
            }}
          >
            Investigate <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Trader Risk Scoring"
        description="Composite, explainable risk scores across every trader — rule adherence, drawdown behavior, consistency, and trading patterns — with deterioration alerts and action thresholds."
        icon={Gauge}
      />
      <PageContent>
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Average score"
            value={`${avgScore}/100`}
            icon={Gauge}
            tone={avgScore >= 70 ? "positive" : avgScore >= 50 ? "warning" : "negative"}
            deltaLabel="across all scored traders"
          />
          <MetricCard
            label="High risk (below review)"
            value={highRisk}
            icon={AlertTriangle}
            tone={highRisk > 0 ? "warning" : "positive"}
            deltaLabel={`review threshold ${reviewThreshold}`}
          />
          <MetricCard
            label="Deteriorating (7d)"
            value={deteriorating}
            icon={TrendingDown}
            tone={deteriorating > 0 ? "negative" : "positive"}
            deltaLabel="score dropped ≥8 points this week"
          />
          <MetricCard
            label="Suspend recommendations"
            value={critical}
            icon={ShieldAlert}
            tone={critical > 0 ? "negative" : "positive"}
            deltaLabel={`suspend threshold ${suspendThreshold}`}
          />
        </div>

        {/* Thresholds + band filter */}
        <Card>
          <CardContent className="flex flex-wrap items-end justify-between gap-4 p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="rr-review" className="text-xs font-medium text-muted-foreground">
                  Flag for review below
                </label>
                <input
                  id="rr-review"
                  type="number"
                  min={suspendThreshold + 5}
                  max={95}
                  value={reviewThreshold}
                  disabled={!canConfigure}
                  onChange={(e) =>
                    setReviewThreshold(Math.max(suspendThreshold + 5, Math.min(95, Number(e.target.value) || 55)))
                  }
                  className="ml-2 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div>
                <label htmlFor="rr-suspend" className="text-xs font-medium text-muted-foreground">
                  Suspend recommendation below
                </label>
                <input
                  id="rr-suspend"
                  type="number"
                  min={0}
                  max={reviewThreshold - 5}
                  value={suspendThreshold}
                  disabled={!canConfigure}
                  onChange={(e) =>
                    setSuspendThreshold(Math.max(0, Math.min(reviewThreshold - 5, Number(e.target.value) || 35)))
                  }
                  className="ml-2 w-20 rounded-md border border-input bg-background px-2 py-1 text-sm font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <Button size="sm" onClick={saveThresholds} disabled={!canConfigure} title={lockTitle}>
                {canConfigure ? <Save className="mr-1 h-3.5 w-3.5" /> : <Lock className="mr-1 h-3.5 w-3.5" />}
                Save thresholds
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "critical", "high", "watch", "healthy"] as const).map((b) => (
                <Button
                  key={b}
                  size="sm"
                  variant={band === b ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => setBand(b)}
                >
                  {b === "all" ? "All traders" : bandBadge[b].label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scoring methodology — explainability (§19) */}
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Activity className="mt-0.5 h-3 w-3 shrink-0" />
          Composite = rule adherence (30% — breach history and account status) + drawdown behavior
          (25% — equity vs balance) + consistency (25% — win rate) + trading patterns (20% — churn
          vs P&amp;L flags). R = rule adherence, D = drawdown, C = consistency, P = patterns.
        </p>

        {/* Scored traders */}
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(s) => s.trader.id}
          searchableText={(s) => `${s.trader.name} ${s.trader.country} ${s.trader.status}`}
          searchPlaceholder="Search traders…"
          onRowClick={(s) => navigate("trader-detail", { id: s.trader.id })}
          emptyTitle="No traders in this band"
          emptyDescription="Switch the band filter or adjust the thresholds."
        />
      </PageContent>
    </Page>
  );
}
