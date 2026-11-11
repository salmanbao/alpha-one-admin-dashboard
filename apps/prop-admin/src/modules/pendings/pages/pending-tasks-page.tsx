"use client";

/**
 * Pendings — Pending Tasks Dashboard (R2-04: truth pass)
 *
 * Operational hub surfacing what needs admin attention right now.
 * Counts are wired to effective KYC/payout statuses and subscribe to
 * store versions so decisions anywhere update the hub instantly.
 */

import { useEffect, useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveTermsInString } from "@/lib/platform/terminology";
import {
  getTenantAffiliates,
  getTenantAiInsights,
  getTenantChallenges,
  getTenantKyc,
  getTenantPayouts,
  getTenantTraders,
  type Challenge,
  type KycRecord,
  type Payout,
} from "@/lib/platform/mock-data";
import { effectiveKycStatus, useKycVersion } from "@/modules/kyc/kyc-store";
import { useLifecycleLog } from "@pfaas/lifecycle";
import { effectivePayoutStatus, usePayoutVersion } from "@/modules/payouts/payout-store";
import { setNavBadge } from "@/lib/platform/nav-badges";
import {
  Page,
  PageHeader,
  PageContent,
} from "@/components/platform/page";
import { BarSeries } from "@/components/platform/charts";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { isModuleEnabledSafe } from "@/components/platform/guard-utils";
import { cn } from "@/lib/utils";
import {
  useCrossAppIntake,
  type PurchaseRecord,
  type ProvisioningRecord,
  type EscalationRecord,
  type MethodChangeRecord,
} from "@/lib/platform/cross-app-intake";
import {
  ClipboardList,
  CheckCircle2,
  ShieldCheck,
  Activity,
  Clock,
  Users,
  ArrowRight,
  TrendingUp,
  Wallet,
  Calendar,
  Megaphone,
  AlertTriangle,
  Package,
  Server,
  ShieldAlert,
  CreditCard,
  RefreshCw,
} from "lucide-react";

interface SummaryCard {
  id: string;
  label: string;
  count: number;
  viewId: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  description: string;
}

/** Resolve the human label + owning module for a target view from the route registry. */
function resolveRouteInfo(viewId: string): { label: string; moduleId?: string } {
  for (const m of moduleRegistry.getAll()) {
    const route = (m.routes ?? []).find((r) => r.viewId === viewId);
    if (route) return { label: route.label, moduleId: route.module };
  }
  return { label: viewId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}

export function PendingTasksPage() {
  const { runtime, navigate, tenant } = usePlatform();
  const tid = runtime.tenant?.id ?? "platform";
  const currency = runtime.tenant?.currency ?? "USD";

  // Subscribe to decision stores so counts update instantly.
  const kycVersion = useKycVersion();
  const payoutVersion = usePayoutVersion();
  // R2-W3-01 / R3-06 — cross-app intake (trader submissions) arrives as
  // lifecycle events; subscribing here makes the hub counts move without a
  // reload once any queue kind lands.
  const lifecycleVersion = useLifecycleLog().length;
  const { purchases, provisioning, escalations, methodChanges } = useCrossAppIntake(tid);

  const challenges = useMemo(() => getTenantChallenges(tid), [tid]);
  const kyc = useMemo(
    () => getTenantKyc(tid).map((r) => ({ ...r, status: effectiveKycStatus(r) })),
    [tid, kycVersion, lifecycleVersion],
  );
  const payouts = useMemo(
    () => getTenantPayouts(tid).map((p) => ({ ...p, status: effectivePayoutStatus(p) })),
    [tid, payoutVersion, lifecycleVersion],
  );
  const affiliates = useMemo(() => getTenantAffiliates(tid), [tid]);
  const traders = useMemo(() => getTenantTraders(tid), [tid]);
  const insights = useMemo(() => getTenantAiInsights(tid), [tid]);

  // Compute counts from effective statuses / real fixtures / R3-06 cross-app intake.
  const phase1Passed = challenges.filter((c: Challenge) => c.status === "passed" && c.phase === "phase-1").length;
  const phase2Passed = challenges.filter((c: Challenge) => c.status === "passed" && c.phase === "phase-2").length;
  const kycReviews = kyc.filter((k: KycRecord) => k.status === "review" || k.status === "pending").length;
  const phaseVerifications = challenges.filter((c: Challenge) => c.status === "in-progress").length;
  const pendingWithdrawals = payouts.filter((p: Payout) => p.status === "pending").length;
  const affiliatePayouts = affiliates.filter((a) => a.commissionPending > 0).length;
  const purchaseCount = purchases.filter((p: PurchaseRecord) => p.status === "pending").length;
  const provisioningCount = provisioning.filter((p: ProvisioningRecord) => p.status !== "active").length;
  const escalationCount = escalations.filter((e: EscalationRecord) => e.status === "open").length;
  const methodCount = methodChanges.length;

  const cards: SummaryCard[] = useMemo(() => [
    {
      id: "phase-1",
      label: "Pass Verification Phase 1",
      count: phase1Passed,
      viewId: "challenges-passed",
      icon: CheckCircle2,
      description: "Traders awaiting phase-1 verification review",
    },
    {
      id: "phase-2",
      label: "Pass Verification Phase 2",
      count: phase2Passed,
      viewId: "challenges-passed",
      icon: CheckCircle2,
      description: "Traders awaiting phase-2 verification review",
    },
    {
      id: "kyc-reviews",
      label: "KYC Reviews",
      count: kycReviews,
      viewId: "kyc-reviews",
      icon: ShieldCheck,
      description: "Identity documents pending review",
    },
    {
      id: "phase-verification",
      label: "Phase Verification",
      count: phaseVerifications,
      viewId: "challenges-active",
      icon: Activity,
      description: "Active challenges being evaluated",
    },
    {
      id: "pending-withdrawals",
      label: "Pending Withdrawals",
      count: pendingWithdrawals,
      viewId: "payouts-pending",
      icon: Clock,
      description: "Payouts awaiting approval",
    },
    {
      id: "affiliate-payouts",
      label: "Affiliate Payouts",
      count: affiliatePayouts,
      viewId: "affiliates-commissions",
      icon: Users,
      description: "Affiliates with commission balance pending payout",
    },
    {
      id: "pending-purchases",
      label: "Pending Purchases",
      count: purchaseCount,
      viewId: "purchase-completed",
      icon: Package,
      description: "Challenge purchases awaiting provisioning",
    },
    {
      id: "provisioning-queues",
      label: "Provisioning Queues",
      count: provisioningCount,
      viewId: "account-provisioning",
      icon: Server,
      description: "Accounts being provisioned or waiting on credentials",
    },
    {
      id: "payout-escalations",
      label: "Payout Escalations",
      count: escalationCount,
      viewId: "payout-detail",
      icon: ShieldAlert,
      description: "Payouts requiring a second signature",
    },
    {
      id: "method-changes",
      label: "Method Changes",
      count: methodCount,
      viewId: "payout-methods-config",
      icon: CreditCard,
      description: "Method additions/removals by traders",
    },
  ], [phase1Passed, phase2Passed, kycReviews, phaseVerifications, pendingWithdrawals, affiliatePayouts, purchaseCount, provisioningCount, escalationCount, methodCount]);

  const resolvedCards = useMemo(() => cards.map((c) => ({
    ...c,
    label: resolveTermsInString(c.label, tenant),
    description: resolveTermsInString(c.description, tenant),
  })), [cards, tenant]);

  const totalPending = resolvedCards.reduce((s, c) => s + c.count, 0);

  // Keep nav badge in sync with the wired pending count (R2-04).
  useEffect(() => {
    setNavBadge("pending-tasks", totalPending);
  }, [totalPending]);

  // Resolve target-route info: human-readable labels + module ownership, so
  // cards for modules that are disabled in this tenant can be surfaced
  // honestly instead of navigating into a "module not enabled" dead end.
  const routeInfo = Object.fromEntries(resolvedCards.map((c) => [c.id, resolveRouteInfo(c.viewId)]));

  // Forecast chart — illustrative projection (demo), not historical data.
  const forecast = useMemo(() => {
    const days = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const pendingPayouts = payouts.filter((p) => p.status === "pending");
    const base = pendingPayouts.reduce((s, p) => s + p.amount, 0) || 4200;
    return days.map((day, i) => ({
      day,
      amount: Math.round(base * (0.55 + Math.sin(i / 2) * 0.18 + i * 0.05)),
    }));
  }, [payouts]);

  const forecastTotal = forecast.reduce((s, d) => s + d.amount, 0);

  // Recent activity feed — derived from effective KYC/payout state + new queues.
  const recentActivity = useMemo(() => {
    const items: { id: string; title: string; summary: string; time: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; tone: "info" | "warning" | "critical" | "success" }[] = [];

    const pending = payouts.filter((p) => p.status === "pending").slice(0, 2);
    for (const p of pending) {
      items.push({
        id: `pw-${p.id}`,
        title: `Withdrawal request from ${p.traderName}`,
        summary: `${formatCurrency(p.amount, p.currency)} via ${p.method} — awaiting approval`,
        time: timeAgo(new Date(p.createdAt)),
        icon: Wallet,
        tone: "warning",
      });
    }

    const kycPending = kyc.filter((k) => k.status === "review" || k.status === "pending").slice(0, 2);
    for (const k of kycPending) {
      items.push({
        id: `kyc-${k.id}`,
        title: `KYC submission from ${k.traderName}`,
        summary: `${k.documentType.replace("-", " ")} from ${k.country} — ${k.status}`,
        time: timeAgo(new Date(k.submittedAt)),
        icon: ShieldCheck,
        tone: "info",
      });
    }

    const purchasesPending = purchases.slice(0, 2);
    for (const p of purchasesPending) {
      items.push({
        id: `pur-${p.id}`,
        title: `Challenge purchase from ${p.traderName}`,
        summary:
          p.orderId
            ? `Order ${p.orderId} — ${formatCurrency(p.amount, p.currency)} awaiting provisioning`
            : `${formatCurrency(p.amount, p.currency)} awaiting provisioning`,
        time: timeAgo(new Date(p.createdAt)),
        icon: Package,
        tone: "info",
      });
    }

    const provisioningPending = provisioning.filter((p) => p.status !== "active").slice(0, 2);
    for (const p of provisioningPending) {
      const label =
        p.status === "in-progress"
          ? "in progress"
          : p.status === "credentials-delivered"
            ? "credentials delivered"
            : "active";
      items.push({
        id: `prov-${p.id}`,
        title: `Account provisioning — ${p.traderName}`,
        summary: `Status: ${label}${p.reason ? ` · ${p.reason}` : ""}`,
        time: timeAgo(new Date(p.createdAt)),
        icon: Server,
        tone: p.status === "active" ? "success" : "info",
      });
    }

    const escalationsPending = escalations.slice(0, 2);
    for (const e of escalationsPending) {
      items.push({
        id: `esc-${e.id}`,
        title: `Payout escalation — ${e.traderName}`,
        summary: `${e.payoutReference} — ${formatCurrency(e.amount, e.currency)} needs a second signature${e.reason ? ` · ${e.reason}` : ""}`,
        time: timeAgo(new Date(e.createdAt)),
        icon: ShieldAlert,
        tone: "critical",
      });
    }

    const methodChangesRecent = methodChanges.slice(0, 2);
    for (const m of methodChangesRecent) {
      items.push({
        id: `mnt-${m.id}`,
        title: `Payout method change — ${m.traderName}`,
        summary: `${m.action} ${m.method}${
          m.action === "primary-set" ? " (primary method set)" : ""
        }`,
        time: timeAgo(new Date(m.createdAt)),
        icon: CreditCard,
        tone: "info",
      });
    }

    for (const ins of insights.slice(0, 2)) {
      const toneMap: Record<string, "info" | "warning" | "critical" | "success"> = {
        info: "info",
        warning: "warning",
        critical: "critical",
        opportunity: "success",
      };
      items.push({
        id: `ins-${ins.id}`,
        title: ins.title,
        summary: ins.summary,
        time: timeAgo(new Date(ins.generatedAt)),
        icon: ins.severity === "critical" ? AlertTriangle : ins.severity === "warning" ? AlertTriangle : TrendingUp,
        tone: toneMap[ins.severity] ?? "info",
      });
    }

    return items.slice(0, 6);
  }, [payouts, kyc, insights, purchases, provisioning, escalations, methodChanges]);

  const onCardClick = (c: SummaryCard) => {
    if (c.viewId === "payout-detail") {
      navigate("payout-detail", { id: c.id === "payout-escalations" ? escalations[0]?.payoutReference ?? "" : "" });
    } else {
      navigate(c.viewId);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Pending Tasks"
        description="Operational hub — what needs admin attention right now."
        icon={ClipboardList}
      />
      <PageContent>
        {/* Top summary band */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Items Awaiting Action</p>
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums text-amber-800 dark:text-amber-300">{totalPending}</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              across {cards.length} categories
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Illustrative forecast (this week)</p>
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {formatCurrency(forecastTotal, currency)}
            </p>
            <p className="text-xs text-muted-foreground">demo projection — not historical data</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">{resolveTermsInString("Active Traders", tenant)}</p>
            </div>
            <p className="mt-1 text-3xl font-bold tabular-nums">{formatCompact(traders.length)}</p>
            <p className="text-xs text-muted-foreground">{traders.filter((t) => t.status === "active").length} currently trading</p>
          </div>
        </div>

        {/* Summary cards grid */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {resolvedCards.map((c) => {
            const isWarning = c.count > 0;
            const tone = isWarning ? "warning" : "success";
            const accentColor = tone === "warning" ? "#d97706" : "#059669";
            const info = routeInfo[c.id] ?? { label: c.viewId };
            const moduleEnabled = !info.moduleId || isModuleEnabledSafe(runtime, info.moduleId);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { if (moduleEnabled) onCardClick(c); }}
                disabled={!moduleEnabled}
                aria-disabled={!moduleEnabled}
                title={!moduleEnabled ? `Enable the "${info.moduleId}" module to manage this queue` : undefined}
                className={cn(
                  "group relative overflow-hidden rounded-lg border bg-card p-4 text-left transition-all",
                  moduleEnabled
                    ? "hover:shadow-md hover:-translate-y-0.5"
                    : "cursor-not-allowed opacity-55",
                  moduleEnabled && isWarning
                    ? "border-amber-500/40 hover:border-amber-500/60"
                    : moduleEnabled
                    ? "border-emerald-500/40 hover:border-emerald-500/60"
                    : "border-border",
                )}
                aria-label={
                  moduleEnabled
                    ? `${c.label}: ${c.count} pending. Click to view.`
                    : `${c.label}: ${c.count} pending. The ${info.moduleId} module is not enabled for this tenant.`
                }
              >
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: accentColor }} />
                <div className="flex items-start justify-between pl-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="rounded-md p-1.5"
                        style={{
                          background: isWarning
                            ? "rgba(217, 119, 6, 0.12)"
                            : "rgba(5, 150, 105, 0.12)",
                        }}
                      >
                        <c.icon
                          className="h-4 w-4"
                          style={{ color: accentColor }}
                        />
                      </div>
                      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        {c.label}
                      </p>
                    </div>
                    <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: accentColor }}>
                      {c.count}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </div>
                <div className="mt-3 pl-2 text-[11px] font-medium text-muted-foreground/80">
                  {!moduleEnabled
                    ? `Module "${info.moduleId}" not enabled`
                    : `Opens ${info.label} →`}
                </div>
              </button>
            );
          })}
        </div>

        {/* Forecast + Recent Activity side-by-side */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-medium">Withdrawal forecast (illustrative projection)</p>
            </div>
            <BarSeries
              data={forecast}
              xKey="day"
              yKey="amount"
              color="#4a7c59"
              height={220}
              formatValue={(v) => formatCurrency(v, currency)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Illustrative projection (demo): scaled from {pendingWithdrawals} pending withdrawal{pendingWithdrawals === 1 ? "" : "s"}. Not a historical distribution.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-medium">Recent Activity</p>
            </div>
            {recentActivity.length === 0 ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground">
                <Megaphone className="h-5 w-5" />
                <p className="text-xs">No recent activity.</p>
              </div>
            ) : (
              <ol className="relative flex flex-col gap-3">
                {recentActivity.map((a, i) => {
                  const Icon = a.icon;
                  const toneColor =
                    a.tone === "critical"
                      ? "#dc2626"
                      : a.tone === "warning"
                      ? "#d97706"
                      : a.tone === "success"
                      ? "#059669"
                      : "#4a7c59";
                  return (
                    <li key={a.id} className="relative flex gap-3">
                      {i < recentActivity.length - 1 ? (
                        <span
                          className="absolute left-[15px] top-7 h-[calc(100%-12px)] w-px bg-border"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div
                        className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
                        style={{ borderColor: `${toneColor}40`, background: `${toneColor}10` }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: toneColor }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{a.time}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{a.summary}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Counts reflect KYC and payout decisions in the current session (subscribed to live stores). Click a card to open
          the related queue. The withdrawal forecast is an illustrative demo projection, not a historical distribution.
        </p>
      </PageContent>
    </Page>
  );
}

/** Format a relative time string for the recent activity feed. */
function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
