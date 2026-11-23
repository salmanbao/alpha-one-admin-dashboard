"use client";

/**
 * Tenants — the tenant fleet workspace.
 *
 * One job (docs/AGENTS.md §2): operate the tenant fleet — see its
 * size/shape/money at a glance, act on the tenants that need attention,
 * and reach any tenant's workspace in one click.
 *
 * Structure (report §4): PageHeader → attention banner → KPI strip →
 * filter toolbar → bulk bar → decision table → related-views footer.
 *
 * State: every filter, sort, page, page-size and column-visibility
 * choice lives in the URL (`?view=tenants&status=trial&…`) through the
 * existing router, so views are shareable and deep links from the
 * attention banner / KPI cards land pre-filtered. Roster data comes
 * exclusively from the reactive `tenant-store` (no mock-data imports).
 */

import { useCallback, useMemo, useState } from "react";
import { usePlatform } from "@/lib/platform/platform-context";
import { Page, PageHeader, PageContent, MetricCard } from "@/components/platform/page";
import { DataTable, downloadCsv, type Column, type TableState } from "@/components/platform/data-table";
import { StatusBadge, formatCurrency } from "@/components/platform/status";
import { SensitiveActionDialog } from "@/components/platform/sensitive-action-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTenants, updateTenant } from "@/lib/platform/tenant-store";
import { usePlans } from "@/lib/platform/plan-catalog-store";
import { healthOf, tenantHealthScore, type Health } from "@/lib/platform/tenant-health";
import { isLiveJob, startProvisioning, useProvisioningStore } from "@/lib/platform/provisioning-saga";
import { recordAudit } from "@/lib/platform/console-store";
import { toast } from "@/hooks/use-toast";
import type { TenantContext } from "@/lib/platform/types";
import {
  Activity,
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Server,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* URL-persisted filter state                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [8, 25, 50, 100];
const DEFAULT_HIDDEN_COLS = ["modules", "features", "currency", "created", "tags"];
const ALL_STATUSES = [
  "invited",
  "trial",
  "active",
  "suspended",
  "terminated",
  "onboarding",
  "provisioning",
  "provisioning_failed",
  "rolled_back",
] as const;

interface TenantsFilters {
  q: string;
  status: string[];
  plan: string;
  application: string;
  region: string;
  health: string;
  tag: string;
  sort: string;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  /** Hidden column keys (column visibility lives in the URL as `cols`). */
  hidden: string[];
}

function parseFilters(params: Record<string, string>): TenantsFilters {
  const int = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
  };
  return {
    q: params.q ?? "",
    status: params.status ? params.status.split(",").filter(Boolean) : [],
    plan: params.plan ?? "all",
    application: params.application ?? "all",
    region: params.region ?? "all",
    health: params.health ?? "all",
    tag: params.tag ?? "all",
    sort: params.sort ?? "",
    dir: params.dir === "desc" ? "desc" : "asc",
    page: params.page ? int(params.page, 1) : 1,
    pageSize: params.pageSize ? int(params.pageSize, DEFAULT_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
    // `cols` present (even empty) = exact visibility set; absent = defaults.
    hidden: "cols" in params ? params.cols.split(",").filter(Boolean) : [...DEFAULT_HIDDEN_COLS],
  };
}

function filtersToParams(f: TenantsFilters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.q) p.q = f.q;
  if (f.status.length) p.status = f.status.join(",");
  if (f.plan !== "all") p.plan = f.plan;
  if (f.application !== "all") p.application = f.application;
  if (f.region !== "all") p.region = f.region;
  if (f.health !== "all") p.health = f.health;
  if (f.tag !== "all") p.tag = f.tag;
  if (f.sort) {
    p.sort = f.sort;
    if (f.dir === "desc") p.dir = "desc";
  }
  if (f.page > 1) p.page = String(f.page);
  if (f.pageSize !== DEFAULT_PAGE_SIZE) p.pageSize = String(f.pageSize);
  const hidden = new Set(f.hidden);
  const isDefaultHidden =
    hidden.size === DEFAULT_HIDDEN_COLS.length && DEFAULT_HIDDEN_COLS.every((k) => hidden.has(k));
  // Emit whenever visibility differs from the default — including the
  // empty set (``cols=``), the only way to express "show every column".
  if (!isDefaultHidden) p.cols = f.hidden.join(",");
  return p;
}

const DEFAULT_FILTERS = parseFilters({});

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/** Readable avatar foreground from an arbitrary tenant brand color. */
function readableFg(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#ffffff";
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111827" : "#ffffff";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** "12d" / "3mo" / "1.4y" — how long the tenant has been in its status. */
function timeInStatus(t: TenantContext): string {
  const at = t.statusHistory?.[t.statusHistory.length - 1]?.at ?? t.createdAt;
  const ms = Date.now() - new Date(at).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) {
    const hours = Math.floor(ms / 3_600_000);
    return hours < 1 ? "<1h" : `${hours}h`;
  }
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

/** Whole days until an ISO date (negative = already past). */
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil(ms / 86_400_000);
}

/**
 * MRR for one tenant — mirrors the detail page's pricing logic:
 * priceOverride − discount%, else the plan's catalog price.
 */
function mrrOf(t: TenantContext, plans: { id: string; priceMonthly: number }[]): number | null {
  if (t.priceOverride && t.priceOverride > 0) {
    return Math.round(t.priceOverride * (1 - (t.discountPct ?? 0) / 100));
  }
  return plans.find((p) => p.id === t.plan)?.priceMonthly ?? null;
}

/** Trial expiry / contract renewal label shared by the cell and the CSV. */
function trialOrRenewal(t: TenantContext): string {
  if (t.status === "trial" && t.trialEndsAt) return `Expires ${fmtDate(t.trialEndsAt)}`;
  if (t.contract?.renewsAt) return `Renews ${fmtDate(t.contract.renewsAt)}`;
  return "";
}

/**
 * Status tone — operational statuses read distinctly (report §3.5):
 * provisioning_failed is a danger, rolled_back is muted, provisioning /
 * onboarding are in-flight (info), everything else keeps its meaning.
 */
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
      return "info";
    default:
      return "warning";
  }
}

const HEALTH_DOT: Record<Health, string> = {
  healthy: "bg-emerald-500",
  watch: "bg-amber-500",
  critical: "bg-rose-500",
};

function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "T"
  );
}

/* ------------------------------------------------------------------ */
/* Clone (TM-21) — pure builder, dialog-driven, audited                */
/* ------------------------------------------------------------------ */

export interface TenantCloneOptions {
  name: string;
  slug: string;
  copyModules: boolean;
  copyFeatures: boolean;
  copyBranding: boolean;
  copyPlan: boolean;
}

/**
 * Build a clone of `source`. Pure and unit-testable: trial / contract /
 * status-history / suspension state are always cleared, status always
 * starts at `provisioning`.
 */
export function buildTenantClone(source: TenantContext, opts: TenantCloneOptions): TenantContext {
  const name = opts.name.trim();
  return {
    ...source,
    id: `tenant-${opts.slug}`,
    slug: opts.slug,
    name,
    branding: opts.copyBranding
      ? { ...source.branding, name }
      : {
          name,
          initials: initialsFor(name),
          primaryColor: "#64748b",
          accentColor: "#475569",
          surfaceColor: "#e2e8f0",
          radius: "0.5rem",
        },
    enabledModules: opts.copyModules ? [...source.enabledModules] : [],
    enabledFeatures: opts.copyFeatures ? [...source.enabledFeatures] : [],
    moduleRollout: opts.copyModules ? { ...source.moduleRollout } : {},
    plan: opts.copyPlan ? source.plan : "starter",
    priceOverride: opts.copyPlan ? source.priceOverride : undefined,
    discountPct: opts.copyPlan ? source.discountPct : undefined,
    status: "provisioning",
    createdAt: new Date().toISOString(),
    liveAt: undefined,
    billingCycleAnchor: undefined,
    scheduledPlan: undefined,
    statusHistory: [],
    trialEndsAt: undefined,
    invitationSentAt: undefined,
    contract: undefined,
    suspensionReason: undefined,
    suspendedAt: undefined,
    terminatedAt: undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function TenantsPage() {
  const { router, navigate, registerTenant, pushNotification, user } = usePlatform();
  const tenants = useTenants();
  const plans = usePlans();
  const provisioning = useProvisioningStore();

  /* ---- URL-backed view state ------------------------------------- */
  const filters = useMemo(() => parseFilters(router.params), [router.params]);

  const applyFilters = useCallback(
    (patch: Partial<TenantsFilters>, opts?: { replace?: boolean }) => {
      const next = { ...filters, ...patch };
      navigate("tenants", filtersToParams(next), { replace: opts?.replace ?? false });
    },
    [filters, navigate],
  );

  const clearFilters = useCallback(() => {
    navigate("tenants", filtersToParams(DEFAULT_FILTERS));
  }, [navigate]);

  const activeFilterCount =
    (filters.q ? 1 : 0) +
    (filters.status.length ? 1 : 0) +
    (filters.plan !== "all" ? 1 : 0) +
    (filters.application !== "all" ? 1 : 0) +
    (filters.region !== "all" ? 1 : 0) +
    (filters.health !== "all" ? 1 : 0) +
    (filters.tag !== "all" ? 1 : 0);

  /* ---- selection -------------------------------------------------- */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleSelectAll = useCallback((pageIds: string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageIds.length > 0 && pageIds.every((id) => next.has(id));
      for (const id of pageIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  /* ---- derived roster facts --------------------------------------- */
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tenants) m.set(t.status, (m.get(t.status) ?? 0) + 1);
    return m;
  }, [tenants]);

  const kpi = useMemo(() => {
    const count = (...statuses: string[]) =>
      tenants.filter((t) => statuses.includes(t.status)).length;
    const trialSoon = tenants.filter(
      (t) => t.status === "trial" && (daysUntil(t.trialEndsAt) ?? Infinity) <= 7,
    ).length;
    const mrr = tenants
      .filter((t) => t.status === "active")
      .reduce((sum, t) => sum + (mrrOf(t, plans) ?? 0), 0);
    return {
      total: tenants.length,
      active: count("active"),
      trial: count("trial"),
      trialSoon,
      inProvisioning: count("provisioning", "onboarding"),
      failed: count("provisioning_failed"),
      suspended: count("suspended", "terminated"),
      mrr,
    };
  }, [tenants, plans]);

  const attention = useMemo(() => {
    type Item = { key: string; label: string; action: () => void };
    const items: Item[] = [];
    if (kpi.failed > 0) {
      items.push({
        key: "failed",
        label: `${kpi.failed} provisioning failed`,
        action: () => navigate("tenant-lifecycle"),
      });
    }
    // Stale = claims in-flight provisioning but no live (running/blocked)
    // saga drives it. Derived from `provisioning.jobs`, which also
    // subscribes the banner to live saga changes.
    const liveJobFor = (tenantId: string) =>
      provisioning.jobs.find((j) => j.tenantId === tenantId);
    const stale = tenants.filter(
      (t) =>
        (t.status === "provisioning" || t.status === "provisioning_failed") &&
        !isLiveJob(liveJobFor(t.id)),
    ).length;
    if (stale > 0) {
      items.push({
        key: "stale",
        label: `${stale} stuck without a running saga`,
        action: () => navigate("provisioning-saga"),
      });
    }
    if (kpi.trialSoon > 0) {
      items.push({
        key: "trials",
        label: `${kpi.trialSoon} trial${kpi.trialSoon === 1 ? "" : "s"} expiring ≤7d`,
        action: () => applyFilters({ status: ["trial"], page: 1 }),
      });
    }
    return items;
  }, [tenants, kpi, provisioning.jobs, applyFilters, navigate]);

  /* ---- page-level filtering (search is the DataTable's job) -------- */
  const filteredTenants = useMemo(
    () =>
      tenants.filter((t) => {
        if (filters.status.length && !filters.status.includes(t.status)) return false;
        if (filters.plan !== "all" && t.plan !== filters.plan) return false;
        if (filters.application !== "all" && t.application !== filters.application) return false;
        if (filters.region !== "all") {
          if (filters.region === "unpinned" ? t.region : t.region !== filters.region) return false;
        }
        if (filters.health !== "all" && healthOf(t) !== filters.health) return false;
        if (filters.tag !== "all" && !(t.tags ?? []).includes(filters.tag)) return false;
        return true;
      }),
    [
      tenants,
      filters.status,
      filters.plan,
      filters.application,
      filters.region,
      filters.health,
      filters.tag,
    ],
  );

  const regions = useMemo(
    () => [...new Set(tenants.map((t) => t.region).filter(Boolean) as string[])].sort(),
    [tenants],
  );
  const allTags = useMemo(
    () => [...new Set(tenants.flatMap((t) => t.tags ?? []))].sort(),
    [tenants],
  );

  /* ---- actions ---------------------------------------------------- */
  const applySuspend = (ids: string[], reason: string) => {
    const nowIso = new Date().toISOString();
    const names: string[] = [];
    for (const id of ids) {
      const t = tenants.find((x) => x.id === id);
      if (!t || t.status === "suspended") continue;
      names.push(t.name);
      updateTenant(id, { status: "suspended", suspendedAt: nowIso, suspensionReason: reason });
    }
    if (!names.length) return;
    recordAudit({
      actor: user.name,
      action: "console.operator_action",
      target: ids.length > 1 ? "tenant.bulk_suspend" : "tenant.suspend",
      severity: "warning",
      ...(ids.length === 1 ? { tenantId: ids[0] } : {}),
      detail:
        ids.length > 1
          ? `Suspended ${names.length} tenants (${names.join(", ")}). Reason: ${reason}`
          : `Suspended ${names[0]}. Reason: ${reason}`,
    });
    toast({
      title: ids.length > 1 ? `${names.length} tenants suspended` : "Tenant suspended",
      description: `${names.join(", ")} — audit rows written.`,
    });
    setSelected(new Set());
  };

  const activateTenants = (ids: string[]) => {
    const names: string[] = [];
    for (const id of ids) {
      const t = tenants.find((x) => x.id === id);
      if (!t || t.status === "active" || t.status === "terminated") continue;
      names.push(t.name);
      updateTenant(id, { status: "active", suspensionReason: undefined, suspendedAt: undefined });
    }
    if (!names.length) {
      toast({ title: "Nothing to activate", description: "Selected tenants are already active." });
      return;
    }
    recordAudit({
      actor: user.name,
      action: "console.operator_action",
      target: ids.length > 1 ? "tenant.bulk_activate" : "tenant.activate",
      severity: "info",
      ...(ids.length === 1 ? { tenantId: ids[0] } : {}),
      detail: `Activated ${names.length} tenant(s): ${names.join(", ")}`,
    });
    toast({ title: "Activated", description: `${names.join(", ")} → active.` });
    setSelected(new Set());
  };

  /* ---- CSV -------------------------------------------------------- */
  const csvHeaders = ["Tenant", "Status", "Health", "Plan", "MRR", "Trial / renewal", "Owner", "Region"];
  const toCsvRow = (t: TenantContext): string[] => {
    const mrr = mrrOf(t, plans);
    return [
      t.name,
      t.status,
      healthOf(t),
      t.plan,
      mrr === null ? "" : String(mrr),
      trialOrRenewal(t),
      t.owner ?? "",
      t.region ?? "",
    ];
  };
  const exportSelected = () => {
    const rows = tenants.filter((t) => selected.has(t.id));
    if (!rows.length) return;
    downloadCsv("tenants-selected", [csvHeaders, ...rows.map(toCsvRow)]);
  };

  /* ---- suspend dialogs -------------------------------------------- */
  const [suspendTarget, setSuspendTarget] = useState<TenantContext | null>(null);
  const [bulkSuspendOpen, setBulkSuspendOpen] = useState(false);

  /* ---- clone dialog ----------------------------------------------- */
  const [cloneSource, setCloneSource] = useState<TenantContext | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneScope, setCloneScope] = useState({
    modules: true,
    features: true,
    branding: true,
    plan: true,
  });
  const [cloneSaga, setCloneSaga] = useState(true);

  const openClone = (source: TenantContext) => {
    setCloneSource(source);
    setCloneName(`${source.name} (Copy)`);
    setCloneSlug(`${source.slug}-copy`);
    setCloneScope({ modules: true, features: true, branding: true, plan: true });
    setCloneSaga(true);
  };

  const slugTaken = cloneSlug.trim().length > 0 && tenants.some((t) => t.slug === cloneSlug.trim());
  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(cloneSlug.trim());
  const cloneValid = cloneName.trim().length > 1 && slugValid && !slugTaken;

  const confirmClone = () => {
    if (!cloneSource || !cloneValid) return;
    const clone = buildTenantClone(cloneSource, {
      name: cloneName,
      slug: cloneSlug.trim(),
      copyModules: cloneScope.modules,
      copyFeatures: cloneScope.features,
      copyBranding: cloneScope.branding,
      copyPlan: cloneScope.plan,
    });
    registerTenant(clone);
    recordAudit({
      actor: user.name,
      action: "console.operator_action",
      target: "tenant.clone",
      tenantId: clone.id,
      severity: "info",
      detail: `Cloned ${cloneSource.name} → ${clone.name} (slug ${clone.slug})`,
    });
    pushNotification({
      title: "Tenant cloned",
      message: `${clone.name} created from ${cloneSource.name}.`,
      severity: "success",
      module: "super-admin",
    });
    if (cloneSaga) {
      startProvisioning({
        tenantId: clone.id,
        tenantName: clone.name,
        slug: clone.slug,
        plan: clone.plan,
        sso: false,
        owner: cloneSource.owner,
        ownerEmail: cloneSource.ownerEmail,
        createdBy: user.name,
      });
    }
    toast({
      title: "Tenant cloned",
      description: cloneSaga ? `${clone.name} — provisioning saga started.` : `${clone.name} created.`,
    });
    setCloneSource(null);
    navigate("tenant-detail", { id: clone.id });
  };

  /* ---- columns ----------------------------------------------------- */
  const rowActions = (t: TenantContext) => (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={(e) => {
          e.stopPropagation();
          navigate("tenant-detail", { id: t.id });
        }}
      >
        View
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 px-0"
            aria-label={`More actions for ${t.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuLabel className="truncate text-xs">{t.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("tenant-detail", { id: t.id })}>
            Open detail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("tenant-view-as", { tenantId: t.id })}>
            View-As…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("tenant-sessions", { tenant: t.id })}>
            Sessions
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("platform-billing", { tenant: t.id })}>
            Invoices
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("tenant-health", { tenant: t.id })}>
            Health
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {t.status === "suspended" ? (
            <DropdownMenuItem onClick={() => activateTenants([t.id])}>Activate</DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setSuspendTarget(t)}
            >
              Suspend…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => openClone(t)}>Clone…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("tenant-offboarding", { tenant: t.id })}>
            Offboard…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const columns: Column<TenantContext>[] = [
    {
      key: "name",
      header: "Tenant",
      cell: (t) => (
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
            style={{ background: t.branding.primaryColor, color: readableFg(t.branding.primaryColor) }}
            aria-hidden
          >
            {t.branding.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{t.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{t.domain}</p>
            <p className="truncate text-[10px] text-muted-foreground/80">
              {t.enabledModules.length} module{t.enabledModules.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      ),
      sortValue: (t) => t.name,
    },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge tone={tenantStatusTone(t.status)}>{t.status.replace("_", " ")}</StatusBadge>
          <span className="text-[10px] text-muted-foreground">{timeInStatus(t)} in status</span>
        </div>
      ),
      sortValue: (t) => t.status,
    },
    {
      key: "health",
      header: "Health",
      cell: (t) => {
        const band = healthOf(t);
        return (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium capitalize"
            title={`Score ${tenantHealthScore(t).score}/100`}
          >
            <span className={`h-2 w-2 rounded-full ${HEALTH_DOT[band]}`} aria-hidden />
            {band}
          </span>
        );
      },
      sortValue: (t) => tenantHealthScore(t).score,
    },
    {
      key: "plan",
      header: "Plan",
      className: "hidden md:table-cell",
      cell: (t) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge variant="outline" className="text-[10px] capitalize">
            {t.plan}
          </Badge>
          {t.scheduledPlan ? (
            <Badge variant="secondary" className="text-[9px]">
              → {t.scheduledPlan.plan} {fmtDate(t.scheduledPlan.scheduledFor)}
            </Badge>
          ) : null}
        </div>
      ),
      sortValue: (t) => t.plan,
    },
    {
      key: "mrr",
      header: "MRR",
      className: "hidden md:table-cell",
      numeric: true,
      cell: (t) => {
        const v = mrrOf(t, plans);
        return (
          <span className="text-xs font-medium tabular-nums">{v === null ? "—" : formatCurrency(v)}</span>
        );
      },
      sortValue: (t) => mrrOf(t, plans) ?? -1,
    },
    {
      key: "trial",
      header: "Trial / renewal",
      className: "hidden lg:table-cell",
      cell: (t) => {
        if (t.status === "trial" && t.trialEndsAt) {
          const d = daysUntil(t.trialEndsAt);
          const urgent = d !== null && d <= 7;
          return (
            <div className="flex flex-col gap-0.5">
              <StatusBadge tone={urgent ? "warning" : "info"}>
                {d !== null && d < 0 ? "Expired " : "Expires "}
                {fmtDate(t.trialEndsAt)}
              </StatusBadge>
              {urgent ? (
                <span className="text-[10px] text-muted-foreground">
                  {d < 0 ? `${-d}d ago` : `${d}d left`}
                </span>
              ) : null}
            </div>
          );
        }
        const label = trialOrRenewal(t);
        return <span className="text-xs text-muted-foreground">{label || "—"}</span>;
      },
      sortValue: (t) => t.trialEndsAt ?? t.contract?.renewsAt ?? "",
    },
    {
      key: "owner",
      header: "Owner",
      className: "hidden lg:table-cell",
      cell: (t) =>
        t.owner ? (
          <span className="text-xs" title={t.ownerEmail ?? t.owner}>
            {t.owner}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
      sortValue: (t) => t.owner ?? "",
    },
    {
      key: "region",
      header: "Region",
      className: "hidden lg:table-cell",
      cell: (t) =>
        t.region ? (
          <Badge variant="outline" className="text-[10px]">
            {t.region}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Unpinned</span>
        ),
      sortValue: (t) => t.region ?? "",
    },
    {
      key: "modules",
      header: "Modules",
      cell: (t) => <span className="text-sm font-medium">{t.enabledModules.length}</span>,
      sortValue: (t) => t.enabledModules.length,
    },
    {
      key: "features",
      header: "Features",
      cell: (t) => t.enabledFeatures.length,
      sortValue: (t) => t.enabledFeatures.length,
    },
    { key: "currency", header: "Currency", cell: (t) => t.currency, sortValue: (t) => t.currency },
    {
      key: "created",
      header: "Created",
      cell: (t) => <span className="text-xs text-muted-foreground">{fmtDate(t.createdAt)}</span>,
      sortValue: (t) => t.createdAt,
    },
    {
      key: "tags",
      header: "Tags",
      cell: (t) =>
        t.tags?.length ? (
          <div className="flex flex-wrap gap-1">
            {t.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[9px]">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
      sortValue: (t) => (t.tags ?? []).join(","),
    },
    { key: "actions", header: "Actions", cell: (t) => rowActions(t), width: "130px" },
  ];

  /* ---- DataTable controlled state ---------------------------------- */
  const tableState: TableState = useMemo(
    () => ({
      search: filters.q,
      sortKey: filters.sort || null,
      sortDir: filters.dir,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    [filters],
  );

  const onTableStateChange = useCallback(
    (next: TableState) => {
      applyFilters(
        {
          q: next.search,
          sort: next.sortKey ?? "",
          dir: next.sortDir,
          page: next.page,
          pageSize: next.pageSize,
        },
        // Typing replaces the current history entry; discrete changes push.
        { replace: next.search !== filters.q },
      );
    },
    [applyFilters, filters.q],
  );

  const searchableTenant = useCallback(
    (t: TenantContext) =>
      `${t.name} ${t.slug} ${t.domain} ${t.owner ?? ""} ${t.ownerEmail ?? ""} ${t.id} ${(t.tags ?? []).join(" ")} ${t.currency} ${t.plan} ${t.status}`,
    [],
  );

  /* ---- empty states ------------------------------------------------ */
  const rosterEmpty = tenants.length === 0;
  const emptyTitle = rosterEmpty ? "No tenants yet" : "No tenants match";
  const emptyDescription = rosterEmpty
    ? "Create your first tenant to start operating the fleet."
    : activeFilterCount > 0
      ? `No tenant matches the ${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}.`
      : "No tenant matches the current search.";
  const emptyAction = rosterEmpty ? (
    <Button size="sm" onClick={() => navigate("create-tenant")}>
      <Plus className="mr-1 h-4 w-4" /> Create tenant
    </Button>
  ) : (
    <Button size="sm" variant="outline" onClick={clearFilters}>
      Clear filters
    </Button>
  );

  /* ---- KPI strip --------------------------------------------------- */
  const kpis: {
    key: string;
    label: string;
    value: string | number;
    deltaLabel?: string;
    icon: typeof Building2;
    tone?: "default" | "positive" | "negative" | "warning";
    onClick: () => void;
  }[] = [
    {
      key: "total",
      label: "Total tenants",
      value: kpi.total,
      icon: Building2,
      onClick: clearFilters,
    },
    {
      key: "active",
      label: "Active",
      value: kpi.active,
      icon: CheckCircle2,
      tone: "positive",
      onClick: () => applyFilters({ status: ["active"], page: 1 }),
    },
    {
      key: "trial",
      label: "Trial",
      value: kpi.trial,
      deltaLabel: kpi.trialSoon > 0 ? `${kpi.trialSoon} expiring ≤7d` : undefined,
      icon: Clock,
      tone: kpi.trialSoon > 0 ? "warning" : "default",
      onClick: () => applyFilters({ status: ["trial"], page: 1 }),
    },
    {
      key: "provisioning",
      label: "In provisioning",
      value: kpi.inProvisioning,
      deltaLabel: kpi.failed > 0 ? `${kpi.failed} failed` : undefined,
      icon: Server,
      tone: kpi.failed > 0 ? "negative" : "default",
      onClick: () =>
        applyFilters({ status: ["provisioning", "onboarding", "provisioning_failed"], page: 1 }),
    },
    {
      key: "suspended",
      label: "Suspended + terminated",
      value: kpi.suspended,
      icon: Ban,
      tone: kpi.suspended > 0 ? "negative" : "default",
      onClick: () => applyFilters({ status: ["suspended", "terminated"], page: 1 }),
    },
    {
      key: "mrr",
      label: "Platform MRR",
      value: formatCurrency(kpi.mrr),
      icon: DollarSign,
      tone: "positive",
      onClick: clearFilters,
    },
  ];
  const visibleKpis = rosterEmpty ? kpis.slice(0, 1) : kpis;

  /* ---- toolbar ------------------------------------------------------ */
  const toolbar = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" aria-label="Filter by status">
            Status{filters.status.length ? ` (${filters.status.length})` : ""}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-xs">Statuses</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem
            checked={filters.status.length === 0}
            onCheckedChange={() => applyFilters({ status: [], page: 1 })}
          >
            <span className="flex-1">All statuses</span>
            <span className="text-[10px] text-muted-foreground">{tenants.length}</span>
          </DropdownMenuCheckboxItem>
          {ALL_STATUSES.map((s) => (
            <DropdownMenuCheckboxItem
              key={s}
              checked={filters.status.includes(s)}
              onCheckedChange={() => {
                const next = filters.status.includes(s)
                  ? filters.status.filter((x) => x !== s)
                  : [...filters.status, s];
                applyFilters({ status: next, page: 1 });
              }}
            >
              <span className="flex-1 capitalize">{s.replace("_", " ")}</span>
              <span className="text-[10px] text-muted-foreground">{statusCounts.get(s) ?? 0}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select value={filters.plan} onValueChange={(v) => applyFilters({ plan: v, page: 1 })}>
        <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Filter by plan">
          <SelectValue placeholder="Plan" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All plans</SelectItem>
          <SelectItem value="starter">Starter</SelectItem>
          <SelectItem value="growth">Growth</SelectItem>
          <SelectItem value="scale">Scale</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.application}
        onValueChange={(v) => applyFilters({ application: v, page: 1 })}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Filter by application">
          <SelectValue placeholder="Application" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All applications</SelectItem>
          <SelectItem value="prop-admin">prop-admin</SelectItem>
          <SelectItem value="trader">trader</SelectItem>
          <SelectItem value="super-admin">super-admin</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.region} onValueChange={(v) => applyFilters({ region: v, page: 1 })}>
        <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Filter by region">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All regions</SelectItem>
          {regions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
          <SelectItem value="unpinned">Unpinned</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.health} onValueChange={(v) => applyFilters({ health: v, page: 1 })}>
        <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Filter by health">
          <SelectValue placeholder="Health" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All health</SelectItem>
          <SelectItem value="healthy">Healthy</SelectItem>
          <SelectItem value="watch">Watch</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
        </SelectContent>
      </Select>

      {allTags.length > 0 ? (
        <Select value={filters.tag} onValueChange={(v) => applyFilters({ tag: v, page: 1 })}>
          <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Filter by tag">
            <SelectValue placeholder="Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {allTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {activeFilterCount > 0 ? (
        <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
          Clear filters ({activeFilterCount})
        </Button>
      ) : null}
    </>
  );

  /* ---- bulk bar ----------------------------------------------------- */
  const bulkBar = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-foreground">
        {selected.size} selected
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        onClick={() => setBulkSuspendOpen(true)}
      >
        <Pause className="h-3 w-3" /> Suspend
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        onClick={() => activateTenants([...selected])}
      >
        <Play className="h-3 w-3" /> Activate
      </Button>
      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={exportSelected}>
        <Download className="h-3 w-3" /> Export selected
      </Button>
      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setSelected(new Set())}>
        Clear selection
      </Button>
    </div>
  );

  const fleetViews: [string, string][] = [
    ["Lifecycle", "tenant-lifecycle"],
    ["Health", "tenant-health"],
    ["Sessions", "tenant-sessions"],
    ["View-As", "tenant-view-as"],
    ["Offboarding", "tenant-offboarding"],
    ["Benchmarking", "tenant-benchmarking"],
  ];

  return (
    <Page>
      <PageHeader
        title="Tenants"
        description={
          rosterEmpty
            ? "No tenants on the platform yet."
            : `${tenants.length} tenant${tenants.length === 1 ? "" : "s"} · ${kpi.active} active · ${formatCurrency(kpi.mrr)} MRR`
        }
        icon={Building2}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => navigate("tenant-lifecycle")}>
              <Activity className="mr-1 h-4 w-4" /> Lifecycle
            </Button>
            <Button size="sm" onClick={() => navigate("create-tenant")}>
              <Plus className="mr-1 h-4 w-4" /> Create tenant
            </Button>
          </>
        }
      />
      <PageContent>
        <div className="flex flex-col gap-4">
          {attention.length > 0 ? (
            <div
              role="region"
              aria-label="Tenants needing attention"
              className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" /> Needs attention
                </span>
                {attention.map((item) => (
                  <Button
                    key={item.key}
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 bg-background/70 text-xs"
                    onClick={item.action}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {visibleKpis.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={k.onClick}
                aria-label={`Filter tenants by ${k.label}`}
                className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MetricCard label={k.label} value={k.value} deltaLabel={k.deltaLabel} icon={k.icon} tone={k.tone} />
              </button>
            ))}
          </div>

          <DataTable
            columns={columns}
            data={filteredTenants}
            rowKey={(t) => t.id}
            onRowClick={(t) => navigate("tenant-detail", { id: t.id })}
            searchableText={searchableTenant}
            searchPlaceholder="Search name, slug, domain, owner, id, tags…"
            state={tableState}
            onStateChange={onTableStateChange}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            selection={{
              selectedIds: selected,
              onToggle: toggleSelect,
              onToggleAll: toggleSelectAll,
              bulkBar,
            }}
            columnVisibility={{
              hidden: new Set(filters.hidden),
              onChange: (next) => applyFilters({ hidden: [...next] }),
            }}
            exportCsv={{ filename: "tenants", headers: csvHeaders, toRow: toCsvRow }}
            toolbar={toolbar}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            emptyAction={emptyAction}
            emptyHint={
              rosterEmpty
                ? "Tenants you create appear here and in the tenant switcher."
                : "Clear the filters to see the full roster."
            }
          />

          <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="font-medium">Fleet views:</span>
            {fleetViews.map(([label, view]) => (
              <Button
                key={view}
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => navigate(view)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      </PageContent>

      {/* Row-level suspend — consequence + required reason + 2FA. */}
      <SensitiveActionDialog
        open={suspendTarget !== null}
        onOpenChange={(o) => {
          if (!o) setSuspendTarget(null);
        }}
        actionKey="tenant.suspend"
        title={`Suspend ${suspendTarget?.name ?? "tenant"}`}
        consequence={`${suspendTarget?.name ?? "This tenant"} loses console access immediately; live sessions are revoked and billing continues until reinstatement.`}
        blastRadius={[
          `${suspendTarget?.name ?? "Tenant"} workspace locked for all operators`,
          "Active impersonation and user sessions revoked",
          "Reason written to the audit trail",
        ]}
        requireReason
        tenantId={suspendTarget?.id}
        onExecute={(reason) => {
          if (suspendTarget) applySuspend([suspendTarget.id], reason);
          setSuspendTarget(null);
        }}
      />

      {/* Bulk suspend — same dialog, one audit row per tenant. */}
      <SensitiveActionDialog
        open={bulkSuspendOpen}
        onOpenChange={setBulkSuspendOpen}
        actionKey="tenant.bulk_suspend"
        title={`Suspend ${selected.size} tenant${selected.size === 1 ? "" : "s"}`}
        consequence={`${selected.size} tenant workspaces lose console access immediately; live sessions are revoked and billing continues until reinstatement.`}
        blastRadius={[
          `${selected.size} tenant workspaces locked`,
          "All operator and trader sessions in those tenants revoked",
          "One audited suspension row per tenant (reason required)",
        ]}
        requireReason
        onExecute={(reason) => {
          applySuspend([...selected], reason);
          setBulkSuspendOpen(false);
        }}
      />

      {/* Clone — dialog replaces the old one-click clone (report §4.6). */}
      <Dialog open={cloneSource !== null} onOpenChange={(o) => { if (!o) setCloneSource(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Clone {cloneSource?.name ?? "tenant"}</DialogTitle>
            <DialogDescription>
              Creates a copy of this tenant&apos;s configuration. Trial, contract and status
              history are always cleared; the clone starts in provisioning.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="clone-name">Name</Label>
              <Input
                id="clone-name"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Alpha Capital (Copy)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clone-slug">Slug</Label>
              <Input
                id="clone-slug"
                value={cloneSlug}
                onChange={(e) => setCloneSlug(e.target.value)}
                aria-invalid={cloneSlug.length > 0 && (!slugValid || slugTaken)}
              />
              <p className="text-xs text-muted-foreground">
                {cloneSlug.length === 0
                  ? "Used for the tenant id and subdomain."
                  : slugTaken
                    ? "This slug is already taken."
                    : !slugValid
                      ? "Lowercase letters, numbers and hyphens only."
                      : `Tenant id: tenant-${cloneSlug.trim()}`}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Copy scope
              </p>
              {(
                [
                  ["modules", "Modules & rollout"],
                  ["features", "Features"],
                  ["branding", "Branding"],
                  ["plan", "Plan & pricing"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`clone-${key}`}
                    checked={cloneScope[key]}
                    onCheckedChange={(v) => setCloneScope((s) => ({ ...s, [key]: v === true }))}
                  />
                  <Label htmlFor={`clone-${key}`} className="text-sm font-normal">
                    {label}
                  </Label>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Trial dates, contract and pricing overrides are always cleared.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="clone-saga"
                checked={cloneSaga}
                onCheckedChange={(v) => setCloneSaga(v === true)}
              />
              <Label htmlFor="clone-saga" className="text-sm font-normal">
                Open provisioning saga after create
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneSource(null)}>
              Cancel
            </Button>
            <Button onClick={confirmClone} disabled={!cloneValid}>
              Clone tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
