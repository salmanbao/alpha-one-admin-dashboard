"use client";

/**
 * Platform Overview Page — Global PFaaS dashboard.
 *
 * Stitch screen: platform_overview
 * Tier 1 — Platform Admin core dashboard with KPIs, tenant distribution,
 * module adoption, MRR trajectory, and operational intelligence.
 */

import { useMemo } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { StatusBadge, formatCurrency, formatCompact } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  Users,
  DollarSign,
  Package,
  Activity,
  AlertTriangle,
  Zap,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { tenants as allTenants, getTenantTraders } from "@/lib/platform/mock-data";
import { moduleRegistry } from "@/lib/platform/module-registry";

const tenantStatusTone = (s: string) =>
  s === "active"
    ? "success"
    : s === "trial"
      ? "info"
      : s === "suspended"
        ? "danger"
        : s === "terminated"
          ? "muted"
          : s === "invited"
            ? "info"
            : "warning";

export function PlatformOverviewPage() {
  const { navigate } = usePlatform();

  // KPIs
  const totalTraders = allTenants.reduce((s, t) => s + getTenantTraders(t.id).length, 0);
  const totalRevenue = allTenants.reduce((s, t) => s + (t.plan === "enterprise" ? 4900 : t.plan === "scale" ? 1900 : 890), 0);
  const allModules = moduleRegistry.getAll();
  const tenantFacingModules = allModules.filter((m) => m.manifest.id !== "super-admin");
  const activeTenants = allTenants.filter((t) => t.status === "active").length;

  // MRR trajectory data (12-month record)
  const mrrData = useMemo(() => [
    { month: "JUN 24", value: 210000 },
    { month: "AUG 24", value: 245000 },
    { month: "OCT 24", value: 288000 },
    { month: "DEC 24", value: 325000 },
    { month: "FEB 25", value: 365000 },
    { month: "APR 25", value: 410000 },
    { month: "MAY 25", value: 482500 },
  ], []);

  // Revenue breakdown
  const revenueBreakdown = useMemo(() => [
    { label: "Tier-1 Enterprise Base (L4 SLA)", value: 290000, pct: 60.1 },
    { label: "Active Trader Quota Overages", value: 118250, pct: 24.5 },
    { label: "Add-On Module ARR Run-Rate", value: 74250, pct: 15.4 },
  ], []);

  return (
    <Page>
      <PageHeader
        title="Platform Overview"
        description="Global PFaaS infrastructure health, multi-tenant billing analytics, and capability module penetration."
        icon={Activity}
        actions={
          <>
            <Button variant="outline" size="sm">
              <AlertTriangle className="mr-1 h-4 w-4" /> Subscribe to Platform Alerts
            </Button>
            <Button variant="outline" size="sm">
              <Package className="mr-1 h-4 w-4" /> Export Platform Report
            </Button>
            <Button size="sm" onClick={() => navigate("create-tenant")}>
              <Building2 className="mr-1 h-4 w-4" /> Create Tenant
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </>
        }
      />
      <PageContent>
        {/* Compliance badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="mr-1 h-3 w-3" /> SOC 2 Type II Certified
          </Badge>
          <Badge variant="outline" className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
            <Activity className="mr-1 h-3 w-3" /> SEC Rule 17a-4 WORM
          </Badge>
          <Badge variant="default" className="bg-primary text-primary-foreground">
            <Zap className="mr-1 h-3 w-3" /> Global Mesh: {activeTenants} Tenants Active
          </Badge>
        </div>

        {/* Incident banner (demo) */}
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Degraded Latency Notice — Node US-EAST-02 (cTrader Gateway)</p>
                <p className="text-sm mt-0.5">Failover routes actively mitigating via Equinix LD4 transit mesh. Zero order packet drops registered in the last 15 minutes.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="border-amber-500">+8.4ms jitter</Badge>
              <Button size="sm" variant="outline">View Routing Mesh</Button>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Active Prop Firms" value={`${activeTenants} / ${allTenants.length}`} delta={2} icon={Building2} tone="positive" />
          <MetricCard label="Total Active Traders" value={formatCompact(totalTraders)} delta={14} icon={Users} />
          <MetricCard label="Platform MRR" value={formatCurrency(totalRevenue * 100)} delta={18} icon={DollarSign} tone="positive" />
          <MetricCard label="Module Catalog" value={`${tenantFacingModules.length} / ${tenantFacingModules.length}`} delta={0} icon={Package} />
        </div>

        {/* MRR Trajectory Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">MRR Trajectory &amp; Subscription Revenue Breakdown</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Continuous growth trajectory across {allTenants.length} institutional PFaaS tenancies with tiered volume add-ons.</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">12-MONTH RECORD</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* MRR Chart */}
            <div className="h-40 w-full rounded-lg bg-muted/30 p-4">
              <svg className="h-full w-full" viewBox="0 0 800 160" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="var(--brand-primary)" stopOpacity="0.25" />
                    <stop offset="1" stopColor="var(--brand-primary)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Grid lines */}
                <line x1="0" y1="40" x2="800" y2="40" stroke="var(--muted-foreground)" strokeOpacity="0.2" strokeDasharray="4 4" />
                <line x1="0" y1="80" x2="800" y2="80" stroke="var(--muted-foreground)" strokeOpacity="0.2" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="800" y2="120" stroke="var(--muted-foreground)" strokeOpacity="0.2" strokeDasharray="4 4" />
                {/* Area */}
                <polygon
                  fill="url(#mrrGradient)"
                  points="0,140 57,132 114,125 171,115 228,102 285,92 342,84 400,71 457,58 514,42 571,28 628,12 685,12 742,12 800,12 800,155 0,155"
                />
                {/* Line */}
                <path
                  d="M0,140 Q57,132 114,125 T228,102 T342,84 T457,58 T571,28 L685,12 L800,12"
                  fill="none"
                  stroke="var(--brand-primary)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                {/* Data points */}
                {mrrData.map((d, i) => {
                  const x = (i / (mrrData.length - 1)) * 800;
                  const y = 155 - (d.value / 500000) * 140;
                  return (
                    <circle
                      key={d.month}
                      cx={x}
                      cy={y}
                      r={i === mrrData.length - 1 ? 6 : 4}
                      fill="var(--background)"
                      stroke="var(--brand-primary)"
                      strokeWidth="2.5"
                    />
                  );
                })}
              </svg>
            </div>
            {/* Month labels */}
            <div className="flex justify-between text-[11px] font-mono text-muted-foreground mt-2">
              {mrrData.map((d) => (
                <span key={d.month} className={d.month === "MAY 25" ? "font-bold text-primary" : ""}>
                  {d.month} (${Math.round(d.value / 1000)}k)
                </span>
              ))}
            </div>

            <Separator className="my-4" />

            {/* Revenue breakdown */}
            <div className="grid gap-4 sm:grid-cols-3">
              {revenueBreakdown.map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/50 p-4">
                  <p className="text-[11px] font-semibold text-muted-foreground">{item.label}</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-bold">{formatCurrency(item.value)}</span>
                    <span className="text-xs font-semibold text-primary">{item.pct.toFixed(1)}% Share</span>
                  </div>
                  <Progress value={item.pct} className="mt-3 h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Two-column grid: Tenant Distribution + Module Adoption */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Tenant Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Tenant Distribution &amp; Health</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Isolated sovereign schema clusters across LD4 and NY4.</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{activeTenants} Active</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allTenants.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{ background: t.branding.primaryColor }}
                      >
                        {t.branding.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{t.name}</span>
                          <Badge variant="outline" className="text-[10px] capitalize">{t.plan}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-medium text-foreground">{formatCompact(getTenantTraders(t.id).length)} traders</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>cTrader / MT5 Dual</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge tone={tenantStatusTone(t.status)}>{t.status}</StatusBadge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Module Adoption */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Module Adoption &amp; Capability</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Platform module distribution across active tenant fleets.</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{tenantFacingModules.length} Deployed</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tenantFacingModules.map((m) => {
                  const adopters = allTenants.filter((t) => t.enabledModules.includes(m.manifest.id)).length;
                  const pct = Math.round((adopters / allTenants.length) * 100);
                  const Icon = m.manifest.icon;
                  return (
                    <div key={m.manifest.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {Icon ? (
                          <div className="rounded-md bg-muted p-1.5">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ) : null}
                        <span className="text-sm truncate">{m.manifest.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">{adopters}/{allTenants.length}</span>
                        <Progress value={pct} className="w-16 h-1.5" />
                        <Badge variant="outline" className="text-[9px] capitalize">{pct}%</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContent>
    </Page>
  );
}
