"use client";

import { usePlatform } from "@/lib/platform/platform-context";
import { DashboardGrid, CustomizeDashboardDialog } from "@/components/platform/gridstack-dashboard";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { AttentionCenter } from "@/components/platform/attention-center";
import { LiveActivityFeedWidget } from "@/components/platform/live-activity-feed";
import { LiveEquityCurveWidget } from "@/components/platform/live-equity-curve";
import { LivePriceFeedWidget } from "@/components/platform/live-price-feed";
import { useLiveData, syncLiveStats } from "@/lib/platform/live-data";
import { LayoutDashboard, Sparkles, RefreshCw, Calendar, ShieldCheck, Users, Wallet, TrendingUp, Activity, AlertTriangle, Brain, Settings2, Radio } from "lucide-react";
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
import { AnimatedNumber } from "@/components/platform/animated-number";
import { makeTermResolver, plural, resolveTermsInString } from "@/lib/platform/terminology";
import { roles } from "@/lib/platform/mock-data";
import { useState, useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

export function OverviewPage() {
  const { runtime, tenant, user, navigate, setCustomizeOpen, hiddenWidgets } = usePlatform();
  const enabled = moduleRegistry.getEnabledModules(runtime);
  const live = useLiveData();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Revenue range — wired into the Analytics revenue KPI below (7/30 days,
  // matching the 30-day revenueSeries window). Hidden when analytics is off.
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
            {hasAnalytics ? (
              <div className="hidden items-center gap-1 rounded-md border bg-card p-0.5 text-xs sm:flex">
                {(["7", "30"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {r}d
                  </button>
                ))}
              </div>
            ) : null}
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

interface SummaryKpi {
  moduleId: string;
  moduleName: string;
  label: string;
  value: string | number;
  delta?: number;
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

