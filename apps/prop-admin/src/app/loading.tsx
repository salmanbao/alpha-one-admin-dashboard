import { Skeleton } from "@pfaas/ui";

/**
 * Route-level loading — prop-admin's AppShell lives in page.tsx (not
 * layout.tsx), so this file is the FIRST paint before the shell exists.
 * It mirrors the shell's shape (sidebar strip + topbar + content) instead
 * of the old centered spinner, keeping layout stable through boot.
 */
export default function LoadingPage() {
  return (
    <div className="flex min-h-screen bg-background" aria-hidden="true">
      {/* Sidebar strip */}
      <div className="hidden w-60 shrink-0 flex-col gap-3 border-r p-4 lg:flex">
        <Skeleton className="h-8 w-36" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>

      {/* Main: topbar + content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <Skeleton className="h-6 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-6 p-4 sm:p-6">
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
      </div>
    </div>
  );
}
