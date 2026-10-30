import { Skeleton } from "@pfaas/ui";

/**
 * Route-level loading — renders inside AppShell (layout.tsx), so this is
 * the CONTENT-area skeleton only: page header → KPI row → content card.
 * Matches PageSkeleton (components/shell/page-skeleton.tsx) used by
 * the route Suspense fallbacks for a consistent first paint.
 */
export default function LoadingPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
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
