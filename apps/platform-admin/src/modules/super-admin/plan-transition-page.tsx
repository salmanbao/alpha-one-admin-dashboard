"use client";

/**
 * Plan Transition Workflow — findings #2 & #4 (HIGH / MEDIUM).
 *
 * "Plan changes have a clear path including proration" was the missing
 * success-path step of the Plan & entitlement management journey. The
 * plans page has a per-tenant migrate dialog, but the journey-map probe
 * looks for a dedicated upgrade/downgrade path — this is it:
 *
 *   1. Tenant + target plan selection (deep-linkable via router params)
 *   2. Before → after comparison: feature gains/losses (bundle markers
 *      filtered) plus a limits table with today's usage against both
 *      the current and the target ceilings
 *   3. Proration math for immediate changes (deterministic fixture:
 *      day 12 of a 30-day cycle → 18 days remaining, net = charge − credit)
 *   4. Transition rules — effective timing, entitlement cascade, grace
 *      period, and the tenant notification template
 *   5. Tenant-facing preview — exactly what the tenant will see
 *   6. Confirm → writes the tenant store via `updateTenant` (R3-04:
 *      immediate moves `plan`, next-cycle persists `scheduledPlan`) +
 *      toast + audit record (console.plan_transition_applied)
 *
 * The plan catalog is the persisted plan-catalog-store (shared with the
 * plans page — this page used to hardcode its own copy); tenants read
 * tenant-store reactively so the before/after comparison reflects a
 * confirmed transition immediately. Usage mirrors tenantUsage. No Math.random.
 */

import { useEffect, useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { applyDueScheduledPlans, updateTenant, useTenants } from "@/lib/platform/tenant-store";
import { type PlanId, usePlans } from "@/lib/platform/plan-catalog-store";
import { recordAudit } from "@/lib/platform/console-store";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { formatCurrency, formatCompact } from "@/components/platform/status";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  Bell,
  Check,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Plan presentation fixtures — tier order/tone + deterministic usage.  */
/* The catalog itself lives in lib/platform/plan-catalog-store.        */
/* ------------------------------------------------------------------ */

const PLAN_ORDER: PlanId[] = ["starter", "growth", "scale", "enterprise"];

const PLAN_TONE: Record<PlanId, string> = {
  starter: "#6b6358",
  growth: "#0f766e",
  scale: "#b45309",
  enterprise: "#7c3aed",
};

/** Deterministic per-tenant usage vs plan limits (mirrors plans-page). */
function tenantUsage(tenantId: string) {
  const seed = tenantId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    traders: 200 + (seed % 900),
    apiCallsPerDay: 40_000 + (seed % 800_000),
    storageGb: 12 + (seed % 200),
    eventsPerDay: 3_000 + (seed % 90_000),
  };
}

const pct = (used: number, limit: number) => Math.min(100, Math.round((used / limit) * 100));

/** Next tier up — falls back to the tier below at the top of the stack. */
function neighborPlan(plan: PlanId): PlanId {
  const i = PLAN_ORDER.indexOf(plan);
  return PLAN_ORDER[i + 1] ?? PLAN_ORDER[i - 1];
}

/** Transition-rule fixtures — deterministic demo options. */
const NOTIFICATION_TEMPLATES = [
  {
    id: "upgrade-notice",
    label: "Plan upgrade — tenant notice",
    note: "Confirms the new tier, its limits, and the effective date.",
  },
  {
    id: "downgrade-grace",
    label: "Plan downgrade + grace window",
    note: "Warns about removed features and how long they stay available.",
  },
  {
    id: "billing-adjustment",
    label: "Billing adjustment — proration",
    note: "Explains the proration charge or credit on the next invoice.",
  },
] as const;

const GRACE_PERIODS = [
  { days: 0, label: "No grace — revoke at effective time" },
  { days: 3, label: "3-day grace before removal" },
  { days: 7, label: "7-day grace before removal" },
  { days: 14, label: "14-day grace before removal" },
] as const;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function PlanTransitionPage({ params }: { params: Record<string, string> }) {
  const { user, navigate } = usePlatform();

  // Tenants on file — from the store (R3-04), so a transition confirmed
  // here re-renders the before/after comparison immediately (the page
  // used to read the mock-data seed once at module load).
  const storedTenants = useTenants();
  const tenantRows = useMemo(
    () => storedTenants.filter((t) => t.id !== "platform"),
    [storedTenants],
  );

  // Persisted catalog (shared with the plans page) + apply any scheduled
  // plan transitions whose effective time has passed.
  const plans = usePlans();
  useEffect(() => {
    const applied = applyDueScheduledPlans();
    if (applied.length > 0) {
      toast({
        title: "Scheduled plan change applied",
        description: applied
          .map((t) => `${t.name} → ${plans.find((p) => p.id === t.plan)?.name ?? t.plan}`)
          .join(", "),
      });
    }
    // plans is read once on mount — a due schedule applies before edits matter.
  }, []);

  // Deep-linkable selection — navigate("plan-transition", { tenant, target })
  // pre-seeds the workflow (e.g. from the plans table).
  const seededTenant = tenantRows.find((t) => t.id === params.tenant) ?? tenantRows[0];
  const [tenantId, setTenantId] = useState(seededTenant?.id ?? "");
  const [targetId, setTargetId] = useState<PlanId>(() => {
    const seeded = params.target as PlanId | undefined;
    if (seeded && PLAN_ORDER.includes(seeded)) return seeded;
    return seededTenant ? neighborPlan(seededTenant.plan) : "growth";
  });

  const tenant = tenantRows.find((t) => t.id === tenantId) ?? seededTenant;
  const currentPlan = tenant ? plans.find((p) => p.id === tenant.plan) : undefined;
  const targetPlan = targetId ? plans.find((p) => p.id === targetId) : undefined;

  // Transition rules (section 4)
  const [effective, setEffective] = useState<"immediate" | "cycle">("cycle");
  const [cascade, setCascade] = useState(true);
  const [graceDays, setGraceDays] = useState<number>(7);
  const [templateId, setTemplateId] = useState<string>(NOTIFICATION_TEMPLATES[0].id);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!tenant || !currentPlan || !targetPlan) {
    return (
      <Page>
        <PageContent>
          <p className="text-sm text-muted-foreground">No tenants on file.</p>
        </PageContent>
      </Page>
    );
  }

  const usage = tenantUsage(tenant.id);
  const isCurrent = targetPlan.id === currentPlan.id;
  const curIdx = PLAN_ORDER.indexOf(currentPlan.id);
  const tgtIdx = PLAN_ORDER.indexOf(targetPlan.id);
  const direction = tgtIdx > curIdx ? "upgrade" : tgtIdx < curIdx ? "downgrade" : "none";

  /* 2 · Limits: today's usage vs both ceilings */
  const checks: Array<{ label: string; used: number; current: number; target: number }> = [
    { label: "Traders", used: usage.traders, current: currentPlan.limits.traders, target: targetPlan.limits.traders },
    { label: "API calls/day", used: usage.apiCallsPerDay, current: currentPlan.limits.apiCallsPerDay, target: targetPlan.limits.apiCallsPerDay },
    { label: "Storage (GB)", used: usage.storageGb, current: currentPlan.limits.storageGb, target: targetPlan.limits.storageGb },
    { label: "Events/day", used: usage.eventsPerDay, current: currentPlan.limits.eventsPerDay, target: targetPlan.limits.eventsPerDay },
  ];
  const violations = checks.filter((c) => c.used > c.target);

  /* 2 · Feature delta — bundle markers ("Everything in X") are nav
   *  shorthand, not user-visible features, so they're filtered out. */
  const bundle = (f: string) => f.startsWith("Everything in ");
  const gained = targetPlan.features.filter((f) => !currentPlan.features.includes(f) && !bundle(f));
  const lost = currentPlan.features.filter((f) => !targetPlan.features.includes(f) && !bundle(f));
  const priceDelta = targetPlan.priceMonthly - currentPlan.priceMonthly;

  /* 3 · Proration — deterministic fixture: day 12 of a 30-day cycle. */
  const CYCLE_DAYS = 30;
  const CYCLE_DAY_USED = 12;
  const daysRemaining = CYCLE_DAYS - CYCLE_DAY_USED; // 18
  const dailyCurrent = currentPlan.priceMonthly / CYCLE_DAYS;
  const dailyTarget = targetPlan.priceMonthly / CYCLE_DAYS;
  const creditUnused = dailyCurrent * daysRemaining; // money back on old plan
  const chargeRemaining = dailyTarget * daysRemaining; // money owed on new plan
  const netProration = chargeRemaining - creditUnused; // >0 = tenant owes

  const worstTargetPct = Math.max(...checks.map((c) => pct(c.used, c.target)));
  const canConfirm = !isCurrent && violations.length === 0 && acknowledged;
  // R3-04 — a scheduled change already on file for this tenant.
  const scheduled = tenant.scheduledPlan;

  /* 5 · Tenant-facing preview copy — composed from the rules above. */
  const template = NOTIFICATION_TEMPLATES.find((t) => t.id === templateId) ?? NOTIFICATION_TEMPLATES[0];
  const subject =
    direction === "upgrade"
      ? `Your plan is upgrading to ${targetPlan.name}`
      : direction === "downgrade"
        ? `Your plan is moving to ${targetPlan.name}`
        : `Plan update for ${targetPlan.name}`;
  const previewBody = [
    `Hi ${tenant.name} team —`,
    effective === "immediate"
      ? `Your ${currentPlan.name} plan changes to ${targetPlan.name} today.`
      : `Your ${currentPlan.name} plan changes to ${targetPlan.name} at your next billing cycle.`,
    `Monthly price: ${formatCurrency(currentPlan.priceMonthly)} → ${formatCurrency(targetPlan.priceMonthly)}/mo.`,
    effective === "immediate"
      ? `Your next invoice includes a net ${netProration >= 0 ? "charge" : "credit"} of ${formatCurrency(Math.abs(netProration))} for the ${daysRemaining} unused/remaining days.`
      : "No proration — this cycle runs to its end unchanged.",
    direction === "downgrade" && graceDays > 0
      ? `Removed features stay available for ${graceDays} days while you adjust.`
      : null,
    cascade
      ? "Modules and feature flags re-provision automatically."
      : "Modules and feature flags stay as-is until you enable them manually.",
  ]
    .filter(Boolean)
    .join("\n");

  const pickTenant = (id: string) => {
    setTenantId(id);
    // Keep a valid target when the tenant (and therefore the current
    // plan) changes — no effects, the reset happens in the handler.
    const next = tenantRows.find((t) => t.id === id);
    if (next) setTargetId(neighborPlan(next.plan));
    setAcknowledged(false);
  };

  const confirm = () => {
    if (!canConfirm) return;
    // R3-04: the workflow now WRITES the tenant store — it used to toast
    // + audit only, so the transition never happened. Immediate → plan
    // moves now (clearing any earlier schedule); next cycle → persisted
    // as a scheduled record the store applies when due.
    if (effective === "immediate") {
      updateTenant(tenant.id, { plan: targetPlan.id, scheduledPlan: undefined });
    } else {
      updateTenant(tenant.id, {
        scheduledPlan: {
          plan: targetPlan.id,
          scheduledFor: new Date(Date.now() + daysRemaining * 86_400_000).toISOString(),
        },
      });
    }
    toast({
      title: effective === "immediate" ? "Plan transition applied" : "Plan transition scheduled",
      description: `${tenant.name}: ${currentPlan.name} → ${targetPlan.name} — effective ${
        effective === "immediate"
          ? `immediately (net proration ${netProration >= 0 ? "charge" : "credit"} of ${formatCurrency(Math.abs(netProration))})`
          : "at the next billing cycle (saved on the tenant record)"
      }, ${graceDays}-day grace, cascade ${cascade ? "on" : "off"}; "${template.label}" queued.`,
    });
    recordAudit({
      actor: user.name,
      action: "console.plan_transition_applied",
      target: tenant.id,
      tenantId: tenant.id,
      severity: "info",
      detail: `${tenant.name}: ${currentPlan.name} → ${targetPlan.name} (effective ${
        effective === "immediate"
          ? `immediately, proration ${netProration >= 0 ? "+" : "−"}${formatCurrency(Math.abs(netProration))}`
          : "next billing cycle — scheduled record persisted on the tenant"
      }; cascade ${cascade ? "on" : "off"}; grace ${graceDays}d; template "${template.id}"; acknowledged by ${user.name})`,
    });
    setAcknowledged(false);
  };

  return (
    <Page>
      <PageHeader
        title="Plan Transition"
        description="Upgrade or downgrade a tenant's plan with a full before/after comparison, proration math, transition rules, and a tenant-facing preview."
        icon={ArrowRightLeft}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("plans")}>
            <CreditCard className="mr-1.5 h-4 w-4" /> Plans &amp; Subscriptions
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        }
      />
      <PageContent>
        {/* Status metrics — the numbers that drive the decision */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Monthly price change"
            value={`${priceDelta > 0 ? "+" : priceDelta < 0 ? "−" : ""}${formatCurrency(Math.abs(priceDelta))}`}
            delta={priceDelta}
            deltaLabel={`${currentPlan.name} → ${targetPlan.name}`}
            icon={DollarSign}
            tone={priceDelta > 0 ? "positive" : priceDelta < 0 ? "warning" : "default"}
          />
          <MetricCard
            label="Net proration (immediate)"
            value={effective === "immediate" ? formatCurrency(Math.abs(netProration)) : "—"}
            deltaLabel={
              effective === "immediate"
                ? netProration >= 0
                  ? "tenant is charged"
                  : "tenant is credited"
                : "no proration at cycle"
            }
            icon={CreditCard}
            tone={effective === "immediate" ? (netProration >= 0 ? "default" : "positive") : "default"}
          />
          <MetricCard
            label="Days left in cycle"
            value={`${daysRemaining} of ${CYCLE_DAYS}`}
            deltaLabel={`proration basis · day ${CYCLE_DAY_USED}`}
            icon={Clock}
          />
          <MetricCard
            label="Usage vs target"
            value={`${worstTargetPct}%`}
            deltaLabel={
              violations.length > 0
                ? `${violations.length} limit${violations.length === 1 ? "" : "s"} exceeded — blocked`
                : "worst-case ceiling usage"
            }
            icon={Bell}
            tone={violations.length > 0 ? "negative" : worstTargetPct >= 80 ? "warning" : "positive"}
          />
        </div>

        {/* 1 · Tenant + target plan */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">1 · Tenant &amp; target plan</span>
            <p className="text-xs text-muted-foreground">
              Pick who changes and where they land. Deep-linkable —{" "}
              <code className="text-[11px]">navigate("plan-transition", &#123; tenant, target &#125;)</code>.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={tenant.id} onValueChange={pickTenant}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenantRows.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="capitalize" style={{ borderColor: PLAN_TONE[currentPlan.id], color: PLAN_TONE[currentPlan.id] }}>
                Current: {currentPlan.name}
              </Badge>
              <Badge
                variant={direction === "upgrade" ? "default" : direction === "downgrade" ? "secondary" : "outline"}
                className="gap-1 capitalize"
              >
                {direction === "upgrade" ? <ArrowUp className="h-3 w-3" /> : direction === "downgrade" ? <ArrowDown className="h-3 w-3" /> : null}
                {direction}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {plans.map((p) => {
                const selected = p.id === targetId;
                const current = p.id === currentPlan.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={current}
                    aria-pressed={selected}
                    onClick={() => {
                      setTargetId(p.id);
                      setAcknowledged(false);
                    }}
                    className={`rounded-md border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60"
                    } ${current ? "opacity-60" : ""}`}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="font-medium" style={{ color: PLAN_TONE[p.id] }}>
                        {p.name}
                      </span>
                      {current ? (
                        <Badge variant="outline" className="text-[9px] uppercase">
                          Current
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatCurrency(p.priceMonthly)}/mo
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 2 · Before → after comparison */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">2 · Before → after</span>
            <p className="text-xs text-muted-foreground">
              Feature delta (bundle markers filtered) and today&apos;s usage against both plan
              ceilings — amber at 80% of the target, red when it exceeds it.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-emerald-500/30 bg-emerald-50/50 p-2.5 text-xs dark:bg-emerald-950/20">
                <span className="mb-1 block font-medium text-emerald-700 dark:text-emerald-400">
                  Gains on {targetPlan.name}
                </span>
                {gained.length === 0 ? (
                  <span className="text-muted-foreground">No new features</span>
                ) : (
                  <ul className="space-y-0.5">
                    {gained.map((f) => (
                      <li key={f} className="flex items-start gap-1">
                        <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-md border border-rose-500/30 bg-rose-50/50 p-2.5 text-xs dark:bg-rose-950/20">
                <span className="mb-1 block font-medium text-rose-700 dark:text-rose-400">
                  Losses from {currentPlan.name}
                </span>
                {lost.length === 0 ? (
                  <span className="text-muted-foreground">Nothing removed</span>
                ) : (
                  <ul className="space-y-0.5">
                    {lost.map((f) => (
                      <li key={f} className="flex items-start gap-1">
                        <X className="mt-0.5 h-3 w-3 shrink-0 text-rose-600" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">Limit</th>
                    <th className="py-1.5 pr-3 font-medium">Today&apos;s usage</th>
                    <th className="py-1.5 pr-3 font-medium">{currentPlan.name} ceiling</th>
                    <th className="py-1.5 pr-3 font-medium">{targetPlan.name} ceiling</th>
                    <th className="py-1.5 font-medium">After transition</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c) => {
                    const p = pct(c.used, c.target);
                    const over = c.used > c.target;
                    const near = !over && p >= 80;
                    return (
                      <tr key={c.label} className="border-b border-border/50">
                        <td className="py-1.5 pr-3 font-medium">{c.label}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{formatCompact(c.used)}</td>
                        <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                          {formatCompact(c.current)}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums text-muted-foreground">
                          {formatCompact(c.target)}
                        </td>
                        <td className="py-1.5">
                          <span
                            className={
                              over
                                ? "font-medium text-red-600 dark:text-red-400"
                                : near
                                  ? "font-medium text-amber-600 dark:text-amber-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {p}% — {over ? "exceeds target" : near ? "near limit" : "within limits"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {violations.length > 0 && (
              <p
                role="alert"
                className="rounded-md border border-red-500/40 bg-red-50/60 p-2 text-xs font-medium text-red-700 dark:bg-red-950/20 dark:text-red-400"
              >
                Transition blocked —{" "}
                {violations
                  .map(
                    (v) =>
                      `${formatCompact(v.used)} ${v.label.toLowerCase()} exceed the ${targetPlan.name} limit of ${formatCompact(v.target)}`,
                  )
                  .join("; ")}
                . Free capacity or upgrade instead.
              </p>
            )}
            {priceDelta !== 0 && (
              <p className="text-xs text-muted-foreground">
                Price change:{" "}
                <span className="font-medium text-foreground">
                  {priceDelta > 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(priceDelta))}/mo
                </span>{" "}
                ({currentPlan.name} {formatCurrency(currentPlan.priceMonthly)} → {targetPlan.name}{" "}
                {formatCurrency(targetPlan.priceMonthly)})
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3 · Proration */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">3 · Proration</span>
            <p className="text-xs text-muted-foreground">
              What the change costs today — day {CYCLE_DAY_USED} of a {CYCLE_DAYS}-day cycle, so{" "}
              {daysRemaining} days remain.
            </p>
          </CardHeader>
          <CardContent>
            {effective === "immediate" ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <dl className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      Unused time on {currentPlan.name} (credited)
                    </dt>
                    <dd className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                      −{formatCurrency(creditUnused)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">
                      {targetPlan.name} for {daysRemaining} days (charged)
                    </dt>
                    <dd className="tabular-nums font-medium">+{formatCurrency(chargeRemaining)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-1">
                    <dt className="font-medium">
                      Net {netProration >= 0 ? "charge" : "credit"} on next invoice
                    </dt>
                    <dd
                      className={`tabular-nums font-semibold ${
                        netProration >= 0 ? "text-foreground" : "text-emerald-700 dark:text-emerald-400"
                      }`}
                    >
                      {formatCurrency(Math.abs(netProration))}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No proration — the current plan runs to the end of its cycle, then the new
                plan&apos;s full price applies ({formatCurrency(targetPlan.priceMonthly)}/mo).
              </p>
            )}
          </CardContent>
        </Card>

        {/* 4 · Transition rules */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">4 · Transition rules</span>
            <p className="text-xs text-muted-foreground">
              When it applies, how entitlements cascade, how long removed features linger, and
              which notification the tenant receives.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Effective</Label>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="transition-effective"
                      checked={effective === "immediate"}
                      onChange={() => setEffective("immediate")}
                    />
                    Immediately (prorated)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="transition-effective"
                      checked={effective === "cycle"}
                      onChange={() => setEffective("cycle")}
                    />
                    Next billing cycle
                  </label>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="cascade-switch" className="text-xs text-muted-foreground">
                    Entitlement cascade
                  </Label>
                  <Switch id="cascade-switch" checked={cascade} onCheckedChange={setCascade} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {cascade
                    ? "Re-provision dependent modules and feature flags as part of the transition."
                    : "Change only the plan record — modules and flags stay as-is until touched manually."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Grace period (downgrades)</Label>
                <Select value={String(graceDays)} onValueChange={(v) => setGraceDays(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRACE_PERIODS.map((g) => (
                      <SelectItem key={g.days} value={String(g.days)}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {direction === "upgrade"
                    ? "Unused for upgrades — entitlements are added immediately."
                    : "Removed entitlements stay usable for this window before revocation."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tenant notification</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{template.note}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5 · Tenant-facing preview */}
        <Card>
          <CardHeader className="pb-2">
            <span className="text-sm font-medium">5 · Tenant-facing preview</span>
            <p className="text-xs text-muted-foreground">
              Exactly what {tenant.name} will see, rendered with their branding — review before
              confirming.
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: tenant.branding.primaryColor }}
                  aria-hidden="true"
                >
                  {tenant.branding.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tenant.branding.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {tenant.branding.tagline ?? "Plan notification"}
                  </p>
                </div>
                <Badge variant="outline" className="ml-auto gap-1 text-[10px]">
                  <Eye className="h-3 w-3" /> Preview
                </Badge>
              </div>
              <p className="text-sm font-semibold">{subject}</p>
              <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {previewBody}
              </p>
              <Separator className="my-3" />
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Bell className="h-3 w-3" /> Sent via “{template.label}” ·{" "}
                {effective === "immediate" ? "on confirm" : "at cycle rollover"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* R3-04 — scheduled change already on file for this tenant */}
        {scheduled ? (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            Scheduled: {currentPlan.name} →{" "}
            {plans.find((p) => p.id === scheduled.plan)?.name ?? scheduled.plan} on{" "}
            {new Date(scheduled.scheduledFor).toLocaleDateString()} — applies automatically
            when due (saved on the tenant record).
          </div>
        ) : null}

        {/* 6 · Confirm */}
        <Card>
          <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex max-w-2xl items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                I understand this changes {tenant.name} from {currentPlan.name} to{" "}
                {targetPlan.name}
                {effective === "immediate"
                  ? `, takes effect immediately, and applies a net ${
                      netProration >= 0 ? "charge" : "credit"
                    } of ${formatCurrency(Math.abs(netProration))} on the next invoice`
                  : ", and takes effect at the next billing cycle"}
                {direction === "downgrade" && graceDays > 0
                  ? `. Removed features stay available for ${graceDays} days`
                  : ""}
                . Entitlements re-provision {cascade ? "automatically" : "manually"}.
              </span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("plans")}>
                Cancel
              </Button>
              <Button
                disabled={!canConfirm}
                onClick={confirm}
                title={
                  isCurrent
                    ? "That is already the current plan"
                    : violations.length > 0
                      ? "Usage exceeds the target plan's limits"
                      : !acknowledged
                        ? "Tick the acknowledgment to confirm you understand the change"
                        : undefined
                }
              >
                {isCurrent
                  ? "Current plan"
                  : effective === "immediate"
                    ? "Apply transition now"
                    : "Schedule transition"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PageContent>
    </Page>
  );
}
