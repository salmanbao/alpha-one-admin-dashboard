import { PageSkeleton } from "@/components/shell/page-skeleton";

/**
 * Route-level loading state (audit fix #13) — shows the page skeleton
 * the instant a data-heavy route is navigated to, before the page
 * chunk resolves. The in-page Suspense fallbacks still cover streaming.
 */
export default function Loading() {
  return <PageSkeleton />;
}
