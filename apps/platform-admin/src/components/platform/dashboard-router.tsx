"use client";

/**
 * PFaaS Platform — Dashboard View Router Component
 *
 * Resolves the current view from router state, looks up the page
 * component, and renders it with module/permission/feature guards.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { resolveView, type ViewComponent } from "@/lib/platform/view-router";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { hasPermission } from "@/lib/platform/permission-engine";
import { isModuleEnabledSafe, isFeatureEnabledSafe } from "@/components/platform/guard-utils";
import { ForbiddenState } from "@/components/platform/guards";
import { ModuleErrorBoundary } from "@/components/platform/guards";
import { Page, PageContent } from "@/components/platform/page";
import { PackageX } from "lucide-react";

export function DashboardRouter() {
  const { router, runtime } = usePlatform();
  const view = router.view;
  const params = router.params;

  const Component = resolveView(view);

  if (!Component) {
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <PackageX className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">View "{view}" not found</p>
            <p className="text-sm text-muted-foreground">
              The module that owns this view may be disabled for this tenant.
            </p>
          </div>
        </PageContent>
      </Page>
    );
  }

  // Resolve the route definition (if any) to check guards
  const routeDef = moduleRegistry.getAll().flatMap((m) => m.routes ?? []).find((r) => r.viewId === view);

  // Module guard
  if (routeDef?.module && !isModuleEnabledSafe(runtime, routeDef.module)) {
    return (
      <Page>
        <PageContent>
          <ForbiddenState message={`The "${routeDef.module}" module is not enabled for this tenant.`} />
        </PageContent>
      </Page>
    );
  }
  // Feature guard
  if (routeDef?.feature && !isFeatureEnabledSafe(runtime, routeDef.feature)) {
    return (
      <Page>
        <PageContent>
          <ForbiddenState message={`This view requires the "${routeDef.feature}" feature flag.`} />
        </PageContent>
      </Page>
    );
  }
  // Permission guard
  if (routeDef?.permission && !hasPermission(runtime.user, routeDef.permission)) {
    return (
      <Page>
        <PageContent>
          <ForbiddenState message="You don't have permission to access this view." />
        </PageContent>
      </Page>
    );
  }

  return (
    <ModuleErrorBoundary name={routeDef?.label ?? view}>
      <ViewRenderer component={Component} params={params} />
    </ModuleErrorBoundary>
  );
}

function ViewRenderer({
  component: Component,
  params,
}: {
  component: ViewComponent;
  params: Record<string, string>;
}) {
  return <Component params={params} />;
}
