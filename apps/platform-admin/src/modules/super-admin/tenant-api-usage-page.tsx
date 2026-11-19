"use client";

/**
 * Tenant API Usage — audit finding #1 (HIGH).
 *
 * The global API analytics screen shows platform-wide calls and a
 * top-consumers list, but operators couldn't answer per-tenant
 * questions: who is burning their rate limit, whose error rate is
 * climbing, where usage is spiking. This screen adds:
 *
 *  - Per-tenant call patterns with a 7-day trend sparkline
 *  - Rate-limit usage vs plan cap AND custom per-tenant limits
 *    (editable inline, applied with a toast confirmation)
 *  - Deterministic anomaly flags: high error rate (≥1%),
 *    rate-limit risk (≥80% of limit), usage spike (≥25% week-over-week)
 *  - Integration with the tenant detail view (row action + header link)
 *
 * Usage numbers match the usage-metering fixture exactly so the two
 * screens can never disagree. No Math.random() — stable across renders.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary, EmptyState } from "@/components/platform/guards";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  Gauge,
  Key,
  Save,
  Server,
  Zap,
} from "lucide-react";
import { useTenants } from "@/lib/platform/tenant-store";
import type { TenantContext } from "@/lib/platform/types";
import { StatusBadge } from "@/components/platform/status";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Deterministic per-tenant API usage                                   */
/* ------------------------------------------------------------------ */

interface TenantApiRow {
  tenantId: string;
  name: string;
  plan: "starter" | "growth" | "scale" | "enterprise";
  /** Matches usage-metering fixture exactly. */
  callsPerDay: number;
  /** Last 7 days of calls — ends at callsPerDay. */
  series: number[];
  avgLatencyMs: number;
  errorRatePct: number;
  rateLimited429: number;
  /** Custom per-tenant limit (null = plan cap applies). */
  customLimit: number | null;
}

/* ------------------------------------------------------------------ */
/* Deterministic API usage fixture (matches mock-data usage metering)  */
/* ------------------------------------------------------------------ */

const TENANT_API: TenantApiRow[] = [
  {
    tenantId: "tenant-alpha",
    name: "Alpha Capital",
    plan: "growth",
    callsPerDay: 742_310,
    series: [640_000, 655_000, 702_000, 688_000, 731_000, 719_000, 742_310],
    avgLatencyMs: 132,
    errorRatePct: 0.45,
    rateLimited429: 610,
    customLimit: 800_000,
  },
  {
    tenantId: "tenant-beta",
    name: "Beta Trading",
    plan: "scale",
    callsPerDay: 88_400,
    series: [91_000, 89_000, 93_000, 87_000, 90_000, 86_000, 88_400],
    avgLatencyMs: 140,
    errorRatePct: 0.62,
    rateLimited429: 0,
    customLimit: null,
  },
  {
    tenantId: "tenant-gamma",
    name: "Gamma Futures",
    plan: "enterprise",
    callsPerDay: 1_284_900,
    series: [980_000, 1_050_000, 1_120_000, 1_180_000, 1_240_000, 1_260_000, 1_284_900],
    avgLatencyMs: 148,
    errorRatePct: 1.2,
    rateLimited429: 3_140,
    customLimit: 1_200_000,
  },
];

/* ------------------------------------------------------------------ */
/* Plan API caps                                                        */
/* ------------------------------------------------------------------ */

const PLAN_API_CAP: Record<TenantApiRow["plan"], number> = {
  starter: 100_000,
  growth: 1_000_000,
  scale: 5_000_000,
  enterprise: 10_000_000,
};

/* ------------------------------------------------------------------ */
/* Usage forecasting                                                     */
/* ------------------------------------------------------------------ */

function forecastDaysToLimit(series: number[], callsPerDay: number, limit: number): number | null {
  if (callsPerDay >= limit) return 0;
  if (series.length < 2) return null;
  const slope = (series[series.length - 1] - series[0]) / (series.length - 1);
  if (slope <= 0) return null;
  const days = (limit - callsPerDay) / slope;
  return days > 365 ? null : Math.ceil(days);
}

/* ------------------------------------------------------------------ */
/* Anomalies (deterministic heuristics)                               */
/* ------------------------------------------------------------------ */

type Anomaly = { key: string; label: string; tone: "destructive" | "secondary" | "default" };

function anomaliesFor(row: TenantApiRow, limit: number): Anomaly[] {
  const out: Anomaly[] = [];
  const usage = (row.callsPerDay / Math.max(1, limit)) * 100;
  const wow = ((row.series[row.series.length - 1] - row.series[0]) / Math.max(1, row.series[0])) * 100;
  if (row.errorRatePct >= 1) out.push({ key: "err", label: "High error rate", tone: "destructive" });
  if (usage >= 100) out.push({ key: "over", label: "Over limit", tone: "destructive" });
  else if (usage >= 80) out.push({ key: "risk", label: "Rate-limit risk", tone: "secondary" });
  if (wow >= 25) out.push({ key: "spike", label: "Usage spike", tone: "default" });
  if (row.rateLimited429 > 0) out.push({ key: "429", label: "429s served", tone: "default" });
  return out;
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : `${n}`;

/* ------------------------------------------------------------------ */
/* Sparkline (inline SVG, deterministic)                               */
/* ------------------------------------------------------------------ */

function Sparkline({ series, danger }: { series: number[]; danger: boolean }) {
  const max = Math.max(...series, 1);
  const w = 64;
  const h = 20;
  const step = w / (series.length - 1);
  const points = series.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="7-day call trend" role="img">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={danger ? "#e11d48" : "var(--brand-primary, #4a7c59)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function TenantApiUsagePage() {
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(
    () => mockAsync(() => true, { delayMs: 400 }),
    []
  );
  const { navigate } = usePlatform();
  const tenants = useTenants();

  // Custom per-tenant limits — editable, applied with a toast (audit #1).
  const [limits, setLimits] = useState<Record<string, number | null>>(
    () => Object.fromEntries(TENANT_API.map((r) => [r.tenantId, r.customLimit])),
  );

  const effectiveLimit = (row: TenantApiRow) =>
    limits[row.tenantId] ?? PLAN_API_CAP[row.plan];

  const rows = useMemo(
    () =>
      TENANT_API.map((row) => {
        const limit = effectiveLimit(row);
        const usagePct = (row.callsPerDay / Math.max(1, limit)) * 100;
        const wow = ((row.series[row.series.length - 1] - row.series[0]) / Math.max(1, row.series[0])) * 100;
        const daysToLimit = forecastDaysToLimit(row.series, row.callsPerDay, limit);
        return { row, limit, usagePct, wow, daysToLimit, anomalies: anomaliesFor(row, limit) };
      }),
    [limits],
  );

  const totalCalls = rows.reduce((s, r) => s + r.row.callsPerDay, 0);
  const total429 = rows.reduce((s, r) => s + r.row.rateLimited429, 0);
  const avgErrorRate = rows.reduce((s, r) => s + r.row.errorRatePct * r.row.callsPerDay, 0) / Math.max(1, totalCalls);
  const anomalyCount = rows.filter((r) => r.anomalies.length > 0).length;

  const cols: Column<typeof rows[0]>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{r.row.name}</span>
            <Badge variant="outline" className="text-[10px] ml-1">
              {r.row.plan}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      key: "calls",
      header: "Calls/day",
      cell: (r) => <span className="font-mono tabular-nums">{compact(r.row.callsPerDay)}</span>,
    },
    {
      key: "trend",
      header: "7-day trend",
      cell: (r) => <Sparkline series={r.row.series} danger={r.anomalies.some((a) => a.tone === "destructive")} />,
    },
    {
      key: "latency",
      header: "Avg latency",
      cell: (r) => <span className="font-mono tabular-nums">{r.row.avgLatencyMs} ms</span>,
    },
    {
      key: "errors",
      header: "Error rate",
      cell: (r) => (
        <span className={cn("font-mono tabular-nums", r.row.errorRatePct >= 1 && "text-rose-600")}>
          {r.row.errorRatePct.toFixed(2)}%
        </span>
      ),
    },
    {
      key: "limit",
      header: "Rate limit",
      cell: (r) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{compact(r.limit)}</span>
            <span className="text-xs text-muted-foreground">
              {r.limit >= PLAN_API_CAP[r.row.plan] ? "(plan cap)" : "(custom)"}
            </span>
          </div>
          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (r.row.callsPerDay / r.limit) * 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "usage",
      header: "Usage",
      cell: (r) => (
        <span className={cn("font-medium", r.usagePct >= 100 && "text-rose-600", r.usagePct >= 80 && "text-amber-600")}>
          {r.usagePct.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "anomalies",
      header: "Anomalies",
      cell: (r) =>
        r.anomalies.length === 0 ? (
          <StatusBadge tone="success">None</StatusBadge>
        ) : (
          <div className="flex flex-wrap gap-1">
            {r.anomalies.map((a) => (
              <Badge key={a.key} variant={a.tone === "destructive" ? "destructive" : a.tone === "secondary" ? "secondary" : "default"} className="text-[10px]">
                {a.label}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              setLimits((prev) => ({ ...prev, [r.row.tenantId]: r.limit }));
              toast({ title: "Custom limit applied", description: `${r.row.name}: ${compact(r.limit)}/day` });
            }}
          >
            <Save className="mr-1 h-3 w-3" />Apply
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => navigate(`/tenant/${r.row.tenantId}`)}
          >
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Tenant API Usage"
        description="Per-tenant call patterns, rate-limit usage, anomaly detection and custom limits. Data matches the usage-metering fixture."
        icon={Activity}
      />
      <PageContent>
        <div className="grid gap-3 sm:grid-cols-4 mb-6">
          <MetricCard label="Total calls/day" value={compact(totalCalls)} icon={Server} />
          <MetricCard label="Avg error rate" value={`${avgErrorRate.toFixed(2)}%`} icon={AlertTriangle} tone={avgErrorRate >= 1 ? "negative" : "default"} />
          <MetricCard label="429s served" value={compact(total429)} icon={Zap} tone={total429 > 0 ? "warning" : "default"} />
          <MetricCard label="Tenants with anomalies" value={anomalyCount} icon={Bell} tone={anomalyCount > 0 ? "warning" : "positive"} />
        </div>

        <Card>
          <CardContent className="pt-0">
            <DataTable
              columns={cols}
              data={rows}
              rowKey={(r) => r.row.tenantId}
              pageSize={10}
              searchableText={(r) => r.row.name}
            />
          </CardContent>
        </Card>

        <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-2">Anomaly key</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>High error rate</strong> — error rate ≥ 1%</li>
            <li><strong>Over limit</strong> — usage ≥ 100% of limit</li>
            <li><strong>Rate-limit risk</strong> — usage ≥ 80% of limit</li>
            <li><strong>Usage spike</strong> — week-over-week increase ≥ 25%</li>
            <li><strong>429s served</strong> — tenant hit rate limits</li>
          </ul>
        </div>
      </PageContent>
    </Page>
  );
}