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
 *   ④ Connectors  → integrations-store (assignment per connector; KYC
 *                                     providers are owned by step ③)
 *   ⑤ Risk        → risk-defaults-store (the SAME values the Risk Engine
 *                                     page reads and writes)
 *   ⑥ Review      → tenant-store      status: provisioning → active
 *                     + console-store  recordAudit for every step
 *
 * Progress (which tenant, which step, what's complete) lives only in
 * go-live-store; the facts live in the target stores and the review step
 * reads them back from there — no second copy. localStorage-backed, so
 * leaving the page mid-run and coming back resumes at the saved step.
 *
 * Go-live report hardening:
 *   • P0 — every save is idempotent: the step-① tenant id is held in a
 *     ref so a double-click/retry reuses ONE roster entry, slug
 *     uniqueness is re-checked at write time (not just render time) and
 *     every audit row is recorded at most once per distinct payload.
 *     "Go live" first opens a consequence-stating confirmation; the
 *     status flip, `go_live.completed` audit, `finishRun` and the
 *     notification fire exactly once on confirm.
 *   • P0 — step ① writes the SAME tenant shape Create Tenant writes:
 *     owner + owner email, region pin, real domain, locale, branding
 *     preset, derived feature flags and 100 % module rollout.
 *   • P1 — plan cards render from the live `plan-catalog-store` (price,
 *     limits, current-plan badge, billing note, Advanced overrides);
 *     unsaved input autosaves to a Resume/Discard draft with a
 *     beforeunload guard; provider health is shown honestly and a
 *     non-connected provider needs an explicit "mark connected anyway"
 *     acknowledgement that lands in the audit detail; entry points and
 *     `?tenant=<id>` deep links preselect the run; the review step gains
 *     an advisory readiness checklist, per-row Edit jumps and "unsaved"
 *     suffixes; Restart confirms before destroying progress.
 *   • P2 — shared vocabularies (timezones, locales, currencies, plans,
 *     regions, color presets) are imported, never redeclared.
 *
 * Honest scope: the wizard registers the tenant and writes the settings
 * above. It does NOT start the 9-step provisioning saga — Create Tenant
 * owns that (CON-03); the review checklist surfaces that gap instead of
 * hiding it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { useTenants, updateTenant, readTenants } from "@/lib/platform/tenant-store";
import { recordAudit } from "@/lib/platform/console-store";
import { openRun, finishRun } from "@/lib/platform/onboarding-runs-store";
import {
  useIntegrationOverrides,
  setIntegrationOverride,
  type IntegrationOverride,
} from "@/lib/platform/integrations-store";
import {
  SEED_INTEGRATIONS,
  type SeedIntegration,
} from "@/lib/platform/integrations-catalog";
import {
  useRiskParams,
  setRiskParams,
  DEFAULT_RISK_PARAMS,
  type TenantRiskParams,
} from "@/lib/platform/risk-defaults-store";
import {
  useGoLive,
  readGoLive,
  completeStep,
  patchGoLive,
  resetGoLive,
} from "@/lib/platform/go-live-store";
import {
  GO_LIVE_DRAFT_VERSION,
  loadGoLiveDraft,
  saveGoLiveDraft,
  clearGoLiveDraft,
  type GoLiveDraft,
} from "@/lib/platform/go-live-draft";
import { usePlans } from "@/lib/platform/plan-catalog-store";
import { TENANT_REGIONS, regionLabel } from "@/lib/platform/regions";
import {
  deriveEnabledFeatures,
  deriveModuleRollout,
} from "@/lib/platform/tenant-features";
import { COLOR_PRESETS, CORE_MODULE_IDS } from "@/lib/platform/tenant-templates";
import { CURRENCIES } from "@/lib/platform/currency";
import { TIMEZONES, LOCALES } from "@/lib/platform/timezones";
import { useProvisioningStore } from "@/lib/platform/provisioning-saga";
import type { TenantContext } from "@/lib/platform/types";
import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { StatusBadge } from "@/components/platform/status";
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
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  Activity,
  Search,
  History,
  Pencil,
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
  { id: "connectors", label: "Connectors", icon: Plug, writesTo: "integrations-store (assignment)" },
  { id: "risk", label: "Risk", icon: Gauge, writesTo: "risk-defaults-store (shared with Risk Engine)" },
  { id: "review", label: "Go live", icon: ScrollText, writesTo: "tenant-store (status → active) + audit log" },
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

/** Slugs the platform (or its DNS conventions) reserves — never a tenant. */
const RESERVED_SLUGS = new Set(["www", "admin", "app", "api", "mail", "ftp", "blog", "root", "support", "billing"]);

/** Same identity shape Create Tenant writes — never drifted per wizard. */
const INITIAL_FORM = {
  name: "",
  slug: "",
  slugTouched: false,
  region: "us-east-1",
  timezone: "UTC",
  currency: "USD",
  locale: "en-US",
  domain: "",
  owner: "",
  ownerEmail: "",
  preset: 0,
  existingId: "",
  priceOverride: 0,
  discountPct: 0,
  advancedTouched: false,
};

type GoLiveForm = typeof INITIAL_FORM;

function validRange(value: string, min: number, max: number): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max;
}

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

function integrationName(id: string): string {
  if (id === "manual") return "Manual review";
  return SEED_INTEGRATIONS.find((i) => i.id === id)?.name ?? id;
}

/** API-call ceilings read as 100K / 1M instead of 1000000. */
function fmtApi(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return String(n);
}

/** Tenant statuses read distinctly in the existing-tenant picker. */
function tenantStatusTone(s: string) {
  switch (s) {
    case "active":
      return "success";
    case "trial":
    case "invited":
      return "info";
    case "suspended":
    case "provisioning_failed":
      return "danger";
    case "terminated":
    case "rolled_back":
      return "muted";
    case "provisioning":
    case "onboarding":
      return "warning";
    default:
      return "default";
  }
}

/** Effective integration health badge (override merged over seed). */
function healthBadge(status: "connected" | "disconnected" | "error") {
  if (status === "connected") return <StatusBadge tone="success">Connected</StatusBadge>;
  if (status === "error") return <StatusBadge tone="danger">Error</StatusBadge>;
  return <StatusBadge tone="muted">Disconnected</StatusBadge>;
}

/**
 * Single confirmation surface for the two "throw operator work away"
 * moments (restart progress, discard draft) — consequence stated,
 * destructive confirm styled red (AGENTS #24).
 */
function ConfirmDialog({
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
          <AlertDialogCancel>Cancel</AlertDialogCancel>
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
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function GoLiveWizardPage() {
  const { navigate, registerTenant, pushNotification, user, router } = usePlatform();
  const progress = useGoLive();
  const tenants = useTenants();
  const overrides = useIntegrationOverrides();
  const riskMap = useRiskParams();
  const plans = usePlans();
  const { jobs } = useProvisioningStore();

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
  const [form, setForm] = useState<GoLiveForm>(INITIAL_FORM);
  const [planChoice, setPlanChoice] = useState<TenantContext["plan"] | null>(null);
  const [kycChoice, setKycChoice] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[] | null>(null);
  const [riskDraft, setRiskDraft] = useState<TenantRiskParams | null>(null);

  /* ---- P0-a save guards ---- */
  const [isSaving, setIsSaving] = useState(false);
  /** Re-entrancy guard: a second invocation while one save is in flight
   *  (double Enter / click in the same frame) no-ops. */
  const savingRef = useRef(false);
  /** Step ①'s generated id survives a failed/partial attempt so a retry
   *  re-registers the SAME roster entry — never an orphaned twin. State
   *  rather than a ref because the render-time slug check reads it too. */
  const [ownTenantId, setOwnTenantId] = useState<string | null>(null);
  /** Every audit row recorded at most once per (action, tenant, detail)
   *  in this run — the trail can never duplicate on a double-click. */
  const auditTrailRef = useRef<Set<string>>(new Set());
  /** go_live.completed (audit + finishRun + notification) fires once. */
  const goLiveLoggedRef = useRef(false);
  /** Connectors the wizard itself force-connected — unassigning restores
   *  the seed status only for these, and only when nobody else uses it. */
  const wizardConnectedRef = useRef<Set<string>>(new Set());

  /* ---- P0-a / P1-f confirmations ---- */
  const [confirmGoLive, setConfirmGoLive] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmDiscardDraft, setConfirmDiscardDraft] = useState(false);

  /* ---- P1-b draft persistence ---- */
  const [pendingDraft, setPendingDraft] = useState<GoLiveDraft<GoLiveForm, TenantRiskParams> | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  /* ---- P1-c provider-health acknowledgement (signature-scoped so a
   *       different selection starts unacknowledged again) ---- */
  const [ackKycFor, setAckKycFor] = useState<string | null>(null);
  const [ackConnSig, setAckConnSig] = useState<string | null>(null);

  /* ---- P2-c existing-tenant picker ---- */
  const [tenantSearch, setTenantSearch] = useState("");
  const [showAllTenants, setShowAllTenants] = useState(false);

  /* ---- P1-a advanced plan overrides ---- */
  const [showAdvanced, setShowAdvanced] = useState(false);

  // UC-P3 — open a time-to-value run so stage entries stamp; an
  // unfinished run resumes with its original startedAt instead.
  useEffect(() => {
    openRun("go-live");
  }, []);

  // P1-d — `?view=go-live-wizard&tenant=<id>` preselects existing mode
  // and parks the run on step ② (AGENTS #51). An explicit deep link is a
  // deliberate fresh start, so the Resume/Discard prompt stays
  // suppressed; without the param, a stored draft becomes that prompt.
  useEffect(() => {
    const deepTenantId = router.params.tenant;
    if (!deepTenantId) {
      const stored = loadGoLiveDraft<GoLiveForm, TenantRiskParams>();
      const p = readGoLive();
      if (
        stored &&
        !p.done &&
        (stored.form.name || stored.form.slug || stored.form.existingId || stored.riskDraft)
      ) {
        setPendingDraft(stored);
      }
      return;
    }
    const target = readTenants().find((t) => t.id === deepTenantId);
    if (!target) return;
    setMode("existing");
    setForm((f) => ({ ...f, existingId: target.id }));
    const p = readGoLive();
    if (p.tenantId === target.id) {
      if (p.step === 0) patchGoLive({ tenantId: target.id, step: 1 });
    } else {
      // The run on record belongs to a different tenant (or none) — it
      // cannot be resumed against this one.
      resetGoLive();
      patchGoLive({ tenantId: target.id, step: 1 });
    }
    setPendingDraft(null);
  }, [router.params.tenant]);

  const isDirty = useMemo(
    () =>
      JSON.stringify(form) !== JSON.stringify(INITIAL_FORM) || riskDraft !== null,
    [form, riskDraft],
  );

  // Debounced autosave — a refresh must never cost the operator their
  // typed input (P1-b). Best-effort: saveGoLiveDraft swallows storage
  // failures so typing never breaks in private-mode/quota browsers.
  useEffect(() => {
    if (!isDirty || pendingDraft || progress.done) return;
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      saveGoLiveDraft<GoLiveForm, TenantRiskParams>({
        version: GO_LIVE_DRAFT_VERSION,
        mode,
        form,
        riskDraft,
        step,
        savedAt,
      });
      setDraftSavedAt(savedAt);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isDirty, pendingDraft, progress.done, mode, form, riskDraft, step]);

  // Unsaved-changes guard for refresh / tab close (AGENTS #17).
  useEffect(() => {
    if (!isDirty || progress.done) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, progress.done]);

  // The run finished — its input now belongs to the tenant, not a draft.
  useEffect(() => {
    if (!progress.done) return;
    clearGoLiveDraft();
    setDraftSavedAt(null);
    setPendingDraft(null);
  }, [progress.done]);

  const assignedIds = tenant
    ? SEED_INTEGRATIONS.filter((i) =>
        (overrides[i.id]?.assignedTenants ?? []).includes(tenant.id),
      ).map((i) => i.id)
    : [];
  /** Step ④ owns non-KYC connectors only — Persona/Sumsub belong to ③. */
  const connectorSeeds = useMemo(
    () => SEED_INTEGRATIONS.filter((s) => s.category !== "kyc"),
    [],
  );
  const assignedConnectorIds = assignedIds.filter((id) =>
    connectorSeeds.some((s) => s.id === id),
  );
  const planValue = planChoice ?? tenant?.plan ?? "growth";
  const kycValue = kycChoice ?? tenant?.kycProvider ?? "";
  const pickValue = picks ?? assignedConnectorIds;
  const storedRisk = tenant ? (riskMap[tenant.id] ?? DEFAULT_RISK_PARAMS) : DEFAULT_RISK_PARAMS;
  const riskValue = riskDraft ?? storedRisk;

  const planLabel = (id: string) => plans.find((p) => p.id === id)?.name ?? id;

  /** Effective status: operator override merged over the seed catalog. */
  const integrationStatus = (id: string): "connected" | "disconnected" | "error" =>
    overrides[id]?.status ??
    SEED_INTEGRATIONS.find((s) => s.id === id)?.status ??
    "disconnected";

  const unhealthyPicks = pickValue.filter((id) => integrationStatus(id) !== "connected");
  const connAckSig = unhealthyPicks.join(",");

  /** Unsaved step-① input — previewed to the operator before save. */
  const derivedDomain = form.slug ? `app.${form.slug}.io` : "";
  const domainValue = (form.domain.trim() || derivedDomain).toLowerCase();

  const slugProblem = !form.slug
    ? ""
    : form.slug.length > 32
      ? "Slug must be 32 characters or fewer."
      : !/^[a-z0-9-]+$/.test(form.slug)
        ? "Lowercase letters, digits and dashes only."
        : RESERVED_SLUGS.has(form.slug)
          ? `"${form.slug}" is reserved — pick another slug.`
          : "";
  const slugTaken = Boolean(
    form.slug &&
      !slugProblem &&
      tenants.some((t) => t.slug === form.slug && t.id !== ownTenantId),
  );

  const filteredTenants = tenants.filter((t) => {
    if (!showAllTenants && (t.status === "active" || t.status === "terminated")) return false;
    const q = tenantSearch.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
  });

  /** P2-3 — per-status guidance once an existing tenant is selected. */
  const existingStatusHint = (() => {
    if (mode !== "existing" || !form.existingId) return "";
    const t = tenants.find((x) => x.id === form.existingId);
    if (!t) return "That tenant no longer exists — pick another.";
    switch (t.status) {
      case "active":
        return "Already active — going live only re-stamps the audit trail; liveAt is kept.";
      case "suspended":
        return "Suspended — going live reactivates the firm for traders.";
      case "terminated":
        return "Terminated — this reactivates a firm that was offboarded.";
      case "provisioning":
        return "Still provisioning — the 9-step saga has not run; consider Create Tenant first.";
      case "provisioning_failed":
        return "Provisioning failed — resume it from the tenant detail before go-live.";
      case "rolled_back":
        return "Provisioning was rolled back — restart it before go-live.";
      default:
        return "";
    }
  })();

  /* ---- Validation & navigation ---- */

  const stepHint = (i: number): string => {
    switch (i) {
      case 0:
        if (mode === "existing") return form.existingId ? "" : "Pick a tenant to continue.";
        if (form.name.trim().length <= 1) return "Tenant name is required.";
        if (!form.slug) return "Slug is required.";
        if (slugProblem) return slugProblem;
        if (slugTaken) return "That slug is already in use.";
        if (!form.owner.trim()) return "Owner name is required.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.ownerEmail.trim()))
          return "A valid owner email is required.";
        if (
          domainValue &&
          !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domainValue)
        )
          return "Domain must look like app.meridian.io.";
        return "";
      case 1:
        if (!tenant) return "Register or pick a tenant first.";
        if (form.advancedTouched) {
          if (!Number.isFinite(form.priceOverride) || form.priceOverride < 0)
            return "Price override must be 0 or more.";
          if (!Number.isFinite(form.discountPct) || form.discountPct < 0 || form.discountPct > 100)
            return "Discount must be between 0 and 100.";
        }
        return "";
      case 2:
        if (!tenant) return "Register or pick a tenant first.";
        if (!kycValue) return "Choose a KYC provider (or manual review).";
        if (kycValue !== "manual" && integrationStatus(kycValue) !== "connected" && ackKycFor !== kycValue)
          return `${integrationName(kycValue)} is not connected — tick “Mark connected anyway” to continue.`;
        return "";
      case 3:
        if (!tenant) return "Register or pick a tenant first.";
        if (pickValue.length === 0) return "Connect at least one connector.";
        if (unhealthyPicks.length > 0 && ackConnSig !== unhealthyPicks.join(","))
          return `${unhealthyPicks.length} selected connector(s) are not connected — tick “Mark connected anyway” to continue.`;
        return "";
      case 4: {
        if (!tenant) return "Register or pick a tenant first.";
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
    setAckKycFor(null);
    setAckConnSig(null);
  };

  /* ---- P0-a idempotent save plumbing ---- */

  const guarded = (fn: () => void) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      fn();
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  /** recordAudit at most once per (action, tenant, detail) in this run. */
  const recordOnce = (entry: Parameters<typeof recordAudit>[0]): boolean => {
    const key = `${entry.action}|${entry.tenantId ?? ""}|${entry.detail ?? ""}`;
    if (auditTrailRef.current.has(key)) return false;
    auditTrailRef.current.add(key);
    recordAudit(entry);
    return true;
  };

  /** Full reset of the run: progress, draft, pending choices, guards. */
  const resetRunState = () => {
    resetGoLive();
    clearGoLiveDraft();
    // UC-P3 — if the previous attempt already finished, the next one
    // gets its own time-to-value run (an unfinished one just resumes).
    openRun("go-live");
    setMode("new");
    setForm(INITIAL_FORM);
    clearDrafts();
    setDraftSavedAt(null);
    setPendingDraft(null);
    setTenantSearch("");
    setShowAllTenants(false);
    setShowAdvanced(false);
    setOwnTenantId(null);
    auditTrailRef.current = new Set();
    goLiveLoggedRef.current = false;
    wizardConnectedRef.current = new Set();
  };

  const restart = () => {
    // P1-f — confirm only when there IS progress to destroy.
    if (progress.completed.length > 0 || progress.tenantId) {
      setConfirmRestart(true);
      return;
    }
    resetRunState();
    toast({ title: "Wizard restarted", description: "Progress reset — saved settings in the target stores are kept." });
  };

  const doRestart = () => {
    setConfirmRestart(false);
    resetRunState();
    toast({ title: "Wizard restarted", description: "Progress reset — saved settings in the target stores are kept." });
  };

  /** Orphaned run — swap the dead tenant for a live one without a full
   *  three-click detour through Restart → mode toggle → search. */
  const pickAnotherTenant = () => {
    resetRunState();
    setMode("existing");
    toast({ title: "Pick a tenant", description: "Progress reset — choose the firm this run should continue on." });
  };

  const resumeDraft = () => {
    if (!pendingDraft) return;
    setMode(pendingDraft.mode);
    setForm(pendingDraft.form);
    setRiskDraft(pendingDraft.riskDraft);
    setDraftSavedAt(pendingDraft.savedAt);
    setPendingDraft(null);
    toast({
      title: "Draft resumed",
      description: `${pendingDraft.form.name || pendingDraft.form.existingId || "Untitled firm"} — picked up where you left off.`,
    });
  };

  const discardDraft = () => {
    clearGoLiveDraft();
    setDraftSavedAt(null);
    setPendingDraft(null);
    setConfirmDiscardDraft(false);
    // Reset the form too: a dirty state would re-trigger the debounced
    // autosave (or resurrect a pending timer), bringing the just-discarded
    // draft straight back.
    setMode("new");
    setForm(INITIAL_FORM);
    setRiskDraft(null);
    setPlanChoice(null);
    setKycChoice(null);
    setPicks(null);
    setAckKycFor(null);
    setAckConnSig(null);
  };

  /* ---- Step ① — Tenant → tenant-store ---- */

  const saveTenant = () =>
    guarded(() => {
      if (mode === "existing") {
        const target = readTenants().find((t) => t.id === form.existingId);
        if (!target) {
          toast({
            title: "Tenant not found",
            description: "The previous selection no longer exists — pick a tenant from the list.",
            variant: "destructive",
          });
          return;
        }
        clearDrafts();
        const firstTime =
          !readGoLive().completed.includes("tenant") || readGoLive().tenantId !== target.id;
        patchGoLive({ tenantId: target.id });
        completeStep("tenant", 1, { tenantId: target.id, tenantName: target.name });
        recordOnce({
          actor,
          action: "go_live.run_started",
          target: target.name,
          tenantId: target.id,
          severity: "info",
          detail: `Go-live run started on an existing tenant (status ${target.status}, wizard)`,
        });
        if (firstTime)
          toast({ title: "Target tenant set", description: `${target.name} — progress saved; leave and resume anytime.` });
        return;
      }

      // ---- New tenant: write-time validation (render hints can go stale
      // between click and write) ----
      const roster = readTenants();
      const name = form.name.trim();
      const owner = form.owner.trim();
      const ownerEmail = form.ownerEmail.trim();
      if (name.length <= 1) {
        toast({ title: "Tenant name required", description: "Give the firm a name before saving.", variant: "destructive" });
        return;
      }
      if (!form.slug || slugProblem) {
        toast({ title: "Invalid slug", description: slugProblem || "Slug is required.", variant: "destructive" });
        return;
      }
      if (!owner || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
        toast({ title: "Owner required", description: "Owner name and a valid owner email are required.", variant: "destructive" });
        return;
      }
      // P0-a — the id is generated ONCE per run; a retry after failure (or
      // a double click racing a stale roster) reuses the SAME id.
      const id = ownTenantId ?? `tenant-${form.slug}-${Math.random().toString(36).slice(2, 6)}`;
      if (roster.some((t) => t.id !== id && t.slug === form.slug)) {
        toast({ title: "Slug already in use", description: `"${form.slug}" belongs to another tenant — pick a different slug.`, variant: "destructive" });
        return;
      }

      const domain = domainValue;
      const preset = COLOR_PRESETS[form.preset] ?? COLOR_PRESETS[0];
      const branding = {
        name,
        tagline: "",
        initials: initialsFromName(name),
        primaryColor: preset.primary,
        accentColor: preset.accent,
        surfaceColor: preset.surface,
        radius: "0.625rem",
      };

      const stored = roster.find((t) => t.id === id);
      if (stored) {
        // Idempotent re-save of THIS run's tenant: one roster entry, one
        // audit row — only real edits apply.
        const b = stored.branding;
        const changed =
          stored.name !== name ||
          stored.slug !== form.slug ||
          stored.domain !== domain ||
          stored.locale !== form.locale ||
          stored.timezone !== form.timezone ||
          stored.currency !== form.currency ||
          stored.owner !== owner ||
          stored.ownerEmail !== ownerEmail ||
          stored.region !== form.region ||
          b.initials !== branding.initials ||
          b.primaryColor !== branding.primaryColor ||
          b.accentColor !== branding.accentColor ||
          b.surfaceColor !== branding.surfaceColor;
        if (changed) {
          updateTenant(id, {
            name,
            slug: form.slug,
            domain,
            locale: form.locale,
            timezone: form.timezone,
            currency: form.currency,
            owner,
            ownerEmail,
            region: form.region,
            // Preserve fields this wizard never collects (logo, tagline).
            branding: { ...b, name, initials: branding.initials, primaryColor: branding.primaryColor, accentColor: branding.accentColor, surfaceColor: branding.surfaceColor },
          });
          recordOnce({
            actor,
            action: "go_live.tenant_registered",
            target: name,
            tenantId: id,
            severity: "info",
            detail: `Tenant identity updated in the go-live wizard — owner ${ownerEmail}, region ${form.region}, domain ${domain}`,
          });
          toast({ title: "Tenant updated", description: `${name} — identity fields persisted in tenant-store.` });
        }
        patchGoLive({ tenantId: id });
        completeStep("tenant", 1, { tenantId: id, tenantName: name });
        return;
      }

      setOwnTenantId(id);
      const createdAt = new Date().toISOString();
      // P0-1 — full identity parity with Create Tenant's shape: derived
      // feature flags, full module rollout, residency pin, real domain.
      const newTenant: TenantContext = {
        id,
        slug: form.slug,
        name,
        application: "prop-admin",
        domain,
        subdomain: form.slug,
        branding,
        locale: form.locale,
        timezone: form.timezone,
        currency: form.currency,
        region: form.region,
        enabledModules: [...CORE_MODULE_IDS],
        enabledFeatures: deriveEnabledFeatures(CORE_MODULE_IDS),
        terminology: {},
        plan: "growth",
        status: "provisioning",
        createdAt,
        owner,
        ownerEmail,
        moduleRollout: deriveModuleRollout(CORE_MODULE_IDS),
        priceOverride: 0,
        discountPct: 0,
        // First billing cycle starts with the tenant (proration source).
        billingCycleAnchor: createdAt,
      };
      // Same mechanism as Create Tenant — registered WITHOUT hijacking the
      // operator's context; the provisioning saga is not started here.
      registerTenant(newTenant);
      clearDrafts();
      const firstTime =
        !readGoLive().completed.includes("tenant") || readGoLive().tenantId !== id;
      patchGoLive({ tenantId: id });
      completeStep("tenant", 1, { tenantId: id, tenantName: newTenant.name });
      recordOnce({
        actor,
        action: "go_live.tenant_registered",
        target: newTenant.name,
        tenantId: id,
        severity: "info",
        detail: `Tenant ${newTenant.slug} registered with status "provisioning" (go-live wizard) — owner ${ownerEmail}, region ${form.region}, domain ${domain}`,
      });
      if (firstTime)
        toast({
          title: "Tenant registered",
          description: `${newTenant.name} persisted in tenant-store with status "provisioning".`,
        });
    });

  /* ---- Step ② — Plan → tenant-store ---- */

  const savePlan = () =>
    guarded(() => {
      if (!tenant) return;
      const patch: Partial<TenantContext> = { plan: planValue };
      if (form.advancedTouched) {
        patch.priceOverride = form.priceOverride;
        patch.discountPct = form.discountPct;
      }
      updateTenant(tenant.id, patch);
      const recorded = recordOnce({
        actor,
        action: "go_live.plan_set",
        target: tenant.name,
        tenantId: tenant.id,
        severity: "info",
        detail: `Plan → ${planLabel(planValue)}${
          form.advancedTouched
            ? ` · price override $${form.priceOverride}/mo · discount ${form.discountPct}%`
            : " · billing cycle untouched"
        }`,
      });
      setPlanChoice(null); // display now reads back from tenant-store
      completeStep("plan", 2);
      if (recorded)
        toast({ title: "Plan saved", description: `${tenant.name} → ${planLabel(planValue)}. Persisted in tenant-store.` });
    });

  /* ---- Step ③ — KYC → integrations-store + tenant.kycProvider ---- */

  const saveKyc = () =>
    guarded(() => {
      if (!tenant || !kycValue) return;
      const before = kycValue !== "manual" ? integrationStatus(kycValue) : "connected";
      if (kycValue !== "manual") {
        const prev = overrides[kycValue]?.assignedTenants ?? [];
        const patch: Partial<IntegrationOverride> = {
          assignedTenants: prev.includes(tenant.id) ? prev : [...prev, tenant.id],
        };
        if (before !== "connected") {
          // P1-c — health is not "connected"; the save was gated on an
          // explicit "Mark connected anyway" ack and the audit detail
          // below records the override. Remember it so unassigning later
          // can restore the seed status.
          patch.status = "connected";
          wizardConnectedRef.current.add(kycValue);
        }
        setIntegrationOverride(kycValue, patch);
      }
      updateTenant(tenant.id, { kycProvider: kycValue });
      const recorded = recordOnce({
        actor,
        action: "go_live.kyc_selected",
        target: tenant.name,
        tenantId: tenant.id,
        severity: "info",
        detail: `KYC provider → ${integrationName(kycValue)}${
          kycValue !== "manual" && before !== "connected"
            ? ` (was ${before} — marked connected anyway per operator acknowledgement)`
            : ""
        }`,
      });
      setKycChoice(null);
      completeStep("kyc", 3);
      if (recorded)
        toast({
          title: "KYC provider saved",
          description: `${integrationName(kycValue)} — stored on ${tenant.name} (tenant.kycProvider${kycValue === "manual" ? "" : " + integration assignment"}).`,
        });
    });

  /* ---- Step ④ — Connectors → integrations-store ---- */

  const saveConnectors = () =>
    guarded(() => {
      if (!tenant || pickValue.length === 0) return;
      // Add this tenant to every picked connector, remove it from every
      // unpicked one that had it — other tenants' assignments are kept.
      // KYC providers are deliberately NOT touched: step ③ owns them.
      for (const seed of connectorSeeds) {
        const prev = overrides[seed.id]?.assignedTenants ?? [];
        const had = prev.includes(tenant.id);
        const wants = pickValue.includes(seed.id);
        if (wants && !had) {
          const current = integrationStatus(seed.id);
          const patch: Partial<IntegrationOverride> = { assignedTenants: [...prev, tenant.id] };
          if (current !== "connected") {
            patch.status = "connected";
            wizardConnectedRef.current.add(seed.id);
          }
          setIntegrationOverride(seed.id, patch);
        } else if (!wants && had) {
          const nextAssigned = prev.filter((x) => x !== tenant.id);
          const patch: Partial<IntegrationOverride> = { assignedTenants: nextAssigned };
          // P1-c — if the WIZARD forced this connector to connected and
          // no tenant remains assigned, unassigning restores the seed
          // status so the Integrations page stops claiming a connector
          // the wizard just dropped.
          if (
            nextAssigned.length === 0 &&
            integrationStatus(seed.id) === "connected" &&
            seed.status !== "connected" &&
            wizardConnectedRef.current.has(seed.id)
          ) {
            patch.status = seed.status;
            wizardConnectedRef.current.delete(seed.id);
          }
          setIntegrationOverride(seed.id, patch);
        }
      }
      const recorded = recordOnce({
        actor,
        action: "go_live.connectors_set",
        target: tenant.name,
        tenantId: tenant.id,
        severity: "info",
        detail: `${pickValue.length} connector(s) assigned: ${pickValue.map(integrationName).join(", ")}`,
      });
      setPicks(null); // display now reads back from integrations-store
      completeStep("connectors", 4);
      if (recorded)
        toast({
          title: "Connectors saved",
          description: `${pickValue.length} assigned to ${tenant.name} — persisted; the Integrations page shows the same state.`,
        });
    });

  /* ---- Step ⑤ — Risk defaults → risk-defaults-store ---- */

  const saveRisk = () =>
    guarded(() => {
      if (!tenant) return;
      if (RISK_FIELDS.some((f) => !validRange(riskValue[f.key], f.min, f.max))) return;
      setRiskParams(tenant.id, riskValue);
      const recorded = recordOnce({
        actor,
        action: "go_live.risk_defaults_set",
        target: tenant.name,
        tenantId: tenant.id,
        severity: "info",
        detail: `daily loss ${riskValue.dailyLoss}% · max DD ${riskValue.maxDd}% · target ${riskValue.profitTarget}% · min days ${riskValue.minDays}`,
      });
      setRiskDraft(null); // display now reads back from risk-defaults-store
      completeStep("risk", 5);
      if (recorded)
        toast({
          title: "Risk defaults saved",
          description: `${tenant.name} — persisted; the Risk Engine page shows the same values.`,
        });
    });

  /* ---- Step ⑥ — Review → tenant-store status + audit ---- */

  const provisioningJob = tenant ? jobs.find((j) => j.tenantId === tenant.id) : undefined;

  /** P1-e — advisory readiness: every gap is listed, none blocks the
   *  flip; anything outstanding is recorded in the audit detail so
   *  "go live anyway" is a deliberate, auditable choice. */
  const readiness: {
    label: string;
    ok: boolean;
    detail: string;
    link?: { label: string; view: string; params?: Record<string, string> };
  }[] = tenant
    ? [
        {
          label: "Identity & owner",
          ok: Boolean(tenant.owner && tenant.ownerEmail),
          detail:
            tenant.owner && tenant.ownerEmail
              ? `${tenant.owner} · ${tenant.ownerEmail}`
              : "No owner recorded — set it in step ①.",
        },
        {
          label: "Region pinned",
          ok: Boolean(tenant.region),
          detail: tenant.region ? regionLabel(tenant.region) : "Unpinned — data falls back to platform defaults.",
        },
        { label: "Plan", ok: Boolean(tenant.plan), detail: planLabel(tenant.plan) },
        {
          label: "KYC provider",
          ok: Boolean(tenant.kycProvider),
          detail: tenant.kycProvider ? integrationName(tenant.kycProvider) : "Not chosen — pick one in step ③.",
        },
        {
          label: "Connectors",
          ok: assignedConnectorIds.length > 0,
          detail: assignedConnectorIds.length
            ? `${assignedConnectorIds.length} assigned: ${assignedConnectorIds.map(integrationName).join(", ")}`
            : "None assigned — step ④.",
        },
        {
          label: "Risk defaults",
          ok: Boolean(riskMap[tenant.id]),
          detail: riskMap[tenant.id] ? "Custom defaults saved for this tenant." : "Platform defaults — not customized yet.",
        },
        {
          label: "Provisioning",
          ok: provisioningJob?.state === "completed",
          detail: !provisioningJob
            ? "Not run — this firm has no modules rollout or admin invite. Recommended: run Create Tenant provisioning first."
            : provisioningJob.state === "completed"
              ? "9-step saga completed."
              : provisioningJob.state === "compensated"
                ? "Provisioning was compensated (rolled back) — review before go-live."
                : `Provisioning ${provisioningJob.state} — follow it on the saga view.`,
          link: !provisioningJob
            ? { label: "Run Create Tenant provisioning →", view: "create-tenant" }
            : provisioningJob.state !== "completed"
              ? { label: "View provisioning run →", view: "provisioning-saga", params: { job: provisioningJob.id, tenant: tenant.id } }
              : undefined,
        },
      ]
    : [];
  const readinessGaps = readiness.filter((r) => !r.ok);

  const executeGoLive = () => {
    setConfirmGoLive(false);
    if (!tenant || goLiveLoggedRef.current) return;
    goLiveLoggedRef.current = true;
    // liveAt is stamped once — first activation only — so days-to-live
    // measures the firm's FIRST go-live (UC-P3).
    updateTenant(tenant.id, {
      status: "active",
      liveAt: tenant.liveAt ?? new Date().toISOString(),
    });
    recordOnce({
      actor,
      action: "go_live.completed",
      target: tenant.name,
      tenantId: tenant.id,
      // P2-2 — a firm going live is business-significant.
      severity: "warning",
      detail: `Status → active · plan ${planLabel(tenant.plan)} · KYC ${integrationName(tenant.kycProvider || "manual")} · ${assignedIds.length} connector(s) · risk ${storedRisk.dailyLoss}/${storedRisk.maxDd}/${storedRisk.profitTarget}/${storedRisk.minDays}${
        readinessGaps.length
          ? ` · readiness gaps accepted: ${readinessGaps.map((g) => g.label).join(", ")}`
          : ""
      }`,
    });
    // UC-P3 — close the time-to-value run ("Firm live" stamped).
    finishRun("go-live", { tenantId: tenant.id, tenantName: tenant.name });
    patchGoLive({ done: true, step: STEP_META.length - 1 });
    pushNotification({
      title: "Tenant live",
      message: `${tenant.name} is active on ${planLabel(tenant.plan)}.`,
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
                  <Label htmlFor="gl-name">Firm name <span className="text-rose-500" aria-hidden>*</span></Label>
                  <Input
                    id="gl-name"
                    value={form.name}
                    placeholder="e.g. Meridian Capital"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        name: e.target.value,
                        // P2-5 — slug follows the name until edited by hand.
                        slug: f.slugTouched ? f.slug : slugify(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-slug">Slug <span className="text-rose-500" aria-hidden>*</span></Label>
                  <Input
                    id="gl-slug"
                    value={form.slug}
                    maxLength={32}
                    placeholder="e.g. meridian"
                    aria-describedby="gl-slug-hint"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slug: e.target.value.toLowerCase(), slugTouched: true }))
                    }
                  />
                  <p id="gl-slug-hint" aria-live="polite">
                    {form.slug ? (
                      slugProblem ? (
                        <span className="text-[10px] text-rose-600">{slugProblem}</span>
                      ) : slugTaken ? (
                        <span className="text-[10px] text-rose-600">Already used by another tenant.</span>
                      ) : (
                        <span className="text-[10px] text-emerald-600">Available · resolves to {derivedDomain}</span>
                      )
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Auto-derived from the firm name — editable.</span>
                    )}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-region">Data residency region <span className="text-rose-500" aria-hidden>*</span></Label>
                  <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
                    <SelectTrigger id="gl-region"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TENANT_REGIONS.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Pins payments/KYC data — shows as pinned in the Residency report.</p>
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
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-locale">Locale</Label>
                  <Select value={form.locale} onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}>
                    <SelectTrigger id="gl-locale"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LOCALES.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.id} — {l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-owner">Owner name <span className="text-rose-500" aria-hidden>*</span></Label>
                  <Input id="gl-owner" value={form.owner} placeholder="e.g. Dana Whitfield"
                    onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-owner-email">Owner email <span className="text-rose-500" aria-hidden>*</span></Label>
                  <Input id="gl-owner-email" type="email" value={form.ownerEmail} placeholder="e.g. dana@meridian.io"
                    onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="gl-domain">Domain</Label>
                  <Input id="gl-domain" value={form.domain} placeholder={derivedDomain || "app.meridian.io"}
                    onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} />
                  <p className="text-[10px] text-muted-foreground">
                    Saved as <span className="font-mono">{domainValue || "—"}</span> — a real pattern (never
                    <span className="font-mono"> {form.slug}.{form.slug}1.io</span>); edit only if the firm has its own domain.
                  </p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Branding</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((p, i) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, preset: i }))}
                        aria-pressed={form.preset === i}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                          form.preset === i ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                        )}
                      >
                        <span className="flex h-4 w-4 overflow-hidden rounded-full border" aria-hidden>
                          <span className="w-1/2" style={{ background: p.primary }} />
                          <span className="w-1/2" style={{ background: p.accent }} />
                        </span>
                        {p.name}
                        {form.preset === i && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>
                    ))}
                    <span
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{ background: (COLOR_PRESETS[form.preset] ?? COLOR_PRESETS[0]).primary }}
                      aria-hidden
                    >
                      {initialsFromName(form.name) || "??"}
                    </span>
                  </div>
                </div>
                {/* P2-6 — cross-field sanity (mirrors Create Tenant). */}
                {form.region.startsWith("eu-") && form.currency !== "EUR" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 sm:col-span-2">
                    Data pinned to {regionLabel(form.region)} but invoiced in {form.currency} — confirm FX exposure is intended.
                  </p>
                )}
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Registered with status <Badge variant="outline" className="font-mono text-[10px]">provisioning</Badge>, the
                  core module set, derived feature flags and 100% rollout. The 9-step provisioning saga is started from{" "}
                  <button type="button" className="underline underline-offset-2" onClick={() => navigate("create-tenant")}>
                    Create Tenant
                  </button>{" "}
                  (CON-03) — not here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      value={tenantSearch}
                      onChange={(e) => setTenantSearch(e.target.value)}
                      placeholder="Search by name or slug…"
                      className="h-9 pl-8"
                      aria-label="Search tenants"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={showAllTenants}
                      onCheckedChange={(v) => setShowAllTenants(v === true)}
                      aria-label="Show all tenants including active and terminated"
                    />
                    Show all statuses
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gl-existing">Tenant</Label>
                  <Select value={form.existingId} onValueChange={(v) => setForm((f) => ({ ...f, existingId: v }))}>
                    <SelectTrigger id="gl-existing"><SelectValue placeholder="Pick a tenant…" /></SelectTrigger>
                    <SelectContent>
                      {filteredTenants.length === 0 && (
                        <SelectItem value="__none" disabled>No tenants match</SelectItem>
                      )}
                      {filteredTenants.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            <span className="truncate">{t.name}</span>
                            <span className="text-muted-foreground">· {t.plan} ·</span>
                            <StatusBadge tone={tenantStatusTone(t.status)} className="text-[9px]">
                              {t.status.replace("_", " ")}
                            </StatusBadge>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!showAllTenants && (
                    <p className="text-[10px] text-muted-foreground">
                      Active and terminated tenants are hidden — tick “Show all statuses” to pick them anyway.
                    </p>
                  )}
                  {existingStatusHint && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">{existingStatusHint}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Useful for a tenant that already exists (e.g. created by Create Tenant and waiting to go live).
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Firm doesn&apos;t exist yet?{" "}
                  <button type="button" className="underline underline-offset-2" onClick={() => navigate("create-tenant")}>
                    Create Tenant
                  </button>{" "}
                  provisions it — and runs the 9-step saga this wizard skips (CON-03).
                </p>
              </div>
            )}
          </div>
        );

      /* ② Plan */
      case 1: {
        const advPrice = form.advancedTouched ? form.priceOverride : tenant?.priceOverride ?? 0;
        const advDiscount = form.advancedTouched ? form.discountPct : tenant?.discountPct ?? 0;
        return (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((p) => (
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{p.name}</span>
                    <span className="flex items-center gap-1.5">
                      {tenant?.plan === p.id && (
                        <Badge variant="secondary" className="text-[9px]">current plan</Badge>
                      )}
                      {planValue === p.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </span>
                  </div>
                  <p className="mt-0.5 text-lg font-semibold tabular-nums">
                    ${p.priceMonthly.toLocaleString()}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {p.limits.traders.toLocaleString()} traders · {fmtApi(p.limits.apiCallsPerDay)} API calls/day ·{" "}
                    {p.limits.storageGb} GB storage
                  </p>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Saved with <code className="font-mono">updateTenant(id, {"{ plan }"})</code> — the same write the Tenant
              Detail “Change plan” control performs (W1-05). Billing is untouched: no invoice is raised and{" "}
              <code className="font-mono">billingCycleAnchor</code> keeps its value.
            </p>
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                Advanced settings <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
              </Button>
              {showAdvanced && (
                <div className="mt-1 grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="gl-price">Price override ($/mo)</Label>
                    <Input
                      id="gl-price"
                      type="number"
                      min={0}
                      step={10}
                      value={advPrice}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, advancedTouched: true, priceOverride: Number(e.target.value) || 0 }))
                      }
                      className="h-9 tabular-nums"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      0 = plan catalog price (${(plans.find((p) => p.id === planValue)?.priceMonthly ?? 0).toLocaleString()}/mo).
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gl-disc">Discount (%)</Label>
                    <Input
                      id="gl-disc"
                      type="number"
                      min={0}
                      max={100}
                      value={advDiscount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, advancedTouched: true, discountPct: Number(e.target.value) || 0 }))
                      }
                      className="h-9 tabular-nums"
                    />
                    <p className="text-[10px] text-muted-foreground">0–100, applied on top of the price.</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground sm:col-span-2">
                    Overrides are written only when you save with these fields touched — leaving them alone keeps whatever
                    the tenant already has.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      }

      /* ③ KYC */
      case 2:
        return (
          <div className="space-y-3">
            <div className="grid gap-3">
              {KYC_OPTIONS.map((o) => {
                const status = o.id === "manual" ? null : integrationStatus(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setKycChoice(o.id);
                      setAckKycFor(null);
                    }}
                    aria-pressed={kycValue === o.id}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                      kycValue === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <Shield className={cn("mt-0.5 h-4 w-4 shrink-0", kycValue === o.id ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{o.label}</p>
                        {status && healthBadge(status)}
                      </div>
                      <p className="text-xs text-muted-foreground">{o.blurb}</p>
                    </div>
                    {kycValue === o.id && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
            {/* P1-c — health honesty: a provider that is not "connected"
                needs an explicit acknowledgement, recorded in the audit. */}
            {kycValue && kycValue !== "manual" && integrationStatus(kycValue) !== "connected" && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <Checkbox
                  checked={ackKycFor === kycValue}
                  onCheckedChange={(v) => setAckKycFor(v === true ? kycValue : null)}
                  className="mt-0.5"
                />
                <span className="text-xs">
                  <span className="font-medium">Mark connected anyway</span> — {integrationName(kycValue)} currently
                  reports <span className="font-mono">{integrationStatus(kycValue)}</span>. The wizard assigns it to this
                  tenant, sets its status to connected, and records the override in the audit detail.
                </span>
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              Provider choice is stored on the tenant (<code className="font-mono">kycProvider</code>); an external
              provider is also assigned in <code className="font-mono">integrations-store</code>. Health shown here is the
              same status the Integrations page displays.
            </p>
          </div>
        );

      /* ④ Connectors */
      case 3: {
        const groups = connectorSeeds.reduce<Record<string, SeedIntegration[]>>((acc, s) => {
          (acc[s.category] ??= []).push(s);
          return acc;
        }, {});
        return (
          <div className="space-y-3">
            <div className="space-y-3">
              {Object.entries(groups).map(([category, seeds]) => (
                <div key={category} className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{category}</p>
                  <div className="grid gap-2">
                    {seeds.map((seed) => {
                      const checked = pickValue.includes(seed.id);
                      const status = integrationStatus(seed.id);
                      return (
                        <label
                          key={seed.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                            checked && "border-primary bg-primary/5",
                          )}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setPicks((prev) => {
                                const base = prev ?? assignedConnectorIds;
                                return v ? [...new Set([...base, seed.id])] : base.filter((x) => x !== seed.id);
                              })
                            }
                          />
                          <span className="min-w-0">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{seed.name}</span>
                              <Badge variant="outline" className="text-[9px] capitalize">{seed.category}</Badge>
                              {healthBadge(status)}
                            </span>
                            <span className="block text-xs text-muted-foreground">{seed.description}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {status === "connected" ? "Connected" : `Status: ${status}`}
                              {overrides[seed.id]?.updatedAt ? " · edited on this platform" : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {unhealthyPicks.length > 0 && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <Checkbox
                  checked={ackConnSig !== null && ackConnSig === unhealthyPicks.join(",")}
                  onCheckedChange={(v) => setAckConnSig(v === true ? unhealthyPicks.join(",") : null)}
                  className="mt-0.5"
                />
                <span className="text-xs">
                  <span className="font-medium">Mark connected anyway</span> —{" "}
                  {unhealthyPicks.map(integrationName).join(", ")} report a status other than connected. The wizard sets
                  them to connected for this assignment and records the override in the audit detail.
                </span>
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              Assigned connectors are written to <code className="font-mono">integrations-store</code> for this tenant —
              unassign here to remove them (other tenants keep theirs). KYC providers (Persona, Sumsub) are assigned in
              step ③, not here.
            </p>
          </div>
        );
      }

      /* ⑤ Risk defaults */
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {RISK_PRESETS.map((p) => {
                // P2-8 — compare numerically so "5.0" still matches "5".
                const matches = (Object.keys(p.params) as (keyof TenantRiskParams)[]).every((k) => {
                  const a = Number(riskValue[k]);
                  const b = Number(p.params[k]);
                  return Number.isFinite(a) && Number.isFinite(b) && a === b;
                });
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
              {RISK_FIELDS.map((f) => {
                const invalid = !validRange(riskValue[f.key], f.min, f.max);
                return (
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
                        aria-invalid={invalid || undefined}
                        onChange={(e) => setRiskDraft({ ...(riskDraft ?? riskValue), [f.key]: e.target.value })}
                        className={cn("h-9 tabular-nums", invalid && "border-rose-400 focus-visible:ring-rose-400")}
                      />
                      <span className="w-4 text-xs text-muted-foreground">{f.unit}</span>
                    </div>
                    {/* P2-6/#58 — inline per-field validation. */}
                    {invalid ? (
                      <p role="alert" className="text-[10px] text-rose-600">
                        Must be {f.min}–{f.max}{f.unit}.
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">{f.min}–{f.max}{f.unit}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {tenant?.timezone === "UTC" && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Defaults kept — daily-loss reset runs on UTC. Confirm that is right for {tenant.name}’s trading day.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Persisted per tenant in <code className="font-mono">risk-defaults-store</code> — the Risk Engine page
              reads and writes the same values.
            </p>
          </div>
        );

      /* ⑥ Review & go live */
      case 5:
      default: {
        const planUnsaved = planChoice !== null && planChoice !== tenant?.plan;
        const kycUnsaved = kycChoice !== null && kycChoice !== (tenant?.kycProvider ?? "");
        const picksUnsaved =
          picks !== null &&
          [...picks].sort().join() !== [...assignedConnectorIds].sort().join();
        const riskUnsaved =
          riskDraft !== null &&
          RISK_FIELDS.some((f) => riskDraft[f.key] !== storedRisk[f.key]);
        const rows: { label: string; value: string; store: string; edit?: number; unsaved?: string }[] = tenant
          ? [
              { label: "Tenant", value: `${tenant.name} (${tenant.slug})`, store: "tenant-store", edit: 0 },
              {
                label: "Plan",
                value: planLabel(tenant.plan),
                store: "tenant-store → plan",
                edit: 1,
                unsaved: planUnsaved ? "unsaved — save in step 2 to apply" : undefined,
              },
              {
                label: "KYC provider",
                value: integrationName(tenant.kycProvider || "manual"),
                store: "tenant.kycProvider",
                edit: 2,
                unsaved: kycUnsaved ? "unsaved — save in step 3 to apply" : undefined,
              },
              {
                label: "Connectors",
                value: assignedConnectorIds.length
                  ? assignedConnectorIds.map(integrationName).join(", ")
                  : "—",
                store: "integrations-store → assignedTenants",
                edit: 3,
                unsaved: picksUnsaved ? "unsaved — save in step 4 to apply" : undefined,
              },
              {
                label: "Risk defaults",
                value: `daily ${storedRisk.dailyLoss}% · DD ${storedRisk.maxDd}% · target ${storedRisk.profitTarget}% · ${storedRisk.minDays}d`,
                store: "risk-defaults-store",
                edit: 4,
                unsaved: riskUnsaved ? "unsaved — save in step 5 to apply" : undefined,
              },
              {
                label: "Status",
                value: progress.done ? "active" : `${tenant.status} → active on go-live`,
                store: "tenant-store → status",
              },
            ]
          : [];
        return (
          <div className="space-y-4">
            {/* P1-e — readiness checklist: advisory, never blocking. */}
            {readiness.length > 0 && (
              <div className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Readiness</p>
                  <Badge
                    variant={readinessGaps.length ? "outline" : "secondary"}
                    className={readinessGaps.length ? "border-amber-500/50 text-amber-600" : ""}
                  >
                    {readinessGaps.length ? `${readinessGaps.length} to review` : "all checks passed"}
                  </Badge>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {readiness.map((r) => (
                    <li key={r.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                      {r.ok ? (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 self-start text-emerald-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 self-start text-amber-600" />
                      )}
                      <span className="font-medium">{r.label}</span>
                      <span className="text-muted-foreground">— {r.detail}</span>
                      {r.link && (
                        <button
                          type="button"
                          className="ml-auto shrink-0 underline underline-offset-2"
                          onClick={() => navigate(r.link!.view, r.link!.params)}
                        >
                          {r.link.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Advisory — outstanding items are recorded in the go-live audit entry; “Go live” stays available as a
                  deliberate choice.
                </p>
              </div>
            )}
            <div className="divide-y rounded-lg border">
              {rows.map((r) => (
                <div key={r.label} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</span>
                  <span className="flex min-w-0 flex-wrap items-baseline justify-end gap-2">
                    {r.unsaved && (
                      <Badge variant="outline" className="border-amber-500/50 text-[9px] text-amber-600">
                        {r.unsaved}
                      </Badge>
                    )}
                    <span className="text-sm font-medium">{r.value}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{r.store}</span>
                    {r.edit !== undefined && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px]"
                        aria-label={`Edit ${r.label} in step ${r.edit + 1}`}
                        onClick={() => goTo(r.edit!)}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Every row above is read back from its store — nothing on this screen is a second copy; pending edits show an
              “unsaved” tag until the owning step is saved. The provisioning saga is started from Create Tenant, not by
              this wizard.
            </p>
            {progress.done && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
                <div className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div>
                    <p className="font-medium">Tenant is live.</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Status set to active, <code className="font-mono">liveAt</code> stamped, audit entry recorded —
                      days-to-live now keys off this date.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => tenant && navigate("tenant-detail", { id: tenant.id })}>
                    Open tenant detail
                  </Button>
                  {provisioningJob && tenant && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("provisioning-saga", { job: provisioningJob.id, tenant: tenant.id })}
                    >
                      View provisioning run
                    </Button>
                  )}
                  {!provisioningJob && (
                    <Button size="sm" variant="outline" onClick={() => navigate("create-tenant")}>
                      Run provisioning (Create Tenant)
                    </Button>
                  )}
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

  /* ---- Draft status bar (P1-b) ---- */

  const draftBar = pendingDraft ? (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3"
    >
      <div className="flex items-start gap-2 text-sm">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
        <p>
          <span className="font-medium">Unsaved draft found</span> —{" "}
          {pendingDraft.form.name || pendingDraft.form.existingId || "Untitled firm"}, step{" "}
          {Math.min(pendingDraft.step + 1, STEP_META.length)} of {STEP_META.length}, saved{" "}
          {new Date(pendingDraft.savedAt).toLocaleString()}.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={resumeDraft} className="gap-1">
          <History className="h-3.5 w-3.5" aria-hidden /> Resume draft
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDiscardDraft(true)}>
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
        Draft saved · step {step + 1} of {STEP_META.length} · last edited{" "}
        {new Date(draftSavedAt).toLocaleTimeString()}
      </p>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfirmDiscardDraft(true)}>
        Discard draft
      </Button>
    </div>
  ) : null;

  return (
    <Page>
      <PageHeader
        title="Go-Live Wizard"
        description="Stand a firm up end to end — tenant, plan, KYC, connectors, risk defaults — and take it live. Progress persists across visits."
        icon={Rocket}
        actions={
          <>
            {/* P2-7 — run context chip: which firm, how far along. */}
            {tenant && (
              <Badge variant="outline" className="hidden font-normal sm:inline-flex">
                {tenant.name} · step {step + 1}/{STEP_META.length}
              </Badge>
            )}
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
            <div className="flex-1">
              <p>This run points at a tenant that no longer exists. Saved settings on other tenants are untouched.</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={pickAnotherTenant}>
                  Choose another tenant
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={restart}>
                  <RotateCcw className="mr-1 h-3 w-3" /> Restart the wizard
                </Button>
              </div>
            </div>
          </div>
        )}

        {draftBar}

        {/* P2-7 — "resumed" copy would be a lie on a finished run. */}
        {progress.updatedAt && !orphaned && !progress.done && (
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
            <Button variant="ghost" size="sm" disabled={step === 0 || isSaving} onClick={back} className="gap-1">
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
              <Button
                size="sm"
                disabled={!canSave || isSaving}
                aria-busy={isSaving}
                onClick={() => {
                  if (step === 0) saveTenant();
                  else if (step === 1) savePlan();
                  else if (step === 2) saveKyc();
                  else if (step === 3) saveConnectors();
                  else if (step === 4) saveRisk();
                }}
                className="gap-1"
              >
                Save &amp; continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : progress.done ? (
              <Button size="sm" variant="outline" onClick={restart} className="gap-1.5" disabled={isSaving}>
                <RotateCcw className="h-4 w-4" /> Start another run
              </Button>
            ) : (
              <Button size="sm" disabled={!canSave || isSaving} onClick={() => setConfirmGoLive(true)} className="gap-1.5">
                <Rocket className="h-4 w-4" /> Go live
              </Button>
            )}
          </div>
        </div>

        {/* P0-a — consequential flip confirms its consequence first. */}
        <AlertDialog open={confirmGoLive} onOpenChange={setConfirmGoLive}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Take {tenant?.name} live?</AlertDialogTitle>
              <AlertDialogDescription>
                {tenant?.name} becomes active for real traders. Status flips from <strong>{tenant?.status}</strong> to{" "}
                <strong>active</strong>, <code className="font-mono">liveAt</code> is stamped (kept on later runs —
                days-to-live measures this first go-live), and a{" "}
                <code className="font-mono">go_live.completed</code> audit entry is recorded alongside the finished
                onboarding run.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5 rounded-md border p-3 text-xs text-muted-foreground">
              <p>
                Already saved: plan {tenant ? planLabel(tenant.plan) : "—"} · KYC{" "}
                {tenant ? integrationName(tenant.kycProvider || "manual") : "—"} · {assignedIds.length} connector(s) ·
                risk {storedRisk.dailyLoss}/{storedRisk.maxDd}/{storedRisk.profitTarget}/{storedRisk.minDays}.
              </p>
              {readinessGaps.length > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  Outstanding readiness items ({readinessGaps.map((g) => g.label).join(", ")}) — going live anyway is
                  deliberate and recorded in the audit detail.
                </p>
              )}
              {tenant && !provisioningJob && (
                <p>
                  The 9-step provisioning saga has not run for this firm — this wizard does not start it (CON-03);
                  Create Tenant owns provisioning.
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
              <AlertDialogAction onClick={executeGoLive}>Go live</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* P1-f — restart destroys run progress; confirm when any exists. */}
        <ConfirmDialog
          open={confirmRestart}
          onOpenChange={setConfirmRestart}
          title="Restart the go-live run?"
          description={`Progress resets to step 1${tenant ? ` and this run stops tracking ${tenant.name}` : ""}. Settings already saved to the target stores are kept — plan, KYC, connector and risk writes are NOT undone — and the saved form draft is discarded.`}
          confirmLabel="Restart run"
          destructive
          onConfirm={doRestart}
        />

        <ConfirmDialog
          open={confirmDiscardDraft}
          onOpenChange={setConfirmDiscardDraft}
          title="Discard the saved draft?"
          description="The unsaved form input stored on this browser is removed (run progress is kept). This cannot be undone."
          confirmLabel="Discard draft"
          destructive
          onConfirm={discardDraft}
        />
      </PageContent>
    </Page>
  );
}
