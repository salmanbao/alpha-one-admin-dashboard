import { Skeleton } from "@pfaas/ui";

/**
 * Route-level page skeleton — shown while a route chunk streams in
 * (Suspense fallback) and by the root loading.tsx.
 *
 * Previously every trader route used `fallback={null}`, which rendered a
 * blank content area during load — no layout continuity, no feedback.
 * This skeleton mirrors the common page shape (PageHeader → toolbar →
 * content card) so the transition to real content is stable.
 */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6" aria-hidden="true">
      {/* Page header: title + description + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>

      {/* Toolbar + content card */}
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-28" />
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
