"use client";

/**
 * PFaaS Platform — Guards & Boundaries
 *
 * Spec sections 32, 34, 35, 36. ModuleGuard / FeatureGuard /
 * PermissionGuard provide UX-level visibility; ErrorBoundary isolates
 * module crashes. Loading / Empty / Error states for widgets.
 */

import { Component, Suspense, type ReactNode } from "react";
import { AlertTriangle, Ban, Loader2, PackageX, Lock } from "lucide-react";
import { usePlatform } from "@/lib/platform/platform-context";
import { hasPermission } from "@/lib/platform/permission-engine";
import { isModuleEnabledSafe } from "./guard-utils";
import { Skeleton } from "@pfaas/ui/skeleton";
import { Button } from "@pfaas/ui/button";

/* ------------------------------------------------------------------ */
/* Guards                                                              */
/* ------------------------------------------------------------------ */

export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: {
  permission: Parameters<typeof hasPermission>[1];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { user } = usePlatform();
  if (!hasPermission(user, permission)) return <>{fallback}</>;
  return <>{children}</>;
}

export function ModuleGuard({
  module: moduleId,
  fallback = null,
  children,
}: {
  module: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { runtime } = usePlatform();
  if (!isModuleEnabledSafe(runtime, moduleId)) return <>{fallback}</>;
  return <>{children}</>;
}

export function FeatureGuard({
  feature,
  fallback = null,
  children,
}: {
  feature: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { runtime } = usePlatform();
  const enabled =
    runtime.tenant?.id === "platform" ||
    runtime.enabledFeatures.includes(feature);
  if (!enabled) return <>{fallback}</>;
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* Error boundary (per-module isolation, spec section 34)             */
/* ------------------------------------------------------------------ */

interface ErrorBoundaryState {
  error: Error | null;
}

export class ModuleErrorBoundary extends Component<
  { name: string; children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-medium text-foreground">
              Something went wrong loading {this.props.name}.
            </p>
            <p className="text-sm text-muted-foreground">
              The rest of the dashboard is still operational.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={this.reset}>
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/* Loading / Empty / Error states (spec sections 35, 36)              */
/* ------------------------------------------------------------------ */

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

/**
 * EmptyState (§30) — explains why empty, what will appear, what to do.
 * Never shows just "No data." without context.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = PackageX,
  action,
  hint,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
  /** What the user should do — guides next action */
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
      <div className="rounded-full bg-muted p-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="max-w-sm">
        <p className="font-medium text-foreground">{title}</p>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {hint ? (
          <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
            <p className="text-xs font-medium text-primary">{hint}</p>
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-6 text-center">
      <Ban className="h-8 w-8 text-destructive" />
      <div>
        <p className="font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium text-foreground">{message ?? "You don't have permission to access this."}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Widget-level suspense + skeleton                                    */
/* ------------------------------------------------------------------ */

export function WidgetSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function WidgetSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WidgetSkeleton />}>{children}</Suspense>
  );
}
