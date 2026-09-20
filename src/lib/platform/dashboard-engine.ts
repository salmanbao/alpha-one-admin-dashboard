/**
 * PFaaS Platform — Dashboard Engine
 *
 * Spec sections 20, 21, 22, 23. Widget grid + layout config + resolver.
 * Layouts: Platform default → Tenant → Role → User (priority order).
 */

import type {
  DashboardLayout,
  DashboardWidgetPlacement,
  ModuleRuntimeContext,
  WidgetDefinition,
} from "./types";
import { moduleRegistry } from "./module-registry";

const COLS = 12;

/** A widget resolved from its definition + placement. */
export interface ResolvedWidget {
  placement: DashboardWidgetPlacement;
  definition: WidgetDefinition;
}

/**
 * Resolve the active dashboard layout. Priority (spec section 22):
 * User customization > Role layout > Tenant layout > Platform default.
 *
 * For demo, we synthesize layouts from runtime context. User-customized
 * hidden widgets are excluded via the `hiddenWidgets` set.
 */
export function resolveDashboardLayout(
  ctx: ModuleRuntimeContext,
  hiddenWidgets?: Set<string>,
): DashboardLayout {
  const widgets = moduleRegistry.getWidgets(ctx).filter(
    (w) => !hiddenWidgets?.has(w.id),
  );
  const placements: DashboardWidgetPlacement[] = [];

  // Simple flow layout: 2 columns of equal width unless widget declares w=12
  let x = 0;
  let y = 0;
  for (const w of widgets) {
    const colW = Math.min(w.defaultSize.w, COLS);
    if (x + colW > COLS) {
      x = 0;
      y += 1;
    }
    placements.push({
      widgetId: w.id,
      x,
      y,
      w: colW,
      h: w.defaultSize.h,
    });
    x += colW;
  }
  return {
    id: `layout-${ctx.tenant?.id ?? "platform"}-${ctx.application}-${ctx.user.roles[0] ?? "anon"}`,
    label: `${ctx.tenant?.name ?? "Platform"} — ${ctx.user.roles[0] ?? "User"}`,
    tenantId: ctx.tenant?.id,
    roleId: ctx.user.roles[0],
    userId: ctx.user.id,
    widgets: placements,
  };
}

/** Resolve widget placements against the widget registry, dropping missing. */
export function resolveWidgets(
  ctx: ModuleRuntimeContext,
  layout: DashboardLayout,
): ResolvedWidget[] {
  const all = moduleRegistry.getWidgets(ctx);
  const byId = new Map(all.map((w) => [w.id, w]));
  return layout.widgets
    .map((p) => {
      const def = byId.get(p.widgetId);
      if (!def) return null;
      return { placement: p, definition: def };
    })
    .filter((x): x is ResolvedWidget => x !== null);
}

export const DASHBOARD_COLS = COLS;
