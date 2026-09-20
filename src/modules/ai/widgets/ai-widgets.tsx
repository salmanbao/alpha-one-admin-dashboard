"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { getTenantAiInsights } from "@/lib/platform/mock-data";
import type { AiInsight } from "@/lib/platform/mock-data";
import { MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCompact } from "@/components/platform/status";
import { BarSeries } from "@/components/platform/charts";
import { Sparkles, Brain, Target, AlertTriangle, TrendingUp } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function aiSeverityTone(sev: string): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  switch (sev) {
    case "critical": return "danger";
    case "warning": return "warning";
    case "opportunity": return "success";
    case "info": return "info";
    default: return "muted";
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function avgConfidence(insights: AiInsight[]): number {
  if (!insights.length) return 0;
  const sum = insights.reduce((s, i) => s + i.confidence, 0);
  return Math.round((sum / insights.length) * 100);
}

/* ------------------------------------------------------------------ */
/* Widgets                                                             */
/* ------------------------------------------------------------------ */

export function AiOverviewWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const insights = getTenantAiInsights(tid);
  const active = insights.length;
  const avg = avgConfidence(insights);
  const opportunities = insights.filter((i) => i.severity === "opportunity").length;
  const critical = insights.filter((i) => i.severity === "critical").length;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard label="Active Insights" value={active} icon={Sparkles} tone="positive" />
      <MetricCard label="Avg Confidence" value={`${avg}%`} icon={Brain} />
      <MetricCard label="Opportunities" value={opportunities} icon={Target} tone="positive" />
      <MetricCard label="Critical Alerts" value={critical} icon={AlertTriangle} tone="negative" />
    </div>
  );
}

export function AiInsightsWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const insights = getTenantAiInsights(tid)
    .slice()
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
    .slice(0, 4);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-medium">Latest AI insights</span>
      </div>
      {insights.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          No AI insights yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {insights.map((i) => (
            <div key={i.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
              <div className="mt-0.5">
                {i.severity === "opportunity" ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : i.severity === "critical" ? (
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                ) : i.severity === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                ) : (
                  <Sparkles className="h-4 w-4 text-violet-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{i.title}</span>
                  <StatusBadge tone={aiSeverityTone(i.severity)}>{i.severity}</StatusBadge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{i.summary}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>Confidence {Math.round(i.confidence * 100)}%</span>
                  <span>·</span>
                  <span>{relativeTime(i.generatedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AiConfidenceWidget() {
  const { runtime } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const insights = getTenantAiInsights(tid);
  const data = insights.map((i) => ({
    date: i.title.length > 18 ? i.title.slice(0, 16) + "…" : i.title,
    value: Math.round(i.confidence * 100),
  }));
  if (!data.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No confidence data
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <BarSeries data={data} xKey="date" yKey="value" color="#7c3aed" height={200} formatValue={(v) => `${v}%`} />
      <p className="text-xs text-muted-foreground">{formatCompact(insights.length)} insights · avg {avgConfidence(insights)}%</p>
    </div>
  );
}
