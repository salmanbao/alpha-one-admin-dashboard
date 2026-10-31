"use client";

/**
 * Tenant Usage & Overage (docs/21 CON-10) — audit finding #4 (HIGH).
 *
 * The dedicated overage-monitoring dashboard: per-tenant consumption —
 * accounts, API calls, storage, events/day — against the plan's
 * entitlements (CON-05 reads the same numbers for enforcement; BIL (V3)
 * bills from them). Each row shows usage vs the plan ceiling with a
 * utilisation bar; rows above the overage threshold (80%) get a warning
 * tone so the operator sees the tenant who is about to hit a limit (or
 * already has) before support does.
 *
 * Finding #4 increments:
 *  - a LIMIT FORECAST per tenant (deterministic 30-day trend → days
 *    until the soonest metric hits its ceiling) with a 'projected ≤90d'
 *    state, so APPROACHING limits are as visible as exceeded ones
 *  - proactive tools per flagged tenant: arm 80%/95% usage alerts and
 *    open a pre-filled 'Notify tenant' overage/upgrade notice
 *
 * Deterministic mock per tenant — no live counters in the frontend phase.
 */

import { useMemo, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import type { TenantContext } from "@/lib/platform/types";
import { soonestLimit } from "@/lib/platform/usage-forecast";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/platform/guards";
import { toast } from "@/hooks/use-toast";
import {
  UsageNoticeDialog,
  type UsageNoticePrefill,
} from "@/modules/super-admin/usage-notice-dialog";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  Gauge,
  HardDrive,
  Search,
  Send,
  Server,
  TrendingUp,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Deterministic per-tenant usage (mock)                               */
/* ------------------------------------------------------------------ */

/** Plan ceilings per CON-05 entitlements — the numbers CON-10 metering checks against. */
const PLAN_LIMITS: Record<
  TenantContext["plan"],
  { accounts: number; apiCallsPerDay: number; storageGb: number; eventsPerDay: number }
> = {
  starter: { accounts: 1_000, apiCallsPerDay: 100_000, storageGb: 50, eventsPerDay: 10_000 },
  growth: { accounts: 5_000, apiCallsPerDay: 1_000_000, storageGb: 250, eventsPerDay: 100_000 },
  scale: { accounts: 20_000, apiCallsPerDay: 5_000_000, storageGb: 1_000, eventsPerDay: 500_000 },
  enterprise: { accounts: 50_000, apiCallsPerDay: 10_000_000, storageGb: 2_000, eventsPerDay: 1_000_000 },
};

interface TenantUsage {
  tenantId: string;
  accounts: number;
  apiCallsPerDay: number;
  storageGb: number;
  eventsPerDay: number;
}

/** Deterministic pseudo-usage derived from the tenant id — stable across renders. */
const USAGE: TenantUsage[] = [
  { tenantId: "tenant-alpha", accounts: 1_842, apiCallsPerDay: 742_310, storageGb: 188, eventsPerDay: 61_240 },
  { tenantId: "tenant-beta", accounts: 918, apiCallsPerDay: 88_400, storageGb: 31, eventsPerDay: 8_120 },
  { tenantId: "tenant-gamma", accounts: 3_104, apiCallsPerDay: 1_284_900, storageGb: 302, eventsPerDay: 148_500 },
];

const pct = (used: number, limit: number) => Math.min(100, Math.round((used / limit) * 100));

const toneBar = (p: number) =>
  p >= 100 ? "bg-destructive" : p >= 80 ? "bg-amber-500" : "bg-emerald-500";

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : `${n}`;

/* ------------------------------------------------------------------ */
/* Row shape — metrics + limit forecast (finding #4)                   */
/* ------------------------------------------------------------------ */

type MetricKey = "accounts" | "apiCallsPerDay" | "storageGb" | "eventsPerDay";

interface RowMetric {
  key: MetricKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  used: number;
  limit: number;
  /** Utilisation %, capped at 100 for the bar. */
  p: number;
  fmt: (n: number) => string;
}

/** Plan tier order — for upgrade suggestions in tenant notices. */
const PLAN_TIERS: TenantContext["plan"][] = ["starter", "growth", "scale", "enterprise"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function UsageMeteringPage() {
  // Async seam (frontend-first): hydrate via the mock layer so the
  // loading skeleton + error/retry states are exercised; local
  // interactive state below stays authoritative once loaded.
  const {
    data: hydrated,
    loading,
    error,
    retry,
  } = useAsyncMock(() => mockAsync(() => true, { delayMs: 400 }), []);
  const { availableTenants, navigate } = usePlatform();
  const [query, setQuery] = useState("");

  /** Tenants with a usage row (onboarding tenants have no consumption yet). */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return USAGE.map((u) => {
      const tenant = availableTenants.find((t) => t.id === u.tenantId);
      if (!tenant) return null;
      const limits = PLAN_LIMITS[tenant.plan];
      const metrics: RowMetric[] = [
        { key: "accounts", label: "Accounts", icon: Users, used: u.accounts, limit: limits.accounts, p: pct(u.accounts, limits.accounts), fmt: (n) => n.toLocaleString() },
        { key: "apiCallsPerDay", label: "API calls/day", icon: Activity, used: u.apiCallsPerDay, limit: limits.apiCallsPerDay, p: pct(u.apiCallsPerDay, limits.apiCallsPerDay), fmt: compact },
        { key: "storageGb", label: "Storage", icon: HardDrive, used: u.storageGb, limit: limits.storageGb, p: pct(u.storageGb, limits.storageGb), fmt: (n) => `${n} GB` },
        { key: "eventsPerDay", label: "Events/day", icon: Server, used: u.eventsPerDay, limit: limits.eventsPerDay, p: pct(u.eventsPerDay, limits.eventsPerDay), fmt: compact },
      ];
      // finding #4 — which metric hits its ceiling soonest (0 = over now)
      const soon = soonestLimit(
        metrics.map((m) => ({ key: m.key, used: m.used, limit: m.limit, pctUsed: m.p })),
        tenant.id,
      );
      return {
        tenant,
        usage: u,
        limits,
        accountsPct: pct(u.accounts, limits.accounts),
        apiPct: pct(u.apiCallsPerDay, limits.apiCallsPerDay),
        storagePct: pct(u.storageGb, limits.storageGb),
        eventsPct: pct(u.eventsPerDay, limits.eventsPerDay),
        metrics,
        soon,
      };
    }).filter((r): r is NonNullable<typeof r> => {
      if (!r) return false;
      if (!q) return true;
      return (
        r.tenant.name.toLowerCase().includes(q) ||
        r.tenant.id.toLowerCase().includes(q) ||
        r.tenant.plan.toLowerCase().includes(q)
      );
    });
  }, [availableTenants, query]);

  const rowOver = (r: (typeof rows)[number]) => r.metrics.some((m) => m.p >= 100);
  const rowNear = (r: (typeof rows)[number]) => !rowOver(r) && r.metrics.some((m) => m.p >= 80);

  const overLimit = rows.filter(rowOver).length;
  // Per-ROW near/over test: the old global `overLimit === 0 &&` guard
  // zeroed this KPI whenever ANY tenant was over — hiding exactly the
  // approaching tenants this dashboard exists to surface (finding #4).
  const nearLimit = rows.filter(rowNear).length;
  const projected = rows.filter((r) => r.soon.days <= 90).length;

  // finding #4 — proactive notification system (arm 80%/95% alerts)
  const [alertsArmed, setAlertsArmed] = useState<Record<string, boolean>>({});
  const toggleAlerts = (tenantName: string) => {
    setAlertsArmed((prev) => {
      const next = !prev[tenantName];
      toast({
        title: next ? "Usage alerts armed" : "Usage alerts muted",
        description: next
          ? `${tenantName} will be notified at 80% and 95% of each plan limit.`
          : `No more limit notifications for ${tenantName}.`,
      });
      return { ...prev, [tenantName]: next };
    });
  };

  // finding #4 — tenant-facing overage/upgrade notice (editable, then sent)
  const [notice, setNotice] = useState<UsageNoticePrefill | null>(null);
  const notifyTenant = (r: (typeof rows)[number]) => {
    const m = r.metrics.find((x) => x.key === r.soon.key) ?? r.metrics[0];
    const unit = m.key === "storageGb" ? " GB" : "";
    const forecast =
      r.soon.days === 0
        ? "is already over the ceiling"
        : Number.isFinite(r.soon.days)
          ? `is forecast to reach its limit in ~${r.soon.days} days at ~${r.soon.growth}% monthly growth`
          : "is not projected to reach its limit at the current trend";
    let upgradeText = "";
    for (let i = PLAN_TIERS.indexOf(r.tenant.plan) + 1; i < PLAN_TIERS.length && !upgradeText; i++) {
      const nextTier = PLAN_TIERS[i];
      const nextLimit = PLAN_LIMITS[nextTier][m.key];
      if (nextLimit >= m.used * 2) {
        upgradeText = `Recommended: upgrade to the ${nextTier} plan for a ${compact(nextLimit)}${unit} ${m.label.toLowerCase()} ceiling.`;
      }
    }
    if (!upgradeText) {
      upgradeText = `You are on our top tier — our team will reach out to discuss bespoke ${m.label.toLowerCase()} limits.`;
    }
    setNotice({
      tenantName: r.tenant.name,
      recipient: `admin@${r.tenant.slug}.example`,
      subject: `${r.tenant.name}: ${m.label} at ${m.p}% of the ${r.tenant.plan} plan limit`,
      message: [
        `Hi ${r.tenant.name} team,`,
        ``,
        `${m.label} usage ${forecast}. Current usage: ${m.fmt(m.used)} of ${m.fmt(m.limit)}${unit} (${m.p}% of your plan allowance).`,
        ``,
        upgradeText,
        ``,
        `If the trend continues, usage above ${m.fmt(m.limit)}${unit} will be capped from the next billing cycle to protect service stability.`,
        ``,
        `— Platform Operations`,
      ].join("\n"),
    });
  };

  return (
    <Page>
      <PageHeader
        title="Tenant Usage & Overage"
        description="Current usage against plan limits — API calls, storage, events, accounts — with limit forecasts and proactive tools to notify tenants before overages hit (CON-10 feeds CON-05 enforcement and V3 billing)."
        icon={Gauge}
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={hydrated !== undefined}
          loadingLabel="Loading usage metering…"
        >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Tenants metered" value={rows.length} icon={Server} />
          <MetricCard label="Over plan limit" value={overLimit} icon={AlertTriangle} tone={overLimit > 0 ? "negative" : "positive"} />
          <MetricCard label="Near limit (≥80%)" value={nearLimit} icon={Activity} tone={nearLimit > 0 ? "warning" : "positive"} />
          <MetricCard
            label="Limit forecast ≤90d"
            value={projected}
            icon={TrendingUp}
            tone={projected > 0 ? "warning" : "positive"}
            deltaLabel="at the current 30-day trend"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No tenants match"
            description={query ? `Nothing matches "${query}".` : "No tenants are metered yet."}
            icon={Search}
          />
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const { tenant, metrics, soon } = row;
              const worst = Math.max(...metrics.map((m) => m.p));
              const flagged = worst >= 80 || soon.days <= 90;
              const soonMetric = metrics.find((m) => m.key === soon.key) ?? metrics[0];
              const armed = !!alertsArmed[tenant.name];
              const forecastText =
                soon.days === 0
                  ? `${soonMetric.label} is over its ceiling now`
                  : Number.isFinite(soon.days)
                    ? `${soonMetric.label} forecast to hit its ${soonMetric.fmt(soonMetric.limit)} limit in ~${soon.days} days (~${soon.growth}%/30d)`
                    : `No limit projected at the current trend (~${soon.growth}%/30d on ${soonMetric.label})`;
              return (
                <Card key={tenant.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{tenant.name}</p>
                        <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
                        <Badge
                          variant={
                            worst >= 100
                              ? "destructive"
                              : worst >= 80 || soon.days <= 90
                                ? "secondary"
                                : "default"
                          }
                          className="text-[9px]"
                        >
                          {worst >= 100
                            ? "over limit"
                            : worst >= 80
                              ? "near limit"
                              : soon.days <= 90
                                ? "projected ≤90d"
                                : "within plan"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {flagged ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs"
                              title="Send the tenant a pre-filled notice with utilization, forecast, and upgrade recommendation"
                              onClick={() => notifyTenant(row)}
                            >
                              <Send className="h-3 w-3" /> Notify tenant
                            </Button>
                            <Button
                              size="sm"
                              variant={armed ? "secondary" : "outline"}
                              className="h-7 gap-1 text-xs"
                              aria-pressed={armed}
                              title="Notify the tenant at 80% and 95% of each plan limit"
                              onClick={() => toggleAlerts(tenant.name)}
                            >
                              {armed ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                              {armed ? "Alerts armed" : "Arm alerts"}
                            </Button>
                          </>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => navigate("tenant-detail", { id: tenant.id })}>
                          Tenant detail <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* finding #4 — limit forecast (approaching indicator) */}
                    <p className="text-[11px] text-muted-foreground">
                      <TrendingUp className="mr-1 inline h-3 w-3 align-[-1px]" />
                      {forecastText}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {metrics.map((m) => (
                        <div key={m.label} className="space-y-1">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                            <m.icon className="h-3 w-3" /> {m.label}
                          </p>
                          <p className="text-sm font-semibold tabular-nums">
                            {m.fmt(m.used)}{" "}
                            <span className="text-[11px] font-normal text-muted-foreground">
                              / {m.fmt(m.limit)}
                            </span>
                          </p>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${toneBar(m.p)}`} style={{ width: `${m.p}%` }} />
                          </div>
                          <p
                            className={`text-[10px] tabular-nums ${
                              m.p >= 100 ? "text-destructive" : m.p >= 80 ? "text-amber-600" : "text-muted-foreground"
                            }`}
                          >
                            {m.p}% of plan limit
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {notice ? (
          <UsageNoticeDialog prefill={notice} onClose={() => setNotice(null)} />
        ) : null}

        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How metering works (CON-10)</p>
          <p className="mt-1">
            The console reads `GET /v1/console/metering` — per-tenant consumption counters from
            the platform services. Plan limits come from the tenant&apos;s entitlements (CON-05):
            when a counter crosses its ceiling, enforcement (feature gating, not hard stops) and
            billing (V3, CON-24) act on the same numbers. Values here are static mock data for
            the frontend phase.
          </p>
        </div>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}
