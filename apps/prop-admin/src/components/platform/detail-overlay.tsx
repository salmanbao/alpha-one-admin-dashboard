"use client";

/**
 * PFaaS Platform — Detail Overlay (sub-screen as a sheet over its parent)
 *
 * Enterprise navigation pattern: an operator scanning a list clicks a row
 * and the detail opens in a right-side SHEET ON TOP of the list — scroll
 * position, filters and selection survive, and closing returns to exactly
 * where they were. The sibling pattern (open the same sub-screen in a NEW
 * TAB) lives in lib/platform/view-links.ts; every overlay header also
 * offers it, so both patterns are one click away from any pair.
 *
 * URL-synced state — refresh, browser back/forward, deep links and
 * "open in new tab" all work because the panel lives in the query string
 * alongside the parent view:
 *
 *   ?view=payouts-pending&panel=payout-detail&id=PAY-123
 *   └ parent view ┘        └ overlay sub-screen ┘ └ entity id ┘
 *
 * The sub-screen reads its entity from `router.params.id` (detail pages
 * already do `router.params.id`), so no changes are needed inside the
 * detail screens themselves — the host passes the full router params.
 *
 * Guards mirror DashboardRouter: a panel that fails its route's
 * module/permission checks renders ForbiddenState INSIDE the sheet rather
 * than bypassing the guard a full-page visit would enforce.
 *
 * Scope: overlay parents are LIST views (they don't read `params.id`),
 * so open/close may freely own `panel` + `id`. Wizard/one-way flows and
 * dashboards stay full-page on purpose.
 */

import { useCallback } from "react";
import { ExternalLink } from "lucide-react";
import { usePlatform } from "@/lib/platform/platform-context";
import { resolveView } from "@/lib/platform/view-router";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { hasPermission } from "@/lib/platform/permission-engine";
import { isModuleEnabledSafe, isFeatureEnabledSafe } from "@/components/platform/guard-utils";
import { ForbiddenState, ModuleErrorBoundary } from "@/components/platform/guards";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { openViewInNewTab } from "@/lib/platform/view-links";

/** Query param that carries the open sub-screen. */
const PANEL_PARAM = "panel";

export interface DetailOverlayApi {
  /** Currently open panel view id, or null. */
  panel: string | null;
  /** Open a sub-screen as an overlay on the CURRENT parent view. */
  openPanel: (viewId: string, params?: Record<string, string>) => void;
  /** Close the overlay, returning the URL to the bare parent list. */
  closePanel: () => void;
}

/**
 * Hook for parent (list) screens: primary click → `openPanel(subView, { id })`.
 * State is written through `navigate()` so it flows into the URL via the
 * router's existing pushState sync (platform-context.tsx).
 */
export function useDetailOverlay(): DetailOverlayApi {
  const { router, navigate } = usePlatform();
  const panel = router.params[PANEL_PARAM] ?? null;

  const openPanel = useCallback(
    (viewId: string, params: Record<string, string> = {}) => {
      // Keep the parent's own params (e.g. tab filters) but never carry a
      // stale panel/id into the new panel — `params` supplies the entity.
      const base: Record<string, string> = {};
      Object.entries(router.params).forEach(([k, v]) => {
        if (k !== PANEL_PARAM && k !== "id") base[k] = v;
      });
      navigate(router.view, { ...base, ...params, [PANEL_PARAM]: viewId });
    },
    [router.view, router.params, navigate],
  );

  const closePanel = useCallback(() => {
    // Parents of overlays are list views and don't read `id`; dropping it
    // keeps the URL clean so the list re-renders from its own state.
    const rest: Record<string, string> = {};
    Object.entries(router.params).forEach(([k, v]) => {
      if (k !== PANEL_PARAM && k !== "id") rest[k] = v;
    });
    navigate(router.view, rest);
  }, [router.view, router.params, navigate]);

  return { panel, openPanel, closePanel };
}

/**
 * Mounted once next to DashboardRouter (app/page.tsx). Renders nothing
 * unless `?panel=` is present; otherwise the parent list owns the screen.
 */
export function DetailOverlayHost() {
  const { router, runtime } = usePlatform();
  const { panel, closePanel } = useDetailOverlay();

  if (!panel) return null;

  // Unknown or stitch-gated view id → ignore the panel (parent stays
  // usable) instead of rendering a dead sheet.
  const Component = resolveView(panel);
  if (!Component) return null;

  const routeDef = moduleRegistry
    .getAll()
    .flatMap((m) => m.routes ?? [])
    .find((r) => r.viewId === panel);
  const label = routeDef?.label ?? panel;

  // Same guard chain as DashboardRouter — no permission bypass via panel.
  let guardMessage: string | null = null;
  if (routeDef?.module && !isModuleEnabledSafe(runtime, routeDef.module)) {
    guardMessage = `The "${routeDef.module}" module is not enabled for this tenant.`;
  } else if (routeDef?.feature && !isFeatureEnabledSafe(runtime, routeDef.feature)) {
    guardMessage = `This view requires the "${routeDef.feature}" feature flag.`;
  } else if (routeDef?.permission && !hasPermission(runtime.user, routeDef.permission)) {
    guardMessage = "You don't have permission to access this view.";
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) closePanel();
      }}
    >
      <SheetContent
        side="right"
        className="gap-0 border-l bg-background p-0 sm:max-w-2xl lg:max-w-4xl"
      >
        {/* Header: a11y title (Radix requires SheetTitle) + the pattern-1
            escape hatch — jump to the same sub-screen as a full page. */}
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3 pr-12">
          <SheetTitle className="text-sm font-semibold">{label}</SheetTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            title="Open this screen full-page in a new tab"
            onClick={() => openViewInNewTab(panel, { id: router.params.id ?? "" })}
          >
            <ExternalLink className="h-3.5 w-3.5" /> New tab
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {guardMessage ? (
            <ForbiddenState message={guardMessage} />
          ) : (
            <ModuleErrorBoundary name={label}>
              <Component params={router.params} />
            </ModuleErrorBoundary>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
