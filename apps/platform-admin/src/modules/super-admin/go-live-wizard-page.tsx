"use client";

/**
 * Go-Live Wizard — R2-W3-04 (firm go-live, start to finish).
 *
 * Six steps; the moment a step is saved it writes the store it claims:
 *
 *   ① Tenant      → tenant-store      registerTenant (new) or pick an
 *                                     existing tenant
 *   ② Plan        → tenant-store      updateTenant(id, { plan }) — the
 *                                     real W1-05 plan assignment
 *   ③ KYC         → integrations-store (Persona/Sumsub assignment) +
 *                                     tenant-store (tenant.kycProvider)
 *   ④ Connectors  → integrations-store (status + assignment per connector)
 *   ⑤ Risk        → risk-defaults-store (the SAME values the Risk Engine
 *                                     page reads and writes)
 *   ⑥ Review      → tenant-store      status: provisioning → active
 *                     + console-store  recordAudit for every step
 *
 * Progress (which tenant, which step, what's complete) lives only in
 * go-live-store; the facts live in the target stores and the review step
 * reads them back from there — no second copy. localStorage-backed, so
 * leaving the page mid-run and coming back resumes at the saved step
 * with the saved data.
 *
 * Honest scope: the wizard registers the tenant and writes the settings
 * above. It does NOT start the 9-step provisioning saga — Create Tenant
 * owns that (CON-03).
 */

import { useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants, updateTenant } from "@/lib/platform/tenant-store";
import { recordAudit } from "@/lib/platform/console-store";
import {
  useIntegrationOverrides,
  setIntegrationOverride,
} from "@/lib/platform/integrations-store";
import { SEED_INTEGRATIONS } from "@/lib/platform/integrations-catalog";
import {
  useRiskParams,
  setRiskParams,
  DEFAULT_RISK_PARAMS,
  type TenantRiskParams,
} from "@/lib/platform/risk-defaults-store";
import {
  useGoLive,
  completeStep,
  patchGoLive,
  resetGoLive,
} from "@/lib/platform/go-live-store";
import type { TenantContext } from "@/lib/platform/types";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Rocket,
  Building2,
  CreditCard,
  Shield,
  Plug,
  Gauge,
  ScrollText,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Activity,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Step metadata                                                       */
/* ------------------------------------------------------------------ */

const STEP_META: {
  id: "tenant" | "plan" | "kyc" | "connectors" | "risk" | "review";
  label: string;
  icon: typeof Building2;
  /** Where this step's facts land — shown to the operator as they go. */
  writesTo: string;
}[] = [
  { id: "tenant", label: "Tenant", icon: Building2, writesTo: "tenant-store (registerTenant)" },
  { id: "plan", label: "Plan", icon: CreditCard, writesTo: "tenant-store (updateTenant → plan)" },
  { id: "kyc", label: "KYC", icon: Shield, writesTo: "integrations-store + tenant.kycProvider" },
  { id: "connectors", label: "Connectors", icon: Plug, writesTo: "integrations-store (status + assignment)" },
  { id: "risk", label: "Risk", icon: Gauge, writesTo: "risk-defaults-store (shared with Risk Engine)" },
  { id: "review", label: "Go live", icon: ScrollText, writesTo: "tenant-store (status → active) + audit log" },
];

const PLAN_OPTIONS: { id: TenantContext["plan"]; label: string; blurb: string }[] = [
  { id: "starter", label: "Starter", blurb: "Single challenge, core modules." },
  { id: "growth", label: "Growth", blurb: "Multiple programs, full analytics." },
  { id: "scale", label: "Scale", blurb: "High volume, advanced risk controls." },
  { id: "enterprise", label: "Enterprise", blurb: "Custom terms, dedicated support." },
];

const KYC_OPTIONS: { id: string; label: string; blurb: string }[] = [
  { id: "int-006", label: "Persona", blurb: "Document + liveness checks, automatic low-risk approval." },
  { id: "int-007", label: "Sumsub", blurb: "Alternative provider with document review queues." },
  { id: "manual", label: "Manual review", blurb: "No external provider — reviewers decide cases in-app." },
];

const RISK_PRESETS: { id: string; label: string; params: TenantRiskParams }[] = [
  { id: "conservative", label: "Conservative", params: { dailyLoss: "3", maxDd: "7", profitTarget: "8", minDays: "5" } },
  { id: "balanced", label: "Balanced", params: DEFAULT_RISK_PARAMS },
  { id: "aggressive", label: "Aggressive", params: { dailyLoss: "10", maxDd: "20", profitTarget: "10", minDays: "1" } },
];

const RISK_FIELDS: { key: keyof TenantRiskParams; label: string; unit: string; min: number; max: number }[] = [
  { key: "dailyLoss", label: "Daily loss limit", unit: "%", min: 0.1, max: 20 },
  { key: "maxDd", label: "Max drawdown", unit: "%", min: 1, max: 50 },
  { key: "profitTarget", label: "Profit target", unit: "%", min: 0, max: 100 },
  { key: "minDays", label: "Minimum trading days", unit: "d", min: 0, max: 60 },
];

/** Same core set the Create Tenant wizard starts from. */
const CORE_MODULE_IDS = ["trading", "challenges", "risk", "payouts", "settings"];

const TIMEZONES = ["UTC", "America/New_York", "Europe/London", "Asia/Dubai", "Asia/Karachi"];
const CURRENCIES = ["USD", "EUR", "GBP", "AED", "PKR"];

const INITIAL_FORM = { name: "", slug: "", timezone: "UTC", currency: "USD", existingId: "" };

function validRange(value: string, min: number, max: number): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

function planLabel(id: string): string {
  return PLAN_OPTIONS.find((p) => p.id === id)?.label ?? id;
}

function integrationName(id: string): string {
  if (id === "manual") return "Manual review";
  return SEED_INTEGRATIONS.find((i) => i.id === id)?.name ?? id;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function GoLiveWizardPage() {
  const { navigate, registerTenant, pushNotification, user } = usePlatform();
  const progress = useGoLive();
  const tenants = useTenants();
  const overrides = useIntegrationOverrides();
  const riskMap = useRiskParams();

  const actor = user?.name ?? "Console operator";
  const tenant = progress.tenantId
    ? tenants.find((t) => t.id === progress.tenantId)
    : undefined;
  /** Progress points at a tenant that no longer exists — restart only. */
  const orphaned = Boolean(progress.tenantId && !tenant);
  const step = orphaned ? 0 : Math.min(progress.step, STEP_META.length - 1);

  // Drafts hold the operator's PENDING choice; while null the value shown
  // is whatever the target store already holds — a resumed run therefore
  // always displays the stored facts, never a stale local copy.
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState(INITIAL_FORM);
  const [planChoice, setPlanChoice] = useState<TenantContext["plan"] | null>(null);
  const [kycChoice, setKycChoice] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[] | null>(null);
  const [riskDraft, setRiskDraft] = useState<TenantRiskParams | null>(null);

  const assignedIds = tenant
    ? SEED_INTEGRATIONS.filter((i) =>
        (overrides[i.id]?.assignedTenants ?? []).includes(tenant.id),
      ).map((i) => i.id)
    : [];
  const planValue = planChoice ?? tenant?.plan ?? "growth";
  const kycValue = kycChoice ?? tenant?.kycProvider ?? "";
  const pickValue = picks ?? assignedIds;
  const riskValue =
    riskDraft ?? (tenant ? (riskMap[tenant.id] ?? DEFAULT_RISK_PARAMS) : DEFAULT_RISK_PARAMS);

  /* ---- Validation & navigation ---- */

  const stepHint = (i: number): string => {
    switch (i) {
      case 0:
        if (mode === "existing") return form.existingId ? "" : "Pick a tenant to continue.";
        if (form.name.trim().length <= 1) return "Tenant name is required.";
        if (!/^[a-z0-9-]+$/.test(form.slug)) return "Slug: lowercase letters, digits and dashes only.";
        if (tenants.some((t) => t.slug === form.slug)) return "That slug is already in use.";
        return "";
      case 1:
        return tenant ? "" : "Register or pick a tenant first.";
      case 2:
        return kycValue ? "" : "Choose a KYC provider (or manual review).";
      case 3:
        return pickValue.length > 0 ? "" : "Connect at least one connector.";
      case 4:
        if (!tenant) return "Register or pick a tenant first.";
        {
          const bad = RISK_FIELDS.find((f) => !validRange(riskValue[f.key], f.min, f.max));
          return bad ? `${bad.label} must be between ${bad.min} and ${bad.max}${bad.unit}.` : "";
        }
      case 5:
        return tenant ? "" : "Register or pick a tenant first.";
      default:
        return "";
    }
  };

  const hint = stepHint(step);
  const canSave = hint === "";

  const goTo = (i: number) => {
    if (i !== step) patchGoLive({ step: i });
  };
  const back = () => goTo(Math.max(0, step - 1));

  const clearDrafts = () => {
    setPlanChoice(null);
    setKycChoice(null);
    setPicks(null);
    setRiskDraft(null);
  };

  const restart = () => {
    resetGoLive();
    setMode("new");
    setForm(INITIAL_FORM);
    clearDrafts();
    toast({ title: "Wizard restarted", description: "Progress reset — saved settings in the target stores are kept." });
  };

  /* ---- Step ① — Tenant → tenant-store ---- */

  const saveTenant = () => {
    if (mode === "existing") {
      const target = tenants.find((t) => t.id === form.existingId);
      if (!target) return;
      clearDrafts();
      patchGoLive({ tenantId: target.id });
      completeStep("tenant", 1);
      recordAudit({
        actor,
        action: "go_live.run_started",
        target: target.name,
        tenantId: target.id,
        severity: "info",
        detail: "Go-live run started on an existing tenant (wizard)",
      });
      toast({ title: "Target tenant set", description: `${target.name} — progress saved; leave and resume anytime.` });
      return;
    }
    const id = `tenant-${form.slug}-${Math.random().toString(36).slice(2, 6)}`;
    const newTenant: TenantContext = {
      id,
      slug: form.slug,
      name: form.name.trim(),
      application: "prop-admin",
      branding: {
        name: form.name.trim(),
        tagline: "",
        initials: form.name.trim().slice(0, 2).toUpperCase(),
        primaryColor: "#4a7c59",
        accentColor: "#705c30",
        surfaceColor: "#f5efe6",
        radius: "0.625rem",
      },
      locale: "en-US",
      timezone: form.timezone,
      currency: form.currency,
      enabledModules: [...CORE_MODULE_IDS],
      enabledFeatures: [],
      terminology: {},
      plan: "growth",
      status: "provisioning",
      createdAt: new Date().toISOString(),
    };
    // Same mechanism as Create Tenant — registered WITHOUT hijacking the
    // operator's context; the provisioning saga is not started here.
    registerTenant(newTenant);
    clearDrafts();
    patchGoLive({ tenantId: id });
    completeStep("tenant", 1);
    recordAudit({
      actor,
      action: "go_live.tenant_registered",
      target: newTenant.name,
      tenantId: id,
      severity: "info",
      detail: `Tenant ${newTenant.slug} registered with status "provisioning" (go-live wizard)`,
    });
    toast({
      title: "Tenant registered",
      description: `${newTenant.name} persisted in tenant-store with status "provisioning".`,
    });
  };

  /* ---- Step ② — Plan → tenant-store ---- */

  const savePlan = () => {
    if (!tenant) return;
    updateTenant(tenant.id, { plan: planValue });
    recordAudit({
      actor,
      action: "go_live.plan_set",
      target: tenant.name,
      tenantId: tenant.id,
      severity: "info",
      detail: `Plan → ${planLabel(planValue)}`,
    });
    setPlanChoice(null); // display now reads back from tenant-store
    completeStep("plan", 2);
    toast({ title: "Plan saved", description: `${tenant.name} → ${planLabel(planValue)}. Persisted in tenant-store.` });
  };

  /* ---- Step ③ — KYC → integrations-store + tenant.kycProvider ---- */

  const saveKyc = () => {
    if (!tenant || !kycValue) return;
    if (kycValue !== "manual") {
      const prev = overrides[kycValue]?.assignedTenants ?? [];
      setIntegrationOverride(kycValue, {
        status: "connected",
        assignedTenants: prev.includes(tenant.id) ? prev : [...prev, tenant.id],
      });
    }
    updateTenant(tenant.id, { kycProvider: kycValue });
    recordAudit({
      actor,
      action: "go_live.kyc_selected",
      target: tenant.name,
      tenantId: tenant.id,
      severity: "info",
      detail: `KYC provider → ${integrationName(kycValue)}`,
    });
    setKycChoice(null);
    completeStep("kyc", 3);
    toast({
      title: "KYC provider saved",
      description: `${integrationName(kycValue)} — stored on ${tenant.name} (tenant.kycProvider${kycValue === "manual" ? "" : " + integration assignment"}).`,
    });
  };

  /* ---- Step ④ — Connectors → integrations-store ---- */

  const saveConnectors = () => {
    if (!tenant || pickValue.length === 0) return;
    // Add this tenant to every picked connector, remove it from every
    // unpicked one that had it — other tenants' assignments are kept.
    for (const seed of SEED_INTEGRATIONS) {
      const prev = overrides[seed.id]?.assignedTenants ?? [];
      const had = prev.includes(tenant.id);
      const wants = pickValue.includes(seed.id);
      if (wants && !had) {
        setIntegrationOverride(seed.id, { status: "connected", assignedTenants: [...prev, tenant.id] });
      } else if (!wants && had) {
        setIntegrationOverride(seed.id, { assignedTenants: prev.filter((x) => x !== tenant.id) });
      }
    }
    recordAudit({
      actor,
      action: "go_live.connectors_set",
      target: tenant.name,
      tenantId: tenant.id,
      severity: "info",
      detail: `${pickValue.length} connector(s) assigned: ${pickValue.map(integrationName).join(", ")}`,
    });
    setPicks(null); // display now reads back from integrations-store
    completeStep("connectors", 4);
    toast({
      title: "Connectors saved",
      description: `${pickValue.length} assigned to ${tenant.name} — persisted; the Integrations page shows the same state.`,
    });
  };

  /* ---- Step ⑤ — Risk defaults → risk-defaults-store ---- */

  const saveRisk = () => {
    if (!tenant) return;
    if (RISK_FIELDS.some((f) => !validRange(riskValue[f.key], f.min, f.max))) return;
    setRiskParams(tenant.id, riskValue);
    recordAudit({
      actor,
      action: "go_live.risk_defaults_set",
      target: tenant.name,
      tenantId: tenant.id,
      severity: "info",
      detail: `daily loss ${riskValue.dailyLoss}% · max DD ${riskValue.maxDd}% · target ${riskValue.profitTarget}% · min days ${riskValue.minDays}`,
    });
    setRiskDraft(null); // display now reads back from risk-defaults-store
    completeStep("risk", 5);
    toast({
      title: "Risk defaults saved",
      description: `${tenant.name} — persisted; the Risk Engine page shows the same values.`,
    });
  };

  /* ---- Step ⑥ — Review → tenant-store status + audit ---- */

  const goLive = () => {
    if (!tenant) return;
    updateTenant(tenant.id, { status: "active" });
    recordAudit({
      actor,
      action: "go_live.completed",
      target: tenant.name,
      tenantId: tenant.id,
      severity: "info",
      detail: `Status → active · plan ${planLabel(planValue)} · KYC ${integrationName(kycValue || tenant.kycProvider || "manual")} · ${assignedIds.length || pickValue.length} connector(s) · risk ${riskValue.dailyLoss}/${riskValue.maxDd}/${riskValue.profitTarget}/${riskValue.minDays}`,
    });
    patchGoLive({ done: true, step: STEP_META.length - 1 });
    pushNotification({
      title: "Tenant live",
      message: `${tenant.name} is active on ${planLabel(planValue)}.`,
      severity: "success",
      module: "super-admin",
    });
    toast({ title: "Tenant is live", description: `${tenant.name} → active. Audit entry recorded.` });
  };

  /* ---- Step content ---- */

  const renderStep = () => {
    switch (step) {
      /* ① Tenant */
      case 0:
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "new" ? "default" : "outline"} onClick={() => setMode("new")}>New tenant</Button>
              <Button size="sm" variant={mode === "existing" ? "default" : "outline"} onClick={() => setMode("existing")}>Use existing tenant</Button>
            </div>
            {mode === "new" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="gl-name">Firm name</Label>
                  <Input id="gl-name" value={form.name} placeholder="e.g. Meridian Capital" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-slug">Slug</Label>
                  <Input id="gl-slug" value={form.slug} placeholder="e.g. meridian" onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-tz">Timezone</Label>
                  <Select value={form.timezone} onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}>
                    <SelectTrigger id="gl-tz"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-cur">Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                    <SelectTrigger id="gl-cur"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Registered with status <Badge variant="outline" className="font-mono text-[10px]">provisioning</Badge> and
                  the core module set. The 9-step provisioning saga is started from Create Tenant (CON-03) — not here.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="gl-existing">Tenant</Label>
                <Select value={form.existingId} onValueChange={(v) => setForm((f) => ({ ...f, existingId: v }))}>
                  <SelectTrigger id="gl-existing"><SelectValue placeholder="Pick a tenant…" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · {t.plan} · {t.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Useful for a tenant that already exists (e.g. created by Create Tenant and waiting to go live).
                </p>
              </div>
            )}
          </div>
        );

      /* ② Plan */
      case 1:
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {PLAN_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanChoice(p.id)}
                aria-pressed={planValue === p.id}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  planValue === p.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{p.label}</span>
                  {planValue === p.id && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
              </button>
            ))}
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Saved with <code className="font-mono">updateTenant(id, {"{ plan }"})</code> — the same write the Tenant
              Detail “Change plan” control performs (W1-05).
            </p>
          </div>
        );

      /* ③ KYC */
      case 2:
        return (
          <div className="space-y-3">
            {KYC_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setKycChoice(o.id)}
                aria-pressed={kycValue === o.id}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  kycValue === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <Shield className={cn("mt-0.5 h-4 w-4 shrink-0", kycValue === o.id ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{o.label}</p>
                  <p className="text-xs text-muted-foreground">{o.blurb}</p>
                </div>
                {kycValue === o.id && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
              </button>
            ))}
            <p className="text-xs text-muted-foreground">
              Provider choice is stored on the tenant (<code className="font-mono">kycProvider</code>); an external
              provider is also connected and assigned in <code className="font-mono">integrations-store</code>.
            </p>
          </div>
        );

      /* ④ Connectors */
      case 3:
        return (
          <div className="space-y-3">
            <div className="grid gap-2">
              {SEED_INTEGRATIONS.map((seed) => {
                const checked = pickValue.includes(seed.id);
                return (
                  <label
                    key={seed.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      checked && "border-primary bg-primary/5",
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={(v) =>
                      setPicks((prev) => {
                        const base = prev ?? assignedIds;
                        return v ? [...new Set([...base, seed.id])] : base.filter((x) => x !== seed.id);
                      })
                    } />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{seed.name}</span>
                        <Badge variant="outline" className="text-[9px] capitalize">{seed.category}</Badge>
                      </span>
                      <span className="block text-xs text-muted-foreground">{seed.description}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        Seed status: <span className="font-mono">{seed.status}</span>
                        {overrides[seed.id]?.updatedAt ? " · edited on this platform" : ""}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Assigned connectors are written to <code className="font-mono">integrations-store</code> for this tenant —
              unassign here to remove them (other tenants keep theirs).
            </p>
          </div>
        );

      /* ⑤ Risk defaults */
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {RISK_PRESETS.map((p) => {
                const matches = (Object.keys(p.params) as (keyof TenantRiskParams)[])
                  .every((k) => riskValue[k] === p.params[k]);
                return (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={matches ? "default" : "outline"}
                    onClick={() => setRiskDraft({ ...p.params })}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RISK_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={`gl-${f.key}`}>{f.label}</Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id={`gl-${f.key}`}
                      type="number"
                      inputMode="decimal"
                      min={f.min}
                      max={f.max}
                      value={riskValue[f.key]}
                      onChange={(e) => setRiskDraft({ ...(riskDraft ?? riskValue), [f.key]: e.target.value })}
                      className="h-9 tabular-nums"
                    />
                    <span className="w-4 text-xs text-muted-foreground">{f.unit}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{f.min}–{f.max}{f.unit}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Persisted per tenant in <code className="font-mono">risk-defaults-store</code> — the Risk Engine page
              reads and writes the same values.
            </p>
          </div>
        );

      /* ⑥ Review & go live */
      case 5:
      default: {
        const rows: { label: string; value: string; store: string }[] = tenant
          ? [
              { label: "Tenant", value: `${tenant.name} (${tenant.slug})`, store: "tenant-store" },
              { label: "Plan", value: planLabel(planValue), store: "tenant-store → plan" },
              { label: "KYC provider", value: integrationName(kycValue || tenant.kycProvider || "manual"), store: "tenant.kycProvider" },
              { label: "Connectors", value: assignedIds.length ? assignedIds.map(integrationName).join(", ") : "—", store: "integrations-store → assignedTenants" },
              { label: "Risk defaults", value: `daily ${riskValue.dailyLoss}% · DD ${riskValue.maxDd}% · target ${riskValue.profitTarget}% · ${riskValue.minDays}d`, store: "risk-defaults-store" },
              { label: "Status", value: progress.done ? "active" : `${tenant.status} → active on go-live`, store: "tenant-store → status" },
            ]
          : [];
        return (
          <div className="space-y-4">
            <div className="divide-y rounded-lg border">
              {rows.map((r) => (
                <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</span>
                  <span className="flex min-w-0 flex-wrap items-baseline justify-end gap-2">
                    <span className="text-sm font-medium">{r.value}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{r.store}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Every row above is read back from its store — nothing on this screen is a second copy. The provisioning
              saga is started from Create Tenant, not by this wizard.
            </p>
            {progress.done && (
              <div className="flex items-start gap-2.5 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <div>
                  <p className="font-medium">Tenant is live.</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Status set to active, audit entry recorded.
                    {tenant && (
                      <>
                        {" "}
                        <button type="button" className="underline underline-offset-2" onClick={() => navigate("tenant-detail", { id: tenant.id })}>
                          Open tenant detail
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      }
    }
  };

  /* ---- Rail ---- */

  const renderRail = () => (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        {STEP_META.map((s, i) => {
          const Icon = s.icon;
          const done = progress.completed.includes(s.id);
          const active = i === step;
          const reachable = done || i < step;
          const circle = (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : active
                    ? "border-primary text-primary"
                    : "border-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
          );
          return (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-center">
                {i > 0 ? <div className={cn("h-0.5 flex-1", i <= step ? "bg-primary" : "bg-muted")} /> : null}
                {reachable ? (
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Go to step ${i + 1}: ${s.label}`}
                    className="rounded-full"
                  >
                    {circle}
                  </button>
                ) : (
                  <span aria-current={active ? "step" : undefined}>{circle}</span>
                )}
                {i < STEP_META.length - 1 ? <div className={cn("h-0.5 flex-1", i < step ? "bg-primary" : "bg-muted")} /> : null}
              </div>
              <span className={cn("text-[10px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Page>
      <PageHeader
        title="Go-Live Wizard"
        description="Stand a firm up end to end — tenant, plan, KYC, connectors, risk defaults — and take it live. Progress persists across visits."
        icon={Rocket}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("audit-log")}>
              <Activity className="mr-1.5 h-4 w-4" /> Audit Log
            </Button>
            <Button variant="ghost" size="sm" onClick={restart}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restart
            </Button>
          </>
        }
      />
      <PageContent>
        {orphaned && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This run points at a tenant that no longer exists. Restart the wizard — saved settings on other tenants
              are untouched.
            </p>
          </div>
        )}

        {progress.updatedAt && !orphaned && (
          <p className="text-xs text-muted-foreground">
            Resumed run · tenant {tenant ? <span className="font-medium text-foreground">{tenant.name}</span> : "—"} ·
            last saved {new Date(progress.updatedAt).toLocaleString()}
          </p>
        )}

        {renderRail()}

        <p role="status" aria-live="polite" className="sr-only">
          Step {step + 1} of {STEP_META.length}: {STEP_META[step].label}
          {hint ? ` — ${hint}` : ""}
        </p>

        <div className="rounded-lg border bg-card p-4 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">{STEP_META[step].label}</h2>
              <p className="text-xs text-muted-foreground">
                Persists to <span className="font-mono">{STEP_META[step].writesTo}</span>
              </p>
            </div>
            {progress.completed.includes(STEP_META[step].id) && (
              <Badge variant="secondary" className="text-[10px]">
                <Check className="mr-1 h-3 w-3" /> saved
              </Badge>
            )}
          </div>

          <div className="min-h-[320px]">{renderStep()}</div>

          <Separator className="my-4" />

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={step === 0} onClick={back} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-muted-foreground">
                Step {step + 1} of {STEP_META.length}
              </span>
              {hint && (
                <span role="alert" className="text-[11px] text-amber-700 dark:text-amber-400">
                  {hint}
                </span>
              )}
            </div>
            {step < STEP_META.length - 1 ? (
              <Button size="sm" disabled={!canSave} onClick={() => {
                if (step === 0) saveTenant();
                else if (step === 1) savePlan();
                else if (step === 2) saveKyc();
                else if (step === 3) saveConnectors();
                else if (step === 4) saveRisk();
              }} className="gap-1">
                Save &amp; continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : progress.done ? (
              <Button size="sm" variant="outline" onClick={restart} className="gap-1.5">
                <RotateCcw className="h-4 w-4" /> Start another run
              </Button>
            ) : (
              <Button size="sm" disabled={!canSave} onClick={goLive} className="gap-1.5">
                <Rocket className="h-4 w-4" /> Go live
              </Button>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
