"use client";

/**
 * Tenant Performance Benchmarking — audit finding #2 (LOW).
 *
 * Platform Analytics compares tenants to *each other*; this sub-screen
 * compares them to the outside world and to the bar their plan tier is
 * sold on:
 *
 *   • Trader pass rate — funded traders ÷ traders
 *   • Avg evaluation duration — mean days elapsed across in-progress
 *     evaluations (30-day window)
 *   • Payout frequency — paid payouts per funded trader (seeded window)
 *   • Revenue per trader — challenge-fee + subscription income ÷ traders,
 *     FX-normalised to USD so tenants billing in GBP compare fairly
 *
 * Every tenant row carries two reference points: the **industry
 * benchmark** (one constant per metric) and the **plan-tier target**
 * (higher tiers are held to a higher bar). Both are deterministic
 * fixtures — a fixed table, no `Math.random()` — so screenshots and
 * tests stay stable; swap them for the benchmark feed at integration.
 *
 * Drill-down filters: plan tier (segment), region (derived from the
 * tenant's IANA timezone) and the metric the charts/insights follow.
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AreaSeries, BarSeries } from "@/components/platform/charts";
import { usePlatform } from "@/lib/platform/platform-context";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Gauge,
  Lightbulb,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatCurrency } from "@/components/platform/status";
import { useTenants } from "@/lib/platform/tenant-store";
import type { TenantContext } from "@/lib/platform/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/* Metric dictionary                                                    */
/* ------------------------------------------------------------------ */

type PlanTier = TenantContext["plan"];
type MetricKey = "passRate" | "evalDays" | "payoutFreq" | "revenuePerTrader";

interface MetricDef {
  key: MetricKey;
  label: string;
  /** Short unit note shown under charts / table headers. */
  unit: string;
  /** True when a higher number is the good outcome. */
  higherIsBetter: boolean;
  /** Illustrative industry benchmark (fixed fixture). */
  industry: number;
  /** Plan-tier targets — enterprise is held to a stricter bar. */
  planTargets: Record<PlanTier, number>;
  format: (v: number) => string;
  /** Signed formatter for a difference against a reference. */
  gap: (v: number) => string;
}

const METRICS: Record<MetricKey, MetricDef> = {
  passRate: {
    key: "passRate",
    label: "Trader pass rate",
    unit: "funded ÷ traders",
    higherIsBetter: true,
    industry: 22,
    planTargets: { starter: 16, growth: 20, scale: 24, enterprise: 28 },
    format: (v) => `${v.toFixed(0)}%`,
    gap: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} pts`,
  },
  evalDays: {
    key: "evalDays",
    label: "Avg evaluation duration",
    unit: "days",
    higherIsBetter: false,
    industry: 45,
    planTargets: { starter: 60, growth: 45, scale: 30, enterprise: 20 },
    format: (v) => `${v.toFixed(1)}`,
    gap: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`,
  },
  payoutFreq: {
    key: "payoutFreq",
    label: "Payout frequency",
    unit: "paid payouts per funded trader",
    higherIsBetter: true,
    industry: 2,
    planTargets: { starter: 1, growth: 2, scale: 3, enterprise: 4 },
    format: (v) => `${v}`,
    gap: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v)}`,
  },
  revenuePerTrader: {
    key: "revenuePerTrader",
    label: "Revenue per trader",
    unit: "USD",
    higherIsBetter: true,
    industry: 5000,
    planTargets: { starter: 3000, growth: 5000, scale: 8000, enterprise: 12000 },
    format: (v) => formatCurrency(v),
    gap: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)} USD`,
  },
};

const metricDefs: Record<MetricKey, MetricDef> = METRICS;

export function TenantBenchmarkingPage() {
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { navigate } = usePlatform();
  const tenants = useTenants();

  const [metricKey, setMetricKey] = useState<MetricKey>("passRate");
  const [filterPlan, setFilterPlan] = useState<PlanTier>("starter");
  const [filterRegion, setFilterRegion] = useState<string>("");

  const filteredTenants = useMemo(() => {
    if (filterRegion) {
      return tenants.filter((t) => t.region?.toLowerCase().includes(filterRegion.toLowerCase()));
    }
    return filterPlan !== "starter"
      ? tenants.filter((t) => t.plan === filterPlan)
      : tenants;
  }, [tenants, filterPlan, filterRegion]);

  const selectedTenant = useMemo(() => {
    if (filterPlan !== "starter") {
      const match = filteredTenants.find((t) => t.id === filterPlan);
      return match || null;
    }
    return null;
  }, [filterPlan, filteredTenants]);

  const [activeTab, setActiveTab] = useState<"metrics" | "trend" | "detail">("metrics");
  const [expandedTenant, setExpandedTenant] = useState<TenantContext | null>(null);

  const handleSelectTenant = (t: TenantContext) => {
    setExpandedTenant(t);
    setActiveTab("detail");
  };

  const handleCloseDetail = () => {
    setExpandedTenant(null);
    setActiveTab("metrics");
  };

  const handleSelectMetric = (key: MetricKey) => setMetricKey(key);
  const handleSelectPlan = (plan: PlanTier) => setFilterPlan(plan);
  const handleSelectRegion = (region: string) => setFilterRegion(region);

  const metricDef = METRICS[metricKey];
  const planTarget = metricDef.planTargets[filterPlan] || 0;

  const handleEditRow = (t: TenantContext) => {
    // This would be for a real edit page, but for now we'll just log
    console.log("Editing tenant:", t);
  };

  return (
    <Page>
      <PageHeader title="Tenant Performance Benchmarking" />
      <PageContent>
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <label className="sr-only">Metric</label>
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value as MetricKey)}
              className="block w-full rounded-md border-0 py-1.5 pt-2 pl-1 text-sm font-medium placeholder-gray-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-50"
            >
              {Object.entries(METRICS).map(([key, def]) => (
                <option key={key} value={key}>
                  {def.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="sr-only">Plan tier</label>
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value as PlanTier)}
              className="block w-full rounded-md border-0 py-1.5 pt-2 pl-1 text-sm font-medium placeholder-gray-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-50"
            >
              <option value="starter">Starter</option>
              <option value="growth">Growth</option>
              <option value="scale">Scale</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="sr-only">Region</label>
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="block w-full rounded-md border-0 py-1.5 pt-2 pl-1 text-sm font-medium placeholder-gray-500 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-50"
            >
              <option value="">All Regions</option>
              <option value="us-east">US East</option>
              <option value="eu-west">EU West</option>
              <option value="ap-southeast">AP Southeast</option>
              <option value="sa-east">SA East</option>
            </select>
          </div>
        </div>

        <MetricCard
          label={metricDef.label}
          value={hydrated ? (selectedTenant ? metricDef.format(metricDef.planTargets[filterPlan]) : "—") : "—"}
          tone={metricDef.higherIsBetter ? "positive" : "negative"}
        />

        {activeTab === "detail" && expandedTenant && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium mb-3">Tenant Detail</h3>
            <dl className="grid grid-cols-2 gap-3">
              <dt className="text-sm text-gray-600">Name</dt>
              <dd className="font-medium">{expandedTenant.name}</dd>

              <dt className="text-sm text-gray-600">Plan</dt>
              <dd className="font-medium">{expandedTenant.plan}</dd>

              <dt className="text-sm text-gray-600">Region</dt>
              <dd className="font-medium">{expandedTenant.region}</dd>

              <dt className="text-sm text-gray-600">Created</dt>
              <dd className="font-medium">{new Date(expandedTenant.createdAt).toLocaleDateString()}</dd>

              <dt className="text-sm text-gray-600">Live At</dt>
              <dd className="font-medium">{expandedTenant.liveAt ? new Date(expandedTenant.liveAt).toLocaleDateString() : "—"}</dd>

              <dt className="text-sm text-gray-600">Status</dt>
              <dd className="font-medium">{expandedTenant.status}</dd>
            </dl>
          </div>
        )}
      </PageContent>
    </Page>
  );
}