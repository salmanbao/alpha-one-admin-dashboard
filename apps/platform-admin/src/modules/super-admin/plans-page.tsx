"use client";

/**
 * Plans & Subscription Management — audit #3 fix #1 (CRITICAL).
 *
 * The monetization control panel the platform was missing: CRUD for the
 * platform's own pricing tiers (Starter → Enterprise), with per-plan
 * features, limits (traders, API calls, storage, events), pricing,
 * trial configuration, tenant↔plan assignment, usage-vs-limit meters,
 * and upgrade/downgrade paths. Frontend-first — plans live in component
 * state (edits are session-scoped demo mutations with toasts).
 */

import { useMemo, useState } from "react";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/components/platform/status";
import { tenants as allTenants, getTenantTraders } from "@/lib/platform/mock-data";
import { toast } from "@/hooks/use-toast";
import type { TenantContext } from "@/lib/platform/types";
import { usageGrowth30d, daysToLimit } from "@/lib/platform/usage-forecast";
import {
  UsageNoticeDialog,
  type UsageNoticePrefill,
} from "@/modules/super-admin/usage-notice-dialog";
import {
  CreditCard,
  DollarSign,
  Users,
  Sparkles,
  Pencil,
  Plus,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Check,
  X,
  FlaskConical,
  AlertTriangle,
  ShieldCheck,
  TrendingUp,
  Bell,
  BellRing,
  Lock,
  Send,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Plan model                                                          */
/* ------------------------------------------------------------------ */

type PlanId = TenantContext["plan"];

interface PlanLimits {
  traders: number;
  apiCallsPerDay: number;
  storageGb: number;
  eventsPerDay: number;
}

interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number; // platform charges the tenant this /mo
  trialDays: number; // 0 = no trial
  limits: PlanLimits;
  features: string[];
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "New prop firms validating their first challenge program.",
    priceMonthly: 890,
    trialDays: 14,
    limits: { traders: 1_000, apiCallsPerDay: 100_000, storageGb: 50, eventsPerDay: 10_000 },
    features: ["Challenges & payouts", "Risk monitoring (basic)", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Scaling firms with active marketing and affiliate programs.",
    priceMonthly: 1_900,
    trialDays: 14,
    limits: { traders: 5_000, apiCallsPerDay: 1_000_000, storageGb: 250, eventsPerDay: 100_000 },
    features: [
      "Everything in Starter",
      "Affiliates & marketing",
      "Advanced risk analytics",
      "White-label branding",
      "Priority support",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "High-volume operations with API and SIEM integrations.",
    priceMonthly: 4_900,
    trialDays: 30,
    limits: { traders: 20_000, apiCallsPerDay: 5_000_000, storageGb: 1_000, eventsPerDay: 500_000 },
    features: [
      "Everything in Growth",
      "Full API access",
      "SIEM / audit exports",
      "Custom contracts",
      "Dedicated CSM",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Bespoke contracts, SSO, and unlimited scale.",
    priceMonthly: 12_000,
    trialDays: 30,
    limits: { traders: 50_000, apiCallsPerDay: 10_000_000, storageGb: 2_000, eventsPerDay: 1_000_000 },
    features: [
      "Everything in Scale",
      "SAML / OIDC SSO",
      "Unlimited branding seats",
      "99.9% SLA + named engineer",
      "Custom data residency",
    ],
  },
];

const PLAN_TONE: Record<PlanId, string> = {
  starter: "#6b6358",
  growth: "#0f766e",
  scale: "#b45309",
  enterprise: "#7c3aed",
};

/* Deterministic per-tenant usage vs plan limits (mirrors usage-metering). */
function tenantUsage(tenantId: string) {
  const seed = tenantId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    traders: 200 + (seed % 900),
    apiCallsPerDay: 40_000 + (seed % 800_000),
    storageGb: 12 + (seed % 200),
    eventsPerDay: 3_000 + (seed % 90_000),
  };
}

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : `${n}`;

const pct = (used: number, limit: number) => Math.min(100, Math.round((used / limit) * 100));

const usageTone = (p: number) => (p >= 100 ? "bg-destructive" : p >= 80 ? "bg-amber-500" : "bg-emerald-500");

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);

  // Tenants on file (exclude the internal platform pseudo-tenant).
  const tenantRows = useMemo(
    () => allTenants.filter((t) => t.id !== "platform"),
    [],
  );

  const mrr = tenantRows.reduce((s, t) => s + (plans.find((p) => p.id === t.plan)?.priceMonthly ?? 0), 0);
  const trialCount = plans.filter((p) => p.trialDays > 0).length;
  const tenantsOnScalePlus = tenantRows.filter((t) => t.plan === "scale" || t.plan === "enterprise").length;

  const savePlan = (plan: Plan) => {
    setPlans((prev) => {
      const exists = prev.some((p) => p.id === plan.id);
      return exists ? prev.map((p) => (p.id === plan.id ? plan : p)) : [...prev, plan];
    });
    setEditing(null);
    setCreating(false);
    toast({ title: "Plan saved", description: `${plan.name} — ${formatCurrency(plan.priceMonthly)}/mo, ${plan.trialDays}-day trial.` });
  };

  return (
    <Page>
      <PageHeader
        title="Plans & Subscriptions"
        description="Pricing tiers, feature entitlements, limits, and tenant plan assignment."
        icon={CreditCard}
        actions={
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New plan
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Plan MRR" value={formatCurrency(mrr)} icon={DollarSign} tone="positive" />
          <MetricCard label="Active plans" value={plans.length} icon={CreditCard} />
          <MetricCard label="Trials enabled" value={trialCount} icon={FlaskConical} />
          <MetricCard label="Tenants on Scale+" value={tenantsOnScalePlus} icon={Users} />
        </div>

        {/* Overage monitoring — audit #4 fix #4 (MEDIUM): proactive limit watch */}
        <OverageMonitoringPanel tenantRows={tenantRows} plans={plans} />

        {/* Plan cards — pricing, trial, limits, feature list */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const tenantsOnPlan = tenantRows.filter((t) => t.plan === plan.id);
            const traderTotal = tenantsOnPlan.reduce((s, t) => s + getTenantTraders(t.id).length, 0);
            return (
              <Card key={plan.id} className="relative flex flex-col gap-3 p-4">
                <span
                  className="absolute inset-x-0 top-0 h-1 rounded-t-lg"
                  style={{ background: PLAN_TONE[plan.id] }}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-2 pt-2">
                  <div>
                    <p className="font-semibold" style={{ color: PLAN_TONE[plan.id] }}>
                      {plan.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    aria-label={`Edit ${plan.name} plan`}
                    onClick={() => setEditing(plan)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline text-2xl font-bold tabular-nums">
                    {formatCurrency(plan.priceMonthly)}
                  </span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {plan.trialDays > 0 ? `${plan.trialDays}-day trial` : "No trial"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    ≤{compact(plan.limits.traders)} traders
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {tenantsOnPlan.length} tenant{tenantsOnPlan.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <Separator />
                <ul className="space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3 w-3 shrink-0" style={{ color: PLAN_TONE[plan.id] }} />
                      {f}
                    </li>
                  ))}
                </ul>
                {tenantsOnPlan.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {compact(traderTotal)} {traderTypeLabel(traderTotal)} across {tenantsOnPlan.length} tenant
                    {tenantsOnPlan.length === 1 ? "" : "s"}
                  </p>
                ) : (
                  <p className="text-[11px] italic text-muted-foreground/70">No tenants on this plan yet</p>
                )}
              </Card>
            );
          })}
        </div>

        {/* Tenant ↔ plan assignment + usage vs limits */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">Tenant plans &amp; usage vs limits</span>
            <p className="text-xs text-muted-foreground">
              Usage meters compare current consumption against the assigned plan&apos;s ceilings — amber at 80%, red at limit.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenantRows.map((t) => {
              const plan = plans.find((p) => p.id === t.plan);
              if (!plan) return null;
              const usage = tenantUsage(t.id);
              const meters: Array<{ label: string; used: number; limit: number }> = [
                { label: "Traders", used: usage.traders, limit: plan.limits.traders },
                { label: "API calls/day", used: usage.apiCallsPerDay, limit: plan.limits.apiCallsPerDay },
                { label: "Storage", used: usage.storageGb, limit: plan.limits.storageGb },
                { label: "Events/day", used: usage.eventsPerDay, limit: plan.limits.eventsPerDay },
              ];
              return (
                <div key={t.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                        style={{ borderColor: PLAN_TONE[t.plan], color: PLAN_TONE[t.plan] }}
                      >
                        {plan.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(plan.priceMonthly)}/mo
                        {plan.trialDays > 0 ? ` · ${plan.trialDays}-day trial` : ""}
                      </span>
                    </div>
                    <PlanChangeButtons tenant={t} plans={plans} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {meters.map((m) => {
                      const p = pct(m.used, m.limit);
                      return (
                        <div key={m.label} className="space-y-1">
                          <div className="flex items-baseline justify-between text-[11px]">
                            <span className="text-muted-foreground">{m.label}</span>
                            <span className="tabular-nums font-medium">
                              {compact(m.used)} / {compact(m.limit)}
                            </span>
                          </div>
                          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                            <span
                              className={`absolute inset-y-0 left-0 rounded-full ${usageTone(p)}`}
                              style={{ width: `${p}%` }}
                              role="progressbar"
                              aria-valuenow={p}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${m.label}: ${p}% of plan limit`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Plan comparison matrix */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">Plan comparison</span>
            <p className="text-xs text-muted-foreground">
              Limits and pricing across all tiers. Tenants are billed monthly; upgrade/downgrade takes effect at the next billing cycle.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Plan</th>
                    <th className="py-2 px-4 font-medium">Price /mo</th>
                    <th className="py-2 px-4 font-medium">Trial</th>
                    <th className="py-2 px-4 font-medium">Traders</th>
                    <th className="py-2 px-4 font-medium">API calls/day</th>
                    <th className="py-2 px-4 font-medium">Storage</th>
                    <th className="py-2 pl-4 font-medium">Events/day</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {plans.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="py-2 pr-4">
                        <span className="font-medium" style={{ color: PLAN_TONE[p.id] }}>
                          {p.name}
                        </span>
                      </td>
                      <td className="py-2 px-4 tabular-nums">{formatCurrency(p.priceMonthly)}</td>
                      <td className="py-2 px-4">{p.trialDays > 0 ? `${p.trialDays} days` : "—"}</td>
                      <td className="py-2 px-4 tabular-nums">{compact(p.limits.traders)}</td>
                      <td className="py-2 px-4 tabular-nums">{compact(p.limits.apiCallsPerDay)}</td>
                      <td className="py-2 px-4 tabular-nums">{compact(p.limits.storageGb)} GB</td>
                      <td className="py-2 pl-4 tabular-nums">{compact(p.limits.eventsPerDay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <PlanDialog
          plan={creating ? null : editing}
          open={creating || editing !== null}
          onOpenChange={(o) => {
            if (!o) {
              setEditing(null);
              setCreating(false);
            }
          }}
          onSave={savePlan}
        />
      </PageContent>
    </Page>
  );
}

function traderTypeLabel(n: number) {
  return Math.abs(n) === 1 ? "trader" : "traders";
}

/* Upgrade/downgrade buttons per tenant — demo mutation + toast. */
function PlanChangeButtons({ tenant, plans }: { tenant: TenantContext; plans: Plan[] }) {
  const order: PlanId[] = ["starter", "growth", "scale", "enterprise"];
  const idx = order.indexOf(tenant.plan);
  const change = (dir: 1 | -1) => {
    const target = plans.find((p) => p.id === order[idx + dir]);
    if (!target) return;
    toast({
      title: `Plan change scheduled`,
      description: `${tenant.name}: ${tenant.plan} → ${target.id} at the next billing cycle.`,
    });
  };
  return (
    <div className="flex gap-1">
      {idx > 0 ? (
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => change(-1)}>
          <ArrowDown className="h-3 w-3" /> Downgrade
        </Button>
      ) : null}
      {idx < order.length - 1 ? (
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => change(1)}>
          <ArrowUp className="h-3 w-3" /> Upgrade
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overage monitoring — audit #4 fix #4 (MEDIUM) + finding #1 (HIGH)    */
/*                                                                     */
/* The usage meters below are reactive (current state only). This      */
/* panel is proactive: it projects each tenant's usage trend against   */
/* their plan ceilings, flags tenants that are over-limit, ≥80%, or    */
/* projected to hit a limit within 90 days, and offers three quick     */
/* actions per flagged tenant — upgrade to the smallest tier that      */
/* clears the binding metric, enforce the cap (throttle at the plan    */
/* ceiling), or arm 80%/95% usage-alert notifications so overages are  */
/* caught before they impact service.                                  */
/* ------------------------------------------------------------------ */

/** Plan tier order for upgrade suggestions. */
const PLAN_ORDER: PlanId[] = ["starter", "growth", "scale", "enterprise"];

const METRIC_LABELS: Array<{ key: keyof PlanLimits; label: string }> = [
  { key: "traders", label: "Traders" },
  { key: "apiCallsPerDay", label: "API calls/day" },
  { key: "storageGb", label: "Storage" },
  { key: "eventsPerDay", label: "Events/day" },
];

/** Forecast math now lives in lib/platform/usage-forecast.ts (finding #4)
 *  so this panel and the Tenant Usage & Overage dashboard project the
 *  same trend from the same formulas. */

interface OverageMetric {
  key: keyof PlanLimits;
  label: string;
  used: number;
  limit: number;
  pctUsed: number; // uncapped — can exceed 100 when over the ceiling
  growth: number;
  days: number;
}

interface TenantOverage {
  tenant: TenantContext;
  plan: Plan;
  status: "critical" | "approaching";
  binding: OverageMetric; // the metric closest to its ceiling
  upgrade: { plan: Plan; headroomPct: number } | null; // smallest tier that clears it
}

function OverageMonitoringPanel({
  tenantRows,
  plans,
}: {
  tenantRows: TenantContext[];
  plans: Plan[];
}) {
  const [alertsArmed, setAlertsArmed] = useState<Record<string, boolean>>({});
  // finding #4 — tenant-facing notice (mounted fresh per open)
  const [notice, setNotice] = useState<UsageNoticePrefill | null>(null);

  const { flagged, healthy, upsellMrr } = useMemo(() => {
    const flagged: TenantOverage[] = [];
    const healthy: TenantContext[] = [];
    let upsellMrr = 0;

    for (const t of tenantRows) {
      const plan = plans.find((p) => p.id === t.plan);
      if (!plan) continue;
      const usage = tenantUsage(t.id);
      const metrics: OverageMetric[] = METRIC_LABELS.map(({ key, label }) => {
        const used = usage[key];
        const limit = plan.limits[key];
        const growth = usageGrowth30d(t.id, key);
        return {
          key,
          label,
          used,
          limit,
          pctUsed: Math.round((used / limit) * 100),
          growth,
          days: daysToLimit(used, limit, growth),
        };
      });

      const overNow = metrics.filter((m) => m.pctUsed >= 100);
      const approaching = metrics.filter((m) => m.pctUsed >= 80 || m.days <= 90);

      if (overNow.length === 0 && approaching.length === 0) {
        healthy.push(t);
        continue;
      }

      // Binding metric: worst current overage, else the soonest projected limit.
      const binding =
        overNow.sort((a, b) => b.pctUsed - a.pctUsed)[0] ??
        approaching.sort((a, b) => a.days - b.days)[0];

      // Smallest upgrade tier that gives the binding metric ≥2× headroom.
      const curIdx = PLAN_ORDER.indexOf(t.plan);
      let upgrade: TenantOverage["upgrade"] = null;
      for (let i = curIdx + 1; i < PLAN_ORDER.length && !upgrade; i++) {
        const candidate = plans.find((p) => p.id === PLAN_ORDER[i]);
        if (!candidate) continue;
        const headroomPct = Math.round((candidate.limits[binding.key] / binding.used) * 100) - 100;
        if (headroomPct >= 100) upgrade = { plan: candidate, headroomPct };
      }

      flagged.push({
        tenant: t,
        plan,
        status: overNow.length > 0 ? "critical" : "approaching",
        binding,
        upgrade,
      });
      upsellMrr += plan.priceMonthly;
    }

    flagged.sort((a, b) => (a.status === b.status ? 0 : a.status === "critical" ? -1 : 1));
    return { flagged, healthy, upsellMrr };
  }, [tenantRows, plans]);

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

  const scheduleUpgrade = (tenantName: string, from: string, to: string) => {
    toast({
      title: "Plan change scheduled",
      description: `${tenantName}: ${from} → ${to} at the next billing cycle.`,
    });
  };

  /** Enforcement path (finding #1): cap the binding metric instead of upgrading. */
  const enforceLimit = (tenantName: string, metric: string, limit: string) => {
    toast({
      title: "Limit enforcement scheduled",
      description: `${tenantName}: ${metric} hard-capped at ${limit} from the next billing cycle — usage above the ceiling is throttled until the plan is upgraded.`,
      variant: "destructive",
    });
  };

  /**
   * finding #4 (HIGH) — tenant-facing notification tool: pre-filled
   * overage notice carrying utilization, forecast, and the upgrade
   * recommendation, editable before sending.
   */
  const notifyTenant = (f: TenantOverage) => {
    const b = f.binding;
    const unit = b.key === "storageGb" ? " GB" : "";
    const forecast =
      b.days === 0
        ? "is already over the ceiling"
      : Number.isFinite(b.days)
        ? `is forecast to reach its limit in ~${b.days} days at the current ~${b.growth}% monthly trend`
        : "is not projected to reach its limit at the current trend";
    const upgradeText = f.upgrade
      ? f.upgrade.plan.priceMonthly > f.plan.priceMonthly
        ? `Recommended: upgrade to the ${f.upgrade.plan.name} plan for ${f.upgrade.headroomPct}%+ ${b.label.toLowerCase()} headroom (+${formatCurrency(f.upgrade.plan.priceMonthly - f.plan.priceMonthly)}/mo).`
        : `Recommended: upgrade to the ${f.upgrade.plan.name} plan for ${f.upgrade.headroomPct}%+ ${b.label.toLowerCase()} headroom.`
      : `You are on our top tier — our team will reach out to negotiate bespoke ${b.label.toLowerCase()} limits before enforcement.`;
    setNotice({
      tenantName: f.tenant.name,
      recipient: `admin@${f.tenant.slug}.example`,
      subject: `${f.tenant.name}: ${b.label} at ${b.pctUsed}% of the ${f.plan.name} plan limit`,
      message: [
        `Hi ${f.tenant.name} team,`,
        ``,
        `${b.label} usage ${forecast}. Current usage: ${compact(b.used)}${unit} of ${compact(b.limit)}${unit} (${b.pctUsed}% of your ${f.plan.name} plan).`,
        ``,
        upgradeText,
        ``,
        `If the trend continues, usage above ${compact(b.limit)}${unit} will be capped from the next billing cycle to protect service stability.`,
        ``,
        `— Platform Operations`,
      ].join("\n"),
    });
  };

  const criticalCount = flagged.filter((f) => f.status === "critical").length;
  const approachingCount = flagged.length - criticalCount;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Plan overage monitoring</span>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                criticalCount > 0 ? "bg-destructive/10 text-destructive" : "text-muted-foreground"
              }`}
            >
              <AlertTriangle className="h-3 w-3" /> {criticalCount} over limit
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                approachingCount > 0 ? "bg-amber-500/10 text-amber-600" : "text-muted-foreground"
              }`}
            >
              <TrendingUp className="h-3 w-3" /> {approachingCount} approaching
            </span>
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> {healthy.length} healthy
            </span>
            {upsellMrr > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {formatCurrency(upsellMrr)}/mo upsell pipeline
              </span>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Usage trends projected against plan ceilings — tenants are flagged at ≥80% utilization or
          when a limit is forecast within 90 days, so overages are addressed before they impact service.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {flagged.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            All tenants are comfortably within their plan limits — no upgrades or alerts needed right now.
          </div>
        ) : (
          flagged.map((f) => {
            const b = f.binding;
            const isCritical = f.status === "critical";
            const armed = !!alertsArmed[f.tenant.name];
            const barPct = Math.min(100, b.pctUsed);
            return (
              <div
                key={f.tenant.id}
                className={`rounded-lg border p-3 ${
                  isCritical ? "border-destructive/40 bg-destructive/5" : "border-amber-500/40 bg-amber-500/5"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {isCritical ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-label="Over limit" />
                    ) : (
                      <TrendingUp className="h-4 w-4 shrink-0 text-amber-600" aria-label="Approaching limit" />
                    )}
                    <span className="text-sm font-medium">{f.tenant.name}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                      style={{ borderColor: PLAN_TONE[f.tenant.plan], color: PLAN_TONE[f.tenant.plan] }}
                    >
                      {f.plan.name}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        isCritical ? "border-destructive/50 text-destructive" : "border-amber-500/50 text-amber-600"
                      }`}
                    >
                      {isCritical ? "Over limit" : "Approaching"}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    {f.upgrade ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => scheduleUpgrade(f.tenant.name, f.plan.name, f.upgrade!.plan.name)}
                      >
                        <ArrowUpRight className="h-3 w-3" /> Upgrade to {f.upgrade.plan.name}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled>
                        Contact sales — top tier
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() =>
                        enforceLimit(
                          f.tenant.name,
                          b.label,
                          `${compact(b.limit)}${b.key === "storageGb" ? " GB" : ""}`,
                        )
                      }
                    >
                      <Lock className="h-3 w-3" /> Enforce cap
                    </Button>
                    <Button
                      size="sm"
                      variant={armed ? "default" : "outline"}
                      className="h-7 gap-1 text-xs"
                      aria-pressed={armed}
                      onClick={() => toggleAlerts(f.tenant.name)}
                    >
                      {armed ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                      {armed ? "Alerts armed" : "Arm alerts"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                      title="Send this tenant a pre-filled notice with utilization, forecast, and the upgrade recommendation"
                      onClick={() => notifyTenant(f)}
                    >
                      <Send className="h-3 w-3" /> Notify tenant
                    </Button>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {b.label}: {compact(b.used)} / {compact(b.limit)}
                      {b.key === "storageGb" ? " GB" : ""}
                    </span>
                    <span className={`tabular-nums font-medium ${isCritical ? "text-destructive" : "text-amber-600"}`}>
                      {b.pctUsed}%
                    </span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full ${usageTone(b.pctUsed)}`}
                      style={{ width: `${barPct}%` }}
                      role="progressbar"
                      aria-valuenow={b.pctUsed}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${b.label}: ${b.pctUsed}% of ${f.plan.name} plan limit`}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    ↑ {b.growth}% per 30d ·{" "}
                    {b.days === 0
                      ? "over the ceiling now"
                      : Number.isFinite(b.days)
                        ? `limit forecast in ~${b.days} days`
                        : "no limit in sight at current trend"}
                  </p>
                  <p className="text-[11px] text-foreground/80">
                    Recommended:{" "}
                    {f.upgrade ? (
                      <>
                        upgrade to <span className="font-medium">{f.upgrade.plan.name}</span> for{" "}
                        {f.upgrade.headroomPct}%+ {b.label.toLowerCase()} headroom
                        {f.upgrade.plan.priceMonthly > f.plan.priceMonthly
                          ? ` (+${formatCurrency(f.upgrade.plan.priceMonthly - f.plan.priceMonthly)}/mo)`
                          : ""}
                        .{" "}
                      </>
                    ) : (
                      <>already on the top tier — negotiate bespoke {b.label.toLowerCase()} limits with sales.{" "}</>
                    )}
                    Alert suggestion: notify at 80% and 95% of each limit.
                  </p>
                </div>
              </div>
            );
          })
        )}
        {healthy.length > 0 && flagged.length > 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Within limits: {healthy.map((h) => h.name).join(", ")}.
          </p>
        ) : null}
        {notice ? (
          <UsageNoticeDialog prefill={notice} onClose={() => setNotice(null)} />
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit dialog                                                */
/* ------------------------------------------------------------------ */

function PlanDialog({
  plan,
  open,
  onOpenChange,
  onSave,
}: {
  plan: Plan | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (p: Plan) => void;
}) {
  const isNew = plan === null;
  const [draft, setDraft] = useState<Plan>(plan ?? DEFAULT_PLANS[0]);
  const [lastPlan, setLastPlan] = useState<Plan | null>(plan);

  // Re-seed the draft when the target plan changes (edit vs create).
  if (open && plan !== lastPlan) {
    setLastPlan(plan);
    setDraft(plan ?? { ...DEFAULT_PLANS[0], id: "starter", name: "New Plan" });
  }

  const patch = (p: Partial<Plan>) => setDraft((d) => ({ ...d, ...p }));
  const patchLimits = (p: Partial<PlanLimits>) =>
    setDraft((d) => ({ ...d, limits: { ...d.limits, ...p } }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Create plan" : `Edit ${draft.name}`}</DialogTitle>
          <DialogDescription>
            Pricing, trial window, and entitlement ceilings. Changes apply to new billing cycles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price / month (USD)</Label>
              <Input
                type="number"
                min={0}
                value={draft.priceMonthly}
                onChange={(e) => patch({ priceMonthly: Math.max(0, Number(e.target.value) || 0) })}
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Trial days (0 disables the trial)</Label>
            <Input
              type="number"
              min={0}
              max={90}
              value={draft.trialDays}
              onChange={(e) => patch({ trialDays: Math.min(90, Math.max(0, Number(e.target.value) || 0)) })}
              className="h-9"
            />
          </div>
          <Separator />
          <div>
            <Label className="mb-2 block text-xs">Limits</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["traders", "Traders"],
                  ["apiCallsPerDay", "API calls / day"],
                  ["storageGb", "Storage (GB)"],
                  ["eventsPerDay", "Events / day"],
                ] as Array<[keyof PlanLimits, string]>
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={draft.limits[key]}
                    onChange={(e) => patchLimits({ [key]: Math.max(0, Number(e.target.value) || 0) } as Partial<PlanLimits>)}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="gap-1">
            <X className="h-4 w-4" /> Cancel
          </Button>
          <Button
            onClick={() => {
              if (!draft.name.trim()) {
                toast({ title: "Name required", variant: "destructive" });
                return;
              }
              onSave(draft);
            }}
            className="gap-1.5"
          >
            <Sparkles className="h-4 w-4" /> Save plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
