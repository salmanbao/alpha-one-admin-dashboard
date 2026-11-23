"use client";

/**
 * PFaaS Platform — Dashboard View Router Component
 *
 * Resolves the current view from router state, looks up the page
 * component, and renders it with module/permission/feature guards.
 */

import { usePlatform } from "@/lib/platform/platform-context";
import { resolveView, type ViewComponent, viewRegistry } from "@/lib/platform/view-router";
import { moduleRegistry } from "@/lib/platform/module-registry";
import { hasPermission } from "@/lib/platform/permission-engine";
import { isModuleEnabledSafe, isFeatureEnabledSafe } from "@/components/platform/guard-utils";
import { ForbiddenState } from "@/components/platform/guards";
import { ModuleErrorBoundary } from "@/components/platform/guards";
import { Page, PageContent } from "@/components/platform/page";
import { PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateTenantPage } from "@/modules/super-admin/create-tenant-page";

/** S5/F6 — nearest keys by plain edit distance, dev triage only. */
function nearestKeys(viewId: string, keys: string[], limit = 10): string[] {
  const dist = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i, ...Array<number>(n).fill(0)];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
      prev = cur;
    }
    return prev[n];
  };
  return [...keys].sort((x, y) => dist(viewId, x) - dist(viewId, y)).slice(0, limit);
}

export function DashboardRouter() {
  const { router, runtime, navigate } = usePlatform();
  const view = router.view;
  const params = router.params;

  const Component = resolveView(view);

  if (!Component) {
    // S5/F6 — the old copy told platform operators a tenant module might be
    // disabled, framing an engineering defect as an access restriction. An
    // unregistered view has no owning module (this renders before any route
    // definition is consulted) and the platform operator is not subject to
    // tenant entitlements at all. Make the wording application-aware and
    // give triage a jump start in dev builds.
    const isPlatformApp = runtime.application === "super-admin";
    if (process.env.NODE_ENV !== "production") {
      const keys = Object.keys(viewRegistry);
      console.warn(
        `[view-router] "${view}" is not registered (${keys.length} keys). ` +
          `Nearest: ${nearestKeys(view, keys).join(", ")}`,
      );
    }
    return (
      <Page>
        <PageContent>
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
            <PackageX className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">View "{view}" not found</p>
            <p className="text-sm text-muted-foreground">
              {isPlatformApp
                ? "This view is not registered in the current build. This is an engineering defect, not an access restriction — please report it."
                : "The module that owns this view may be disabled for this tenant."}
            </p>
            <Button size="sm" variant="outline" onClick={() => navigate("super-overview")}>
              Return to overview
            </Button>
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
