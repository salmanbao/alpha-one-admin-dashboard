"use client";

/**
 * R13 P1-5 — API Analytics store.
 *
 * The range filter (7d/30d/90d) was a no-op because the demo dataset only
 * had 5 days of data. This store provides a deterministic 90-day history
 * that the filter can actually slice. Export/Refresh now persist + audit.
 *
 * Pattern: singleton state + listener set + version hook, persisted to
 * localStorage under a single key.
 */

import { useEffect, useState } from "react";
import { recordAudit } from "@/lib/platform/console-store";

export interface ApiUsageDay {
  date: string;
  totalCalls: number;
  successfulCalls: number;
  errorCalls: number;
  p95Latency: number;
  p99Latency: number;
  uniqueKeys: number;
  uniqueTenants: number;
}

export interface ApiTopConsumer {
  tenant: string;
  keyName: string;
  calls: number;
  share: number;
  avgLatency: number;
  errorRate: number;
}

export interface ApiErrorBreakdown {
  code: string;
  name: string;
  count: number;
  percentage: number;
  color: string;
}

interface ApiAnalyticsState {
  usage: ApiUsageDay[];
  consumers: ApiTopConsumer[];
  errors: ApiErrorBreakdown[];
  lastRefreshed: string;
}

const STORAGE_KEY = "pfaas:platform-admin:api-analytics";

/** Generate 90 days of deterministic daily API usage (no Math.random). */
function generateUsage(): ApiUsageDay[] {
  const base = 2_000_000;
  const out: ApiUsageDay[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    // Deterministic weekly cycle + slow growth
    const dayOfWeek = d.getDay();
    const weekly = [0.95, 1.0, 1.02, 1.03, 1.05, 0.9, 0.85][dayOfWeek];
    const growth = 1 + (90 - i) / 90 * 0.15;
    const mult = weekly * growth;
    const total = Math.round(base * mult + ((i * 73) % 200_000));
    const errorPct = 0.005 + (i % 13) / 10000;
    const p95 = 130 + (i % 17) * 2;
    out.push({
      date,
      totalCalls: total,
      successfulCalls: Math.round(total * (1 - errorPct)),
      errorCalls: Math.round(total * errorPct),
      p95Latency: p95,
      p99Latency: p95 + 120 + (i % 5) * 10,
      uniqueKeys: 38 + (i % 7),
      uniqueTenants: 10 + (i % 4),
    });
  }
  return out;
}

/** Deterministic top consumers (stable across reloads). */
const SEED_CONSUMERS: ApiTopConsumer[] = [
  { tenant: "Alpha Capital", keyName: "Production", calls: 850_000, share: 34.7, avgLatency: 128, errorRate: 0.4 },
  { tenant: "Beta Trading", keyName: "Integration", calls: 620_000, share: 25.3, avgLatency: 135, errorRate: 0.7 },
  { tenant: "Gamma Futures", keyName: "Mobile App", calls: 480_000, share: 19.6, avgLatency: 148, errorRate: 1.2 },
  { tenant: "Alpha Capital", keyName: "Reporting", calls: 320_000, share: 13.1, avgLatency: 142, errorRate: 0.5 },
  { tenant: "Beta Trading", keyName: "Analytics Export", calls: 180_000, share: 7.3, avgLatency: 155, errorRate: 0.9 },
];

/** Deterministic error breakdown. */
const SEED_ERRORS: ApiErrorBreakdown[] = [
  { code: "429", name: "Rate Limited", count: 8_200, percentage: 45.6, color: "#b83230" },
  { code: "500", name: "Server Error", count: 4_500, percentage: 25.0, color: "#705c30" },
  { code: "401", name: "Unauthorized", count: 2_800, percentage: 15.6, color: "#6b6358" },
  { code: "400", name: "Bad Request", count: 1_500, percentage: 8.3, color: "#4a7c59" },
  { code: "503", name: "Service Unavailable", count: 1_000, percentage: 5.6, color: "#74796e" },
];

function load(): ApiAnalyticsState {
  if (typeof window === "undefined") {
    return {
      usage: generateUsage(),
      consumers: SEED_CONSUMERS,
      errors: SEED_ERRORS,
      lastRefreshed: new Date().toISOString(),
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        usage: generateUsage(),
        consumers: SEED_CONSUMERS,
        errors: SEED_ERRORS,
        lastRefreshed: new Date().toISOString(),
      };
    }
    const parsed = JSON.parse(raw);
    return {
      usage: Array.isArray(parsed?.usage) ? parsed.usage : generateUsage(),
      consumers: Array.isArray(parsed?.consumers) ? parsed.consumers : SEED_CONSUMERS,
      errors: Array.isArray(parsed?.errors) ? parsed.errors : SEED_ERRORS,
      lastRefreshed: typeof parsed?.lastRefreshed === "string" ? parsed.lastRefreshed : new Date().toISOString(),
    };
  } catch {
    return {
      usage: generateUsage(),
      consumers: SEED_CONSUMERS,
      errors: SEED_ERRORS,
      lastRefreshed: new Date().toISOString(),
    };
  }
}

function persist(next: ApiAnalyticsState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota — state stays in memory for this session */
  }
}

let state: ApiAnalyticsState = load();

function commit(next: ApiAnalyticsState) {
  state = next;
  persist(state);
  emit();
}

export function readApiAnalytics(): ApiAnalyticsState {
  return state;
}

/** Trigger a refresh — regenerates usage deterministically but writes an audit row. */
export function refreshApiAnalytics(actor = "operator"): ApiAnalyticsState {
  const next: ApiAnalyticsState = {
    usage: generateUsage(),
    consumers: SEED_CONSUMERS,
    errors: SEED_ERRORS,
    lastRefreshed: new Date().toISOString(),
  };
  commit(next);
  recordAudit({
    actor,
    action: "api.analytics_refresh",
    target: "api-analytics",
    detail: "API analytics data refreshed — regenerated 90-day history",
    severity: "info",
  });
  return next;
}

/** Export the current filtered slice (audits the export). */
export function exportApiAnalytics(range: "7d" | "30d" | "90d", actor = "operator"): { csv: string; filename: string } {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const slice = state.usage.slice(0, days);
  const headers = ["Date", "Total Calls", "Successful", "Errors", "Error Rate %", "P95 Latency (ms)", "P99 Latency (ms)", "Unique Keys", "Unique Tenants"];
  const rows = slice.map((d) => [
    d.date,
    d.totalCalls.toString(),
    d.successfulCalls.toString(),
    d.errorCalls.toString(),
    ((d.errorCalls / d.totalCalls) * 100).toFixed(2),
    d.p95Latency.toString(),
    d.p99Latency.toString(),
    d.uniqueKeys.toString(),
    d.uniqueTenants.toString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const filename = `api-analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  recordAudit({
    actor,
    action: "api.analytics_export",
    target: "api-analytics",
    detail: `Exported ${days}-day API analytics (${slice.length} rows) as CSV`,
    severity: "info",
  });
  return { csv, filename };
}

/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let version = 0;
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Subscribe the calling component to analytics mutations. */
export function useApiAnalyticsVersion(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    const l = () => setV(version);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return v;
}