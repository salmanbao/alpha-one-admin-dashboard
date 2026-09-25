"use client";

/**
 * PFaaS Platform — Dashboard Manager (Super Admin, spec §23)
 *
 * Lets the platform admin configure widget layouts on a per-tenant +
 * per-role basis for all white-label prop firm admin/trader dashboards.
 *
 * Capabilities:
 *   • Tenant + Role selector (prop-admin / trader scoped roles)
 *   • GridStack drag-and-drop editor with widget library sidebar
 *   • Add/remove widgets, lock/unlock tenant layout, preview as tenant
 *   • Layouts persisted to localStorage keyed by `{tenantId}:{roleId}`
 *
 * Storage:
 *   `pfaas:dashboardLayout:{tenantId}:{roleId}` — GridStack node array
 *   `pfaas:dashboardLock:{tenantId}:{roleId}`   — boolean lock flag
 *
 * This tool does NOT interfere with the regular tenant dashboard
 * (`pfaas:gridLayout:{tenantId}`) — different namespace, different scope.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";

import { usePlatform, PlatformContext, type PlatformContextValue } from "@/lib/platform/platform-context";
import { makeTermResolver } from "@/lib/platform/terminology";
import { moduleRegistry } from "@/lib/platform/module-registry";
import {
  resolveDashboardLayout,
  resolveWidgets,
} from "@/lib/platform/dashboard-engine";
import { platformTenant, roles as allRoles } from "@/lib/platform/mock-data";
import type {
  AuthUser,
  DashboardWidgetPlacement,
  ModuleRuntimeContext,
  RoleDefinition,
  TenantContext,
  WidgetCategory,
  WidgetDefinition,
} from "@/lib/platform/types";

import { Page, PageHeader, PageContent } from "@/components/platform/page";
import { EmptyState, ModuleErrorBoundary } from "@/components/platform/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Search,
  Pencil,
  ShieldCheck,
  PackageOpen,
  CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* GridStack local types (we use the JS API directly via dynamic import) */
/* ------------------------------------------------------------------ */

interface GridStackNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GridStackStatic {
  // GridStack v11+ signature: options first, element (or selector) second
  init(opts?: Record<string, unknown>, elOrString?: HTMLElement | string): GridStackInstance;
}

interface GridStackInstance {
  on(event: string, cb: (event: Event, items: GridStackNode[]) => void): void;
  off(event: string): void;
  save(saveContent: boolean, saveGridOpt: boolean): GridStackNode[];
  destroy(detach: boolean): void;
  setStatic(value: boolean): void;
  addWidget(el: HTMLElement, options?: Record<string, unknown>): HTMLElement;
  removeWidget(el: HTMLElement, removeDOM: boolean): void;
}

/* ------------------------------------------------------------------ */
/* Storage helpers                                                     */
/* ------------------------------------------------------------------ */

const layoutKey = (tenantId: string, roleId: string) =>
  `pfaas:dashboardLayout:${tenantId}:${roleId}`;
const lockKey = (tenantId: string, roleId: string) =>
  `pfaas:dashboardLock:${tenantId}:${roleId}`;

function loadSavedLayout(tenantId: string, roleId: string): GridStackNode[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(layoutKey(tenantId, roleId));
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;
    return parsed as GridStackNode[];
  } catch {
    return null;
  }
}

function saveLayoutToStorage(tenantId: string, roleId: string, layout: GridStackNode[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(layoutKey(tenantId, roleId), JSON.stringify(layout));
  } catch { /* ignore quota */ }
}

function clearLayoutFromStorage(tenantId: string, roleId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(layoutKey(tenantId, roleId));
  } catch { /* ignore */ }
}

function loadLock(tenantId: string, roleId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(lockKey(tenantId, roleId)) === "true";
  } catch {
    return false;
  }
}

function saveLock(tenantId: string, roleId: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lockKey(tenantId, roleId), value ? "true" : "false");
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Runtime context builder                                             */
/* ------------------------------------------------------------------ */

/**
 * Build a ModuleRuntimeContext that *simulates* the selected tenant+role
 * combination. Used by the dashboard engine to resolve the widget set the
 * tenant+role would see, so the platform admin can preview/edit it.
 */
function buildContext(
  tenant: TenantContext,
  role: RoleDefinition,
  baseUser: AuthUser,
): ModuleRuntimeContext {
  const previewUser: AuthUser = {
    ...baseUser,
    id: `preview-${tenant.id}-${role.id}`,
    name: `${role.name} (Preview)`,
    email: "",
    initials: role.name.slice(0, 2).toUpperCase(),
    roles: [role.id],
    permissions: role.permissions,
    application: role.application,
    tenantId: tenant.id,
    lastActiveAt: new Date().toISOString(),
  };
  return {
    application: role.application,
    tenant,
    user: previewUser,
    permissions: role.permissions,
    enabledModules: tenant.enabledModules,
    enabledFeatures: tenant.enabledFeatures,
  };
}

/* ------------------------------------------------------------------ */
/* Widget renderer — mounts a React widget into a grid item's content */
/* ------------------------------------------------------------------ */

function renderWidgetInto(
  container: HTMLElement,
  widget: WidgetDefinition,
  ctx: ModuleRuntimeContext,
  rootMap: Map<string, Root>,
  platformValue: PlatformContextValue,
) {
  // Unmount any previous root for this widget id (avoid leaks on re-render).
  // Deferred to a microtask: calling root.unmount() synchronously while React
  // is mid-render of another root triggers "synchronously unmount a root
  // while React was already rendering" race warnings.
  const previous = rootMap.get(widget.id);
  if (previous) {
    queueMicrotask(() => {
      try { previous.unmount(); } catch { /* ignore */ }
    });
    rootMap.delete(widget.id);
  }

  const root = createRoot(container);
  rootMap.set(widget.id, root);

  const moduleInfo = moduleRegistry.get(widget.module);
  const accentColor = moduleInfo?.manifest.accentColor ?? "#4a7c59";
  const moduleName = moduleInfo?.manifest.name ?? widget.module;
  const Comp = widget.component;

  // Synthesize a placement for the widget instance id (grid coords read at runtime)
  const placement: DashboardWidgetPlacement = {
    widgetId: widget.id,
    x: Number(container.parentElement?.getAttribute("gs-x") ?? 0),
    y: Number(container.parentElement?.getAttribute("gs-y") ?? 0),
    w: Number(container.parentElement?.getAttribute("gs-w") ?? widget.defaultSize.w),
    h: Number(container.parentElement?.getAttribute("gs-h") ?? widget.defaultSize.h),
  };

  root.render(
    // Widgets are mounted into an imperative DOM container, which makes a
    // separate React root that inherits NO context. Re-provide the platform
    // context here with `runtime` overridden so the widget previews the
    // SELECTED tenant + role instead of the operator's own context.
    <PlatformContext.Provider value={{ ...platformValue, runtime: ctx }}>
    <ModuleErrorBoundary name={widget.title}>
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-terra-soft bg-terra-surface/30 px-4 py-2.5">
          <h3 className="text-[13px] font-medium text-foreground">{widget.title}</h3>
          <div className="flex items-center gap-1.5">
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{ background: `${accentColor}14`, color: accentColor }}
              title={moduleName}
            >
              {moduleName}
            </span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
              style={{ background: "var(--muted)" }}
            >
              {widget.category}
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <Comp
            instanceId={`${widget.id}-${ctx.tenant?.id ?? "platform"}-${ctx.user.roles[0] ?? "anon"}-${placement.x}-${placement.y}`}
            widgetId={widget.id}
          />
        </div>
      </div>
    </ModuleErrorBoundary>
    </PlatformContext.Provider>,
  );
}

function unmountWidget(widgetId: string, rootMap: Map<string, Root>) {
  const root = rootMap.get(widgetId);
  if (root) {
    // Defer unmount past any in-flight render (see note in renderWidgetInto)
    queueMicrotask(() => {
      try { root.unmount(); } catch { /* ignore */ }
    });
    rootMap.delete(widgetId);
  }
}

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const WIDGET_CATEGORIES: WidgetCategory[] = [
  "metric",
  "chart",
  "table",
  "feed",
  "progress",
  "status",
  "heatmap",
  "leaderboard",
  "ai",
  "alert",
  "action",
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function DashboardManagerPage() {
  const platformValue = usePlatform();
  const { availableTenants, user, tenant } = platformValue;
  const term = makeTermResolver(tenant);

  // Non-platform tenants only
  const tenants = useMemo(
    () => availableTenants.filter((t) => t.id !== platformTenant.id),
    [availableTenants],
  );
  // Non-super-admin roles (prop-admin + trader scopes only)
  const roles = useMemo(
    () => allRoles.filter((r) => r.application !== "super-admin"),
    [],
  );

  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    tenants[0]?.id ?? "",
  );
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id ?? "",
  );

  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === selectedTenantId),
    [tenants, selectedTenantId],
  );
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId),
    [roles, selectedRoleId],
  );

  const ctx = useMemo(() => {
    if (!selectedTenant || !selectedRole) return null;
    return buildContext(selectedTenant, selectedRole, user);
  }, [selectedTenant, selectedRole, user]);

  // Available widgets for the selected tenant+role (resolved from registry)
  const availableWidgets = useMemo<WidgetDefinition[]>(() => {
    if (!ctx) return [];
    return moduleRegistry.getWidgets(ctx);
  }, [ctx]);

  // Full widget library — across ALL modules, for the sidebar browser
  const widgetLibrary = useMemo<WidgetDefinition[]>(() => {
    return moduleRegistry.getAll().flatMap((m) => m.widgets ?? []);
  }, []);

  const moduleOptions = useMemo(() => {
    return moduleRegistry
      .getAll()
      .filter((m) => (m.widgets ?? []).length > 0)
      .map((m) => ({ id: m.manifest.id, name: m.manifest.name }));
  }, []);

  /* ----------------- UI / interaction state ----------------------- */

  const [previewMode, setPreviewMode] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [placedIds, setPlacedIds] = useState<Set<string>>(new Set());
  const [layoutNonce, setLayoutNonce] = useState(0); // force re-init

  /* ----------------- GridStack refs -------------------------------- */

  const gridRef = useRef<HTMLDivElement>(null);
  const gridInstanceRef = useRef<GridStackInstance | null>(null);
  const rootMapRef = useRef<Map<string, Root>>(new Map());
  const [isGridReady, setIsGridReady] = useState(false);

  /* ----------------- Lock state sync ------------------------------ */

  useEffect(() => {
    if (!selectedTenantId || !selectedRoleId) return;
    setIsLocked(loadLock(selectedTenantId, selectedRoleId));
  }, [selectedTenantId, selectedRoleId, layoutNonce]);

  /* ----------------- Refresh placed-widget-id set ----------------- */

  const refreshPlacedIds = useCallback(() => {
    if (!gridInstanceRef.current) {
      setPlacedIds(new Set());
      return;
    }
    try {
      const current = gridInstanceRef.current.save(false, false) as GridStackNode[];
      setPlacedIds(new Set(current.map((n) => n.id)));
    } catch {
      setPlacedIds(new Set());
    }
  }, []);

  /* ----------------- Initialize / re-init GridStack --------------- */

  useEffect(() => {
    if (!ctx || !gridRef.current) return;

    let grid: GridStackInstance | null = null;
    let cancelled = false;

    // Clean up previous React roots
    for (const root of rootMapRef.current.values()) {
      try { root.unmount(); } catch { /* ignore */ }
    }
    rootMapRef.current.clear();
    gridInstanceRef.current = null;
    setIsGridReady(false);

    import("gridstack").then((gsModule) => {
      const GridStack = (gsModule as unknown as { GridStack: GridStackStatic }).GridStack;
      if (cancelled || !gridRef.current || !ctx) return;

      // Clear DOM
      gridRef.current.innerHTML = "";

      // Resolve default auto-layout + widget set for this ctx
      const layout = resolveDashboardLayout(ctx);
      const resolved = resolveWidgets(ctx, layout);
      const defById = new Map(resolved.map((w) => [w.definition.id, w.definition]));

      // Read saved layout (per-tenant+role)
      const roleId = ctx.user.roles[0];
      const tenantId = ctx.tenant?.id;
      const saved = tenantId && roleId ? loadSavedLayout(tenantId, roleId) : null;

      // Build nodes: saved if present and references resolvable widgets,
      // else fall back to the auto-layout from the dashboard engine.
      let nodes: GridStackNode[];
      if (saved && saved.length > 0) {
        nodes = saved.filter((n) => defById.has(n.id));
      } else {
        nodes = layout.widgets.map((p) => ({
          id: p.widgetId,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
        }));
      }

      // Pre-build DOM with gs-* attributes — GridStack will auto-detect children
      for (const node of nodes) {
        const def = defById.get(node.id);
        if (!def) continue;
        const el = document.createElement("div");
        el.className = "grid-stack-item";
        el.setAttribute("gs-id", node.id);
        el.setAttribute("gs-x", String(node.x));
        el.setAttribute("gs-y", String(node.y));
        el.setAttribute("gs-w", String(node.w));
        el.setAttribute("gs-h", String(node.h));
        el.innerHTML = '<div class="grid-stack-item-content"></div>';
        gridRef.current.appendChild(el);
      }

      // GridStack v11+ signature: init(options, el) — options FIRST.
      // Reversed args crash with "el.classList is undefined" (same fix as
      // gridstack-dashboard.tsx).
      grid = GridStack.init(
        {
          column: 12,
          cellHeight: 80,
          margin: 12,
          staticGrid: previewMode,
          disableResize: previewMode,
          disableDrag: previewMode,
          animate: true,
          float: false,
        },
        gridRef.current,
      );
      gridInstanceRef.current = grid;

      // Auto-persist layout on any change (drag/resize/add/remove)
      const persist = () => {
        if (!ctx?.tenant) return;
        const rid = ctx.user.roles[0];
        if (!rid) return;
        try {
          const currentLayout = grid!.save(false, false) as GridStackNode[];
          saveLayoutToStorage(ctx.tenant.id, rid, currentLayout);
          // Refresh placed-id state for the sidebar
          setPlacedIds(new Set(currentLayout.map((n) => n.id)));
        } catch { /* ignore */ }
      };
      grid.on("change", persist);
      grid.on("dragstop", persist);
      grid.on("resizestop", persist);
      grid.on("added", persist);
      grid.on("removed", persist);

      // Render widgets into each grid item's content div
      const items = gridRef.current.querySelectorAll(".grid-stack-item");
      items.forEach((item) => {
        const widgetId = item.getAttribute("gs-id");
        if (!widgetId) return;
        const def = defById.get(widgetId) ?? availableWidgets.find((w) => w.id === widgetId);
        if (!def) return;
        const contentEl = item.querySelector(".grid-stack-item-content");
        if (contentEl) {
          renderWidgetInto(contentEl as HTMLElement, def, ctx, rootMapRef.current, platformValue);
        }
      });

      setIsGridReady(true);
      // Initial sync of placed-ids for the sidebar
      try {
        const initial = grid.save(false, false) as GridStackNode[];
        setPlacedIds(new Set(initial.map((n) => n.id)));
      } catch { /* ignore */ }
    });

    return () => {
      cancelled = true;
      // Unmount React roots on cleanup
      for (const root of rootMapRef.current.values()) {
        try { root.unmount(); } catch { /* ignore */ }
      }
      rootMapRef.current.clear();
      if (grid) {
        try { grid.destroy(true); } catch { /* ignore */ }
      }
      gridInstanceRef.current = null;
      setIsGridReady(false);
    };
  }, [ctx, previewMode, layoutNonce]);

  /* ----------------- Filtered widget library ---------------------- */

  const filteredLibrary = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return widgetLibrary.filter((w) => {
      if (moduleFilter !== "all" && w.module !== moduleFilter) return false;
      if (categoryFilter !== "all" && w.category !== categoryFilter) return false;
      if (q && !w.title.toLowerCase().includes(q) && !w.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [widgetLibrary, moduleFilter, categoryFilter, searchQuery]);

  /* ----------------- Handlers ------------------------------------- */

  const handleAddWidget = useCallback(
    (widget: WidgetDefinition) => {
      if (!gridInstanceRef.current || !gridRef.current || !ctx) return;
      if (previewMode) {
        toast({
          title: "Preview mode is on",
          description: "Exit preview mode to add widgets.",
        });
        return;
      }
      const grid = gridInstanceRef.current;

      // Determine next Y — append at the bottom of the existing grid
      let maxY = 0;
      try {
        const current = grid.save(false, false) as GridStackNode[];
        maxY = current.reduce((m, n) => Math.max(m, n.y + n.h), 0);
      } catch { /* ignore */ }

      const w = Math.min(widget.defaultSize.w, 12);
      const h = widget.defaultSize.h;

      // Build the element with gs-* attrs and a content div
      const el = document.createElement("div");
      el.className = "grid-stack-item";
      el.setAttribute("gs-id", widget.id);
      el.setAttribute("gs-w", String(w));
      el.setAttribute("gs-h", String(h));
      el.innerHTML = '<div class="grid-stack-item-content"></div>';

      try {
        grid.addWidget(el, {
          id: widget.id,
          x: 0,
          y: maxY,
          w,
          h,
          autoPosition: false,
        });
      } catch {
        // Fallback: append directly to DOM (GridStack may still pick it up)
        gridRef.current.appendChild(el);
      }

      // Render React widget into the freshly added content div
      const contentEl = el.querySelector(".grid-stack-item-content");
      if (contentEl) {
        renderWidgetInto(contentEl as HTMLElement, widget, ctx, rootMapRef.current, platformValue);
      }

      refreshPlacedIds();
      toast({
        title: "Widget added",
        description: `${widget.title} added to the layout.`,
      });
    },
    [ctx, previewMode, refreshPlacedIds],
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      if (!gridInstanceRef.current || !gridRef.current) return;
      if (previewMode) {
        toast({
          title: "Preview mode is on",
          description: "Exit preview mode to remove widgets.",
        });
        return;
      }
      const widget = widgetLibrary.find((w) => w.id === widgetId);
      const items = gridRef.current.querySelectorAll(".grid-stack-item");
      let removed = false;
      for (const item of Array.from(items)) {
        if (item.getAttribute("gs-id") === widgetId) {
          // Unmount the React root first to avoid React warnings
          unmountWidget(widgetId, rootMapRef.current);
          try {
            gridInstanceRef.current.removeWidget(item as HTMLElement, true);
          } catch { /* ignore */ }
          removed = true;
          break;
        }
      }
      if (removed) {
        refreshPlacedIds();
        toast({
          title: "Widget removed",
          description: `${widget?.title ?? widgetId} removed from the layout.`,
        });
      }
    },
    [widgetLibrary, previewMode, refreshPlacedIds],
  );

  const handleSave = useCallback(() => {
    if (!ctx?.tenant || !gridInstanceRef.current || !selectedRole) return;
    const roleId = ctx.user.roles[0];
    if (!roleId) return;
    try {
      const currentLayout = gridInstanceRef.current.save(false, false) as GridStackNode[];
      saveLayoutToStorage(ctx.tenant.id, roleId, currentLayout);
      toast({
        title: "Layout saved",
        description: `Saved to ${ctx.tenant.name} — ${selectedRole.name}.`,
      });
    } catch {
      toast({
        title: "Save failed",
        description: "Could not save the current layout.",
      });
    }
  }, [ctx, selectedRole]);

  const handleReset = useCallback(() => {
    if (!ctx?.tenant || !selectedRole) return;
    const roleId = ctx.user.roles[0];
    if (!roleId) return;
    clearLayoutFromStorage(ctx.tenant.id, roleId);
    toast({
      title: "Layout reset to defaults",
      description: `Restored platform default layout for ${ctx.tenant.name} — ${selectedRole.name}.`,
    });
    // Bump the nonce to force a clean GridStack re-init from auto-layout
    setLayoutNonce((n) => n + 1);
  }, [ctx, selectedRole]);

  const handleToggleLock = useCallback(
    (value: boolean) => {
      if (!ctx?.tenant || !selectedRole) return;
      const roleId = ctx.user.roles[0];
      if (!roleId) return;
      saveLock(ctx.tenant.id, roleId, value);
      setIsLocked(value);
      toast({
        title: value ? "Layout locked for tenant" : "Layout unlocked for tenant",
        description: value
          ? `${ctx.tenant.name} — ${selectedRole.name} can no longer customize their dashboard.`
          : `${ctx.tenant.name} — ${selectedRole.name} may customize their dashboard again.`,
      });
    },
    [ctx, selectedRole],
  );

  const handleTogglePreview = useCallback(() => {
    const next = !previewMode;
    setPreviewMode(next);
    if (gridInstanceRef.current) {
      try {
        gridInstanceRef.current.setStatic(next);
      } catch { /* ignore */ }
    }
    toast({
      title: next ? "Preview mode" : "Edit mode",
      description: next
        ? "Rendering exactly as the tenant will see it (read-only)."
        : "Drag, resize, add, and remove widgets. Changes save automatically.",
    });
  }, [previewMode]);

  /* ----------------- Render --------------------------------------- */

  // Guard against missing tenant/role (no tenants configured)
  if (!selectedTenant || !selectedRole || !ctx) {
    return (
      <Page>
        <PageHeader
          title="Dashboard Manager"
          description="Configure widget layouts per tenant and role."
          icon={LayoutDashboard}
        />
        <EmptyState
          title="No tenants available"
          description="Provision at least one non-platform tenant before configuring dashboard layouts."
          icon={Building2}
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Dashboard Manager"
        description={`Configure widget layouts for each tenant's admin and ${term("trader").toLowerCase()} roles.`}
        icon={LayoutDashboard}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePreview}
              className="gap-1.5"
            >
              {previewMode ? (
                <>
                  <Pencil className="h-3.5 w-3.5" /> Exit Preview
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </>
              )}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Save Layout
            </Button>
          </div>
        }
      />

      <PageContent className="!flex-row gap-4">
        {/* ============ Sidebar ============ */}
        <aside className="flex w-[280px] shrink-0 flex-col gap-3">
          {/* Tenant selector */}
          <Card className="shadow-none">
            <CardContent className="space-y-3 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Tenant
              </div>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ background: t.branding.primaryColor }}
                        />
                        <span>{t.name}</span>
                        <Badge variant="outline" className="ml-1 text-[9px]">
                          {t.plan}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTenant && (
                <div className="text-[11px] text-muted-foreground">
                  {selectedTenant.enabledModules.length} modules ·{" "}
                  {selectedTenant.enabledFeatures.length} features
                </div>
              )}
            </CardContent>
          </Card>

          {/* Role selector */}
          <Card className="shadow-none">
            <CardContent className="space-y-3 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Role
              </div>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        <span>{r.name}</span>
                        <Badge
                          variant="outline"
                          className="ml-1 text-[9px] capitalize"
                        >
                          {r.application === "prop-admin" ? "Admin" : term("trader")}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole && (
                <div className="text-[11px] text-muted-foreground">
                  {selectedRole.permissions.length} permissions ·{" "}
                  {availableWidgets.length} widgets available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Widget Library */}
          <Card className="flex min-h-[300px] flex-1 flex-col shadow-none">
            <CardContent className="flex h-full flex-col gap-3 p-3.5">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <LayoutDashboard className="h-3.5 w-3.5" /> Widget Library
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Add widgets to the layout or remove ones already placed.
                </p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search widgets…"
                  className="h-8 pl-7 text-xs"
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-1.5">
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue placeholder="Module" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>
                    {moduleOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full" size="sm">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {WIDGET_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Widget list */}
              <ScrollArea className="-mx-1 flex-1 px-1">
                <div className="space-y-1.5 pr-1">
                  {filteredLibrary.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                      <PackageOpen className="h-6 w-6 text-muted-foreground/60" />
                      <p className="text-[11px] text-muted-foreground">
                        No widgets match these filters.
                      </p>
                    </div>
                  ) : (
                    filteredLibrary.map((w) => {
                      const isPlaced = placedIds.has(w.id);
                      const moduleInfo = moduleRegistry.get(w.module);
                      const moduleName = moduleInfo?.manifest.name ?? w.module;
                      const accentColor = moduleInfo?.manifest.accentColor ?? "#4a7c59";
                      return (
                        <div
                          key={w.id}
                          className={cn(
                            "group relative flex flex-col gap-1.5 rounded-lg border bg-card p-2.5 transition-all hover:border-terra hover:shadow-soft",
                            isPlaced && "border-terra-soft bg-terra-surface/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-medium text-foreground">
                                {w.title}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground">
                                {w.description ?? w.id}
                              </p>
                            </div>
                            {isPlaced ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                              style={{
                                background: `${accentColor}14`,
                                color: accentColor,
                              }}
                            >
                              {moduleName}
                            </span>
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                              {w.category}
                            </span>
                            <span className="ml-auto rounded border border-terra-soft px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
                              {w.defaultSize.w}×{w.defaultSize.h}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-end gap-1">
                            {isPlaced ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 gap-1 px-2 text-[11px]"
                                onClick={() => handleRemoveWidget(w.id)}
                                disabled={previewMode}
                              >
                                <Trash2 className="h-3 w-3" /> Remove
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                className="h-6 gap-1 px-2 text-[11px]"
                                onClick={() => handleAddWidget(w)}
                                disabled={previewMode}
                              >
                                <Plus className="h-3 w-3" /> Add
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Layout actions */}
          <Card className="shadow-none">
            <CardContent className="space-y-3 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Layout Actions
              </div>

              {/* Lock toggle */}
              <div className="flex items-center justify-between gap-2 rounded-md border border-terra-soft bg-terra-surface/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  {isLocked ? (
                    <Lock className="h-4 w-4 text-tertiary" />
                  ) : (
                    <Unlock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground">
                      {isLocked ? "Tenant locked" : "Tenant can customize"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isLocked
                        ? "Tenant cannot edit their own dashboard."
                        : "Tenant may re-arrange their dashboard."}
                    </p>
                  </div>
                </div>
                <Switch checked={isLocked} onCheckedChange={handleToggleLock} />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="w-full gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
              </Button>
            </CardContent>
          </Card>
        </aside>

        {/* ============ Main editor ============ */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {/* Mode indicator */}
          <div className="flex items-center gap-2 rounded-lg border border-terra bg-terra-surface/40 px-4 py-2.5">
            {previewMode ? (
              <Eye className="h-4 w-4 text-tertiary" />
            ) : (
              <Pencil className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium text-foreground">
              {previewMode
                ? "Preview mode — read-only view of the tenant dashboard"
                : "Edit mode — drag, resize, add & remove widgets"}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {selectedTenant.name} · {selectedRole.name}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {placedIds.size} widget{placedIds.size !== 1 ? "s" : ""} placed
            </span>
            {isLocked && (
              <Badge
                variant="outline"
                className="ml-auto gap-1 border-amber-600/40 bg-amber-500/10 text-amber-700"
              >
                <Lock className="h-3 w-3" /> Locked for tenant
              </Badge>
            )}
          </div>

          {/* GridStack container */}
          {availableWidgets.length === 0 ? (
            <EmptyState
              title="No widgets available for this tenant + role"
              description="The selected tenant does not have any modules enabled that provide widgets for this role's application scope."
              icon={PackageOpen}
              hint="Enable modules for this tenant via the Tenant Detail screen."
            />
          ) : (
            <div
              ref={gridRef}
              className={cn(
                "grid-stack",
                !previewMode && "grid-stack-edit-mode",
              )}
              style={{ minHeight: 280 }}
            />
          )}

          {/* Inline CSS for GridStack widget styling (Terra theme) */}
          <style jsx global>{`
            .grid-stack {
              --grid-stack-columns: 12;
              background: transparent;
            }
            .grid-stack-item {
              background: transparent;
              border: none;
            }
            .grid-stack-item-content {
              border-radius: var(--radius);
              overflow: hidden;
              box-shadow: var(--shadow-soft);
              background-color: var(--card);
              transition: box-shadow 200ms ease, transform 200ms ease;
            }
            .grid-stack-item-content:hover {
              box-shadow: 0 8px 30px rgba(46, 50, 48, 0.08);
            }
            .grid-stack-edit-mode .grid-stack-item-content {
              border: 2px dashed var(--primary);
              border-radius: var(--radius);
              cursor: move;
            }
            .grid-stack-edit-mode .grid-stack-item:hover .grid-stack-item-content {
              transform: scale(1.01);
              border-style: solid;
            }
            .grid-stack-placeholder > .placeholder-content {
              background-color: var(--primary) !important;
              opacity: 0.1 !important;
              border-radius: var(--radius) !important;
            }
            .ui-resizable-handle {
              opacity: 0;
              transition: opacity 200ms;
            }
            .grid-stack-edit-mode .ui-resizable-handle {
              opacity: 0.5;
            }
          `}</style>

          {/* Helper footer */}
          <p className="text-[11px] text-muted-foreground">
            {previewMode
              ? "Preview mode is read-only. Exit preview to modify the layout."
              : "Layout changes save automatically to local storage keyed by tenant + role."}
          </p>
        </div>
      </PageContent>
    </Page>
  );
}
