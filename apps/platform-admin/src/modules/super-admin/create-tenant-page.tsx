"use client";

/**
 * Create Tenant Page — 5-step onboarding wizard for new tenants.
 *
 * Spec §6, §15. Mirrors OnboardingWizard / ChallengeWizard pattern:
 * step indicator (done/active/inactive circles + connecting bars),
 * Back/Next nav, required fields marked with asterisks, smart defaults
 * (core modules pre-selected), review summary, single primary action
 * per step (§22), warm Terra palette only (§6).
 *
 * On Create: builds a new TenantContext, persists it to global context
 * via registerTenant (no context hijack), fires a success toast, and navigates to the new
 * tenant's detail page.
 */

import { useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { moduleRegistry } from "@/lib/platform/module-registry";
import type { TenantContext } from "@/lib/platform/types";
import { startProvisioning } from "@/lib/platform/provisioning-saga";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
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
  Building2,
  Palette,
  Package,
  UserPlus,
  ScrollText,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "basics", label: "Basics", icon: Building2 },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "modules", label: "Modules", icon: Package },
  { id: "admin", label: "Admin", icon: UserPlus },
  { id: "review", label: "Review", icon: ScrollText },
];

const COLOR_PRESETS = [
  { name: "Forest", primary: "#4a7c59", accent: "#705c30", surface: "#f5efe6" },
  { name: "Sage", primary: "#5a7c4a", accent: "#8a6d30", surface: "#f5efe6" },
  { name: "Deep Green", primary: "#4a6c59", accent: "#705c30", surface: "#f5efe6" },
  { name: "Golden Brown", primary: "#705c30", accent: "#4a7c59", surface: "#f5efe6" },
  { name: "Warm Taupe", primary: "#8a7560", accent: "#4a7c59", surface: "#f5efe6" },
  { name: "Slate Green", primary: "#5a7060", accent: "#705c30", surface: "#f5efe6" },
];

const CORE_MODULE_IDS = ["trading", "challenges", "risk", "payouts", "settings"];

const PLAN_COST: Record<TenantContext["plan"], string> = {
  starter: "$890/mo",
  growth: "$1,900/mo",
  scale: "$4,900/mo",
  enterprise: "Custom",
};

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

/* ------------------------------------------------------------------ */
/* Wizard state                                                       */
/* ------------------------------------------------------------------ */

interface WizardState {
  name: string;
  slug: string;
  tagline: string;
  plan: TenantContext["plan"];
  currency: string;
  timezone: string;
  // Branding
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  radius: string;
  initials: string;
  logoUrl: string;
  // Modules
  enabledModules: string[];
  // Admin user
  adminEmail: string;
  adminName: string;
  // SSO (AUTH-24/25) — when contracted, saga sub-step 3a runs.
  contractSso: boolean;
}

const INITIAL_STATE: WizardState = {
  name: "",
  slug: "",
  tagline: "",
  plan: "growth",
  currency: "USD",
  timezone: "UTC",
  primaryColor: "#4a7c59",
  accentColor: "#705c30",
  surfaceColor: "#f5efe6",
  radius: "0.625rem",
  initials: "",
  logoUrl: "",
  enabledModules: [...CORE_MODULE_IDS],
  adminEmail: "",
  adminName: "",
  contractSso: false,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const REQUIRED_ASTERISK = <span className="text-rose-500" aria-hidden>*</span>;

/** Why is the current step's Next button disabled? (audit #3 fix #5) */
function stepValidationMessage(step: number): string {
  switch (step) {
    case 0:
      return "Tenant name and slug are required.";
    case 1:
      return "Initials and primary color are required.";
    case 2:
      return "Select at least one module.";
    case 3:
      return "Admin name and a valid email are required.";
    default:
      return "Complete the required fields to continue.";
  }
}

/* ------------------------------------------------------------------ */
/* Guided onboarding (audit #3 fix #4) — contextual help per step      */
/* ------------------------------------------------------------------ */

/** Best-practice guidance shown above each wizard step. */
const STEP_GUIDANCE: Array<{ title: string; tips: string[] }> = [
  {
    title: "Naming & plan — before you start",
    tips: [
      "The slug becomes the tenant's URL and API namespace — it cannot be changed once traders are onboarded.",
      "Match the plan to projected volume: Starter caps at 1,000 traders; talk to finance before assigning Enterprise.",
      "Set the reporting currency to where the firm invoices from — historical amounts are pinned to it.",
    ],
  },
  {
    title: "Branding — first impressions for traders",
    tips: [
      "Pick a primary color from the firm's existing website for consistency; presets pass contrast checks out of the box.",
      "The initials appear on certificates and the trader login page — use the firm's real logo initials.",
      "Everything here is white-labeled: traders never see platform branding.",
    ],
  },
  {
    title: "Modules — what the firm can access",
    tips: [
      "Core modules (trading, challenges, risk, payouts, settings) are pre-selected and required.",
      "Enable marketing/affiliates only if the firm runs acquisition programs — unused modules add dashboard noise.",
      "You can grant more modules later from the tenant detail page without reprovisioning.",
    ],
  },
  {
    title: "Administrator — the firm's first operator",
    tips: [
      "Use the firm owner's real email — they receive the invitation and set up the rest of the team.",
      "This account starts with full prop-admin permissions; the firm can create restricted staff roles afterwards.",
      "SSO (SAML/OIDC) must be contracted on the plan before provisioning; leave unchecked for local credentials.",
    ],
  },
  {
    title: "Review — the pre-flight checklist",
    tips: [
      "Provisioning is not instant: the saga typically completes in 2–4 minutes and can block on DNS.",
      "After creation you land on the live saga view — any blocker shows a Retry that resumes safely.",
      "Everything is editable later except the slug and plan-driven entitlement ceilings.",
    ],
  },
];

function StepGuidance({ step }: { step: number }) {
  const g = STEP_GUIDANCE[step];
  if (!g) return null;
  return (
    <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        {g.title}
      </p>
      <ul className="mt-1.5 space-y-1">
        {g.tips.map((tip) => (
          <li key={tip} className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <span className="mt-px text-primary" aria-hidden>•</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pre-flight checklist — flags common configuration mistakes (fix #4). */
function preflightChecks(state: WizardState): Array<{ ok: boolean; label: string; fix?: string }> {
  const checks: Array<{ ok: boolean; label: string; fix?: string }> = [];
  checks.push({
    ok: !/^(test|demo|tmp|foo|bar)/i.test(state.slug),
    label: "Slug looks production-ready",
    fix: /^(test|demo|tmp|foo|bar)/i.test(state.slug)
      ? "Slug starts with a placeholder word — traders will see it in URLs."
      : undefined,
  });
  checks.push({
    ok: state.enabledModules.length >= 5,
    label: "All core modules enabled",
    fix:
      state.enabledModules.length < 5
        ? "Firms need trading, challenges, risk, payouts, and settings to operate."
        : undefined,
  });
  checks.push({
    ok: !(state.contractSso && state.plan !== "enterprise" && state.plan !== "scale"),
    label: "SSO matches the plan tier",
    fix:
      state.contractSso && state.plan !== "enterprise" && state.plan !== "scale"
        ? "Contracted SSO requires a Scale or Enterprise plan."
        : undefined,
  });
  checks.push({
    ok: state.tagline.trim().length > 0,
    label: "Tagline filled in",
    fix: "Empty taglines show placeholder text on the trader login page.",
  });
  const domain = state.adminEmail.split("@")[1]?.toLowerCase() ?? "";
  checks.push({
    ok: domain.length > 0 && !/(gmail|yahoo|hotmail|outlook)\./i.test(domain),
    label: "Admin uses a company email",
    fix:
      domain.length > 0 && /(gmail|yahoo|hotmail|outlook)\./i.test(domain)
        ? "Consumer email domains look unprofessional on operator audit trails."
        : undefined,
  });
  checks.push({
    ok: state.currency !== "USD" || state.timezone !== "UTC",
    label: "Currency & timezone reviewed",
    fix:
      state.currency === "USD" && state.timezone === "UTC"
        ? "Defaults kept — confirm UTC is right for the firm's daily-loss reset."
        : undefined,
  });
  return checks;
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-medium text-muted-foreground">
      {children} {REQUIRED_ASTERISK}
    </Label>
  );
}

function FieldRow({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {required ? <RequiredLabel>{label}</RequiredLabel> : (
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      )}
      {children}
      {hint ? <p className="text-[10px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function CreateTenantPage() {
  const { navigate, registerTenant, pushNotification, user } = usePlatform();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [step, setStep] = useState(0);

  // Tenant modules only — the console's own super-admin module is never a
  // tenant entitlement. The catalog lives in lib/platform/module-catalog.ts.
  const allModules = moduleRegistry
    .getAll()
    .filter((m) => m.manifest.id !== "super-admin");

  /* ---- Validation per step ---- */
  const stepValid = (i: number): boolean => {
    switch (i) {
      case 0:
        return state.name.trim().length > 1 && state.slug.trim().length > 0;
      case 1:
        return state.initials.trim().length > 0 && state.primaryColor.length > 0;
      case 2:
        return state.enabledModules.length > 0;
      case 3:
        return (
          state.adminName.trim().length > 1 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.adminEmail)
        );
      case 4:
        return true;
      default:
        return false;
    }
  };

  const canNext = stepValid(step) && step < STEPS.length - 1;
  const canBack = step > 0;
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  /* ---- Create tenant ---- */
  const createTenant = () => {
    const id = `tenant-${state.slug}-${Math.random().toString(36).slice(2, 6)}`;
    const newTenant: TenantContext = {
      id,
      slug: state.slug,
      name: state.name,
      application: "prop-admin",
      branding: {
        name: state.name,
        tagline: state.tagline,
        logoUrl: state.logoUrl || undefined,
        initials: state.initials.toUpperCase(),
        primaryColor: state.primaryColor,
        accentColor: state.accentColor,
        surfaceColor: state.surfaceColor,
        radius: state.radius,
      },
      locale: "en-US",
      timezone: state.timezone,
      currency: state.currency,
      enabledModules: state.enabledModules,
      enabledFeatures: [],
      terminology: {},
      plan: state.plan,
      status: "provisioning",
      createdAt: new Date().toISOString(),
    };
    // Register the tenant in the platform roster WITHOUT hijacking the
    // operator's context — the super-admin stays in the Platform shell and
    // is taken to the live saga view the wizard now feeds (CON-03). The
    // tenant starts `provisioning` (03 §3.5 step 2) and the saga runner
    // drives it to `onboarding` on completion.
    registerTenant(newTenant);

    // Kick off the provisioning saga (CON-03 ← 03 §3.5). Sub-step 3a runs
    // only when the tenant contracted SSO.
    const job = startProvisioning({
      tenantId: id,
      tenantName: state.name,
      slug: state.slug,
      plan: state.plan,
      sso: state.contractSso,
      createdBy: user?.name ?? "Console operator",
    });

    pushNotification({
      title: "Provisioning started",
      message: `${state.name} — saga ${job.id} is running. Follow progress on the live view.`,
      severity: "info",
      module: "super-admin",
    });
    toast({
      title: "Provisioning started",
      description: `${state.name} — follow the 9-step saga on the live view.`,
    });
    setState(INITIAL_STATE);
    setStep(0);
    navigate("provisioning-saga", { job: job.id, tenant: id });
  };

  /* ---- Step content renderer ---- */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <BasicsStep state={state} setState={setState} />
        );
      case 1:
        return <BrandingStep state={state} setState={setState} />;
      case 2:
        return <ModulesStep state={state} setState={setState} allModules={allModules} />;
      case 3:
        return <AdminStep state={state} setState={setState} />;
      case 4:
        return (
          <ReviewStep
            state={state}
            allModules={allModules}
            onCreate={createTenant}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Page>
      <PageHeader
        title="Create Tenant"
        description="Guided wizard to provision a new tenant on the platform."
        icon={Sparkles}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("tenants")}>
            Cancel
          </Button>
        }
      />
      <PageContent>
        {/* Step indicator */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              // Keyboard navigation (audit #3 fix #5) — completed steps are
              // real buttons so keyboard users can jump back; the active
              // step carries aria-current for assistive tech.
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
                    {i > 0 ? (
                      <div className={cn("h-0.5 flex-1", i <= step ? "bg-primary" : "bg-muted")} />
                    ) : null}
                    {done ? (
                      <button
                        type="button"
                        onClick={() => setStep(i)}
                        aria-label={`Go back to step ${i + 1}: ${s.label}`}
                        className="rounded-full"
                      >
                        {circle}
                      </button>
                    ) : (
                      <span aria-current={active ? "step" : undefined}>{circle}</span>
                    )}
                    {i < STEPS.length - 1 ? (
                      <div className={cn("h-0.5 flex-1", i < step ? "bg-primary" : "bg-muted")} />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Screen-reader step announcements (audit #3 fix #5) */}
        <p role="status" aria-live="polite" className="sr-only">
          Step {step + 1} of {STEPS.length}: {STEPS[step].label}
          {!stepValid(step) ? " — some required fields are still incomplete." : ""}
        </p>

        {/* Step content */}
        <div className="rounded-lg border bg-card p-4 md:p-6">
          {/* Contextual guidance for the active step (audit #3 fix #4) */}
          <StepGuidance step={step} />
          <div className="min-h-[320px]">{renderStep()}</div>

          <Separator className="my-4" />

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={!canBack} onClick={back} className="gap-1">
              <ChevronLeft className="h-4 w-4" />Back
            </Button>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs text-muted-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
              {/* Validation feedback (audit #3 fix #5) — never leave a
                  disabled Next button unexplained. */}
              {!canNext && step < STEPS.length - 1 ? (
                <span role="alert" className="text-[11px] text-amber-700 dark:text-amber-400">
                  {stepValidationMessage(step)}
                </span>
              ) : null}
            </div>
            {step < STEPS.length - 1 ? (
              <Button size="sm" disabled={!canNext} onClick={next} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={createTenant} className="gap-1.5">
                <Check className="h-4 w-4" /> Create tenant
              </Button>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Basics                                                    */
/* ------------------------------------------------------------------ */

function BasicsStep({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));

  return (
    <div className="space-y-4">
      <div>
        <RequiredLabel>Tenant basics</RequiredLabel>
        <p className="text-xs text-muted-foreground">
          Set the tenant's identity and plan tier. You can change the plan later from the
          Billing tab.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldRow label="Tenant name" required hint="Display name shown across the platform.">
          <Input
            value={state.name}
            onChange={(e) => {
              const name = e.target.value;
              update({
                name,
                slug: slugify(name),
                initials: initialsFromName(name),
              });
            }}
            placeholder="Acme Trading"
          />
        </FieldRow>
        <FieldRow label="Slug" required hint="URL-safe identifier; auto-generated from the name.">
          <Input
            value={state.slug}
            onChange={(e) => update({ slug: slugify(e.target.value) })}
            placeholder="acme-trading"
          />
        </FieldRow>
        <FieldRow label="Tagline" hint="Short marketing descriptor shown in the shell.">
          <Input
            value={state.tagline}
            onChange={(e) => update({ tagline: e.target.value })}
            placeholder="Funded traders, faster."
          />
        </FieldRow>
        <FieldRow label="Plan" required hint="Determines monthly cost and feature ceilings.">
          <Select
            value={state.plan}
            onValueChange={(v) => update({ plan: v as TenantContext["plan"] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="starter">Starter — {PLAN_COST.starter}</SelectItem>
              <SelectItem value="growth">Growth — {PLAN_COST.growth}</SelectItem>
              <SelectItem value="scale">Scale — {PLAN_COST.scale}</SelectItem>
              <SelectItem value="enterprise">Enterprise — {PLAN_COST.enterprise}</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Currency" required hint="Default reporting currency for this tenant.">
          <Select
            value={state.currency}
            onValueChange={(v) => update({ currency: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD — US Dollar</SelectItem>
              <SelectItem value="GBP">GBP — British Pound</SelectItem>
              <SelectItem value="EUR">EUR — Euro</SelectItem>
              <SelectItem value="AED">AED — UAE Dirham</SelectItem>
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Timezone" required hint="Used for daily-loss reset and reporting.">
          <Select
            value={state.timezone}
            onValueChange={(v) => update({ timezone: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </div>

      {/* SSO contract → provisioning sub-step 3a (AUTH-24/25) */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox
            checked={state.contractSso}
            onCheckedChange={(v) => update({ contractSso: v === true })}
            className="mt-0.5"
          />
          <span className="space-y-0.5">
            <span className="text-sm font-medium leading-none">
              Tenant contracted SSO (SAML / OIDC)
            </span>
            <span className="block text-xs text-muted-foreground">
              Runs provisioning sub-step 3a (AUTH-24/25): registers the org&apos;s external IdP,
              assigns SSO roles, and issues the SCIM token. Leave unchecked if the tenant signs in
              with local credentials only.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Branding                                                  */
/* ------------------------------------------------------------------ */

function BrandingStep({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));
  // Progressive disclosure (audit #3 fix #4) — most firms pick a preset
  // and initials; fine-grained tuning stays available but out of the way.
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <RequiredLabel>Branding</RequiredLabel>
          <p className="text-xs text-muted-foreground">
            White-label colors and visuals. Apply instantly across the tenant's dashboard.
          </p>
        </div>
        <div>
          <Label className="mb-2 block text-xs">Color presets</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() =>
                  update({
                    primaryColor: p.primary,
                    accentColor: p.accent,
                    surfaceColor: p.surface,
                  })
                }
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs hover:bg-muted",
                  state.primaryColor === p.primary && "ring-1 ring-primary/40",
                )}
                style={{ borderColor: state.primaryColor === p.primary ? p.primary : undefined }}
              >
                <span className="h-3 w-3 rounded-sm" style={{ background: p.primary }} />
                <span className="h-3 w-3 rounded-sm" style={{ background: p.accent }} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow label="Primary color" required>
            <div className="flex gap-2">
              <input
                type="color"
                value={state.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
                className="h-9 w-12 rounded-md border"
              />
              <Input
                value={state.primaryColor}
                onChange={(e) => update({ primaryColor: e.target.value })}
              />
            </div>
          </FieldRow>
          <FieldRow label="Initials" required hint="Auto-generated from name; editable.">
            <Input
              value={state.initials}
              maxLength={3}
              onChange={(e) => update({ initials: e.target.value.toUpperCase() })}
            />
          </FieldRow>
        </div>
        {/* Advanced branding — progressive disclosure (audit #3 fix #4) */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="flex w-full items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")}
            aria-hidden
          />
          Advanced branding (accent, radius, logo)
        </button>
        {showAdvanced ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FieldRow label="Accent color" required>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={state.accentColor}
                  onChange={(e) => update({ accentColor: e.target.value })}
                  className="h-9 w-12 rounded-md border"
                />
                <Input
                  value={state.accentColor}
                  onChange={(e) => update({ accentColor: e.target.value })}
                />
              </div>
            </FieldRow>
            <FieldRow label="Border radius" required>
              <Select
                value={state.radius}
                onValueChange={(v) => update({ radius: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.25rem">Sharp (0.25rem)</SelectItem>
                  <SelectItem value="0.5rem">Subtle (0.5rem)</SelectItem>
                  <SelectItem value="0.625rem">Default (0.625rem)</SelectItem>
                  <SelectItem value="0.75rem">Rounded (0.75rem)</SelectItem>
                  <SelectItem value="1rem">Pill (1rem)</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Logo URL (optional)" hint="Leave blank to use initials.">
              <Input
                value={state.logoUrl}
                onChange={(e) => update({ logoUrl: e.target.value })}
                placeholder="https://..."
              />
            </FieldRow>
          </div>
        ) : null}
      </div>

      {/* Live preview */}
      <div>
        <Label className="mb-2 block text-xs">Live preview</Label>
        <div
          className="rounded-lg border p-6"
          style={{ background: state.surfaceColor }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-md text-base font-bold text-white shadow-sm"
              style={{ background: state.primaryColor, borderRadius: state.radius }}
            >
              {state.initials || "TN"}
            </span>
            <div>
              <p className="text-base font-semibold" style={{ color: state.primaryColor }}>
                {state.name || "Tenant Name"}
              </p>
              <p className="text-sm text-muted-foreground">
                {state.tagline || "Tagline preview"}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {/* Theme preview samples — decorative (not interactive), so they
                stay out of the tab order and hidden from screen readers. */}
            <Button
              size="sm"
              className="text-white"
              style={{
                background: state.primaryColor,
                borderColor: state.primaryColor,
                borderRadius: state.radius,
              }}
              tabIndex={-1}
              aria-hidden="true"
            >
              Primary button
            </Button>
            <Button
              size="sm"
              variant="outline"
              style={{
                color: state.accentColor,
                borderColor: state.accentColor,
                borderRadius: state.radius,
              }}
              tabIndex={-1}
              aria-hidden="true"
            >
              Accent button
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Modules                                                   */
/* ------------------------------------------------------------------ */

function ModulesStep({
  state,
  setState,
  allModules,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  allModules: ReturnType<typeof moduleRegistry.getAll>;
}) {
  const toggle = (moduleId: string) => {
    setState((s) => {
      const set = new Set(s.enabledModules);
      if (set.has(moduleId)) set.delete(moduleId);
      else set.add(moduleId);
      return { ...s, enabledModules: Array.from(set) };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <RequiredLabel>Module selection</RequiredLabel>
          <p className="text-xs text-muted-foreground">
            Pick which modules this tenant can access. Core modules are pre-selected.
          </p>
        </div>
        <Badge variant="secondary">
          {state.enabledModules.length} of {allModules.length} selected
        </Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allModules.map((m) => {
          const selected = state.enabledModules.includes(m.manifest.id);
          const Icon = m.manifest.icon;
          const accent = m.manifest.accentColor ?? state.primaryColor;
          const isCore = CORE_MODULE_IDS.includes(m.manifest.id);
          return (
            <div
              key={m.manifest.id}
              role="button"
              tabIndex={0}
              onClick={() => toggle(m.manifest.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(m.manifest.id);
                }
              }}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all hover:shadow-sm",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:border-primary/40",
              )}
              aria-pressed={selected}
            >
              <div className="flex w-full items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md p-1.5" style={{ background: `${accent}1a`, color: accent }}>
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">{m.manifest.name}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {m.manifest.category ?? "module"}
                    </p>
                  </div>
                </div>
                <Checkbox checked={selected} className="pointer-events-none" />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {m.manifest.description ?? "No description available."}
              </p>
              {isCore ? (
                <Badge variant="secondary" className="text-[9px]">Core</Badge>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Admin user                                                */
/* ------------------------------------------------------------------ */

function AdminStep({
  state,
  setState,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.adminEmail);

  return (
    <div className="space-y-4">
      <div>
        <RequiredLabel>Administrator</RequiredLabel>
        <p className="text-xs text-muted-foreground">
          The first prop-admin user for this tenant. They will receive an invitation email
          and can configure the rest of their team.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldRow label="Admin name" required>
          <Input
            value={state.adminName}
            onChange={(e) => update({ adminName: e.target.value })}
            placeholder="Sarah Chen"
          />
        </FieldRow>
        <FieldRow
          label="Admin email"
          required
          hint={state.adminEmail && !emailValid ? "Enter a valid email address." : undefined}
        >
          <Input
            type="email"
            value={state.adminEmail}
            onChange={(e) => update({ adminEmail: e.target.value })}
            placeholder="sarah@acme.io"
          />
        </FieldRow>
      </div>
      <Card className="bg-muted/20">
        <CardContent className="space-y-2 pt-6 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">What happens next?</strong> Creating starts the
            provisioning saga (CON-03 ← 03 §3.5): the tenant enters{" "}
            <Badge variant="outline" className="text-[9px]">provisioning</Badge> status and you're
            taken to the live saga view. Any step can block (e.g. DNS at step 5) — the view
            surfaces the blocker with a Retry that resumes idempotently. On completion the tenant
            becomes <Badge variant="outline" className="text-[9px]">onboarding</Badge>, the admin
            user is invited, and you can refine configuration, billing, and modules from the
            tenant detail page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 — Review                                                    */
/* ------------------------------------------------------------------ */

function ReviewStep({
  state,
  allModules,
  onCreate,
}: {
  state: WizardState;
  allModules: ReturnType<typeof moduleRegistry.getAll>;
  onCreate: () => void;
}) {
  const selectedModules = useMemo(
    () => allModules.filter((m) => state.enabledModules.includes(m.manifest.id)),
    [allModules, state.enabledModules],
  );
  // Pre-flight checklist (audit #3 fix #4) — flags common misconfigurations
  // before the provisioning saga starts, when they are still cheap to fix.
  const checks = useMemo(() => preflightChecks(state), [state]);
  const flagged = checks.filter((c) => !c.ok);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium text-muted-foreground">
          Review &amp; create
        </Label>
        <p className="text-xs text-muted-foreground">
          Confirm the configuration below. You can change everything later from the tenant detail page.
        </p>
      </div>
      {/* Pre-flight checklist — audit #3 fix #4 */}
      <div className="rounded-lg border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ListChecks className="h-3.5 w-3.5 text-primary" aria-hidden />
          Pre-flight checklist
          <span className="ml-auto font-normal text-muted-foreground">
            {checks.length - flagged.length}/{checks.length} passed
          </span>
        </p>
        <ul className="space-y-1">
          {checks.map((c) => (
            <li key={c.label} className="flex items-start gap-1.5 text-xs">
              {c.ok ? (
                <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
              )}
              <span className={c.ok ? "text-muted-foreground" : "text-foreground"}>
                {c.label}
                {c.fix ? <span className="block text-[11px] text-amber-700 dark:text-amber-400">{c.fix}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ReviewCard title="Basics">
          <ReviewRow label="Name" value={state.name} />
          <ReviewRow label="Slug" value={state.slug} mono />
          <ReviewRow label="Tagline" value={state.tagline || "—"} />
          <ReviewRow label="Plan" value={<Badge variant="outline" className="text-[10px] capitalize">{state.plan}</Badge>} />
          <ReviewRow label="Currency" value={state.currency} />
          <ReviewRow label="Timezone" value={state.timezone} />
        </ReviewCard>
        <ReviewCard title="Branding">
          <ReviewRow
            label="Initials"
            value={
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ background: state.primaryColor }}
              >
                {state.initials || "TN"}
              </span>
            }
          />
          <ReviewRow
            label="Primary"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ background: state.primaryColor }} />
                <span className="font-mono text-xs">{state.primaryColor}</span>
              </span>
            }
          />
          <ReviewRow
            label="Accent"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ background: state.accentColor }} />
                <span className="font-mono text-xs">{state.accentColor}</span>
              </span>
            }
          />
          <ReviewRow label="Radius" value={state.radius} />
        </ReviewCard>
        <ReviewCard title="Administrator">
          <ReviewRow label="Name" value={state.adminName} />
          <ReviewRow label="Email" value={state.adminEmail} mono />
          <ReviewRow
            label="SSO"
            value={
              <Badge variant="outline" className="text-[10px]">
                {state.contractSso ? "Contracted (sub-step 3a)" : "Local credentials only"}
              </Badge>
            }
          />
        </ReviewCard>
        <ReviewCard title={`Modules (${selectedModules.length})`}>
          <div className="flex flex-wrap gap-1">
            {selectedModules.map((m) => (
              <Badge key={m.manifest.id} variant="secondary" className="text-[9px]">
                {m.manifest.name}
              </Badge>
            ))}
          </div>
        </ReviewCard>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Provisioning starts in <Badge variant="outline" className="text-[9px]">provisioning</Badge>{" "}
          status and moves to <Badge variant="outline" className="text-[9px]">onboarding</Badge> once
          the saga completes.
        </p>
        <Button size="sm" onClick={onCreate} className="gap-1.5">
          <Check className="h-4 w-4" /> Create tenant
        </Button>
      </div>
    </div>
  );
}

function ReviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-right", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
