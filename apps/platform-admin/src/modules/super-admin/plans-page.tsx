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
import {
  CreditCard,
  DollarSign,
  Users,
  Sparkles,
  Pencil,
  Plus,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  FlaskConical,
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
