"use client";

/**
 * AI Cost Tracking
 *
 * Tracks AI model usage and cost across the tenant (or platform-wide
 * when super-admin): 30d cost trend, cost by model, cost by use case,
 * per-tenant breakdown, budget alerts, and a 30d forecast.
 *
 * Deterministic mock data — no Math.random. All values derive from
 * `hashStr(tenantId + key)` + `Math.sin(i / n)` patterns so the same
 * tenant renders the same numbers across reloads.
 *
 * File ownership: impl-ai-predictive-anomaly-cost
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { makeTermResolver, plural } from "@/lib/platform/terminology";
import { hashStr, tenants, platformTenant } from "@/lib/platform/mock-data";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, type Column } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { AreaSeries, BarSeries, DonutSeries, type SeriesPoint } from "@/components/platform/charts";
import { LabelWithHelp } from "@/components/platform/contextual-help";
import { exportToCsv } from "@/lib/platform/export-utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Save,
  Download,
  Brain,
  Wallet,
  Receipt,
  PiggyBank,
  Bell,
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

interface ModelCost extends SeriesPoint {
  label: string;
  cost: number;
}

const MODELS: ModelCost[] = [
  { label: "GPT-4o", cost: 1180 },
  { label: "Claude 3.5", cost: 720 },
  { label: "Gemini 1.5", cost: 410 },
  { label: "Llama 3.1", cost: 280 },
  { label: "Internal", cost: 257 },
];

const USE_CASES = [
  { label: "Chat Assistant", value: 980, color: TERRA.emerald },
  { label: "Insights Generation", value: 720, color: TERRA.amber },
  { label: "Anomaly Detection", value: 460, color: TERRA.rose },
  { label: "Predictive Analytics", value: 410, color: TERRA.sky },
  { label: "Document Parsing", value: 277, color: TERRA.teal },
];

interface TenantCostRow {
  tenantId: string;
  tenantName: string;
  requests: number;
  tokens: number;
  cost: number;
  costPerRequest: number;
  trend: number; // signed % delta
}

const ALL_TENANTS = [platformTenant, ...tenants];

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

function buildDailyCostSeries(tid: string) {
  // 30d daily spend — deterministic sin pattern + weekly dip.
  const seed = hashStr(tid + "daily-cost");
  const baseline = 78 + (seed % 20); // $78–$97
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const seasonal = Math.sin((i + (seed % 5)) / 3) * 14;
    const weekly = i % 7 === 5 || i % 7 === 6 ? -18 : 0;
    const growth = i * 0.6;
    const value = Math.max(20, Math.round((baseline + seasonal + weekly + growth) * 100) / 100);
    return { day: `D${day}`, cost: value };
  });
}

function buildPerTenantCosts(): TenantCostRow[] {
  return ALL_TENANTS.map((t) => {
    const seed = hashStr(t.id + "tenant-cost");
    const requests = 8000 + (seed % 4000);
    const tokens = requests * (140 + (seed % 60)); // 140–199 tokens/req
    const cost = Math.round((tokens / 1000) * (0.6 + (seed % 40) / 100));
    const trend = ((seed % 41) - 20); // -20 to +20
    return {
      tenantId: t.id,
      tenantName: t.name,
      requests,
      tokens,
      cost,
      costPerRequest: Math.round((cost / requests) * 1000) / 1000,
      trend,
    };
  }).sort((a, b) => b.cost - a.cost);
}

function buildForecastSeries(tid: string, dailySeries: { day: string; cost: number }[]) {
  // 30d forward forecast — deterministic sin pattern + growth.
  const seed = hashStr(tid + "cost-forecast");
  const baseline = dailySeries[dailySeries.length - 1]?.cost ?? 95;
  return Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const seasonal = Math.sin((i + (seed % 4)) / 3) * 11;
    const growth = i * 0.9;
    const predicted = Math.max(30, Math.round((baseline + seasonal + growth) * 100) / 100);
    const band = Math.max(2, Math.round(predicted * 0.18));
    return {
      day: `D${day}`,
      predicted,
      low: Math.max(0, predicted - band),
      high: predicted + band,
    };
  });
}

function trendTone(trend: number): "default" | "success" | "warning" | "danger" | "info" | "muted" {
  if (trend > 15) return "danger";
  if (trend > 5) return "warning";
  if (trend > 0) return "info";
  if (trend < -10) return "success";
  return "muted";
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

export function AiCostPage() {
  const { runtime, tenant } = usePlatform();
  const term = makeTermResolver(tenant);
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";
  const isPlatform = tid === "platform";

  const dailySeries = useMemo(() => buildDailyCostSeries(tid), [tid]);
  const forecastSeries = useMemo(() => buildForecastSeries(tid, dailySeries), [tid, dailySeries]);
  const perTenantRows = useMemo(() => buildPerTenantCosts(), []);

  // ---- KPI computations (deterministic) ---------------------------------
  const totalSpend30d = dailySeries.reduce((s, d) => s + d.cost, 0);
  const dailyAvg = totalSpend30d / 30;
  const totalRequests30d = 24000 + (hashStr(tid + "reqs") % 9000);
  const costPerPrediction = Math.round((totalSpend30d / totalRequests30d) * 100) / 100;
  const monthlyBudget = 5000;
  const budgetUsedPct = Math.round((totalSpend30d / monthlyBudget) * 100);

  // ---- Budget alert config (local state — demo) ------------------------
  const [budget, setBudget] = useState(monthlyBudget);
  const [alertThreshold, setAlertThreshold] = useState(75);
  const [emailRecipient, setEmailRecipient] = useState("alerts@pfaas.io");

  const handleSaveConfig = () => {
    toast({
      title: "Budget alert saved",
      description: `Budget ${formatCurrency(budget, currency)} · alert at ${alertThreshold}% · ${emailRecipient}`,
    });
  };

  // ---- CSV export -------------------------------------------------------
  const handleExportDaily = () =>
    exportToCsv(
      dailySeries,
      [
        { key: "day", header: "Day", value: (r) => r.day },
        { key: "cost", header: `Cost (${currency})`, value: (r) => r.cost },
      ],
      `ai-cost-daily-${tid}.csv`,
    );

  const handleExportTenants = () =>
    exportToCsv(
      perTenantRows,
      [
        { key: "tenantId", header: "Tenant ID", value: (r) => r.tenantId },
        { key: "tenantName", header: "Tenant", value: (r) => r.tenantName },
        { key: "requests", header: "Requests", value: (r) => r.requests },
        { key: "tokens", header: "Tokens", value: (r) => r.tokens },
        { key: "cost", header: `Cost (${currency})`, value: (r) => r.cost },
        { key: "costPerRequest", header: "Cost/Request", value: (r) => r.costPerRequest },
        { key: "trend", header: "Trend %", value: (r) => r.trend },
      ],
      `ai-cost-by-tenant.csv`,
    );

  return (
    <Page>
      <PageHeader
        title="AI Cost Tracking"
        description={`Monitor AI model usage and cost across ${isPlatform ? "all tenants" : `this ${term("trader").toLowerCase()} tenant`}.`}
        icon={DollarSign}
        term={`30d spend ${formatCurrency(totalSpend30d, currency)} · ${budgetUsedPct}% of monthly budget`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportDaily}>
              <Download className="mr-1 h-4 w-4" />
              Export daily
            </Button>
            {isPlatform ? (
              <Button variant="outline" size="sm" onClick={handleExportTenants}>
                <Download className="mr-1 h-4 w-4" />
                Export tenants
              </Button>
            ) : null}
          </>
        }
      />
      <PageContent>
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Total Spend (30d)"
            value={formatCurrency(totalSpend30d, currency)}
            icon={Wallet}
            tone={budgetUsedPct >= 80 ? "negative" : "default"}
            deltaLabel={`of ${formatCurrency(monthlyBudget, currency)} monthly budget`}
          />
          <MetricCard
            label="Daily Avg"
            value={formatCurrency(dailyAvg, currency)}
            icon={Receipt}
            deltaLabel="across last 30 days"
          />
          <MetricCard
            label="Cost per Prediction"
            value={formatCurrency(costPerPrediction, currency)}
            icon={Brain}
            tone="positive"
            delta={-3}
            deltaLabel="vs prior 30d"
          />
          <MetricCard
            label="Budget Used"
            value={`${budgetUsedPct}%`}
            icon={PiggyBank}
            tone={budgetUsedPct >= 90 ? "negative" : budgetUsedPct >= 75 ? "warning" : "positive"}
            deltaLabel={`of ${formatCurrency(monthlyBudget, currency)} monthly budget`}
          />
        </div>

        {/* Section 1: Cost Trend (30d) */}
        <ChartCard
          title="Cost Trend (30d)"
          subtitle={`Daily AI spend — last 30 days (${currency})`}
          help={
            <p>
              Sum of all model invocations charged to this tenant&apos;s AI ledger. Dips on weekends
              reflect reduced assistant traffic; growth is driven by predictive model retraining
              cycles.
            </p>
          }
        >
          <AreaSeries
            data={dailySeries}
            xKey="day"
            yKey="cost"
            color={TERRA.emerald}
            height={240}
            formatValue={(v) => formatCurrency(Number(v), currency)}
          />
        </ChartCard>

        {/* Section 2 + 3: by Model + by Use Case */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Cost by Model"
            subtitle="30d spend per LLM provider"
            help={
              <p>
                Each bar shows total 30d spend on a single model. Use this to decide when to
                downgrade a high-cost model (e.g. GPT-4o → GPT-4o mini) for low-stakes workflows.
              </p>
            }
          >
            <BarSeries
              data={MODELS}
              xKey="label"
              yKey="cost"
              color={TERRA.teal}
              height={240}
              formatValue={(v) => formatCurrency(Number(v), currency)}
            />
          </ChartCard>
          <ChartCard
            title="Cost by Use Case"
            subtitle="30d spend per AI workflow"
            help={
              <p>
                Each slice is a workflow powered by the AI layer. Chat Assistant is typically the
                largest slice; anomaly detection and predictive analytics are smaller but higher
                value per call.
              </p>
            }
          >
            <DonutSeries
              data={USE_CASES}
              height={240}
              formatValue={(v) => formatCurrency(Number(v), currency)}
            />
          </ChartCard>
        </div>

        {/* Section 4: Cost by Tenant (super-admin only) */}
        {isPlatform ? (
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  <LabelWithHelp
                    help={
                      <p>
                        Cross-tenant AI cost breakdown. Super-admins can use this to spot tenants
                        whose AI usage is disproportionately high relative to their plan tier.
                      </p>
                    }
                  >
                    Cost by Tenant
                  </LabelWithHelp>
                </p>
                <p className="text-xs text-muted-foreground">Platform-wide view · ranked by spend</p>
              </div>
              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                super-admin
              </Badge>
            </div>
            <DataTable
              data={perTenantRows}
              rowKey={(r) => r.tenantId}
              pageSize={6}
              searchableText={(r) => r.tenantName}
              searchPlaceholder="Search tenant…"
              emptyTitle="No tenants"
              emptyDescription="No tenant cost data available."
              columns={[
                {
                  key: "tenant",
                  header: "Tenant",
                  cell: (r) => (
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{r.tenantName}</span>
                      <span className="text-[10px] text-muted-foreground">{r.tenantId}</span>
                    </div>
                  ),
                  sortValue: (r) => r.tenantName,
                },
                {
                  key: "requests",
                  header: "Requests",
                  numeric: true,
                  cell: (r) => <span className="tabular-nums">{r.requests.toLocaleString()}</span>,
                  sortValue: (r) => r.requests,
                },
                {
                  key: "tokens",
                  header: "Tokens",
                  numeric: true,
                  cell: (r) => <span className="tabular-nums">{r.tokens.toLocaleString()}</span>,
                  sortValue: (r) => r.tokens,
                },
                {
                  key: "cost",
                  header: "Cost",
                  numeric: true,
                  cell: (r) => <span className="tabular-nums font-medium">{formatCurrency(r.cost, currency)}</span>,
                  sortValue: (r) => r.cost,
                },
                {
                  key: "costPerRequest",
                  header: "Cost/Request",
                  numeric: true,
                  cell: (r) => <span className="tabular-nums">{formatCurrency(r.costPerRequest, currency)}</span>,
                  sortValue: (r) => r.costPerRequest,
                },
                {
                  key: "trend",
                  header: "Trend",
                  numeric: true,
                  cell: (r) => (
                    <div className="flex items-center justify-end gap-1">
                      {r.trend >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-rose-600" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-emerald-600" />
                      )}
                      <StatusBadge tone={trendTone(r.trend)}>
                        {r.trend >= 0 ? "+" : ""}{r.trend}%
                      </StatusBadge>
                    </div>
                  ),
                  sortValue: (r) => r.trend,
                },
              ]}
            />
          </div>
        ) : null}

        {/* Section 5: Budget Alert Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <LabelWithHelp
                help={
                  <p>
                    Configure the monthly AI spend budget and the alert threshold. When the threshold
                    is crossed, an email is sent to the configured recipient. Demo only — no real
                    email is dispatched.
                  </p>
                }
              >
                Budget Alert Configuration
              </LabelWithHelp>
            </CardTitle>
            <CardDescription>Set monthly budget, alert threshold, and email recipient</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="budget-input">
                Monthly budget ({currency})
              </label>
              <Input
                id="budget-input"
                type="number"
                min={100}
                step={100}
                value={budget}
                onChange={(e) => setBudget(Math.max(100, Number(e.target.value) || 0))}
                aria-label="Monthly budget"
              />
              <p className="text-[10px] text-muted-foreground">
                Current projected: {formatCurrency(totalSpend30d, currency)} ({budgetUsedPct}%)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="threshold-slider">
                  Alert threshold
                </label>
                <Badge
                  variant="outline"
                  className={
                    alertThreshold >= 90 ? "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400" :
                    alertThreshold >= 75 ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" :
                    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  }
                >
                  {alertThreshold}%
                </Badge>
              </div>
              <Slider
                id="threshold-slider"
                value={[alertThreshold]}
                min={25}
                max={100}
                step={5}
                onValueChange={(v) => setAlertThreshold(v[0])}
                aria-label="Alert threshold percentage"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Alert fires when monthly spend crosses this percentage of the budget.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground" htmlFor="email-input">
                Email recipient
              </label>
              <Input
                id="email-input"
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="alerts@yourfirm.com"
                aria-label="Email recipient"
              />
              <p className="text-[10px] text-muted-foreground">
                A test alert is sent on save to verify the address.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-3 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Bell className="h-4 w-4" />
              <span>
                Projected month-end: <strong className="text-foreground">{formatCurrency(totalSpend30d * (30 / 30), currency)}</strong>
                {" "}— projected {budgetUsedPct >= alertThreshold ? "will trigger" : "will not trigger"} the alert.
              </span>
            </div>
            <Button onClick={handleSaveConfig}>
              <Save className="mr-1 h-4 w-4" />
              Save configuration
            </Button>
          </CardFooter>
        </Card>

        {/* Section 6: Cost Forecast */}
        <ChartCard
          title="Cost Forecast — Next 30 Days"
          subtitle={`Predicted daily spend (${currency}) · ±18% confidence band`}
          help={
            <p>
              The forecast extends the 30d trend forward using a deterministic seasonal model.
              Use this to plan budget reallocations or model downgrades before the budget is
              exhausted.
            </p>
          }
        >
          <AreaSeries
            data={forecastSeries}
            xKey="day"
            yKey="predicted"
            color={TERRA.amber}
            height={240}
            formatValue={(v) => formatCurrency(Number(v), currency)}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Confidence band: ±18% of predicted value · seasonal model seeded by tenant ID
          </p>
        </ChartCard>

        {/* Methodology card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              <LabelWithHelp
                help={
                  <p>
                    Cost is calculated by summing per-call token usage × the model&apos;s price per
                    1k tokens. All figures are deterministic for the demo; production deployments
                    pull invoices from the model provider API every hour.
                  </p>
                }
              >
                How cost is calculated
              </LabelWithHelp>
            </CardTitle>
            <CardDescription>Inputs, refresh cadence, and pricing assumptions</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost inputs</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· Input + output tokens</li>
                <li>· Per-model price per 1k</li>
                <li>· Caching discount (when applied)</li>
                <li>· Batch vs real-time</li>
                <li>· Tenant seed multiplier</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Refresh cadence</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· Hourly invoice pull</li>
                <li>· Daily KPI roll-up</li>
                <li>· 30d trend refreshed hourly</li>
                <li>· Forecast re-run nightly</li>
                <li>· Budget alert real-time</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pricing tiers</p>
              <ul className="mt-2 space-y-1 text-xs text-foreground">
                <li>· GPT-4o: $0.005 / 1k</li>
                <li>· Claude 3.5: $0.003 / 1k</li>
                <li>· Gemini 1.5: $0.0015 / 1k</li>
                <li>· Llama 3.1: $0.0008 / 1k</li>
                <li>· Internal: marginal cost</li>
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
                title: "AI cost status",
                description: `30d spend ${formatCurrency(totalSpend30d, currency)} · daily avg ${formatCurrency(dailyAvg, currency)} · ${budgetUsedPct}% of ${formatCurrency(budget, currency)} budget`,
              })
            }
          >
            <DollarSign className="mr-1 h-4 w-4" />
            Cost status
          </Button>
        </div>

        {/* Terminology-aware summary (renders for any tenant) */}
        <p className="sr-only">
          AI cost tracking summary for {plural(term("trader")).toLowerCase()} tenant {tid}: total spend
          {formatCurrency(totalSpend30d, currency)} over the last 30 days at {formatCurrency(costPerPrediction, currency)}
          {" "}per prediction against a monthly budget of {formatCurrency(budget, currency)}.
        </p>
      </PageContent>
    </Page>
  );
}
