"use client";

/**
 * AI Anomaly Detection
 *
 * Surfaces unusual trading patterns detected by the AI model:
 *  - 24h anomaly trend (AreaSeries)
 *  - Type distribution (DonutSeries)
 *  - Recent anomalies (DataTable — Investigate / Mark FP / Create ticket)
 *  - Hour × Day heatmap (custom grid)
 *  - Top affected accounts (DataTable)
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
import { hashStr, getTenantAccounts, getTenantTraders } from "@/lib/platform/mock-data";
import type { TradingAccount, Trader } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge } from "@/components/platform/status";
import { AreaSeries, DonutSeries } from "@/components/platform/charts";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { exportToCsv } from "@/lib/platform/export-utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Activity,
  Download,
  Ticket,
  Search,
  EyeOff,
} from "lucide-react";

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

const ANOMALY_TYPES = [
  { key: "trade-size", label: "Unusual Trade Size", color: TERRA.amber },
  { key: "off-hours", label: "Off-Hours Trading", color: TERRA.sky },
  { key: "pattern-break", label: "Pattern Break", color: TERRA.rose },
  { key: "volume-spike", label: "Volume Spike", color: TERRA.teal },
  { key: "spread", label: "Spread Anomaly", color: TERRA.emerald },
  { key: "latency", label: "Latency", color: TERRA.slate },
] as const;

type AnomalyType = (typeof ANOMALY_TYPES)[number]["key"];

const SEVERITY_TONE: Record<string, "default" | "success" | "warning" | "danger" | "info" | "muted"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "muted",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

interface AnomalyRow {
  id: string;
  detected: string;
  typeLabel: string;
  typeColor: string;
  traderId: string;
  traderName: string;
  accountId: string;
  accountLogin: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number; // 0–100
  description: string;
}

interface AffectedAccountRow {
  accountId: string;
  login: string;
  traderId: string;
  traderName: string;
  anomaliesCount: number;
  lastAnomaly: string;
  riskTier: "Critical" | "High" | "Medium" | "Low";
}

function pickType(seed: number): AnomalyType {
  return ANOMALY_TYPES[seed % ANOMALY_TYPES.length].key;
}

function pickSeverity(seed: number): AnomalyRow["severity"] {
  const r = seed % 100;
  if (r < 12) return "critical";
  if (r < 35) return "high";
  if (r < 70) return "medium";
  return "low";
}

function anomalyDescription(type: AnomalyType, trader: string): string {
  const map: Record<AnomalyType, string> = {
    "trade-size": `${trader} placed a trade 4.2× larger than their 30d average`,
    "off-hours": `${trader} traded outside their normal session window (3 AM UTC)`,
    "pattern-break": `${trader}'s typical symbol rotation broke unexpectedly`,
    "volume-spike": `${trader} hit 5.1× normal traded volume in a single hour`,
    spread: `Spread compression detected on ${trader}'s EURUSD position`,
    latency: `Order acknowledgement latency exceeded 850ms for ${trader}`,
  };
  return map[type];
}

/* ------------------------------------------------------------------ */
/* Mock data generators                                                */
/* ------------------------------------------------------------------ */

function buildRecentAnomalies(
  accounts: TradingAccount[],
  traders: Trader[],
  tid: string,
): AnomalyRow[] {
  if (!accounts.length || !traders.length) return [];
  const traderById = new Map(traders.map((t) => [t.id, t]));
  const out: AnomalyRow[] = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const seed = hashStr(tid + "anomaly" + i);
    const acct = accounts[seed % accounts.length];
    const trader = traderById.get(acct.traderId) ?? traders[seed % traders.length];
    const type = pickType(seed);
    const typeMeta = ANOMALY_TYPES.find((t) => t.key === type)!;
    const severity = pickSeverity(seed);
    // Detected between 25h and 5min ago
    const detectedMin = (i * 95) + (seed % 30);
    const detected = new Date(Date.now() - detectedMin * 60 * 1000).toISOString();
    out.push({
      id: `anom-${tid}-${i}`,
      detected,
      typeLabel: typeMeta.label,
      typeColor: typeMeta.color,
      traderId: trader.id,
      traderName: trader.name,
      accountId: acct.id,
      accountLogin: acct.login,
      severity,
      confidence: Math.max(58, Math.min(99, 70 + (seed % 30))),
      description: anomalyDescription(type, trader.name),
    });
  }
  return out.sort((a, b) => new Date(b.detected).getTime() - new Date(a.detected).getTime());
}

function buildTypeDistribution(anomalies: AnomalyRow[]) {
  return ANOMALY_TYPES.map((t) => ({
    label: t.label,
    value: anomalies.filter((a) => a.typeLabel === t.label).length,
    color: t.color,
  })).filter((d) => d.value > 0);
}

function buildHourlyTrend(tid: string) {
  // 24h anomaly count per hour — deterministic sin pattern with peak hours.
  const seed = hashStr(tid + "hourly");
  return Array.from({ length: 24 }, (_, h) => {
    const baseline = 3 + Math.sin((h + (seed % 6)) / 3) * 2;
    const peak = h >= 9 && h <= 11 ? 2 : h >= 14 && h <= 16 ? 1.5 : 0;
    const noise = (seed >> h) & 0x3; // 0–3 deterministic
    return {
      hour: `${h.toString().padStart(2, "0")}h`,
      count: Math.max(0, Math.round(baseline + peak + noise * 0.5)),
    };
  });
}

function buildHeatmap(tid: string): number[][] {
  // 7 days × 24 hours. Deterministic seeded counts 0–12.
  const out: number[][] = [];
  for (let d = 0; d < 7; d++) {
    const row: number[] = [];
    for (let h = 0; h < 24; h++) {
      const seed = hashStr(tid + "hm" + d + h);
      const peak =
        (d < 5 && h >= 9 && h <= 16) ? 4 :
        (d >= 5 && h >= 22) || (d >= 5 && h <= 2) ? 3 :
        0;
      const base = (seed % 4);
      row.push(Math.min(12, Math.max(0, base + peak)));
    }
    out.push(row);
  }
  return out;
}

function buildAffectedAccounts(
  accounts: TradingAccount[],
  traders: Trader[],
  anomalies: AnomalyRow[],
): AffectedAccountRow[] {
  if (!accounts.length || !traders.length) return [];
  const traderById = new Map(traders.map((t) => [t.id, t]));
  const counts = new Map<string, number>();
  const lastByAccount = new Map<string, number>();
  for (const a of anomalies) {
    counts.set(a.accountId, (counts.get(a.accountId) ?? 0) + 1);
    const t = new Date(a.detected).getTime();
    if (!lastByAccount.has(a.accountId) || t > lastByAccount.get(a.accountId)!) {
      lastByAccount.set(a.accountId, t);
    }
  }
  return accounts
    .map((acct) => {
      const trader = traderById.get(acct.traderId);
      const count = counts.get(acct.id) ?? 0;
      const last = lastByAccount.get(acct.id);
      const riskTier: AffectedAccountRow["riskTier"] =
        count >= 5 ? "Critical" : count >= 3 ? "High" : count >= 1 ? "Medium" : "Low";
      return {
        accountId: acct.id,
        login: acct.login,
        traderId: acct.traderId,
        traderName: trader?.name ?? acct.traderName,
        anomaliesCount: count,
        lastAnomaly: last ? new Date(last).toISOString() : "",
        riskTier,
      };
    })
    .filter((r) => r.anomaliesCount > 0)
    .sort((a, b) => b.anomaliesCount - a.anomaliesCount)
    .slice(0, 8);
}

function riskTierTone(tier: AffectedAccountRow["riskTier"]): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (tier) {
    case "Critical": return "danger";
    case "High": return "warning";
    case "Medium": return "info";
    default: return "muted";
  }
}

function relativeTime(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / (1000 * 60));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/* Heatmap cell color                                                  */
/* ------------------------------------------------------------------ */

function heatmapColor(v: number): string {
  if (v === 0) return "var(--muted)";
  if (v <= 2) return TERRA.emerald;
  if (v <= 5) return TERRA.amber;
  if (v <= 8) return TERRA.rose;
  return TERRA.slate;
}

function heatmapOpacity(v: number): number {
  if (v === 0) return 0.15;
  if (v <= 2) return 0.25 + v * 0.1;
  if (v <= 5) return 0.4 + (v - 2) * 0.12;
  if (v <= 8) return 0.55 + (v - 5) * 0.1;
  return 0.85;
}

/* ------------------------------------------------------------------ */
/* Explainable metric card — mirrors `MetricCard` but supports a help  */
/* tooltip inline next to the label per UX Constitution §33.          */
/* ------------------------------------------------------------------ */

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
    tone === "positive" ? "#059669"
    : tone === "negative" ? "#e11d48"
    : tone === "warning" ? "#d97706"
    : "var(--brand-primary)";
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

export function AiAnomalyPage() {
  const { runtime, tenant, navigate } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";

  const accounts = useMemo(() => getTenantAccounts(tid), [tid]);
  const traders = useMemo(() => getTenantTraders(tid), [tid]);

  const anomalies = useMemo(
    () => buildRecentAnomalies(accounts, traders, tid),
    [accounts, traders, tid],
  );
  const typeDist = useMemo(() => buildTypeDistribution(anomalies), [anomalies]);
  const hourly = useMemo(() => buildHourlyTrend(tid), [tid]);
  const heatmap = useMemo(() => buildHeatmap(tid), [tid]);
  const affected = useMemo(
    () => buildAffectedAccounts(accounts, traders, anomalies),
    [accounts, traders, anomalies],
  );

  // ---- KPI computations (deterministic) ---------------------------------
  const anomalies24h = anomalies.length;
  const confirmed = Math.floor(anomalies.length * 0.65);
  const falsePositiveRate = 8 + (hashStr(tid + "fp") % 6); // 8–13%
  const avgDetectionMin = 3 + (hashStr(tid + "detection") % 4); // 3–6 min

  // ---- CSV export -------------------------------------------------------
  const handleExport = () =>
    exportToCsv(
      anomalies,
      [
        { key: "id", header: "Anomaly ID", value: (r) => r.id },
        { key: "detected", header: "Detected", value: (r) => r.detected },
        { key: "type", header: "Type", value: (r) => r.typeLabel },
        { key: "trader", header: term("trader"), value: (r) => r.traderName },
        { key: "account", header: "Account", value: (r) => r.accountLogin },
        { key: "severity", header: "Severity", value: (r) => r.severity },
        { key: "confidence", header: "Confidence %", value: (r) => r.confidence },
        { key: "description", header: "Description", value: (r) => r.description },
      ],
      `ai-anomalies-${tid}.csv`,
    );

  return (
    <Page>
      <PageHeader
        title="Anomaly Detection"
        description={`Detect unusual trading patterns across ${plural(term("trader")).toLowerCase()} and accounts on this tenant.`}
        icon={AlertTriangle}
        term={`Last 24 hours · ${anomalies24h} detected · ${confirmed} confirmed`}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ExplainableMetricCard
            label="Anomalies Detected (24h)"
            value={anomalies24h}
            icon={AlertTriangle}
            tone="warning"
            deltaLabel={`across ${accounts.length} accounts`}
            help={
              <p>
                Total anomalies flagged by the model in the last 24 hours. Includes both
                confirmed true-positives and false-positives (see rate below).
              </p>
            }
          />
          <ExplainableMetricCard
            label="Anomalies Confirmed"
            value={confirmed}
            icon={CheckCircle2}
            tone="positive"
            deltaLabel="confirmed by human review"
          />
          <ExplainableMetricCard
            label="False Positive Rate"
            value={`${falsePositiveRate}%`}
            icon={EyeOff}
            tone={falsePositiveRate <= 10 ? "positive" : "warning"}
            deltaLabel="target: ≤ 10%"
            help={
              <p>
                Percentage of flagged anomalies that turned out to be benign after human review.
                Lower is better. Target: &lt; 10%.
              </p>
            }
          />
          <ExplainableMetricCard
            label="Avg Detection Time"
            value={`${avgDetectionMin}m`}
            icon={Clock}
            deltaLabel="from event → model alert"
          />
        </div>

        {/* Charts row: trend + type distribution */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Anomaly Trend (24h)"
            subtitle="Detections per hour — daily seasonality visible"
            help={
              <p>
                Bars show total anomalies detected per hour over the last 24 hours. Peak hours
                (09–16 UTC) typically carry higher volume-driven detections.
              </p>
            }
          >
            <AreaSeries
              data={hourly}
              xKey="hour"
              yKey="count"
              color={TERRA.amber}
              height={220}
              formatValue={(v) => `${v} anomalies`}
            />
          </ChartCard>
          <ChartCard
            title="Anomaly Type Distribution"
            subtitle="Slice by detection category — 24h"
            help={
              <p>
                Each slice represents one of six anomaly categories. Hover for absolute counts. Use
                this to spot systemic issues (e.g. a latency spike from one broker bridge).
              </p>
            }
          >
            {typeDist.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                No anomalies in last 24h
              </div>
            ) : (
              <DonutSeries data={typeDist} height={220} formatValue={(v) => `${v}`} />
            )}
          </ChartCard>
        </div>

        {/* Section 3: Recent Anomalies */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                <LabelWithHelp
                  help={
                    <p>
                      Live feed of the latest flagged anomalies. Severity drives the escalation path:
                      Critical → Slack alert + ticket; High → ticket; Medium → queue; Low → log only.
                    </p>
                  }
                >
                  Recent Anomalies
                </LabelWithHelp>
              </p>
              <p className="text-xs text-muted-foreground">Investigate, mark as false positive, or create a support ticket</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["critical", "high", "medium", "low"] as const).map((s) => (
                <StatusBadge key={s} tone={SEVERITY_TONE[s]}>{anomalies.filter((a) => a.severity === s).length} {s}</StatusBadge>
              ))}
            </div>
          </div>
          <DataTable
            data={anomalies}
            rowKey={(r) => r.id}
            pageSize={6}
            searchableText={(r) => `${r.traderName} ${r.typeLabel} ${r.accountLogin} ${r.description}`}
            searchPlaceholder="Search trader / type / account…"
            emptyTitle="No anomalies detected"
            emptyDescription="No anomalies have been flagged in the last 24 hours for this tenant."
            columns={[
              {
                key: "detected",
                header: "Detected",
                cell: (r) => <span className="text-xs text-muted-foreground tabular-nums">{relativeTime(r.detected)}</span>,
                sortValue: (r) => new Date(r.detected).getTime(),
              },
              {
                key: "type",
                header: "Type",
                cell: (r) => (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ background: r.typeColor }} />
                    <span className="text-sm font-medium text-foreground">{r.typeLabel}</span>
                  </div>
                ),
              },
              {
                key: "trader",
                header: term("trader"),
                cell: (r) => <span className="text-sm font-medium text-foreground">{r.traderName}</span>,
                sortValue: (r) => r.traderName,
              },
              {
                key: "account",
                header: "Account",
                cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.accountLogin}</span>,
              },
              {
                key: "severity",
                header: "Severity",
                cell: (r) => <StatusBadge tone={SEVERITY_TONE[r.severity]}>{r.severity}</StatusBadge>,
                sortValue: (r) => r.severity,
              },
              {
                key: "confidence",
                header: "Confidence",
                numeric: true,
                cell: (r) => (
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular-nums text-xs font-medium text-foreground">{r.confidence}%</span>
                    <div className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.confidence}%`,
                          background:
                            r.confidence >= 90 ? TERRA.emerald :
                            r.confidence >= 75 ? TERRA.amber :
                            TERRA.slate,
                        }}
                      />
                    </div>
                  </div>
                ),
                sortValue: (r) => r.confidence,
              },
              {
                key: "description",
                header: "Description",
                cell: (r) => <span className="text-xs text-muted-foreground">{r.description}</span>,
              },
              {
                key: "actions",
                header: "Actions",
                width: "240px",
                cell: (r) => (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("trader-detail", { id: r.traderId });
                      }}
                    >
                      <Search className="mr-1 h-3 w-3" />
                      Investigate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast({
                          title: "Marked as false positive",
                          description: `${r.typeLabel} on ${r.traderName} (${r.accountLogin})`,
                        });
                      }}
                    >
                      <EyeOff className="mr-1 h-3 w-3" />
                      False positive
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast({
                          title: "Support ticket created",
                          description: `Ticket T-${hashStr(r.id) % 9000 + 1000} for ${r.typeLabel} on ${r.traderName}`,
                        });
                      }}
                    >
                      <Ticket className="mr-1 h-3 w-3" />
                      Create ticket
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Section 4: Heatmap */}
        <ChartCard
          title="Anomaly Heatmap — Hour × Day"
          subtitle="Color intensity = anomaly count. Useful for spotting systemic time-of-day patterns."
          help={
            <p>
              Each cell shows the deterministic anomaly count for that (day-of-week, hour) bucket.
              Darker rose cells indicate hotspots. Use this to schedule reviews or staffing during
              peak windows.
            </p>
          }
        >
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Hour header */}
              <div className="grid grid-cols-[44px_repeat(24,1fr)] gap-0.5">
                <div />
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="text-center text-[10px] text-muted-foreground tabular-nums">
                    {h.toString().padStart(2, "0")}
                  </div>
                ))}
              </div>
              {/* Day rows */}
              {heatmap.map((row, d) => (
                <div key={d} className="grid grid-cols-[44px_repeat(24,1fr)] gap-0.5">
                  <div className="flex items-center justify-end pr-1 text-[10px] text-muted-foreground">
                    {DAYS[d]}
                  </div>
                  {row.map((v, h) => (
                    <div
                      key={h}
                      title={`${DAYS[d]} ${h.toString().padStart(2, "0")}:00 — ${v} anomalies`}
                      className="aspect-square rounded-sm"
                      style={{
                        background: heatmapColor(v),
                        opacity: heatmapOpacity(v),
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.emerald, opacity: 0.4 }} />
              Low (1–2)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.amber, opacity: 0.6 }} />
              Medium (3–5)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.rose, opacity: 0.7 }} />
              High (6–8)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm" style={{ background: TERRA.slate, opacity: 0.85 }} />
              Critical (9+)
            </span>
          </div>
        </ChartCard>

        {/* Section 5: Top Affected Accounts */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">
                <LabelWithHelp
                  help={
                    <p>
                      Accounts with the most anomalies in the last 24 hours. Risk tier drives
                      the recommended response — Critical accounts should be paused and reviewed.
                    </p>
                  }
                >
                  Top Affected Accounts
                </LabelWithHelp>
              </p>
              <p className="text-xs text-muted-foreground">Ranked by anomaly count</p>
            </div>
          </div>
          <DataTable
            data={affected}
            rowKey={(r) => r.accountId}
            pageSize={5}
            searchableText={(r) => `${r.login} ${r.traderName}`}
            searchPlaceholder="Search account / trader…"
            emptyTitle="No affected accounts"
            emptyDescription="No accounts have been linked to anomalies in the last 24 hours."
            columns={[
              {
                key: "account",
                header: "Account",
                cell: (r) => (
                  <div className="flex flex-col">
                    <span className="font-mono text-xs text-foreground">{r.login}</span>
                    <span className="text-[10px] text-muted-foreground">{r.accountId}</span>
                  </div>
                ),
              },
              {
                key: "trader",
                header: term("trader"),
                cell: (r) => <span className="text-sm font-medium text-foreground">{r.traderName}</span>,
                sortValue: (r) => r.traderName,
              },
              {
                key: "count",
                header: "Anomalies",
                numeric: true,
                cell: (r) => (
                  <Badge variant="outline" className="border-border bg-muted/40 tabular-nums font-medium">
                    {r.anomaliesCount}
                  </Badge>
                ),
                sortValue: (r) => r.anomaliesCount,
              },
              {
                key: "last",
                header: "Last Anomaly",
                cell: (r) => <span className="text-xs text-muted-foreground">{relativeTime(r.lastAnomaly)}</span>,
                sortValue: (r) => new Date(r.lastAnomaly).getTime(),
              },
              {
                key: "tier",
                header: "Risk Tier",
                cell: (r) => <StatusBadge tone={riskTierTone(r.riskTier)}>{r.riskTier}</StatusBadge>,
              },
            ]}
          />
        </div>

        {/* Methodology card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <LabelWithHelp
                help={
                  <p>
                    Anomaly detection runs as a continuous background job. Each account&apos;s recent
                    activity stream is compared against its own 30-day behavioural fingerprint.
                    Outliers above a configurable threshold are surfaced here.
                  </p>
                }
              >
                How anomalies are detected
              </LabelWithHelp>
            </CardTitle>
            <CardDescription>Model inputs, severity bands, and escalation paths</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Model inputs</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· Trade size vs 30d average</li>
                <li>· Session timing fingerprint</li>
                <li>· Volume per hour baseline</li>
                <li>· Symbol rotation entropy</li>
                <li>· Spread + latency signal</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Severity bands</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· Critical — Slack alert + ticket</li>
                <li>· High — Auto-create ticket</li>
                <li>· Medium — Investigation queue</li>
                <li>· Low — Log only</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Escalation</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· Investigate → trader-detail</li>
                <li>· False positive → feedback loop</li>
                <li>· Create ticket → Support module</li>
                <li>· Re-trains the model on review</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Status button */}
        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              toast({
                title: "Anomaly detector status",
                description: `${anomalies24h} detected (24h) · ${confirmed} confirmed · FP rate ${falsePositiveRate}% · avg detection ${avgDetectionMin}m`,
              })
            }
          >
            <Activity className="mr-1 h-4 w-4" />
            Detector status
          </Button>
        </div>
      </PageContent>
    </Page>
  );
}
