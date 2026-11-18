"use client";

import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarSeries, AreaSeries } from "@/components/platform/charts";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/platform/data-table";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { usePlatform } from "@/lib/platform/platform-context";
import {
  tenants as allTenants,
  getTenantTraders,
  getTenantAccounts,
  getTenantPayouts,
  hashStr,
} from "@/lib/platform/mock-data";
import type { TenantContext } from "@/lib/platform/types";
import { useAsyncMock, mockAsync } from "@/lib/platform/async-mock";
import { PageAsyncBoundary } from "@/components/platform/guards";
import { useRuns, FLOW_STAGES, type OnboardingFlow } from "@/lib/platform/onboarding-runs-store";
import { useTenants } from "@/lib/platform/tenant-store";
import { BarChart3, Users, Wallet, TrendingUp, DollarSign, Activity } from "lucide-react";

interface TenantMetric {
  tenant: TenantContext;
  traders: number;
  accounts: number;
  fundedAccounts: number;
  payoutVolume: number;
}

export function PlatformAnalyticsPage() {
  const { navigate } = usePlatform();
  // Async seam (frontend-first): cross-tenant metrics resolve via the mock layer.
  const {
    data: rows = [],
    loading,
    error,
    retry,
  } = useAsyncMock(
    () =>
      mockAsync(
        () =>
          allTenants
            .filter((t) => t.id !== "platform")
            .map((t): TenantMetric => {
              const traders = getTenantTraders(t.id).length;
              const accounts = getTenantAccounts(t.id).length;
              const fundedAccounts = getTenantAccounts(t.id).filter((a) => a.phase === "funded").length;
              const payoutVolume = getTenantPayouts(t.id)
                .filter((p) => p.status === "paid")
                .reduce((s, p) => s + p.amount, 0);
              return { tenant: t, traders, accounts, fundedAccounts, payoutVolume };
            }),
        { delayMs: 450 },
      ),
    [],
  );

  const totalTraders = rows.reduce((s, r) => s + r.traders, 0);
  const totalAccounts = rows.reduce((s, r) => s + r.accounts, 0);
  const totalFunded = rows.reduce((s, r) => s + r.fundedAccounts, 0);
  const totalPayouts = rows.reduce((s, r) => s + r.payoutVolume, 0);

  // Monthly revenue trend (deterministic)
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const n = 11 - i;
    const rev = Math.max(20000, Math.round(84000 + Math.sin(n / 2) * 22000 + n * 1400));
    return { date: `M-${n}`, value: rev };
  });

  // Tenant comparison bar chart
  const traderComparison = rows.map((r) => ({
    name: r.tenant.branding.initials,
    value: r.traders,
  }));

  const columns: Column<TenantMetric>[] = [
    { key: "tenant", header: "Tenant", cell: (r) => <span className="font-medium">{r.tenant.name}</span>, sortValue: (r) => r.tenant.name },
    { key: "traders", header: "Traders", cell: (r) => <span className="tabular-nums">{r.traders}</span>, sortValue: (r) => r.traders, numeric: true },
    { key: "accounts", header: "Accounts", cell: (r) => <span className="tabular-nums">{r.accounts}</span>, sortValue: (r) => r.accounts, numeric: true },
    { key: "funded", header: "Funded", cell: (r) => <span className="tabular-nums">{r.fundedAccounts}</span>, sortValue: (r) => r.fundedAccounts, numeric: true },
    { key: "payoutVolume", header: "Payout Volume", cell: (r) => <span className="tabular-nums text-xs">{formatCurrency(r.payoutVolume)}</span>, sortValue: (r) => r.payoutVolume, numeric: true },
    { key: "conversion", header: "Funded %", cell: (r) => <span className="tabular-nums text-xs">{r.accounts > 0 ? Math.round((r.fundedAccounts / r.accounts) * 100) : 0}%</span>, sortValue: (r) => r.accounts > 0 ? (r.fundedAccounts / r.accounts) * 100 : 0, numeric: true },
  ];

  return (
    <Page>
      <PageHeader
        title="Platform Analytics"
        description="Cross-tenant comparisons — growth, usage, revenue, and provider consumption."
        icon={BarChart3}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate("tenant-benchmarking")}>
              Tenant benchmarking
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("ai-usage-quota")}>
              AI usage & quotas
            </Button>
          </>
        }
      />
      <PageContent>
        <PageAsyncBoundary
          loading={loading}
          error={error}
          onRetry={retry}
          hasData={rows.length > 0}
          loadingLabel="Loading analytics…"
        >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Total Traders" value={formatCompact(totalTraders)} icon={Users} tone="positive" />
          <MetricCard label="Total Accounts" value={formatCompact(totalAccounts)} icon={Activity} />
          <MetricCard label="Funded Accounts" value={formatCompact(totalFunded)} icon={TrendingUp} tone="positive" />
          <MetricCard label="Payout Volume" value={formatCurrency(totalPayouts)} icon={Wallet} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Monthly revenue (12 months)</span></CardHeader>
            <CardContent>
              <AreaSeries data={monthlyRevenue} xKey="date" yKey="value" color="#0f766e" height={220} formatValue={(v) => formatCurrency(v)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><span className="text-sm font-medium">Trader count by tenant</span></CardHeader>
            <CardContent>
              <BarSeries data={traderComparison} xKey="name" yKey="value" color="#b45309" height={220} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Cross-tenant comparison</span></CardHeader>
          <CardContent>
            <DataTable columns={columns} data={rows} rowKey={(r) => r.tenant.id} searchableText={(r) => r.tenant.name} searchPlaceholder="Search tenants…" pageSize={20} emptyTitle="No data" emptyDescription="Tenant metrics will appear here." />
          </CardContent>
        </Card>

        <TimeToValueCard />

        {/* Useful questions section */}
        <Card>
          <CardHeader className="pb-2"><span className="text-sm font-medium">Key questions this view answers</span></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>· Which tenants are approaching their account limit?</li>
              <li>· Which tenants generate the most API traffic?</li>
              <li>· Which provider costs are increasing?</li>
              <li>· What is the funded-account conversion rate per tenant?</li>
              <li>· How does payout volume compare across tenants?</li>
              <li>· How long does onboarding take before the first firm goes live?</li>
            </ul>
          </CardContent>
        </Card>
        </PageAsyncBoundary>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Onboarding time to value — R9 W6 UC-P3                              */
/* ------------------------------------------------------------------ */

const median = (values: number[]): number => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
};

const fmtDur = (ms: number): string => {
  const h = ms / 3_600_000;
  if (h < 48) return `${Math.round(h)}h`;
  const d = h / 24;
  return d < 10 ? `${d.toFixed(1)}d` : `${Math.round(d)}d`;
};

const FLOW_LABEL: Record<OnboardingFlow, string> = {
  "create-tenant": "Create tenant",
  "go-live": "Go-live",
};

const Th = ({ children }: { children: string }) => (
  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{children}</th>
);

function TtvStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

/**
 * Median time per stage, drop-off list and days-to-first-live-firm —
 * fed by onboarding-runs-store stamps (both wizards) and the tenants'
 * createdAt/liveAt. Seeded rows are demo history, labeled (Demo).
 */
function TimeToValueCard() {
  const runs = useRuns();
  const tenants = useTenants();

  // Median time per stage = middle of entry → next-entry durations.
  const stageRows: { flow: OnboardingFlow; label: string; medianMs: number; n: number }[] = [];
  for (const flow of Object.keys(FLOW_STAGES) as OnboardingFlow[]) {
    const stages = FLOW_STAGES[flow];
    for (let i = 0; i < stages.length - 1; i++) {
      const durs: number[] = [];
      for (const run of runs) {
        if (run.flow !== flow) continue;
        const start = i === 0 ? run.startedAt : run.stamps[stages[i].id];
        const end = run.stamps[stages[i + 1].id];
        if (!start || !end) continue;
        const ms = Date.parse(end) - Date.parse(start);
        if (Number.isFinite(ms) && ms >= 0) durs.push(ms);
      }
      if (durs.length > 0) {
        stageRows.push({ flow, label: stages[i].label, medianMs: median(durs), n: durs.length });
      }
    }
  }

  // Drop-offs: unfinished runs the operator actually advanced in — a
  // wizard visit that never stamps a stage transition is not one.
  const dropRows = runs
    .filter((r) => !r.finishedAt && Object.keys(r.stamps).length > 0)
    .map((r) => {
      const stages = FLOW_STAGES[r.flow];
      const entered = stages.filter((s, i) => i === 0 || Boolean(r.stamps[s.id]));
      const times = [r.startedAt, ...Object.values(r.stamps)];
      const lastAt = times.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
      return {
        run: r,
        stopped: entered[entered.length - 1],
        lastAt,
        idleDays: Math.floor((Date.now() - Date.parse(lastAt)) / 86_400_000),
      };
    })
    .sort((a, b) => Date.parse(a.lastAt) - Date.parse(b.lastAt));

  // Days to first live firm — per tenant (createdAt → liveAt) plus the
  // firm that went live first (earliest liveAt wins the headline).
  const liveRows = tenants
    .filter((t) => t.id !== "platform")
    .map((t) => ({
      tenant: t,
      days: t.liveAt
        ? Math.max(0, Math.round((Date.parse(t.liveAt) - Date.parse(t.createdAt)) / 86_400_000))
        : null,
    }))
    .sort((a, b) => Date.parse(a.tenant.createdAt) - Date.parse(b.tenant.createdAt));
  const firstLive = liveRows
    .filter((r) => r.days !== null)
    .sort((a, b) => Date.parse(String(a.tenant.liveAt)) - Date.parse(String(b.tenant.liveAt)))[0];

  const finishedGoLive = runs
    .filter((r) => r.flow === "go-live" && r.finishedAt)
    .map((r) => Date.parse(String(r.finishedAt)) - Date.parse(r.startedAt))
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  const medianGoLive = finishedGoLive.length > 0 ? median(finishedGoLive) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <span className="text-sm font-medium">Onboarding time to value</span>
        <Badge variant="outline" className="text-[10px]">(Demo)</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Stage stamps are recorded live by the Create tenant and Go-live wizards as operators
          advance; seeded history is demo data derived from the seed tenants.
        </p>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <TtvStat
            label="Days to first live firm"
            value={firstLive ? `${firstLive.days}d` : "—"}
            sub={firstLive ? firstLive.tenant.name : "No firm has gone live yet"}
          />
          <TtvStat
            label="Median time to live"
            value={medianGoLive === null ? "—" : fmtDur(medianGoLive)}
            sub={`${finishedGoLive.length} completed go-live run${finishedGoLive.length === 1 ? "" : "s"}`}
          />
          <TtvStat
            label="Open drop-offs"
            value={String(dropRows.length)}
            sub="runs stalled before going live"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium">Median time per stage</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <Th>Flow</Th><Th>Stage</Th><Th>Median time</Th><Th>Runs</Th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm text-muted-foreground">
                        No stage stamps yet — advance either wizard to record one.
                      </td>
                    </tr>
                  ) : (
                    stageRows.map((r) => (
                      <tr key={`${r.flow}-${r.label}`} className="border-b last:border-0">
                        <td className="px-4 py-2 text-sm">{FLOW_LABEL[r.flow]}</td>
                        <td className="px-4 py-2 text-sm">{r.label}</td>
                        <td className="px-4 py-2 text-sm font-semibold">{fmtDur(r.medianMs)}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{r.n}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium">Drop-off list</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <Th>Firm</Th><Th>Stopped at</Th><Th>Last activity</Th>
                  </tr>
                </thead>
                <tbody>
                  {dropRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm text-muted-foreground">
                        No stalled onboarding runs.
                      </td>
                    </tr>
                  ) : (
                    dropRows.map((d) => (
                      <tr key={d.run.id} className="border-b last:border-0">
                        <td className="px-4 py-2 text-sm">
                          <span className="flex items-center gap-1.5">
                            {d.run.tenantName || "Untitled draft"}
                            {d.run.seeded ? (
                              <Badge variant="outline" className="text-[9px]">(Demo)</Badge>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {d.stopped.label}
                          <span className="text-muted-foreground"> · {FLOW_LABEL[d.run.flow]}</span>
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {new Date(d.lastAt).toLocaleDateString()}
                          <span className="text-muted-foreground">
                            {" · "}
                            {d.idleDays <= 0 ? "today" : `${d.idleDays}d idle`}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium">Days to first live firm (per tenant)</p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <Th>Tenant</Th><Th>Plan</Th><Th>Created</Th><Th>Live</Th><Th>Days to live</Th>
                </tr>
              </thead>
              <tbody>
                {liveRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm text-muted-foreground">
                      No tenants yet.
                    </td>
                  </tr>
                ) : (
                  liveRows.map(({ tenant: t, days }) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-sm font-medium">{t.name}</td>
                      <td className="px-4 py-2 text-sm capitalize">{t.plan}</td>
                      <td className="px-4 py-2 text-sm">{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-sm">
                        {t.liveAt ? (
                          new Date(t.liveAt).toLocaleDateString()
                        ) : (
                          <span className="text-muted-foreground">Not live yet</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm font-semibold">
                        {days === null ? <span className="text-muted-foreground">—</span> : `${days}d`}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Methodology — a stage stamp is written the moment an operator enters that stage (the
          first stage is the wizard opening), so each median spans entry → next entry across
          every recorded run; the terminal stage (“Tenant created” / “Firm live”) is a
          completion event and gets no duration row. Seeded history is demo data laid out to
          end on each seed tenant’s createdAt / liveAt, so days-to-live reconciles with it.
          Days to live = createdAt → liveAt, and liveAt is stamped once, on first activation by
          the go-live wizard. A wizard visit that never advances past the first stage is not
          counted as a drop-off.
        </p>
      </CardContent>
    </Card>
  );
}
