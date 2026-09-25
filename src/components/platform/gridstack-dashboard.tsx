"use client";

/**
 * PFaaS Platform — GridStack Dashboard (UX Constitution §23)
 *
 * Drag-and-drop, resizable dashboard widgets powered by GridStack.
 *
 * Permission model:
 * - Super Admin (application === "super-admin") CAN edit layout (drag, resize, add/remove)
 * - Prop Admin, Trader, and all other users CANNOT edit layout — read-only grid
 * - Layouts are persisted per-tenant to localStorage
 *
 * The grid is always rendered as GridStack, but `staticGrid` flag controls
 * whether drag/resize is enabled based on the current user's application.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveDashboardLayout, resolveWidgets, type ResolvedWidget } from "@/lib/platform/dashboard-engine";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { ModuleErrorBoundary, WidgetSkeleton, EmptyState } from "@/components/platform/guards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  PackageOpen,
  Settings2,
  Eye,
  EyeOff,
  RotateCcw,
  X,
  Save,
  Lock,
  Unlock,
  Download,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// GridStack types (simplified — we use the JS API directly)
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
type GridStackInstance = {
  on(event: string, cb: (event: Event, items: GridStackNode[]) => void): void;
  save(saveContent: boolean, saveGridOpt: boolean): GridStackNode[];
  load(layout: GridStackNode[], addRemove: boolean): void;
  destroy(detach: boolean): void;
  staticGrid(value?: boolean): boolean;
  setStatic(value: boolean): void;
  batchUpdate(): void;
  commitBatch(): void;
  addWidget(el: HTMLElement, options: Record<string, unknown>): void;
  removeWidget(el: HTMLElement, removeDOM: boolean): void;
  update(el: HTMLElement, options: Record<string, unknown>): void;
};

// Layout storage key per tenant
const LAYOUT_KEY = (tenantId: string) => `pfaas:gridLayout:${tenantId}`;

function loadLayout(tenantId: string): GridStackNode[] | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LAYOUT_KEY(tenantId));
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

function saveLayout(tenantId: string, layout: GridStackNode[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_KEY(tenantId), JSON.stringify(layout));
  } catch { /* ignore */ }
}

export function DashboardGrid() {
  const { runtime, hiddenWidgets } = usePlatform();
  const isSuperAdmin = runtime.user.application === "super-admin";
  const tenantId = runtime.tenant?.id ?? "platform";
  const roleId = runtime.user.roles[0] ?? "anon";

  // Check if this tenant+role's layout is locked by platform admin
  const isLayoutLocked = (() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(`pfaas:dashboardLock:${tenantId}:${roleId}`) === "true";
    } catch { return false; }
  })();

  // Super-admin can always edit UNLESS the layout is explicitly locked
  // Non-super-admin can NEVER edit (read-only)
  const canEdit = isSuperAdmin && !isLayoutLocked;

  // Compute resolved widgets (with hidden filter)
  const layout = resolveDashboardLayout(runtime, hiddenWidgets);
  const widgets = resolveWidgets(runtime, layout);

  // GridStack state
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInstanceRef = useRef<GridStackInstance | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  // Map of widgetId → DOM container element that GridStack created.
  // We render React widgets into these containers via createPortal so that
  // PlatformContext (and any other React context from the parent tree) flows
  // through correctly. Using createRoot here would create an isolated React
  // tree that loses all parent context, causing usePlatform() to throw.
  const [widgetMounts, setWidgetMounts] = useState<
    Array<{ widgetId: string; container: HTMLElement }>
  >([]);

  // Build initial GridStack nodes from resolved widgets or saved layout
  // Use the per-tenant+role layout key if a Dashboard Manager layout exists,
  // otherwise fall back to the per-tenant grid layout key.
  const buildNodes = useCallback((): GridStackNode[] => {
    // Try Dashboard Manager layout first (per-tenant+role)
    const dmSaved = (() => {
      if (typeof window === "undefined") return null;
      try {
        const stored = window.localStorage.getItem(`pfaas:dashboardLayout:${tenantId}:${roleId}`);
        return stored ? JSON.parse(stored) : null;
      } catch { return null; }
    })();
    if (dmSaved && dmSaved.length > 0) {
      const visibleIds = new Set(widgets.map((w) => w.definition.id));
      return dmSaved.filter((n: GridStackNode) => visibleIds.has(n.id));
    }
    // Fall back to per-tenant grid layout
    const saved = loadLayout(tenantId);
    if (saved && saved.length > 0) {
      // Use saved layout — filter out hidden widgets
      const visibleIds = new Set(widgets.map((w) => w.definition.id));
      return saved.filter((n) => visibleIds.has(n.id));
    }
    // Fall back to auto-layout from resolveDashboardLayout
    return layout.widgets.map((p) => ({
      id: p.widgetId,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
    }));
  }, [layout, widgets, tenantId]);

  // Initialize GridStack on mount + when widgets change
  useEffect(() => {
    if (!gridRef.current) return;

    let grid: GridStackInstance | null = null;

    // Load GridStack dynamically (keeps initial bundle small)
    import("gridstack").then((gsModule) => {
      const GridStack = (gsModule as unknown as { GridStack: GridStackStatic }).GridStack;
      if (!gridRef.current) return;

      // Clear any existing grid
      gridRef.current.innerHTML = "";

      const nodes = buildNodes();

      // Pre-build DOM elements with gs-* attributes so GridStack auto-detects them
      for (const node of nodes) {
        const widgetDef = widgets.find((w) => w.definition.id === node.id);
        if (!widgetDef) continue;

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

      // NOW init GridStack — it will auto-detect the gs-* children
      // NOTE: GridStack v11+ signature is `init(options, el)` — options FIRST,
      // element (or selector) SECOND. Passing them in the wrong order causes
      // `el.classList is undefined` because GridStack internally treats the
      // options object as the grid element.
      grid = GridStack.init(
        {
          column: 12,
          cellHeight: 80,
          margin: 12,
          staticGrid: !canEdit,
          disableResize: !canEdit,
          disableDrag: !canEdit,
          animate: true,
          float: false,
        },
        gridRef.current,
      );

      gridInstanceRef.current = grid;

      // Save layout on change events
      grid.on("change", () => {
        if (grid) {
          try {
            const currentLayout = grid.save(false, false) as GridStackNode[];
            saveLayout(tenantId, currentLayout);
          } catch {}
        }
      });

      grid.on("dragstop", () => {
        if (grid) {
          try {
            const currentLayout = grid.save(false, false) as GridStackNode[];
            saveLayout(tenantId, currentLayout);
          } catch {}
        }
      });

      grid.on("resizestop", () => {
        if (grid) {
          try {
            const currentLayout = grid.save(false, false) as GridStackNode[];
            saveLayout(tenantId, currentLayout);
          } catch {}
        }
      });

      // After grid init, collect the DOM containers GridStack created for each
      // widget. We render React widgets into these via createPortal in the JSX
      // below (rather than imperatively via createRoot), so that React context
      // (PlatformProvider, theme, toast, etc.) propagates into each widget.
      const mounts: Array<{ widgetId: string; container: HTMLElement }> = [];
      const items = gridRef.current.querySelectorAll(".grid-stack-item");
      items.forEach((item) => {
        const widgetId = item.getAttribute("gs-id");
        if (!widgetId) return;
        const contentEl = item.querySelector(
          ".grid-stack-item-content",
        ) as HTMLElement | null;
        if (contentEl) {
          mounts.push({ widgetId, container: contentEl });
        }
      });
      setWidgetMounts(mounts);

      setIsLoaded(true);
    });

    return () => {
      if (grid) {
        grid.destroy(true);
      }
      gridInstanceRef.current = null;
      setWidgetMounts([]);
    };
  }, [tenantId, canEdit, widgets.length]);

  // Toggle edit mode (super-admin only)
  const toggleEditMode = () => {
    if (!canEdit) return;
    const next = !editMode;
    setEditMode(next);
    if (gridInstanceRef.current) {
      gridInstanceRef.current.setStatic(!next);
    }
    toast({
      title: next ? "Layout editing enabled" : "Layout locked",
      description: next
        ? "Drag, resize, and rearrange widgets. Changes save automatically."
        : "Dashboard layout is now locked and read-only.",
    });
  };

  const resetLayout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LAYOUT_KEY(tenantId));
    }
    toast({
      title: "Layout reset",
      description: "Dashboard restored to default layout. Reloading...",
    });
    setTimeout(() => window.location.reload(), 500);
  };

  // Empty state
  if (widgets.length === 0) {
    return (
      <EmptyState
        title="No widgets available"
        description="Enable modules in Settings → Modules to populate your dashboard with widgets."
        icon={LayoutGrid}
      />
    );
  }

  // Group by module for section headers (still works with GridStack)
  const enabledModules = moduleRegistry.getEnabledModules(runtime);
  const byModule = new Map<string, ResolvedWidget[]>();
  for (const w of widgets) {
    const arr = byModule.get(w.definition.module) ?? [];
    arr.push(w);
    byModule.set(w.definition.module, arr);
  }
  const orderedSections = enabledModules
    .filter((m) => byModule.has(m.manifest.id))
    .map((m) => ({ module: m, items: byModule.get(m.manifest.id)! }));

  return (
    <div className="space-y-4">
      {/* Layout control bar — only visible to super-admin */}
      {canEdit ? (
        <div className="flex items-center gap-2 rounded-lg border border-terra bg-terra-surface/40 px-4 py-2.5">
          {editMode ? (
            <Unlock className="h-4 w-4 text-tertiary" />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">
            {editMode ? "Layout editing enabled — drag, resize, rearrange" : "Layout locked (read-only)"}
          </span>
          <span className="text-xs text-muted-foreground">· Super Admin only</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant={editMode ? "default" : "outline"} onClick={toggleEditMode} className="gap-1.5">
              <Settings2 className="h-3.5 w-3.5" />
              {editMode ? "Lock Layout" : "Edit Layout"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetLayout} className="gap-1.5 text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-terra-soft px-4 py-2 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          <span>Dashboard layout is managed by your platform administrator</span>
        </div>
      )}

      {/* Module section headers */}
      {orderedSections.map(({ module, items }) => {
        const Icon = module.manifest.icon;
        return (
          <div key={module.manifest.id} className="space-y-2">
            <div className="flex items-center gap-2.5 border-b border-terra-soft pb-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md"
                style={{ background: `${module.manifest.accentColor}1a`, color: module.manifest.accentColor }}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">{module.manifest.name}</h2>
                <p className="text-[11px] text-muted-foreground">{module.manifest.description}</p>
              </div>
              <span className="ml-auto rounded-full border border-terra bg-terra-surface/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {items.length} widget{items.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        );
      })}

      {/* GridStack container */}
      <div
        ref={gridRef}
        className={cn(
          "grid-stack",
          editMode && "grid-stack-edit-mode",
        )}
        style={{ minHeight: 200 }}
      />

      {/* Portal each React widget into the DOM container GridStack created.
          Portals stay inside this React tree, so PlatformContext (and any
          other parent context) propagates into every widget. This is what
          makes usePlatform(), useToast(), next-themes, etc. work inside
          widgets mounted into GridStack-managed DOM nodes. */}
      {widgetMounts.map(({ widgetId, container }) => {
        const widgetDef = widgets.find((w) => w.definition.id === widgetId);
        if (!widgetDef) return null;
        const Comp = widgetDef.definition.component;
        const accent = moduleRegistry.get(widgetDef.definition.module)?.manifest.accentColor;
        return createPortal(
          <ModuleErrorBoundary name={widgetDef.definition.title}>
            <div className="flex h-full flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-terra-soft bg-terra-surface/30 px-4 py-2.5">
                <h3 className="text-[13px] font-medium text-foreground">{widgetDef.definition.title}</h3>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                  style={{
                    background: `${accent}14`,
                    color: accent,
                  }}
                >
                  {widgetDef.definition.category}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <Comp
                  instanceId={`${widgetDef.definition.id}-${widgetDef.placement.x}-${widgetDef.placement.y}`}
                  widgetId={widgetDef.definition.id}
                />
              </div>
            </div>
          </ModuleErrorBoundary>,
          container,
          `widget-${widgetId}`,
        );
      })}

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
    </div>
  );
}

/**
 * Re-export the CustomizeDashboardDialog for backward compatibility.
 * This is now a no-op wrapper since layout editing is handled by GridStack.
 */
export function CustomizeDashboardDialog() {
  return null;
}
