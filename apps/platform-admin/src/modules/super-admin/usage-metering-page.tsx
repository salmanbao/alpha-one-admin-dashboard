"use client";

/**
 * Usage Metering (docs/21 CON-10).
 *
 * Per-tenant consumption — accounts, API calls, storage, events/day —
 * against the plan's entitlements (CON-05 reads the same numbers for
 * enforcement; BIL (V3) bills from them). Each row shows usage vs the
 * plan ceiling with a utilisation bar; rows above the overage threshold
 * (80%) get a warning tone so the operator sees the tenant who is about
 * to hit a limit (or already has) before support does.
 *
 * Deterministic mock per tenant — no live counters in the frontend phase.
 */

import { useMemo, useState } from "react";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { usePlatform } from "@/lib/platform/platform-context";
import type { TenantContext } from "@/lib/platform/types";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/platform/guards";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Gauge,
  HardDrive,
  Search,
  Server,
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
      return {
        tenant,
        usage: u,
        limits,
        accountsPct: pct(u.accounts, limits.accounts),
        apiPct: pct(u.apiCallsPerDay, limits.apiCallsPerDay),
        storagePct: pct(u.storageGb, limits.storageGb),
        eventsPct: pct(u.eventsPerDay, limits.eventsPerDay),
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

  const overLimit = rows.filter(
    (r) => r.accountsPct >= 100 || r.apiPct >= 100 || r.storagePct >= 100 || r.eventsPct >= 100,
  ).length;
  const nearLimit = rows.filter(
    (r) =>
      overLimit === 0 &&
      [r.accountsPct, r.apiPct, r.storagePct, r.eventsPct].some((p) => p >= 80),
  ).length;
  const totalApi = rows.reduce((s, r) => s + r.usage.apiCallsPerDay, 0);

  return (
    <Page>
      <PageHeader
        title="Usage metering"
        description="Per-tenant consumption against plan limits — accounts, API calls, storage, events/day (CON-10). These numbers feed plan enforcement (CON-05) and billing (V3)."
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
          <MetricCard label="Platform API calls/day" value={compact(totalApi)} icon={Gauge} />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No tenants match"
            description={query ? `Nothing matches "${query}".` : "No tenants are metered yet."}
            icon={Search}
          />
        ) : (
          <div className="space-y-4">
            {rows.map(({ tenant, usage, limits, accountsPct, apiPct, storagePct, eventsPct }) => {
              const metrics = [
                { label: "Accounts", icon: Users, used: usage.accounts, limit: limits.accounts, p: accountsPct, fmt: (n: number) => n.toLocaleString() },
                { label: "API calls/day", icon: Activity, used: usage.apiCallsPerDay, limit: limits.apiCallsPerDay, p: apiPct, fmt: compact },
                { label: "Storage", icon: HardDrive, used: usage.storageGb, limit: limits.storageGb, p: storagePct, fmt: (n: number) => `${n} GB` },
                { label: "Events/day", icon: Server, used: usage.eventsPerDay, limit: limits.eventsPerDay, p: eventsPct, fmt: compact },
              ];
              const worst = Math.max(accountsPct, apiPct, storagePct, eventsPct);
              return (
                <Card key={tenant.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{tenant.name}</p>
                        <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
                        <Badge
                          variant={worst >= 100 ? "destructive" : worst >= 80 ? "secondary" : "default"}
                          className="text-[9px]"
                        >
                          {worst >= 100 ? "over limit" : worst >= 80 ? "near limit" : "within plan"}
                        </Badge>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => navigate("tenant-detail", { id: tenant.id })}>
                        Tenant detail <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
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
