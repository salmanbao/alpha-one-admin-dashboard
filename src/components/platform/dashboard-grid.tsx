"use client";

/**
 * PFaaS Platform — Dashboard Grid
 *
 * Spec sections 20, 21, 22, 23. Renders widgets grouped by module
 * in a responsive grid. Each module section has a header strip so
 * users can visually zone the dashboard. Widgets sit in a WidgetContainer
 * card with its own error boundary. Cards use a 12-column grid that
 * collapses to 2 columns on tablet and 1 on mobile.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { resolveDashboardLayout, resolveWidgets, type ResolvedWidget } from "@/lib/platform/dashboard-engine";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { ModuleErrorBoundary, WidgetSkeleton, EmptyState } from "@/components/platform/guards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, PackageOpen } from "lucide-react";
import { Suspense } from "react";
import { DASHBOARD_COLS } from "@/lib/platform/dashboard-engine";
import { cn } from "@/lib/utils";

/* Map span (1-12) to responsive tailwind classes. We use a 12-col
 * grid on desktop, 2-col on tablet, 1-col on mobile. */
function spanClass(span: number): string {
  // desktop span (out of 12)
  const md = Math.min(Math.max(span, 4), 12);
  // tablet: half-width unless very wide
  const sm = md >= 8 ? "sm:col-span-2" : "sm:col-span-1";
  // mobile: always full
  return cn("col-span-1", sm, `lg:col-span-${md}`);
}

export function DashboardGrid() {
  const { runtime } = usePlatform();
  const layout = resolveDashboardLayout(runtime);
  const widgets = resolveWidgets(runtime, layout);

  if (widgets.length === 0) {
    return (
      <EmptyState
        title="No widgets available"
        description="Enable modules in Settings → Modules to populate your dashboard with widgets."
        icon={LayoutGrid}
      />
    );
  }

  // Group widgets by module so we can render section headers (visual zoning)
  const enabledModules = moduleRegistry.getEnabledModules(runtime);
  const byModule = new Map<string, ResolvedWidget[]>();
  for (const w of widgets) {
    const arr = byModule.get(w.definition.module) ?? [];
    arr.push(w);
    byModule.set(w.definition.module, arr);
  }
  // Order sections by module registration order (matches sidebar order)
  const orderedSections = enabledModules
    .filter((m) => byModule.has(m.manifest.id))
    .map((m) => ({ module: m, items: byModule.get(m.manifest.id)! }));

  return (
    <div className="space-y-8">
      {orderedSections.map(({ module, items }) => {
        const Icon = module.manifest.icon;
        return (
          <section key={module.manifest.id} className="space-y-3">
            <div className="flex items-center gap-2.5 border-b pb-2">
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
              <span className="ml-auto rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {items.length} widget{items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
              {items.map(({ placement, definition }) => {
                const Comp = definition.component;
                const span = Math.min(placement.w, DASHBOARD_COLS);
                return (
                  <div key={`${placement.widgetId}-${placement.x}-${placement.y}`} className={spanClass(span)}>
                    <ModuleErrorBoundary name={definition.title}>
                      <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
                        <CardHeader className="flex flex-row items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2.5">
                          <h3 className="text-[13px] font-medium text-foreground">{definition.title}</h3>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                            style={{ background: `${module.manifest.accentColor}14`, color: module.manifest.accentColor }}
                          >
                            {definition.category}
                          </span>
                        </CardHeader>
                        <CardContent className="flex-1 p-4">
                          <Suspense fallback={<WidgetSkeleton />}>
                            <Comp
                              instanceId={`${definition.id}-${placement.x}-${placement.y}`}
                              widgetId={definition.id}
                            />
                          </Suspense>
                        </CardContent>
                      </Card>
                    </ModuleErrorBoundary>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="mb-3 h-4 w-1/3" />
                  <Skeleton className="mb-2 h-8 w-2/3" />
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyDashboard() {
  return (
    <EmptyState
      title="Your dashboard is empty"
      description="Enable modules in Settings to see widgets here. The dashboard will re-compose instantly."
      icon={PackageOpen}
    />
  );
}
