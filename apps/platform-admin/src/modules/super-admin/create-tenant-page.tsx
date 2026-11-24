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
 * via registerTenant (no context hijack), records a `tenant.create` audit
 * row, fires one notification + one toast, and navigates to the live
 * provisioning saga view.
 *
 * Resilience (create-tenant report, P1/P2):
 *   • every field is autosaved to `pfaas:createTenantDraft` — a refresh
 *     offers Resume / Discard instead of silently losing 5 steps;
 *   • Cancel and Discard confirm when the form is dirty (§17 state-first);
 *   • Create is idempotent: `isSubmitting` blocks double-clicks, the
 *     generated tenant id is held in a ref so a failed saga start can be
 *     retried without a second roster entry;
 *   • `?view=create-tenant&template={starter|growth|full|enterprise}`
 *     opens the wizard pre-filled from the shared template list.
 *
 * Follow-up (out of scope here, see create-tenant report P2-10): the
 * lifecycle's `invited` / `trial` entry states have no creation flow — a
 * "Create invite / trial" variant of this wizard is a separate round.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { moduleRegistry } from "@/lib/platform/module-registry";
import type { TenantContext } from "@/lib/platform/types";
import { startProvisioning } from "@/lib/platform/provisioning-saga";
import { openRun, stampStage, finishRun } from "@/lib/platform/onboarding-runs-store";
import { readTenants } from "@/lib/platform/tenant-store";
import { readPlans, usePlans } from "@/lib/platform/plan-catalog-store";
import { recordAudit } from "@/lib/platform/console-store";
import { formatCurrency } from "@/components/platform/status";
import { CURRENCIES } from "@/lib/platform/currency";
import { TENANT_REGIONS, regionLabel } from "@/lib/platform/regions";
import { deriveEnabledFeatures, deriveModuleRollout } from "@/lib/platform/tenant-features";
import {
  COLOR_PRESETS,
  CORE_MODULE_IDS,
  TENANT_TEMPLATES,
  tenantTemplateById,
  type TenantTemplate,
} from "@/lib/platform/tenant-templates";
import {
  clearDraft,
  CREATE_TENANT_DRAFT_VERSION,
  loadDraft,
  saveDraft,
  type CreateTenantDraft,
} from "@/lib/platform/create-tenant-draft";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  History,
  Loader2,
  Lock,
  Eraser,
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

/**
 * Reporting timezones offered at create. The wizard previously shipped
 * nine; the list now covers the desks that actually run prop firms
 * across regions (create-tenant report, P2-9).
 */
const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/**
 * Tenant shell locales (create-tenant report, P2-9) — `locale` used to be
 * hardcoded to `en-US` at create even though `TenantContext.locale`
 * exists and the seed roster ships `en-GB` too.
 */
const LOCALES = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "de-DE", label: "German" },
  { id: "fr-FR", label: "French" },
  { id: "es-ES", label: "Spanish" },
  { id: "pt-BR", label: "Portuguese (Brazil)" },
  { id: "ar-AE", label: "Arabic" },
  { id: "tr-TR", label: "Turkish" },
  { id: "ja-JP", label: "Japanese" },
];

/**
 * Plan → entitlement `supportTier` (lowercase; the detail header
 * capitalizes it and falls back to "standard").
 */
const SUPPORT_TIER_BY_PLAN: Record<TenantContext["plan"], string> = {
  starter: "standard",
  growth: "priority",
  scale: "dedicated",
  enterprise: "premium",
};

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
  /** Tenant shell locale (P2-9) — was hardcoded to `en-US` at create. */
  locale: string;
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
  /**
   * Owner / primary contact (P0-1). No input used to update these, so
   * every wizard-created tenant got `owner: ""`. They now derive from the
   * admin unless the operator opens "Owner differs from admin?".
   */
  owner?: string;
  ownerEmail?: string;
  // Price override settings (P2-4 — un-deadened, editable on Review).
  priceOverride?: number;  // Custom price to override plan base price
  discountPct?: number;   // Discount percentage (0-100) to apply on top
  // SSO (AUTH-24/25) — when contracted, saga sub-step 3a runs.
  contractSso: boolean;
  // R13 TM-09 — residency pin (data residency region).
  region?: string;
}

const INITIAL_STATE: WizardState = {
  name: "",
  slug: "",
  tagline: "",
  plan: "growth",
  currency: "USD",
  timezone: "UTC",
  locale: "en-US",
  primaryColor: "#4a7c59",
  accentColor: "#705c30",
  surfaceColor: "#f5efe6",
  radius: "0.625rem",
  initials: "",
  logoUrl: "",
  enabledModules: [...CORE_MODULE_IDS],
  adminEmail: "",
  adminName: "",
  owner: "",
  ownerEmail: "",
  // Price override defaults
  priceOverride: 0,  // 0 = use plan base price
  discountPct: 0,   // 0% discount on base price
  contractSso: false,
  region: undefined, // TM-09: unpinned by default
};

/* ------------------------------------------------------------------ */
/* Templates (audit B #10) — one click to a sane starting config.      */
/*                                                                     */
/* Moved to lib/platform/tenant-templates.ts (create-tenant report,    */
/* P2-6): the wizard is no longer the only consumer — `?template=`     */
/* deep links and future Tenants-screen entry points resolve the SAME  */
/* list, so the presets cannot drift. COLOR_PRESETS / CORE_MODULE_IDS  */
/* live there too and are re-imported below. All fields stay editable. */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Business-model personalization (audit B #6) — per-template tips   */
/* shown when a template is active, guiding the operator on           */
/* configuration best practices for their firm type.                   */
/* ------------------------------------------------------------------ */

/** Per-template business-model recommendations. */
const TENANT_BUSINESS_MODEL_RECOMMENDATIONS: Record<
  string,
  { title: string; tips: string[] }
> = {
  starter: {
    title: "Starter firm — lean launch focus",
    tips: [
      "Start with core modules only (trading, challenges, risk, payouts, settings).",
      "Enable additional modules later as the firm grows — unused modules add dashboard noise.",
      "Focus on trader onboarding and challenge completion to reach payout eligibility quickly.",
      "Set the reporting currency to match where the firm invoices from — historical amounts are pinned to it.",
    ],
  },
  growth: {
    title: "Growth firm — acquisition focus",
    tips: [
      "Enable analytics, affiliates, and marketing if the firm runs acquisition programs.",
      "CRM and support modules help retain and manage an expanding trader base.",
      "Consider the Scale plan when module count exceeds 8 — Scale caps are higher than Growth.",
      "Monitor affiliate commission structures to ensure they align with trader payout schedules.",
    ],
  },
  full: {
    title: "Full platform — enterprise operation",
    tips: [
      "Every module enabled provides comprehensive coverage but increases dashboard complexity.",
      "Compliance and AI modules require ongoing configuration and governance.",
      "Regular module audits ensure unused features don't clutter the operator experience.",
      "Set up SSO (SAML/OIDC) on the Scale or Enterprise plan for team management.",
    ],
  },
  enterprise: {
    title: "Enterprise + SSO — global desk",
    tips: [
      "Contracted SSO requires a Scale or Enterprise plan — verify plan tier before enabling.",
      "Configure SAML/OIDC identity provider before provisioning to avoid saga blocker.",
      "Global desks should establish regional admin roles and delegated permissions.",
      "Enterprise plan entitlements include higher trader ceilings and custom compliance rules.",
    ],
  },
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

/**
 * The tenant's resolved domain — previewed under the slug, shown on the
 * Review card, and written to `TenantContext.domain`. Assigned by the
 * saga at its DNS step; there is no availability check at create time.
 */
function domainFor(slug: string): string {
  return `${slug}.${slug}1.io`;
}

const REQUIRED_ASTERISK = <span className="text-rose-500" aria-hidden>*</span>;

/** Why is the current step's Next button disabled? (audit #3 fix #5) */
function stepValidationMessage(step: number, state?: WizardState, existingSlugs?: Set<string>): string {
  switch (step) {
    case 0:
      if (state && existingSlugs && state.slug && existingSlugs.has(state.slug)) {
        return `Slug "${state.slug}" is already taken. Choose a different slug.`;
      }
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
      "Pick a template chip first — it prefills plan, branding and the module set from a real firm profile; every field stays editable afterwards.",
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
      "Core modules (trading, challenges, risk, payouts, settings) are pre-selected and locked — every tenant needs them to operate.",
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
  const missingCore = CORE_MODULE_IDS.filter((id) => !state.enabledModules.includes(id));
  checks.push({
    ok: missingCore.length === 0,
    label: "All core modules enabled",
    fix:
      missingCore.length > 0
        ? `Firms need trading, challenges, risk, payouts and settings to operate — missing ${missingCore.join(", ")}.`
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
  // Residency vs pricing sanity — an EU pin invoiced in USD usually means
  // the operator picked the wrong side of the form.
  const euPinned = (state.region ?? "").startsWith("eu-");
  checks.push({
    ok: !euPinned || state.currency === "EUR",
    label: "Region & pricing currency agree",
    fix:
      euPinned && state.currency !== "EUR"
        ? `Data pinned to ${state.region} but invoiced in ${state.currency} — confirm FX exposure is intended.`
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
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  /** Inline validation message — announced via role="alert" (audit U #8). */
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const errorId = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-error`;
  return (
    <div className="space-y-1.5">
      {required ? <RequiredLabel>{label}</RequiredLabel> : (
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      )}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-[10px] font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {hint ? <p className="text-[10px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

/**
 * Confirmation for work-destroying actions (§17 state-first): the dialog
 * states the consequence and the choice is explicit. Controlled so one
 * surface can gate both Cancel and Discard-draft without a trigger button
 * living inside the dialog.
 */
function ConfirmAction({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export function CreateTenantPage() {
  const { navigate, registerTenant, pushNotification, user, router } = usePlatform();
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [step, setStep] = useState(0);
  // Audit B #10 — which template (if any) seeded the current state. Purely
  // a UI marker: manual edits keep the chip highlighted until another
  // template (or a reset) is chosen, so the operator always knows the
  // starting point of the form in front of them.
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);

  /* ---- Draft persistence (create-tenant report, P1-3) ---- */
  /** A draft found on mount — Resume / Discard is answered first, so the
   *  autosave never overwrites a prompt the operator hasn't seen. */
  const [pendingDraft, setPendingDraft] = useState<CreateTenantDraft<WizardState> | null>(null);
  /** Timestamp of the last successful autosave — drives the status chip. */
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  /** Single confirm surface for the two "throw this work away" moments. */
  const [confirming, setConfirming] = useState<null | "cancel" | "discard-draft">(null);

  /* ---- Create guard (create-tenant report, P2-3) ---- */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** The generated tenant id survives a failed create so a retry
   *  re-registers the SAME roster entry instead of orphaning a second. */
  const pendingIdRef = useRef<string | null>(null);
  /** `finishRun` / `recordAudit` fire once per create, even across retries. */
  const runClosedRef = useRef(false);
  const auditLoggedRef = useRef(false);

  const isDirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(INITIAL_STATE),
    [state],
  );

  // UC-P3 — open a time-to-value run so stage entries stamp; an
  // unfinished run resumes with its original startedAt instead.
  // Mount also resolves the `?template=` deep link (P2-5). A stored draft
  // only becomes the Resume/Discard prompt when no template was asked for
  // — an explicit deep link is a deliberate fresh start.
  useEffect(() => {
    openRun("create-tenant");
    const deepLinked = tenantTemplateById(router.params.template);
    if (deepLinked) {
      setState((s) => ({ ...s, ...deepLinked.patch }));
      setActiveTemplate(deepLinked.id);
      return;
    }
    const stored = loadDraft<WizardState>();
    if (stored && JSON.stringify(stored.state) !== JSON.stringify(INITIAL_STATE)) {
      setPendingDraft(stored);
    }
  }, [router.params.template]);

  // Debounced autosave — a refresh must never cost the operator their
  // configuration. Best-effort: `saveDraft` swallows storage failures so
  // typing never breaks in private-mode / quota-exhausted browsers.
  useEffect(() => {
    if (!isDirty || pendingDraft) return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      saveDraft<WizardState>({
        version: CREATE_TENANT_DRAFT_VERSION,
        state,
        step,
        activeTemplate,
        savedAt,
      });
      setDraftSavedAt(savedAt);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [state, step, activeTemplate, isDirty, pendingDraft]);

  // Unsaved-changes guard for refresh / tab close (§17 state-first).
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const resumeDraft = () => {
    if (!pendingDraft) return;
    setState(pendingDraft.state);
    setStep(Math.min(Math.max(pendingDraft.step, 0), STEPS.length - 1));
    setActiveTemplate(pendingDraft.activeTemplate);
    setDraftSavedAt(pendingDraft.savedAt);
    setPendingDraft(null);
    toast({
      title: "Draft resumed",
      description: `${pendingDraft.state.name || "Untitled tenant"} — step ${pendingDraft.step + 1} of ${STEPS.length}.`,
    });
  };

  const discardDraft = () => {
    clearDraft();
    setDraftSavedAt(null);
    setPendingDraft(null);
    setConfirming(null);
    // Reset the form too: a dirty state would re-trigger the debounced
    // autosave (or resurrect it if a timer was already pending), bringing
    // the just-discarded draft straight back.
    setState(INITIAL_STATE);
    setStep(0);
    setActiveTemplate(null);
  };

  const applyTemplate = (t: TenantTemplate) => {
    setState((s) => ({ ...s, ...t.patch }));
    setActiveTemplate(t.id);
    toast({
      title: `${t.label} template applied`,
      description: t.blurb,
    });
  };

  // Tenant modules only — the console's own super-admin module is never a
  // tenant entitlement. The catalog lives in lib/platform/module-catalog.ts.
  const allModules = moduleRegistry
    .getAll()
    .filter((m) => m.manifest.id !== "super-admin");

  /* ---- Validation per step ---- */
  const existingSlugs = useMemo(() => new Set(readTenants().map(t => t.slug)), []);
  const stepValid = (i: number): boolean => {
    switch (i) {
      case 0:
        // TM-11: slug uniqueness check.
        return state.name.trim().length > 1 && state.slug.trim().length > 0 && !existingSlugs.has(state.slug);
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
  // UC-P3 — advancing means the operator has ENTERED the next stage;
  // stamp it for the time-to-value panel (draft name, if any, labels
  // the run before the tenant exists).
  const next = () => {
    if (step >= STEPS.length - 1) return;
    stampStage("create-tenant", STEPS[step + 1].id, {
      tenantName: state.name.trim() || undefined,
    });
    setStep(step + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  /* ---- Create tenant ---- */
  const createTenant = () => {
    // Double-click guard (P2-3) — a second click before navigation would
    // race the roster write and the saga start.
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Idempotency: reuse the id generated by a previous failed attempt
      // so a retry cannot orphan a second roster entry (`addTenant` is a
      // no-op for an id that already exists).
      const id =
        pendingIdRef.current ??
        `tenant-${state.slug}-${Math.random().toString(36).slice(2, 6)}`;
      pendingIdRef.current = id;

      const actor = user?.name ?? "Console operator";
      // P0-1 — owner never lands empty: it derives from the first admin
      // unless the operator set a different owner on the Admin step.
      const owner = state.owner?.trim() || state.adminName;
      const ownerEmail = state.ownerEmail?.trim() || state.adminEmail;
      const createdAt = new Date().toISOString();
      // P1-2 — structural parity with the seed roster: feature flags
      // implied by the module selection, full rollout per enabled module.
      const enabledFeatures = deriveEnabledFeatures(state.enabledModules);
      const moduleRollout = deriveModuleRollout(state.enabledModules);
      const planDef = readPlans().find((p) => p.id === state.plan);

      const newTenant: TenantContext = {
        id,
        slug: state.slug,
        name: state.name,
        application: "prop-admin",
        domain: domainFor(state.slug),
        subdomain: state.slug,
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
        locale: state.locale,
        timezone: state.timezone,
        currency: state.currency,
        enabledModules: state.enabledModules,
        enabledFeatures,
        terminology: {},
        plan: state.plan,
        owner,
        ownerEmail,
        moduleRollout,
        // P2-7 — entitlement envelope prefilled from the plan catalog so
        // the detail page shows real ceilings instead of blanks.
        entitlements: planDef
          ? {
              seats: planDef.limits.traders,
              quotas: {
                apiCallsPerDay: planDef.limits.apiCallsPerDay,
                storageGb: planDef.limits.storageGb,
                eventsPerDay: planDef.limits.eventsPerDay,
              },
              supportTier: SUPPORT_TIER_BY_PLAN[state.plan],
            }
          : undefined,
        status: "provisioning",
        createdAt,
        // First billing cycle starts with the tenant (proration source).
        billingCycleAnchor: createdAt,
        // TM-09 — residency pin (data residency region).
        region: state.region,
        // P2-4 — commercial overrides, written only when actually set.
        ...(state.priceOverride && state.priceOverride > 0
          ? { priceOverride: state.priceOverride }
          : {}),
        ...(state.discountPct && state.discountPct > 0
          ? { discountPct: state.discountPct }
          : {}),
      };

      // Register the tenant in the platform roster WITHOUT hijacking the
      // operator's context — the super-admin stays in the Platform shell and
      // is taken to the live saga view the wizard now feeds (CON-03). The
      // tenant starts `provisioning` (03 §3.5 step 2) and the saga runner
      // drives it to `onboarding` on completion.
      registerTenant(newTenant);

      // P1-4 — creation is the highest-consequence action on this screen;
      // record it in the Platform Audit Log, not just in a toast.
      if (!auditLoggedRef.current) {
        auditLoggedRef.current = true;
        recordAudit({
          actor,
          action: "tenant.create",
          target: id,
          tenantId: id,
          severity: "info",
          detail: `${newTenant.name} (${state.slug}) created via the provisioning wizard — plan ${state.plan}, ${state.enabledModules.length} modules, region ${state.region ?? "unpinned"}, SSO ${state.contractSso ? "contracted" : "off"}, owner ${owner}.`,
        });
      }

      // UC-P3 — close the time-to-value run ("Tenant created" stamped);
      // days-to-live for this firm will be measured from goLive()'s liveAt.
      // Guarded: a retry must not open and finish a second run.
      if (!runClosedRef.current) {
        runClosedRef.current = true;
        finishRun("create-tenant", { tenantId: id, tenantName: newTenant.name });
      }

      // Kick off the provisioning saga (CON-03 ← 03 §3.5). Sub-step 3a runs
      // only when the tenant contracted SSO.
      const job = startProvisioning({
        tenantId: id,
        tenantName: state.name,
        slug: state.slug,
        plan: state.plan,
        sso: state.contractSso,
        adminName: state.adminName,
        adminEmail: state.adminEmail,
        owner,
        ownerEmail,
        createdBy: actor,
      });

      // P2-8 — one notification + one toast with deliberately different
      // copy: the notification is the durable center entry, the toast the
      // transient confirmation under the cursor.
      pushNotification({
        title: "Tenant created",
        message: `${newTenant.name} is provisioning — saga ${job.id} is running.`,
        severity: "success",
        module: "super-admin",
      });
      toast({
        title: "Tenant created",
        description: `${state.slug} — follow the 9-step saga on the live view.`,
      });

      // The configuration now belongs to the tenant, not to a draft.
      clearDraft();
      setDraftSavedAt(null);
      setPendingDraft(null);
      pendingIdRef.current = null;
      runClosedRef.current = false;
      auditLoggedRef.current = false;
      setState(INITIAL_STATE);
      setStep(0);
      setActiveTemplate(null);
      navigate("provisioning-saga", { job: job.id, tenant: id });
    } catch (err) {
      // Saga start failed. The tenant may already be registered — Retry
      // re-enters this handler with the SAME id, so nothing duplicates.
      const message = err instanceof Error ? err.message : "Provisioning could not be started.";
      setSubmitError(message);
      pushNotification({
        title: "Tenant creation failed",
        message: `${state.name || state.slug} — ${message}`,
        severity: "critical",
        module: "super-admin",
      });
      toast({
        title: "Creation failed",
        description: "Retry create resumes with the same tenant id — nothing is duplicated.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---- Step content renderer ---- */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <BasicsStep
            state={state}
            setState={setState}
            templates={TENANT_TEMPLATES}
            activeTemplate={activeTemplate}
            onApplyTemplate={applyTemplate}
            onClearTemplate={() => setActiveTemplate(null)}
            existingSlugs={existingSlugs}
          />
        );
      case 1:
        return <BrandingStep state={state} setState={setState} />;
      case 2:
        return <ModulesStep state={state} setState={setState} allModules={allModules} />;
      case 3:
        return <AdminStep state={state} setState={setState} />;
      case 4:
        return <ReviewStep state={state} setState={setState} allModules={allModules} />;
      default:
        return null;
    }
  };

  /**
   * Draft status bar (P1-3) — either the unanswered Resume / Discard
   * prompt or the autosave chip. Sits directly under the header so a
   * refresh can never be mistaken for a fresh form (§17 state-first).
   */
  const draftBar = pendingDraft ? (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3"
    >
      <div className="flex items-start gap-2 text-sm">
        <History
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden
        />
        <p>
          <span className="font-medium">Unsaved draft found</span> —{" "}
          {pendingDraft.state.name || "Untitled tenant"}, step{" "}
          {Math.min(pendingDraft.step + 1, STEPS.length)} of {STEPS.length}, saved{" "}
          {new Date(pendingDraft.savedAt).toLocaleString()}.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={resumeDraft} className="gap-1">
          <History className="h-3.5 w-3.5" aria-hidden /> Resume draft
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming("discard-draft")}>
          Discard
        </Button>
      </div>
    </div>
  ) : draftSavedAt ? (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-2.5"
    >
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <History className="h-3.5 w-3.5" aria-hidden />
        Draft saved · step {step + 1} of {STEPS.length} · last edited{" "}
        {new Date(draftSavedAt).toLocaleTimeString()}
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => setConfirming("discard-draft")}
      >
        Discard draft
      </Button>
    </div>
  ) : null;

  return (
    <Page>
      <PageHeader
        title="Create Tenant"
        description="Guided wizard to provision a new tenant on the platform."
        icon={Sparkles}
        actions={
          // §17 state-first — a dirty form confirms before it throws work
          // away; the draft itself survives so Resume can bring it back.
          isDirty ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirming("cancel")}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => navigate("tenants")}>
              Cancel
            </Button>
          )
        }
      />
      <PageContent>
        {draftBar}

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
            <Button
              variant="ghost"
              size="sm"
              disabled={!canBack || isSubmitting}
              onClick={back}
              className="gap-1"
            >
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
                  {stepValidationMessage(step, state, existingSlugs)}
                </span>
              ) : null}
              {/* Create failure (P2-3) — announce it and say why the
                  button now reads "Retry create". */}
              {submitError && step === STEPS.length - 1 ? (
                <span role="alert" className="max-w-[300px] text-[11px] text-destructive">
                  {submitError} — retrying keeps the same tenant id.
                </span>
              ) : null}
            </div>
            {step < STEPS.length - 1 ? (
              <Button size="sm" disabled={!canNext} onClick={next} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              /* §23 — one primary action per step: this footer button is
                 the ONLY Create CTA on Review (the card's duplicate was
                 removed). */
              <Button
                size="sm"
                onClick={createTenant}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="gap-1.5"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-4 w-4" aria-hidden />
                )}
                {submitError ? "Retry create" : "Create tenant"}
              </Button>
            )}
          </div>
        </div>

        {/* Work-destroying confirmations (§17 state-first) */}
        <ConfirmAction
          open={confirming === "cancel"}
          onOpenChange={(open) => setConfirming(open ? "cancel" : null)}
          title="Leave without creating the tenant?"
          description={
            state.name || state.slug
              ? `Your configuration for ${state.name || state.slug} is autosaved as a draft on this browser — resume it any time by reopening this wizard. Leave now?`
              : "Your unsaved configuration is autosaved as a draft on this browser. Leave now?"
          }
          confirmLabel="Leave"
          onConfirm={() => {
            setConfirming(null);
            navigate("tenants");
          }}
        />
        <ConfirmAction
          open={confirming === "discard-draft"}
          onOpenChange={(open) => setConfirming(open ? "discard-draft" : null)}
          title="Discard the saved draft?"
          description="The saved wizard configuration is removed from this browser. This cannot be undone."
          confirmLabel="Discard draft"
          destructive
          onConfirm={discardDraft}
        />
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
  templates,
  activeTemplate,
  onApplyTemplate,
  onClearTemplate,
  existingSlugs,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  templates: TenantTemplate[];
  activeTemplate: string | null;
  onApplyTemplate: (t: TenantTemplate) => void;
  onClearTemplate: () => void;
  /** Roster slugs — drives the inline "already taken" error (P1 target). */
  existingSlugs: Set<string>;
}) {
  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));
  // Canonical validation timing (audit U #8): real-time once a field has
  // been blurred — before that, stay quiet so the wizard isn't noisy.
  const [touched, setTouched] = useState({ name: false, slug: false });
  // Plan costs come from the operator-editable catalog (P1-5) — the
  // hardcoded PLAN_COST record went stale the moment a price changed.
  const plans = usePlans();
  const nameError =
    touched.name && !state.name.trim() ? "Tenant name is required." : undefined;
  const slugTaken = touched.slug && state.slug.length > 0 && existingSlugs.has(state.slug);
  const slugError = !state.slug.trim() && touched.slug
    ? "Slug is required."
    : slugTaken
      ? "Slug already taken — choose a different one."
      : undefined;

  // SSO is a contracted entitlement (P2-2): below Scale the checkbox is
  // disabled with the reason inline instead of only flagging it at Review.
  const ssoAllowed = state.plan === "scale" || state.plan === "enterprise";

  const active = templates.find((t) => t.id === activeTemplate);

  return (
    <div className="space-y-4">
      {/* Templates (audit B #10) — prefill plan, branding and modules from
          a real firm profile. aria-pressed marks the active chip; applying
          one only patches fields, every later edit sticks. */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          Start from a template
        </p>
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label="Tenant setup templates"
        >
          {templates.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === activeTemplate;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onApplyTemplate(t)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={activeTemplate === null && state.name === "" && state.slug === ""}
            onClick={() => {
              setState(INITIAL_STATE);
              onClearTemplate();
            }}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden />
            Blank form
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {active
            ? `${active.blurb} Applied to the fields below — everything stays editable.`
            : "A template prefills plan, branding and module selection from a real firm profile. Nothing is locked: edit any field afterwards."}
        </p>
      </div>

      {/* Business-model personalization (audit B #6) — shown when a template is active */}
      {activeTemplate && (
        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Sparkles className="h-3 w-3 text-primary" aria-hidden />
            {TENANT_BUSINESS_MODEL_RECOMMENDATIONS[activeTemplate].title}
          </p>
          <ul className="mt-1.5 space-y-1">
            {TENANT_BUSINESS_MODEL_RECOMMENDATIONS[activeTemplate].tips.map((tip) => (
              <li key={tip} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-px text-primary" aria-hidden>•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <RequiredLabel>Tenant basics</RequiredLabel>
        <p className="text-xs text-muted-foreground">
          Set the tenant's identity and plan tier. You can change the plan later from the
          Billing tab.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldRow label="Tenant name" required error={nameError} hint="Display name shown across the platform.">
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
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "tenant-name-error" : undefined}
            placeholder="Acme Trading"
          />
        </FieldRow>
        <FieldRow label="Slug" required error={slugError} hint="URL-safe identifier; auto-generated from the name.">
          <Input
            value={state.slug}
            onChange={(e) => update({ slug: slugify(e.target.value) })}
            onBlur={() => setTouched((t) => ({ ...t, slug: true }))}
            aria-invalid={slugError ? true : undefined}
            aria-describedby={slugError ? "slug-error" : undefined}
            placeholder="acme-trading"
          />
          {/* Resolved domain preview — assigned by the saga at its DNS
              step, so the operator sees the URL before committing. */}
          <p className="text-[10px] text-muted-foreground">
            {state.slug ? (
              <>
                <span className="font-mono text-foreground/80">{domainFor(state.slug)}</span> —
                assigned at provisioning
              </>
            ) : (
              "The domain preview appears once a slug is set."
            )}
          </p>
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
            onValueChange={(v) => {
              const plan = v as TenantContext["plan"];
              update({
                plan,
                // P2-2 — SSO is not entitled below Scale: drop the flag
                // rather than carry a box the saga would try to provision.
                contractSso:
                  plan === "scale" || plan === "enterprise" ? state.contractSso : false,
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {formatCurrency(p.priceMonthly, state.currency)}/mo
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>Live plan-catalog price — edit it on the plans page.</span>
            <SeePlanLimitsLink />
          </p>
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
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
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
        {/* P2-9 — locale used to be hardcoded to `en-US` at create. */}
        <FieldRow label="Locale" required hint="Shell language/region for the tenant's admin and trader UI.">
          <Select
            value={state.locale}
            onValueChange={(v) => update({ locale: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.id} — {l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        {/* TM-09 — residency pin. Options come from the canonical
            vocabulary (lib/platform/regions.ts) so wizard-created tenants
            group with the seeded roster in the Residency report. */}
        <FieldRow label="Data Residency Region" hint="Pin this tenant's payments/KYC data to a specific region. Leave unpinned for global.">
          <Select
            value={state.region ?? ""}
            onValueChange={(v) => update({ region: v || undefined })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unpinned (global)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Unpinned (global)</SelectItem>
              {TENANT_REGIONS.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </div>

      {/* SSO contract → provisioning sub-step 3a (AUTH-24/25) — gated at
          step 1 (P2-2) instead of only flagged on the Review checklist. */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <label
          className={cn(
            "flex items-start gap-2.5",
            ssoAllowed ? "cursor-pointer" : "cursor-not-allowed opacity-70",
          )}
        >
          <Checkbox
            checked={state.contractSso}
            disabled={!ssoAllowed}
            onCheckedChange={(v) => update({ contractSso: v === true })}
            className="mt-0.5"
            aria-describedby="contract-sso-hint"
          />
          <span className="space-y-0.5">
            <span className="text-sm font-medium leading-none">
              Tenant contracted SSO (SAML / OIDC)
            </span>
            <span id="contract-sso-hint" className="block text-xs text-muted-foreground">
              {ssoAllowed
                ? "Runs provisioning sub-step 3a (AUTH-24/25): registers the org's external IdP, assigns SSO roles, and issues the SCIM token. Leave unchecked if the tenant signs in with local credentials only."
                : "Requires a Scale or Enterprise plan — switch the plan above to contract SSO."}
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

/** Small link out to the plan catalog (§22 contextual actions). */
function SeePlanLimitsLink() {
  const { navigate } = usePlatform();
  return (
    <button
      type="button"
      onClick={() => navigate("plans")}
      className="shrink-0 text-primary underline-offset-2 hover:underline"
    >
      See plan limits
    </button>
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
    // P2-1 — core modules are locked. The guidance text and the Review
    // pre-flight both say core modules are required, so the cards are
    // inert rather than toggleable: an unoperable tenant is not a valid
    // configuration.
    if (CORE_MODULE_IDS.includes(moduleId)) return;
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
            Pick which modules this tenant can access. Core modules are required and locked.
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
              aria-disabled={isCore || undefined}
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
                isCore && "cursor-not-allowed",
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
                <Badge variant="secondary" className="gap-1 text-[9px]">
                  <Lock className="h-2.5 w-2.5" aria-hidden /> Core · required
                </Badge>
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

  /**
   * P0-1 — `owner` / `ownerEmail` had no inputs anywhere in the wizard, so
   * every created tenant was written with `owner: ""` (and the Tenants
   * screen's Owner column showed a blank). They now follow the admin
   * until the operator explicitly overrides them below.
   */
  const updateAdmin = (patch: Partial<WizardState>) =>
    setState((s) => {
      const next = { ...s, ...patch };
      if (patch.adminName !== undefined && !next.owner?.trim()) next.owner = patch.adminName;
      if (patch.adminEmail !== undefined && !next.ownerEmail?.trim()) {
        next.ownerEmail = patch.adminEmail;
      }
      return next;
    });

  // Progressive disclosure — the extra fields stay out of the way until
  // the owner really is someone other than the first admin.
  const [showOwner, setShowOwner] = useState(false);
  const ownerDiffers =
    !!state.owner?.trim() &&
    (state.owner.trim() !== state.adminName.trim() ||
      (state.ownerEmail?.trim() ?? "") !== state.adminEmail.trim());

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.adminEmail);
  // Canonical validation timing (audit U #8): real-time after blur, and
  // the moment a partial email stops being valid as the user types.
  const [touched, setTouched] = useState({ adminName: false, adminEmail: false });
  const nameError =
    touched.adminName && state.adminName.trim().length <= 1
      ? "Admin name is required."
      : undefined;
  const emailError = !emailValid && (touched.adminEmail || state.adminEmail)
    ? state.adminEmail
      ? "Enter a valid email address."
      : "Admin email is required."
    : undefined;

  const effectiveOwner = state.owner?.trim() || state.adminName.trim();
  const effectiveOwnerEmail = state.ownerEmail?.trim() || state.adminEmail.trim();

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
        <FieldRow label="Admin name" required error={nameError}>
          <Input
            value={state.adminName}
            onChange={(e) => updateAdmin({ adminName: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, adminName: true }))}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "admin-name-error" : undefined}
            placeholder="Sarah Chen"
          />
        </FieldRow>
        <FieldRow
          label="Admin email"
          required
          error={emailError}
        >
          <Input
            type="email"
            value={state.adminEmail}
            onChange={(e) => updateAdmin({ adminEmail: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, adminEmail: true }))}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "admin-email-error" : undefined}
            placeholder="sarah@acme.io"
          />
        </FieldRow>
      </div>

      {/* P0-1 — owner derivation, visible + overridable. */}
      <div className="rounded-lg border bg-muted/30 p-3">
        <button
          type="button"
          onClick={() => setShowOwner((v) => !v)}
          aria-expanded={showOwner}
          className="flex w-full items-center gap-1.5 text-xs font-medium text-foreground"
        >
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", showOwner && "rotate-180")}
            aria-hidden
          />
          Owner differs from admin?
          {ownerDiffers ? (
            <Badge variant="secondary" className="ml-auto text-[9px]">Custom owner</Badge>
          ) : (
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">
              defaults to the admin
            </span>
          )}
        </button>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Owner on record:{" "}
          <span className="font-medium text-foreground">{effectiveOwner || "—"}</span>
          {effectiveOwnerEmail ? (
            <>
              {" · "}
              <span className="font-mono">{effectiveOwnerEmail}</span>
            </>
          ) : null}
          {" — "}used for billing notices, invites and breach alerts.
        </p>
        {showOwner ? (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <FieldRow label="Owner name" hint="Primary contact of the firm. Leave as-is to keep the admin.">
              <Input
                value={state.owner ?? ""}
                onChange={(e) => update({ owner: e.target.value })}
                placeholder="Firm owner"
              />
            </FieldRow>
            <FieldRow label="Owner email" hint="Leave blank to reuse the admin email.">
              <Input
                type="email"
                value={state.ownerEmail ?? ""}
                onChange={(e) => update({ ownerEmail: e.target.value })}
                placeholder="owner@acme.io"
              />
            </FieldRow>
          </div>
        ) : null}
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
  setState,
  allModules,
}: {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  allModules: ReturnType<typeof moduleRegistry.getAll>;
}) {
  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));
  // Live plan catalog — the Review must show what the operator would be
  // billed, not a hardcoded string that went stale (P1-5).
  const plans = usePlans();
  const planDef = plans.find((p) => p.id === state.plan) ?? plans[0];
  const selectedModules = useMemo(
    () => allModules.filter((m) => state.enabledModules.includes(m.manifest.id)),
    [allModules, state.enabledModules],
  );
  // P1-2 — what actually lands on the tenant, shown so the operator can
  // see the derived flag set instead of discovering it on the detail page.
  const derivedFeatures = useMemo(
    () => deriveEnabledFeatures(state.enabledModules),
    [state.enabledModules],
  );
  // Pre-flight checklist (audit #3 fix #4) — flags common misconfigurations
  // before the provisioning saga starts, when they are still cheap to fix.
  const checks = useMemo(() => preflightChecks(state), [state]);
  const flagged = checks.filter((c) => !c.ok);

  // P2-4 — effective commercial terms: plan price (or override), less the
  // discount. `0` on either field means "plan price / no discount".
  const basePrice =
    state.priceOverride && state.priceOverride > 0
      ? state.priceOverride
      : planDef?.priceMonthly ?? 0;
  const discountPct = Math.min(Math.max(state.discountPct ?? 0, 0), 100);
  const effectivePrice = Math.round(basePrice * (1 - discountPct / 100));

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
          <ReviewRow label="Locale" value={state.locale} />
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
            label="Owner"
            value={state.owner?.trim() || state.adminName || "—"}
          />
          <ReviewRow
            label="Owner email"
            value={state.ownerEmail?.trim() || state.adminEmail || "—"}
            mono
          />
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
          <p className="pt-1 text-[11px] text-muted-foreground">
            {derivedFeatures.length} feature{derivedFeatures.length === 1 ? "" : "s"} derived at
            create: {derivedFeatures.join(", ") || "none"}.
          </p>
        </ReviewCard>
      </div>

      {/* P1-5 — residency and commercial terms were collected on step 1
          but never shown before create; Review is the full contract. */}
      <ReviewCard title="Deployment & commercial">
        <div className="grid gap-x-6 gap-y-1.5 md:grid-cols-2">
          <ReviewRow
            label="Region"
            value={
              state.region ? (
                <Badge variant="outline" className="text-[10px]">
                  {regionLabel(state.region)}
                </Badge>
              ) : (
                "Unpinned (global)"
              )
            }
          />
          <ReviewRow label="Domain" value={<span className="font-mono text-xs">{domainFor(state.slug)}</span>} />
          <ReviewRow
            label="Plan price"
            value={`${formatCurrency(planDef?.priceMonthly ?? 0, state.currency)}/mo`}
          />
          <ReviewRow
            label="Effective price"
            value={
              <span className={cn(discountPct > 0 || (state.priceOverride ?? 0) > 0 ? "text-primary" : undefined)}>
                {formatCurrency(effectivePrice, state.currency)}/mo
                {discountPct > 0 ? ` (−${discountPct}%)` : ""}
                {(state.priceOverride ?? 0) > 0 ? " (override)" : ""}
              </span>
            }
          />
          <ReviewRow
            label="Entitlements"
            value={
              planDef
                ? `${planDef.limits.traders.toLocaleString()} seats · ${planDef.limits.apiCallsPerDay.toLocaleString()} API/day`
                : "—"
            }
          />
          <ReviewRow
            label="Support tier"
            value={<span className="capitalize">{SUPPORT_TIER_BY_PLAN[state.plan]}</span>}
          />
        </div>
        {/* P2-4 — these two fields existed in state (and were persisted by
            no one); they are now real, optional, and wired through. */}
        <div className="mt-3 grid gap-3 border-t pt-3 md:grid-cols-2">
          <FieldRow label="Price override" hint="0 = plan price. Per-tenant custom price.">
            <Input
              type="number"
              min={0}
              step={50}
              value={state.priceOverride ?? 0}
              onChange={(e) =>
                update({ priceOverride: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </FieldRow>
          <FieldRow label="Discount %" hint="0–100 — applied on top of the price above.">
            <Input
              type="number"
              min={0}
              max={100}
              value={state.discountPct ?? 0}
              onChange={(e) =>
                update({
                  discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                })
              }
            />
          </FieldRow>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Entitlements are prefilled from the {planDef?.name ?? "selected"} plan and stay editable
          on the tenant detail page.
        </p>
      </ReviewCard>

      <Separator />
      {/* §23 — one primary action per step: the Create button lives in the
          footer nav only; the duplicate that used to sit here is gone. */}
      <p className="text-xs text-muted-foreground">
        Provisioning starts in <Badge variant="outline" className="text-[9px]">provisioning</Badge>{" "}
        status and moves to <Badge variant="outline" className="text-[9px]">onboarding</Badge> once
        the saga completes.
      </p>
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
