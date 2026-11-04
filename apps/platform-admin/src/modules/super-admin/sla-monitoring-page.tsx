"use client";

/**
 * SLA Monitoring — audit finding #10 (MEDIUM).
 *
 * Enterprise tenants are sold on uptime, latency and support-response
 * guarantees, but nothing in tenant management showed whether those
 * commitments are actually being met. This sub-screen makes the
 * contractual bar visible per tenant:
 *
 *   • Uptime (30 d)          — higher is better
 *   • p95 API latency        — lower is better
 *   • First response (support) — lower is better
 *   • MTTR (incidents)       — lower is better
 *
 * Every metric is measured against the **plan-tier target**: higher
 * tiers are sold a stricter bar (Enterprise 99.95 % / 350 ms / 2 h /
 * 4 h vs Starter 99.50 % / 800 ms / 8 h / 12 h). Values derive
 * deterministically from `hashStr(tenant.id)` — a fixed fixture with no
 * `Math.random()` — so screenshots and tests stay stable; swap the
 * derivation for the telemetry feed when the backend exposes it.
 *
 * Screen contents: portfolio KPIs, SLA breach alerts, 12-month uptime /
 * first-response trends, a per-tenant compliance table, and an advice
 * card for tenants currently at risk.
 *
 * Audit #4 extended the screen from "who is missing today" to "who is
 * about to miss":
 *
 *   • Predictive breach alerts — each compliant tenant's own 12-month
 *     trend is extrapolated to a months-to-breach projection, so a
 *     slow drift toward the target surfaces before the meter turns red.
 *   • Early-warning threshold — the operator picks how close to the
 *     target counts as "watch this" (narrow / standard / wide margin,
 *     expressed in each metric's natural unit); the near-miss list
 *     re-derives from that control.
 *   • Root-cause patterns — which metric fails most, which plan tier
 *     concentrates the failures, and which metrics fail together
 *     (shared root cause vs independent problems).
 *   • SLA CSV export — the tenants in view, with actuals, targets and
 *     misses, via the shared exportToCsv helper.
 *
 * All four are pure functions of the same deterministic fixtures — no
 * `Math.random()`, no `Date.now()` in the data path.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { AreaSeries } from "@/components/platform/charts";
import { usePlatform } from "@/lib/platform/platform-context";
import { tenants as allTenants, hashStr } from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { exportToCsv } from "@/lib/platform/export-utils";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  Lightbulb,
  ShieldCheck,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* SLA dictionary                                                      */
/* ------------------------------------------------------------------ */

type PlanTier = TenantContext["plan"];
type SlaKey = "uptime" | "latency" | "firstResponse" | "mttr";

interface SlaDef {
  key: SlaKey;
  label: string;
  unit: string;
  /** True when a higher number is the good outcome. */
  higherIsBetter: boolean;
  /** Plan-tier targets — enterprise is sold a stricter bar. */
  planTargets: Record<PlanTier, number>;
  format: (v: number) => string;
}

const SLAS: Record<SlaKey, SlaDef> = {
  uptime: {
    key: "uptime",
    label: "Uptime (30 d)",
    unit: "availability",
    higherIsBetter: true,
    planTargets: { starter: 99.5, growth: 99.7, scale: 99.9, enterprise: 99.95 },
    format: (v) => `${v.toFixed(2)}%`,
  },
  latency: {
    key: "latency",
    label: "p95 API latency",
    unit: "milliseconds",
    higherIsBetter: false,
    planTargets: { starter: 800, growth: 600, scale: 450, enterprise: 350 },
    format: (v) => `${Math.round(v)} ms`,
  },
  firstResponse: {
    key: "firstResponse",
    label: "First response",
    unit: "support ticket, hours",
    higherIsBetter: false,
    planTargets: { starter: 8, growth: 6, scale: 4, enterprise: 2 },
    format: (v) => `${v.toFixed(1)} h`,
  },
  mttr: {
    key: "mttr",
    label: "MTTR",
    unit: "mean time to restore, hours",
    higherIsBetter: false,
    planTargets: { starter: 12, growth: 8, scale: 6, enterprise: 4 },
    format: (v) => `${v.toFixed(1)} h`,
  },
};

const SLA_ORDER: SlaKey[] = ["uptime", "latency", "firstResponse", "mttr"];
const PLAN_TIERS: PlanTier[] = ["starter", "growth", "scale", "enterprise"];
const PLAN_LABEL: Record<PlanTier, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  enterprise: "Enterprise",
};

const meets = (value: number, target: number, def: SlaDef) =>
  def.higherIsBetter ? value >= target : value <= target;

/* ------------------------------------------------------------------ */
/* Row model + deterministic SLA computation                            */
/* ------------------------------------------------------------------ */

interface TenantSla {
  id: string;
  name: string;
  plan: PlanTier;
  values: Record<SlaKey, number>;
  /** Metric keys currently missing their plan-tier target. */
  breaches: SlaKey[];
}

function buildRows(): TenantSla[] {
  return allTenants
    .filter((t) => t.id !== "platform")
    .map((t) => {
      const h = hashStr(`sla-${t.id}`);
      const targets = {
        uptime: SLAS.uptime.planTargets[t.plan],
        latency: SLAS.latency.planTargets[t.plan],
        firstResponse: SLAS.firstResponse.planTargets[t.plan],
        mttr: SLAS.mttr.planTargets[t.plan],
      };
      // Deterministic spread around the tier target: each hash slice can
      // land either side of the bar so every view contains met and
      // missed SLAs — no Math.random(), identical on every render.
      const values: Record<SlaKey, number> = {
        // ±0.44 pts around the target, clamped below 100 %.
        uptime: Math.min(
          99.99,
          Number((targets.uptime - 0.3 + ((h % 75) / 100)).toFixed(2)),
        ),
        latency: Math.round(targets.latency + 150 - (h % 300)),
        firstResponse: Math.round((targets.firstResponse + 3 - (h % 70) / 10) * 10) / 10,
        mttr: Math.round((targets.mttr + 4 - (h % 80) / 10) * 10) / 10,
      };
      const breaches = SLA_ORDER.filter((k) => !meets(values[k], targets[k], SLAS[k]));
      return { id: t.id, name: t.name, plan: t.plan, values, breaches };
    });
}

/** Worst shortfall against the tier target, in "missed by" terms. */
function worstMiss(row: TenantSla): { key: SlaKey; gapText: string } | null {
  if (!row.breaches.length) return null;
  // Rank misses by relative size so the alert names the biggest problem.
  let worst: SlaKey = row.breaches[0];
  let worstRel = -Infinity;
  for (const key of row.breaches) {
    const def = SLAS[key];
    const target = def.planTargets[row.plan];
    const rel = Math.abs(row.values[key] - target) / Math.max(target, 0.01);
    if (rel > worstRel) {
      worstRel = rel;
      worst = key;
    }
  }
  const def = SLAS[worst];
  const target = def.planTargets[row.plan];
  const raw = row.values[worst] - target;
  const gapText = def.higherIsBetter
    ? `${def.format(Math.abs(raw))} below target`
    : `${def.format(Math.abs(raw))} over target`;
  return { key: worst, gapText };
}

/* ------------------------------------------------------------------ */
/* Deterministic 12-month trends (no Math.random)                       */
/* ------------------------------------------------------------------ */

function trendSeries(center: number, amplitude: number, worseDirection: -1 | 1, dp: number) {
  const step = amplitude * 0.07;
  return Array.from({ length: 12 }, (_, i) => {
    const monthsAgo = 11 - i;
    const seasonal = Math.sin((monthsAgo + 1) / 2.1) * amplitude;
    // Past is worse than today: drift away from the current value.
    const drift = worseDirection * monthsAgo * step;
    return {
      date: `M-${monthsAgo}`,
      value: Number((center + seasonal + drift).toFixed(dp)),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

const ADVICE: Record<SlaKey, (name: string, value: string, target: string) => string> = {
  uptime: (n, v, t) =>
    `${n} is at ${v} uptime against a ${t} plan target — review incident history and page the on-call for recurring degradation windows before renewal.`,
  latency: (n, v, t) =>
    `${n} p95 latency is ${v} against ${t} plan target — inspect hot endpoints, cache hit rate and region load; sustained misses need an infrastructure ticket.`,
  firstResponse: (n, v, t) =>
    `${n} averages ${v} first response against ${t} plan target — rebalance the support rota or add coverage in their business hours.`,
  mttr: (n, v, t) =>
    `${n} MTTR is ${v} against ${t} plan target — check incident runbook coverage and escalation lag; long restores usually mean manual steps.`,
};

/* ------------------------------------------------------------------ */
/* Early-warning threshold (audit #4)                                   */
/* ------------------------------------------------------------------ */

/**
 * Three named margins, expressed in each metric's own unit so "0.05
 * uptime points" and "25 ms" read the same way on the control. Narrow
 * only flags tenants sitting right on the target; wide catches drift
 * earlier at the cost of more noise.
 */
const WARN_SETTINGS = ["Narrow", "Standard", "Wide"] as const;
const WARN_MARGINS: Record<SlaKey, number[]> = {
  uptime: [0.05, 0.1, 0.2], // availability points
  latency: [25, 50, 100], // ms
  firstResponse: [0.5, 1, 2], // hours
  mttr: [1, 2, 4], // hours
};
/** Short unit for the control caption ("0.05 pts · 25 ms · 0.5 h …"). */
const WARN_UNIT_SHORT: Record<SlaKey, string> = {
  uptime: "pts",
  latency: "ms",
  firstResponse: "h",
  mttr: "h",
};

/** Metrics that still meet target but sit inside the selected margin. */
function nearMisses(
  row: TenantSla,
  setting: number,
): { key: SlaKey; gap: number }[] {
  return SLA_ORDER.filter((key) => {
    const def = SLAS[key];
    const target = def.planTargets[row.plan];
    // Already breached → that is the breach-alert card, not a warning.
    if (!meets(row.values[key], target, def)) return false;
    return Math.abs(row.values[key] - target) <= WARN_MARGINS[key][setting];
  }).map((key) => ({
    key,
    gap: Math.abs(row.values[key] - SLAS[key].planTargets[row.plan]),
  }));
}

/* ------------------------------------------------------------------ */
/* Predictive projection (audit #4) — months-to-breach from trend      */
/* ------------------------------------------------------------------ */

/** Projection horizon the alert card works inside. */
const PROJECTION_HORIZON = 6;

/**
 * Monthly drift for one tenant/metric, in the metric's own unit.
 *
 * Derived from the same seed that built the tenant's history: the hash
 * decides whether the 12-month trend was moving *toward* the target
 * (worsening — two thirds of tenants) or away from it, and how fast.
 * A pure function of ids, so the projection is reproducible; swap the
 * derivation for the telemetry slope when the backend exposes it.
 */
function trendSlope(row: TenantSla, key: SlaKey): number {
  const def = SLAS[key];
  const h = hashStr(`slope-${row.id}-${key}`);
  const degrading = h % 3 !== 0;
  const scale = def.higherIsBetter
    ? 0.03 + (h % 5) * 0.015 // uptime: 0.03–0.09 pts per month
    : Math.max(3, def.planTargets[row.plan] * 0.06) * (0.5 + (h % 5) / 10);
  // Degradation direction depends on which way the metric is "bad".
  const sign = def.higherIsBetter ? -1 : 1;
  return degrading ? sign * scale : -sign * scale * 0.5;
}

interface BreachProjection {
  row: TenantSla;
  key: SlaKey;
  /** Whole months from today until the plan-tier target is crossed. */
  months: number;
}

/**
 * Compliant tenants whose own trend crosses their target inside the
 * horizon, soonest first. Tenants already breaching are excluded — the
 * breach-alert card owns those — so the two lists never overlap.
 */
function projectBreaches(rows: TenantSla[], horizon: number): BreachProjection[] {
  const out: BreachProjection[] = [];
  for (const row of rows) {
    if (row.breaches.length) continue;
    for (const key of SLA_ORDER) {
      const def = SLAS[key];
      const target = def.planTargets[row.plan];
      const slope = trendSlope(row, key);
      // Only a trend moving *toward* the target can breach it.
      const toward = def.higherIsBetter ? slope < 0 : slope > 0;
      if (!toward) continue;
      const distance = def.higherIsBetter
        ? row.values[key] - target
        : target - row.values[key];
      const months = Math.max(1, Math.ceil(distance / Math.abs(slope)));
      if (months <= horizon) out.push({ row, key, months });
    }
  }
  return out.sort(
    (a, b) =>
      a.months - b.months ||
      a.row.name.localeCompare(b.row.name) ||
      a.key.localeCompare(b.key),
  );
}

/* ------------------------------------------------------------------ */
/* Root-cause patterns (audit #4)                                       */
/* ------------------------------------------------------------------ */

interface RootCause {
  atRisk: number;
  missCounts: Record<SlaKey, number>;
  totalMisses: number;
  /** Metric responsible for the most misses. */
  topKey: SlaKey | null;
  /** Plan tier with the highest share of at-risk tenants. */
  worstTier: { plan: PlanTier; count: number; atRisk: number; avg: number } | null;
  /** Strongest co-occurrence: both miss together / how often A misses. */
  pair: { a: SlaKey; b: SlaKey; both: number; ofA: number } | null;
}

function analyzeRootCause(rows: TenantSla[]): RootCause {
  const atRisk = rows.filter((r) => r.breaches.length > 0);
  const missCounts: Record<SlaKey, number> = {
    uptime: 0,
    latency: 0,
    firstResponse: 0,
    mttr: 0,
  };
  for (const r of atRisk) for (const k of r.breaches) missCounts[k] += 1;
  const totalMisses = SLA_ORDER.reduce((s, k) => s + missCounts[k], 0);
  const topKey =
    totalMisses === 0
      ? null
      : SLA_ORDER.reduce((a, b) => (missCounts[b] > missCounts[a] ? b : a), SLA_ORDER[0]);

  const tiers = PLAN_TIERS.map((plan) => {
    const inTier = rows.filter((r) => r.plan === plan);
    const risk = inTier.filter((r) => r.breaches.length > 0);
    return {
      plan,
      count: inTier.length,
      atRisk: risk.length,
      avg: inTier.length
        ? risk.reduce((s, r) => s + r.breaches.length, 0) / inTier.length
        : 0,
    };
  }).filter((t) => t.count > 0);
  const worstTier = tiers.length
    ? tiers.reduce((a, b) => (b.atRisk / b.count > a.atRisk / a.count ? b : a))
    : null;

  // Strongest pair by raw co-occurrence — fixed iteration order keeps
  // ties deterministic.
  let pair: RootCause["pair"] = null;
  for (const a of SLA_ORDER) {
    const ofA = atRisk.filter((r) => r.breaches.includes(a)).length;
    if (!ofA) continue;
    for (const b of SLA_ORDER) {
      if (b === a) continue;
      const both = atRisk.filter(
        (r) => r.breaches.includes(a) && r.breaches.includes(b),
      ).length;
      if (both > 0 && (!pair || both > pair.both)) pair = { a, b, both, ofA };
    }
  }

  return { atRisk: atRisk.length, missCounts, totalMisses, topKey, worstTier, pair };
}

export function SlaMonitoringPage() {
  const { navigate } = usePlatform();

  const {
    data: rows = [],
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => buildRows(), { delayMs: 450 }), []);

  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "compliant" | "at-risk">("all");
  // Early-warning margin (audit #4) — index into WARN_SETTINGS / WARN_MARGINS.
  const [warnSetting, setWarnSetting] = useState(1);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (planFilter === "all" || r.plan === planFilter) &&
          (statusFilter === "all" ||
            (statusFilter === "compliant" ? r.breaches.length === 0 : r.breaches.length > 0)),
      ),
    [rows, planFilter, statusFilter],
  );

  const compliant = filtered.filter((r) => r.breaches.length === 0);
  const atRisk = filtered.filter((r) => r.breaches.length > 0);

  const portfolioUptime = filtered.length
    ? Number(
        (
          filtered.reduce((s, r) => s + r.values.uptime, 0) / filtered.length
        ).toFixed(2),
      )
    : 0;
  const portfolioFirstResponse = filtered.length
    ? Math.round(
        (filtered.reduce((s, r) => s + r.values.firstResponse, 0) / filtered.length) * 10,
      ) / 10
    : 0;

  const uptimeTrend = useMemo(
    () => trendSeries(portfolioUptime, 0.12, -1, 2),
    [portfolioUptime],
  );
  const firstResponseTrend = useMemo(
    () => trendSeries(portfolioFirstResponse, 0.5, 1, 1),
    [portfolioFirstResponse],
  );

  const tiersInView = PLAN_TIERS.filter((p) => filtered.some((r) => r.plan === p));

  // Audit #4 — predictive / warning / root-cause views over the same
  // filtered set the table and KPIs use, so every control agrees.
  const projections = useMemo(
    () => projectBreaches(filtered, PROJECTION_HORIZON),
    [filtered],
  );
  const earlyWarnings = useMemo(
    () =>
      filtered
        .map((row) => ({ row, misses: nearMisses(row, warnSetting) }))
        .filter((e) => e.misses.length > 0)
        .sort(
          (a, b) =>
            b.misses.length - a.misses.length || a.row.name.localeCompare(b.row.name),
        ),
    [filtered, warnSetting],
  );
  const rootCause = useMemo(() => analyzeRootCause(filtered), [filtered]);

  // CSV export (audit #4) — actuals, targets and misses for the tenants
  // currently in view, via the shared exportToCsv helper.
  const exportSla = () => {
    exportToCsv(
      filtered,
      [
        { key: "tenant", header: "Tenant", value: (r) => r.name },
        { key: "plan", header: "Plan tier", value: (r) => PLAN_LABEL[r.plan] },
        ...SLA_ORDER.flatMap((k) => [
          {
            key: `${k}-actual`,
            header: `${SLAS[k].label} (actual)`,
            value: (r: TenantSla) => r.values[k],
          },
          {
            key: `${k}-target`,
            header: `${SLAS[k].label} (plan target)`,
            value: (r: TenantSla) => SLAS[k].planTargets[r.plan],
          },
        ]),
        {
          key: "missed",
          header: "SLAs missed",
          value: (r) => r.breaches.map((k) => SLAS[k].label).join("; ") || "none",
        },
        {
          key: "status",
          header: "Status",
          value: (r) => (r.breaches.length ? "At risk" : "Compliant"),
        },
      ],
      "tenant-sla-compliance.csv",
    );
  };

  const columns: Column<TenantSla>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="text-[11px] text-muted-foreground">{PLAN_LABEL[r.plan]} plan</p>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    ...SLA_ORDER.map((key): Column<TenantSla> => {
      const def = SLAS[key];
      return {
        key,
        header: def.label,
        cell: (r) => {
          const target = def.planTargets[r.plan];
          const ok = meets(r.values[key], target, def);
          return (
            <div className="flex flex-col gap-0.5">
              <span className={cn("tabular-nums font-medium", ok ? "text-foreground" : "text-rose-600")}>
                {def.format(r.values[key])}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                target {def.format(target)}
              </span>
            </div>
          );
        },
        sortValue: (r) => (def.higherIsBetter ? r.values[key] : -r.values[key]),
        numeric: true,
      };
    }),
    {
      key: "status",
      header: "SLA status",
      cell: (r) => {
        const miss = worstMiss(r);
        return (
          <div className="flex flex-col gap-1">
            <StatusBadge tone={r.breaches.length === 0 ? "success" : "danger"}>
              {r.breaches.length === 0
                ? "Compliant"
                : `${r.breaches.length} SLA${r.breaches.length > 1 ? "s" : ""} missed`}
            </StatusBadge>
            {miss ? (
              <span className="text-[11px] text-muted-foreground">
                {SLAS[miss.key].label}: {miss.gapText}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">All targets met</span>
            )}
          </div>
        );
      },
      sortValue: (r) => -r.breaches.length,
    },
  ];

  const filters = (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Plan tier (contract)
          </p>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-44" aria-label="Filter by plan tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plan tiers</SelectItem>
              {PLAN_TIERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {PLAN_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            SLA status
          </p>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-44" aria-label="Filter by SLA status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tenants</SelectItem>
              <SelectItem value="compliant">Compliant only</SelectItem>
              <SelectItem value="at-risk">At risk only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mb-0.5"
          onClick={() => {
            setPlanFilter("all");
            setStatusFilter("all");
          }}
        >
          Reset filters
        </Button>

        <Button variant="outline" size="sm" className="mb-0.5" onClick={exportSla}>
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </Button>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {filtered.length} of {rows.length} tenants in view
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Page>
      <PageHeader
        title="SLA Monitoring"
        description="Contractual uptime, API latency and support-response commitments per tenant — measured against each plan tier's target, with breach alerts and 12-month trends."
        icon={ShieldCheck}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate("incident-center")}>
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Incident center
          </Button>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={rows.length > 0}
          loadingLabel="Loading SLA telemetry…"
        >
          <div className="space-y-4">
            {filters}

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <ShieldCheck className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">No tenants match these filters</p>
                    <p className="text-xs text-muted-foreground">
                      Widen the plan tier or status filter to bring tenants back into view.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPlanFilter("all");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <MetricCard
                    label="Portfolio uptime (30 d)"
                    value={SLAS.uptime.format(portfolioUptime)}
                    icon={Gauge}
                    tone={
                      atRisk.length === 0
                        ? "positive"
                        : portfolioUptime >= 99.7
                          ? "warning"
                          : "negative"
                    }
                    deltaLabel="availability across tenants in view"
                  />
                  <MetricCard
                    label="Tenants compliant"
                    value={`${compliant.length} of ${filtered.length}`}
                    icon={CheckCircle2}
                    tone={compliant.length === filtered.length ? "positive" : "warning"}
                    deltaLabel="meeting every plan-tier SLA"
                  />
                  <MetricCard
                    label="SLA breach alerts"
                    value={`${atRisk.length}`}
                    icon={AlertTriangle}
                    tone={atRisk.length === 0 ? "positive" : "negative"}
                    deltaLabel={atRisk.length === 0 ? "none open" : "tenants at risk"}
                  />
                  <MetricCard
                    label="Avg first response"
                    value={SLAS.firstResponse.format(portfolioFirstResponse)}
                    icon={Timer}
                    tone={
                      atRisk.some((r) => r.breaches.includes("firstResponse"))
                        ? "negative"
                        : "positive"
                    }
                    deltaLabel="support tickets, hours"
                  />
                </div>

                {atRisk.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
                      <span className="text-sm font-medium">
                        SLA breach alerts — {atRisk.length} tenant{atRisk.length > 1 ? "s" : ""} at risk
                      </span>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {atRisk.map((r) => {
                        const miss = worstMiss(r);
                        if (!miss) return null;
                        return (
                          <div
                            key={r.id}
                            className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs"
                          >
                            <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-foreground">
                                {r.name}{" "}
                                <span className="font-normal text-muted-foreground">
                                  ({PLAN_LABEL[r.plan]})
                                </span>
                              </p>
                              <p className="text-muted-foreground">
                                {ADVICE[miss.key](
                                  r.name,
                                  SLAS[miss.key].format(r.values[miss.key]),
                                  SLAS[miss.key].format(SLAS[miss.key].planTargets[r.plan]),
                                )}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                Also missed:{" "}
                                {r.breaches
                                  .filter((k) => k !== miss.key)
                                  .map((k) => SLAS[k].label)
                                  .join(", ") || "—"}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 shrink-0"
                              onClick={() => navigate("tenant-detail", { id: r.id })}
                            >
                              Tenant
                              <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                            </Button>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

                {/* Predictive breach alerts (audit #4) — each compliant
                    tenant's own 12-month trend extrapolated to a
                    months-to-breach date, so a slow drift shows up
                    before the meter turns red. */}
                <Card>
                  <CardHeader className="pb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    <span className="text-sm font-medium">
                      Projected SLA breaches — next {PROJECTION_HORIZON} months
                    </span>
                    <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">
                      projected from 12-month trend
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {projections.length === 0 ? (
                      <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>
                          No compliant tenant in view is trending toward a breach inside{" "}
                          {PROJECTION_HORIZON} months — every current trajectory stays within
                          its plan-tier target.
                        </span>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          {projections.length} tenant{projections.length > 1 ? "s" : ""} still meet
                          every target today but are drifting toward one at their current trend.
                        </p>
                        {projections.map(({ row, key, months }) => {
                          const def = SLAS[key];
                          const target = def.planTargets[row.plan];
                          return (
                            <div
                              key={`${row.id}-${key}`}
                              className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
                            >
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground">
                                  {row.name}{" "}
                                  <span className="font-normal text-muted-foreground">
                                    ({PLAN_LABEL[row.plan]})
                                  </span>
                                </p>
                                <p className="text-muted-foreground">
                                  {def.label} {def.format(row.values[key])} → target{" "}
                                  {def.format(target)} — breaches in ~{months} month
                                  {months === 1 ? "" : "s"} at the current trend (
                                  {def.format(Math.abs(trendSlope(row, key)))}/month).
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 shrink-0"
                                onClick={() => navigate("tenant-detail", { id: row.id })}
                              >
                                Tenant
                                <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                              </Button>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Early-warning threshold (audit #4) — the operator picks
                    how close to a met target counts as "watch this"; the
                    near-miss list re-derives from that control. */}
                <Card>
                  <CardHeader className="pb-2 flex flex-wrap items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    <span className="text-sm font-medium">Early warning — inside the margin</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Warn when within</span>
                      <Select
                        value={String(warnSetting)}
                        onValueChange={(v) => setWarnSetting(Number(v))}
                      >
                        <SelectTrigger className="h-8 w-32" aria-label="Early-warning margin">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WARN_SETTINGS.map((label, i) => (
                            <SelectItem key={label} value={String(i)}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Every tenant below still meets every plan-tier target — the margin is how
                      much headroom counts as worth watching (
                      {SLA_ORDER.map((k) => `${WARN_MARGINS[k][warnSetting]} ${WARN_UNIT_SHORT[k]}`).join(" · ")}
                      ).
                    </p>
                    {earlyWarnings.length === 0 ? (
                      <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>
                          No tenant in view sits inside the {WARN_SETTINGS[warnSetting].toLowerCase()}{" "}
                          margin — everyone has headroom against their targets.
                        </span>
                      </div>
                    ) : (
                      earlyWarnings.map(({ row, misses }) => (
                        <div
                          key={row.id}
                          className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs"
                        >
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground">
                              {row.name}{" "}
                              <span className="font-normal text-muted-foreground">
                                ({PLAN_LABEL[row.plan]})
                              </span>
                            </p>
                            <p className="text-muted-foreground">
                              {misses
                                .map(
                                  (m) =>
                                    `${SLAS[m.key].label} ${SLAS[m.key].format(m.gap)} from target`,
                                )
                                .join(" · ")}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0"
                            onClick={() => navigate("tenant-detail", { id: row.id })}
                          >
                            Tenant
                            <ArrowRight className="ml-1 h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Root-cause patterns (audit #4) — which metric fails
                    most, which tier concentrates the failures, and
                    which metrics fail together (shared cause vs two
                    independent problems). */}
                <Card>
                  <CardHeader className="pb-2 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    <span className="text-sm font-medium">Root-cause patterns</span>
                    <Badge variant="outline" className="ml-auto text-[10px] text-muted-foreground">
                      {rootCause.atRisk} tenant{rootCause.atRisk === 1 ? "" : "s"} at risk
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {rootCause.totalMisses === 0 ? (
                      <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>
                          No misses in view to analyze — every tenant meets every target for its
                          plan tier.
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Miss frequency per metric — share of all misses. */}
                        <div className="space-y-2">
                          {SLA_ORDER.map((k) => {
                            const n = rootCause.missCounts[k];
                            const pct = Math.round((n / rootCause.totalMisses) * 100);
                            return (
                              <div key={k} className="flex items-center gap-3 text-xs">
                                <span className="w-32 shrink-0 text-muted-foreground">
                                  {SLAS[k].label}
                                </span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      n > 0 ? "bg-rose-500" : "bg-muted-foreground/30",
                                    )}
                                    style={{ width: `${n > 0 ? Math.max(4, pct) : 0}%` }}
                                  />
                                </div>
                                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                                  {n} · {pct}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <ul className="space-y-1.5 text-xs text-muted-foreground">
                          {rootCause.topKey && (
                            <li>
                              <span className="font-medium text-foreground">
                                {SLAS[rootCause.topKey].label}
                              </span>{" "}
                              accounts for{" "}
                              {Math.round(
                                (rootCause.missCounts[rootCause.topKey] / rootCause.totalMisses) *
                                  100,
                              )}
                              % of all {rootCause.totalMisses} misses — the single biggest driver
                              this period.
                            </li>
                          )}
                          {rootCause.worstTier && (
                            <li>
                              <span className="font-medium text-foreground">
                                {PLAN_LABEL[rootCause.worstTier.plan]}
                              </span>{" "}
                              tenants breach most often ({rootCause.worstTier.atRisk} of{" "}
                              {rootCause.worstTier.count} at risk, avg{" "}
                              {rootCause.worstTier.avg.toFixed(1)} SLAs each) — that tier&apos;s
                              stricter targets are where the portfolio is thinnest.
                            </li>
                          )}
                          {rootCause.pair && (
                            <li>
                              When{" "}
                              <span className="font-medium text-foreground">
                                {SLAS[rootCause.pair.a].label}
                              </span>{" "}
                              slips,{" "}
                              <span className="font-medium text-foreground">
                                {SLAS[rootCause.pair.b].label}
                              </span>{" "}
                              slips with it in {Math.round((rootCause.pair.both / rootCause.pair.ofA) * 100)}
                              % of cases ({rootCause.pair.both} of {rootCause.pair.ofA}) — a shared
                              root cause rather than two independent problems.
                            </li>
                          )}
                        </ul>
                      </>
                    )}
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Uptime — 12-month trend</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        target {SLAS.uptime.format(SLAS.uptime.planTargets.enterprise)} enterprise
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <AreaSeries
                        data={uptimeTrend}
                        xKey="date"
                        yKey="value"
                        color="#0f766e"
                        height={220}
                        formatValue={(v) => SLAS.uptime.format(v)}
                        label={`Portfolio uptime over 12 months, ending at ${SLAS.uptime.format(portfolioUptime)}; enterprise plan target ${SLAS.uptime.format(SLAS.uptime.planTargets.enterprise)}.`}
                      />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Portfolio {SLAS.uptime.format(portfolioUptime)} today · tier targets{" "}
                        {tiersInView
                          .map((t) => `${PLAN_LABEL[t]} ${SLAS.uptime.format(SLAS.uptime.planTargets[t])}`)
                          .join(" · ")}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">First response — 12-month trend</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        lower is better
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <AreaSeries
                        data={firstResponseTrend}
                        xKey="date"
                        yKey="value"
                        color="#0f766e"
                        height={220}
                        formatValue={(v) => SLAS.firstResponse.format(v)}
                        label={`Average support first response over 12 months, ending at ${SLAS.firstResponse.format(portfolioFirstResponse)}.`}
                      />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Portfolio {SLAS.firstResponse.format(portfolioFirstResponse)} today · tier targets{" "}
                        {tiersInView
                          .map(
                            (t) =>
                              `${PLAN_LABEL[t]} ${SLAS.firstResponse.format(SLAS.firstResponse.planTargets[t])}`,
                          )
                          .join(" · ")}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <span className="text-sm font-medium">Tenant SLA compliance</span>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      columns={columns}
                      data={filtered}
                      rowKey={(r) => r.id}
                      searchableText={(r) => `${r.name} ${r.plan}`}
                      searchPlaceholder="Search tenants…"
                      pageSize={10}
                      emptyTitle="No tenants found"
                      emptyDescription="Adjust the plan tier or status filter."
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    <span className="text-sm font-medium">Recommended actions</span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {atRisk.length === 0 ? (
                      <div className="flex items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>
                          All {filtered.length} tenants in view meet every SLA target for their plan
                          tier. Keep the current posture and re-check after the next incident review.
                        </span>
                      </div>
                    ) : (
                      atRisk.map((r) => {
                        const miss = worstMiss(r);
                        if (!miss) return null;
                        return (
                          <div
                            key={r.id}
                            className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
                          >
                            <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                            <span>
                              {ADVICE[miss.key](
                                r.name,
                                SLAS[miss.key].format(r.values[miss.key]),
                                SLAS[miss.key].format(SLAS[miss.key].planTargets[r.plan]),
                              )}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      SLA values are deterministic fixtures derived from tenant IDs — replace the
                      derivation in this file with the telemetry feed when the backend exposes it.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
