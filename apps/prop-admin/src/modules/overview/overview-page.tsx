"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { DashboardGrid, CustomizeDashboardDialog } from "@/components/platform/gridstack-dashboard";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { AttentionCenter } from "@/components/platform/attention-center";
import { LiveActivityFeedWidget } from "@/components/platform/live-activity-feed";
import { LiveEquityCurveWidget } from "@/components/platform/live-equity-curve";
import { LivePriceFeedWidget } from "@/components/platform/live-price-feed";
import { useLiveData, syncLiveStats } from "@/lib/platform/live-data";
import { Compass, LayoutDashboard, Sparkles, RefreshCw, Calendar, ShieldCheck, Users, Wallet, TrendingUp, Activity, AlertTriangle, Brain, Settings2, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { moduleRegistry } from "@/lib/platform/module-registry";
import {
  getTenantTraders,
  getTenantAccounts,
  getTenantPositions,
  getTenantBreaches,
  getTenantPayouts,
  getTenantAffiliates,
  getTenantTransactions,
  getTenantTickets,
  getTenantAiInsights,
  getTenantKyc,
  revenueSeries,
} from "@/lib/platform/mock-data";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { DemoDataStamp } from "@/components/platform/demo-data";
import { AnimatedNumber } from "@/components/platform/animated-number";
import { makeTermResolver, plural, resolveTermsInString } from "@/lib/platform/terminology";
import { roles } from "@/lib/platform/mock-data";
import { useState, useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { PlatformEmptyState } from "@/components/platform/platform-empty-state";

export function OverviewPage() {
  const { runtime, tenant, user, navigate, setCustomizeOpen, hiddenWidgets } = usePlatform();
  const enabled = moduleRegistry.getEnabledModules(runtime);
  const live = useLiveData();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Page-level date range — shown in the header for every role and applied
  // dashboard-wide: it feeds the Analytics revenue KPI (7/30 days, matching
  // the 30-day revenueSeries window) and bumps `refreshKey` so all widgets
  // re-derive for the selected window.
  const [range, setRange] = useState<"7" | "30">("30");
  const term = makeTermResolver(tenant);
  const hasAnalytics = enabled.some((m) => m.manifest.id === "analytics");

  const refresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      // Remount the dashboard grid + widgets and re-run live-stat sync so the
      // action actually re-derives current data (not a toast-only fake).
      setRefreshKey((k) => k + 1);
      setRefreshing(false);
      toast({ title: "Dashboard refreshed", description: "Latest data loaded." });
    }, 600);
  }, []);

  // Aggregate the single most important KPI from each enabled module
  const tid = tenant.id;
  const summary = buildSummary(tid, tenant.currency, enabled.map((m) => m.manifest.id), term, range);

  // Sync live stats to actual values so the live sidebar matches the KPI row.
  useEffect(() => {
    const traders = getTenantTraders(tid);
    const positions = getTenantPositions(tid);
    const payouts = getTenantPayouts(tid);
    const breaches = getTenantBreaches(tid);
    syncLiveStats({
      activeTraders: traders.filter((t) => t.status === "active").length,
      openPositions: positions.length,
      pendingPayouts: payouts.filter((p) => p.status === "pending").length,
      openBreaches: breaches.filter((b) => b.status === "open").length,
    });
  }, [tid, refreshKey]);

  const roleName = roles.find((r) => r.id === user.roles[0])?.name ?? user.roles[0]?.replace(/-/g, " ");

  return (
    <Page>
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description={`${tenant.branding.name} · ${enabled.length} modules active · ${roleName}`}
        icon={LayoutDashboard}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> {tenant.plan} plan
            </Badge>
            <DemoDataStamp label="Simulated metrics" />
            {hasAnalytics ? (
              <Badge variant="outline" className="gap-1 hidden sm:inline-flex">
                <Calendar className="h-3 w-3" /> {range}d window
              </Badge>
            ) : null}
            <div className="flex items-center gap-1 rounded-md border bg-card p-0.5 text-xs" role="group" aria-label="Dashboard date range">
              {(["7", "30"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    if (r === range) return;
                    setRange(r);
                    // Remount widgets so the whole dashboard reflects the new window.
                    setRefreshKey((k) => k + 1);
                    toast({ title: "Date range applied", description: `Dashboard now showing the last ${r} days.` });
                  }}
                  aria-pressed={range === r}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {r}d
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={refresh} disabled={refreshing} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCustomizeOpen(true)} className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Customize</span>
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* First-use empty state (audit fix #11) — shows when a new firm has no
          enabled modules / KPI data yet, with guided setup actions. */}
        {!summary.length && !enabled.length && (
          <PlatformEmptyState
            title="Welcome to your dashboard"
            description="Configure modules and add your first data to see metrics here."
            steps={[
              "Enable KYC / Risk / Payouts modules from Settings",
              "Add your first trader account",
              "Run your first KYC review to see pending cases",
            ]}
            actions={[
              { label: "Configure modules", href: "settings-module-detail" },
              { label: "Invite traders", href: "trading-traders" },
            ]}
          />
        )}

        {/* Attention Center — the dashboard is an Operating Center (§4, §11) */}
        {/* "What needs my attention?" is the first question the dashboard answers */}
        <AttentionCenter />

        {/* Summary KPI row — one metric per enabled module */}
        {summary.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {summary.map((s, idx) => (
              <button
                key={`${s.moduleId}-${idx}`}
                onClick={() => s.href && navigate(s.href)}
                className="text-left"
                title={`Go to ${s.moduleName}`}
              >
                <MetricCard label={s.label} value={s.value} delta={s.delta} icon={s.icon} tone={s.tone} />
              </button>
            ))}
          </div>
        ) : null}

        {/* PRD §4.7 — Recent Payouts + Risk Alerts dashboard widgets
            (GET /dashboard/recent-payouts, GET /dashboard/risk-alerts). */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentPayoutsWidget tid={tid} navigate={navigate} />
          <RiskAlertsWidget tid={tid} navigate={navigate} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <DashboardGrid key={refreshKey} />
          </div>
          <aside className="lg:sticky lg:top-20 lg:h-fit">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2 border-b pb-2">
                <Radio className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-foreground">Live Activity</h2>
                <Badge variant="outline" className="ml-auto gap-1 text-[9px]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  {live.isLive ? "LIVE" : "PAUSED"}
                </Badge>
              </div>
              <LiveActivityFeedWidget />
            </div>
            {/* Live equity curve */}
            <div className="mt-3 rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2 border-b pb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Live Equity</span>
              </div>
              <LiveEquityCurveWidget />
            </div>
            {/* Live price feed */}
            <div className="mt-3 rounded-lg border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2 border-b pb-2">
                <Activity className="h-4 w-4 text-teal-500" />
                <span className="text-sm font-semibold text-foreground">Live Prices</span>
                <Badge variant="outline" className="ml-auto gap-1 text-[9px]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  LIVE
                </Badge>
              </div>
              <LivePriceFeedWidget />
            </div>
            {/* Live stats mini-panel */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {resolveTermsInString("Active Traders", tenant)}
                </p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  <AnimatedNumber value={live.activeTraders} />
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Open Positions
                </p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  <AnimatedNumber value={live.openPositions} />
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {resolveTermsInString("Pending Payouts", tenant)}
                </p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  <AnimatedNumber value={live.pendingPayouts} />
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Open Breaches
                </p>
                <p className="text-lg font-bold tabular-nums text-rose-600">
                  <AnimatedNumber value={live.openBreaches} className="text-rose-600" />
                </p>
              </div>
            </div>
          </aside>
        </div>
      </PageContent>
      <CustomizeDashboardDialog />
    </Page>
  );
}

/**
 * PRD §4.7 — "Recent Payouts" widget (GET /dashboard/recent-payouts).
 * Rows drill into the payout-detail view (the PRD clock/drill-down
 * affordance that previously had no entry point).
 */
function RecentPayoutsWidget({ tid, navigate }: { tid: string; navigate: (v: string) => void }) {
  const recent = [...getTenantPayouts(tid)]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Recent Payouts</h2>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate("payouts")}>
          View all
        </Button>
      </div>
      {recent.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No payout activity yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {recent.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate("payout-detail")}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">{p.traderName}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {p.reference} · {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-foreground">
                    {formatCurrency(p.amount, p.currency)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] ${
                      p.status === "paid"
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        : p.status === "rejected"
                          ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
                          : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {p.status}
                  </Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * PRD §4.7 — "Risk Alerts" widget (GET /dashboard/risk-alerts).
 * Lists open breaches ordered severity-first; rows drill into Risk.
 */
function RiskAlertsWidget({ tid, navigate }: { tid: string; navigate: (v: string) => void }) {
  const open = getTenantBreaches(tid)
    .filter((b) => b.status === "open")
    .sort((a, b) => (a.severity === "critical" ? -1 : 0) - (b.severity === "critical" ? -1 : 0));
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <h2 className="text-sm font-semibold text-foreground">Risk Alerts</h2>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate("breaches")}>
          View all
        </Button>
      </div>
      {open.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No active alerts — every tenant is within its risk rules.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {open.slice(0, 5).map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => navigate("risk-cases")}
                className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">{b.type}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">{b.rule}</span>
                </span>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[9px] ${
                    b.severity === "critical"
                      ? "border-rose-500/40 text-rose-700 dark:text-rose-400"
                      : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {b.severity}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SummaryKpi {
  moduleId: string;
  moduleName: string;
  label: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "default" | "positive" | "negative" | "warning";
  href?: string;
}

function buildSummary(
  tid: string,
  currency: string,
  enabledModuleIds: string[],
  term: (key: "challenge" | "payout" | "account" | "evaluation" | "participant" | "withdrawal" | "disbursement") => string,
  range: "7" | "30",
): SummaryKpi[] {
  const out: SummaryKpi[] = [];
  const has = (id: string) => enabledModuleIds.includes(id);

  if (has("trading")) {
    const traders = getTenantTraders(tid);
    const accounts = getTenantAccounts(tid);
    const activeCount = traders.filter((t) => t.status === "active").length;
    out.push({
      moduleId: "trading",
      moduleName: "Trading",
      label: `Active ${plural(term("account"))}`,
      value: formatCompact(activeCount),
      deltaLabel: `${traders.length} total`,
      icon: Users,
      tone: "positive",
      href: "trading-traders",
    });
    out.push({
      moduleId: "trading",
      moduleName: "Trading",
      label: "Total Equity",
      value: formatCurrency(accounts.reduce((s, a) => s + a.equity, 0), currency),
      icon: Wallet,
      tone: "positive",
      href: "trading-accounts",
    });
  }
  if (has("challenges")) {
    const fundedCount = getTenantTraders(tid).filter((t) => t.challengePhase === "funded").length;
    out.push({
      moduleId: "challenges",
      moduleName: "Challenges",
      label: `Funded ${plural(term("account"))}`,
      value: formatCompact(fundedCount),
      icon: TrendingUp,
      tone: "positive",
      href: "challenges-passed",
    });
  }
  if (has("risk")) {
    const breaches = getTenantBreaches(tid).filter((b) => b.status === "open").length;
    out.push({
      moduleId: "risk",
      moduleName: "Risk",
      label: "Open Breaches",
      value: breaches,
      icon: AlertTriangle,
      tone: breaches > 0 ? "warning" : "positive",
      href: "breaches",
    });
  }
  if (has("payouts")) {
    const pending = getTenantPayouts(tid).filter((p) => p.status === "pending").length;
    out.push({
      moduleId: "payouts",
      moduleName: "Payouts",
      label: `Pending ${plural(term("payout"))}`,
      value: pending,
      icon: Wallet,
      tone: pending > 0 ? "warning" : "positive",
      href: "payouts-pending",
    });
  }
  if (has("analytics")) {
    const rev = revenueSeries(tid).slice(-Number(range)).reduce((s, r) => s + r.value, 0);
    out.push({
      moduleId: "analytics",
      moduleName: "Analytics",
      label: `Revenue (${range}d)`,
      value: formatCurrency(rev, currency),
      deltaLabel: `${range}-day window`,
      icon: TrendingUp,
      tone: "positive",
      href: "analytics",
    });
  }
  if (has("affiliates")) {
    const aff = getTenantAffiliates(tid);
    out.push({
      moduleId: "affiliates",
      moduleName: "Affiliates",
      label: "Affiliate Revenue",
      value: formatCurrency(aff.reduce((s, a) => s + a.commissionEarned, 0), currency),
      deltaLabel: `${aff.length} affiliates`,
      icon: Users,
      tone: "positive",
      href: "affiliates",
    });
  }
  if (has("accounting")) {
    const txns = getTenantTransactions(tid);
    out.push({
      moduleId: "accounting",
      moduleName: "Accounting",
      label: "Net Flow (30d)",
      value: formatCurrency(txns.reduce((s, t) => s + (t.type === "payout" ? -t.amount : t.amount), 0), currency),
      deltaLabel: `${txns.length} txns`,
      icon: Activity,
      tone: "positive",
      href: "accounting",
    });
  }
  if (has("kyc")) {
    const pendingKyc = getTenantKyc(tid).filter((k) => k.status === "pending" || k.status === "review").length;
    out.push({
      moduleId: "kyc",
      moduleName: "KYC",
      label: "KYC Pending",
      value: pendingKyc,
      icon: ShieldCheck,
      tone: pendingKyc > 5 ? "warning" : "positive",
      href: "kyc-reviews",
    });
  }
  if (has("support")) {
    const openTickets = getTenantTickets(tid).filter((t) => t.status === "open").length;
    out.push({
      moduleId: "support",
      moduleName: "Support",
      label: "Open Tickets",
      value: openTickets,
      icon: Activity,
      tone: openTickets > 5 ? "warning" : "positive",
      href: "support-tickets",
    });
  }
  if (has("ai")) {
    const insights = getTenantAiInsights(tid);
    out.push({
      moduleId: "ai",
      moduleName: "AI",
      label: "AI Insights",
      value: insights.length,
      icon: Brain,
      tone: "positive",
      href: "ai-insights",
    });
  }
  return out;
}

