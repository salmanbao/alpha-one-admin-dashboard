"use client";

/**
 * PFaaS Platform — Dashboard Grid
 *
 * Spec sections 20, 21, 22, 23. Renders widgets in a 12-col responsive
 * grid based on resolved layout + widget definitions. Each widget sits
 * in a WidgetContainer card with its own error boundary.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { resolveDashboardLayout, resolveWidgets } from "@/lib/platform/dashboard-engine";
import { ModuleErrorBoundary, WidgetSkeleton, EmptyState } from "./guards";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid } from "lucide-react";
import { Suspense } from "react";
import { DASHBOARD_COLS } from "@/lib/platform/dashboard-engine";

export function DashboardGrid() {
  const { runtime } = usePlatform();
  const layout = resolveDashboardLayout(runtime);
  const widgets = resolveWidgets(runtime, layout);

  if (widgets.length === 0) {
    return (
      <EmptyState
        title="No widgets available"
        description="Enable modules to populate your dashboard with widgets."
        icon={LayoutGrid}
      />
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${DASHBOARD_COLS}, minmax(0, 1fr))` }}
    >
      {widgets.map(({ placement, definition }) => {
        const Comp = definition.component;
        const span = Math.min(placement.w, DASHBOARD_COLS);
        return (
          <div
            key={`${placement.widgetId}-${placement.x}-${placement.y}`}
            className="col-span-12"
            style={{
              gridColumn: `${span > 6 ? "span 12" : `span ${span}`}`,
              // responsive: stack on small screens
            }}
          >
            <ModuleErrorBoundary name={definition.title}>
              <Card className="h-full overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">
                      {definition.title}
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
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
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <Skeleton className="mb-3 h-4 w-1/3" />
            <Skeleton className="mb-2 h-8 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
