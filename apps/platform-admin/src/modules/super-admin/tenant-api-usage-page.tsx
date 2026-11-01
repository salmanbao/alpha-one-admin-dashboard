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
  CheckCircle2,
  Gauge,
  Key,
  Save,
  Server,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Deterministic per-tenant API usage                                  */
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

const PLAN_API_CAP: Record<TenantApiRow["plan"], number> = {
  starter: 100_000,
  growth: 1_000_000,
  scale: 5_000_000,
  enterprise: 10_000_000,
};

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
/* Anomalies (deterministic heuristics)                                */
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
  const { data: hydrated, loading, error, retry } = useAsyncMock(
    () => mockAsync(() => true, { delayMs: 400 }),
    [],
  );
  const { navigate } = usePlatform();

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
        return { row, limit, usagePct, wow, anomalies: anomaliesFor(row, limit) };
      }),
    [limits],
  );

  const totalCalls = TENANT_API.reduce((s, r) => s + r.callsPerDay, 0);
  const atRisk = rows.filter((r) => r.usagePct >= 80).length;
  const total429 = TENANT_API.reduce((s, r) => s + r.rateLimited429, 0);
  const avgError =
    TENANT_API.reduce((s, r) => s + r.errorRatePct * r.callsPerDay, 0) / Math.max(1, totalCalls);

  const applyLimits = () => {
    const changed = TENANT_API.filter((r) => (limits[r.tenantId] ?? null) !== r.customLimit);
    toast({
      title: "API limits saved",
      description:
        changed.length === 0
          ? "No changes — limits unchanged."
          : `${changed.length} tenant limit${changed.length === 1 ? "" : "s"} updated. New limits take effect within 60 seconds.`,
    });
    // Sync the applied baseline so the dirty state clears.
    TENANT_API.forEach((r) => {
      r.customLimit = limits[r.tenantId] ?? null;
    });
  };

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "tenant",
      header: "Tenant",
      cell: (r) => (
        <button
          type="button"
          className="font-medium text-foreground underline-offset-2 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate("tenant-detail", { id: r.row.tenantId });
          }}
        >
          {r.row.name}
        </button>
      ),
      sortValue: (r) => r.row.name,
    },
    {
      key: "calls",
      header: "Calls/day",
      cell: (r) => (
        <span className="tabular-nums">{r.row.callsPerDay.toLocaleString("en-US")}</span>
      ),
      sortValue: (r) => r.row.callsPerDay,
      numeric: true,
    },
    {
      key: "trend",
      header: "7-day trend",
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <Sparkline series={r.row.series} danger={r.wow >= 25} />
          <span
            className={`text-[11px] font-bold tabular-nums ${
              r.wow >= 25 ? "text-destructive" : r.wow >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
            }`}
          >
            {r.wow >= 0 ? "▲" : "▼"} {Math.abs(Math.round(r.wow))}%
          </span>
        </span>
      ),
      sortValue: (r) => r.wow,
    },
    {
      key: "limit",
      header: "Rate-limit usage",
      cell: (r) => (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-bold tabular-nums">
              {Math.round(r.usagePct)}% of {compact(r.limit)}
            </span>
            <span className="text-muted-foreground">{compact(r.row.callsPerDay)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                r.usagePct >= 100 ? "bg-destructive" : r.usagePct >= 80 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, r.usagePct)}%` }}
            />
          </div>
        </div>
      ),
      sortValue: (r) => r.usagePct,
    },
    {
      key: "custom-limit",
      header: "Custom limit",
      cell: (r) => (
        <input
          type="number"
          min={1000}
          step={1000}
          aria-label={`Custom API limit for ${r.row.name} (calls/day)`}
          value={limits[r.row.tenantId] ?? ""}
          placeholder={`Plan ${compact(PLAN_API_CAP[r.row.plan])}`}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value === "" ? null : Math.max(1000, Number(e.target.value));
            setLimits((prev) => ({ ...prev, [r.row.tenantId]: v }));
          }}
          className="w-28 rounded-md border border-input bg-background px-2 py-1 text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      ),
      sortValue: (r) => limits[r.row.tenantId] ?? PLAN_API_CAP[r.row.plan],
    },
    {
      key: "errors",
      header: "Error rate",
      cell: (r) => (
        <span
          className={`text-xs font-bold tabular-nums ${
            r.row.errorRatePct >= 1 ? "text-destructive" : "text-foreground"
          }`}
        >
          {r.row.errorRatePct.toFixed(2)}%
          {r.row.rateLimited429 > 0 && (
            <span className="ml-1 font-normal text-muted-foreground">
              · {r.row.rateLimited429.toLocaleString("en-US")}×429
            </span>
          )}
        </span>
      ),
      sortValue: (r) => r.row.errorRatePct,
    },
    {
      key: "latency",
      header: "Avg latency",
      cell: (r) => <span className="text-xs tabular-nums">{r.row.avgLatencyMs} ms</span>,
      sortValue: (r) => r.row.avgLatencyMs,
      numeric: true,
    },
    {
      key: "anomalies",
      header: "Anomalies",
      cell: (r) =>
        r.anomalies.length === 0 ? (
          <Badge variant="outline">None</Badge>
        ) : (
          <span className="flex flex-wrap gap-1">
            {r.anomalies.map((a) => (
              <Badge key={a.key} variant={a.tone}>
                {a.label}
              </Badge>
            ))}
          </span>
        ),
      sortValue: (r) => r.anomalies.length,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <Button
          size="sm"
          variant="ghost"
          title="Open the full tenant profile"
          onClick={(e) => {
            e.stopPropagation();
            navigate("tenant-detail", { id: r.row.tenantId });
          }}
        >
          Open tenant <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  const activeAnomalies = rows.flatMap((r) =>
    r.anomalies
      .filter((a) => a.key === "over" || a.key === "risk" || a.key === "err" || a.key === "spike")
      .map((a) => ({ tenant: r.row.name, ...a })),
  );

  return (
    <Page>
      <PageHeader
        title="Tenant API Usage"
        description="Per-tenant API call patterns, rate-limit consumption, and anomaly flags — the abuse-and-overuse view behind the global API analytics."
        icon={Server}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate("api-analytics")}>
              Global API analytics <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={applyLimits}>
              <Save className="mr-1 h-3.5 w-3.5" /> Save limits
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading tenant API usage…"
        >
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="API calls today (all tenants)"
              value={totalCalls.toLocaleString("en-US")}
              icon={Activity}
              deltaLabel="across tracked tenants"
            />
            <MetricCard
              label="Tenants ≥80% of limit"
              value={atRisk}
              icon={Gauge}
              tone={atRisk > 0 ? "warning" : "positive"}
              deltaLabel="rate-limit risk zone"
            />
            <MetricCard
              label="Weighted error rate"
              value={`${avgError.toFixed(2)}%`}
              icon={AlertTriangle}
              tone={avgError >= 1 ? "negative" : "positive"}
              deltaLabel="weighted by call volume"
            />
            <MetricCard
              label="429s served today"
              value={total429.toLocaleString("en-US")}
              icon={Zap}
              tone={total429 > 0 ? "warning" : "positive"}
              deltaLabel="requests throttled at the edge"
            />
          </div>

          {/* Threshold alerts */}
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Threshold alerts</p>
                <Badge variant={activeAnomalies.length > 0 ? "destructive" : "secondary"} className="ml-auto">
                  {activeAnomalies.length} active
                </Badge>
              </div>
              {activeAnomalies.length === 0 ? (
                <EmptyState
                  title="No active alerts"
                  description="No tenant is near a rate limit or showing anomaly patterns."
                  icon={CheckCircle2}
                />
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {activeAnomalies.map((a, i) => (
                    <li
                      key={`${a.tenant}-${a.key}-${i}`}
                      className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <Badge variant={a.tone === "destructive" ? "destructive" : "secondary"}>{a.label}</Badge>
                        <span className="text-muted-foreground">{a.tenant}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => navigate("usage-metering")}
                      >
                        Usage & overage <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">
                Heuristics: error rate ≥1% · limit usage ≥80% · week-over-week growth ≥25%.
                Custom limits are enforced at the API gateway within 60 seconds of saving.
              </p>
            </CardContent>
          </Card>

          {/* Per-tenant table with inline custom limits */}
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(r) => r.row.tenantId}
            searchableText={(r) => `${r.row.name} ${r.row.plan}`}
            searchPlaceholder="Search tenants…"
            onRowClick={(r) => navigate("tenant-detail", { id: r.row.tenantId })}
            emptyTitle="No tenants match"
            emptyDescription="Clear the search to see all tracked tenants."
          />

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Key className="h-3 w-3" />
            Calls/day matches the Tenant Usage &amp; Overage screen exactly. Click a tenant to
            open its detail view for API keys and entitlement context.
          </p>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
