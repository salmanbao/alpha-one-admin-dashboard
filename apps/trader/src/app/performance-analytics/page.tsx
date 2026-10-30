import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PerformanceAnalyticsPage } from "../../modules/trading/pages/performance-analytics-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PerformanceAnalyticsPage />
    </Suspense>
  );
}
