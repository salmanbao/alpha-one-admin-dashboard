import { Suspense } from "react";
import { PerformanceAnalyticsPage } from "../../modules/trading/pages/performance-analytics-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PerformanceAnalyticsPage />
    </Suspense>
  );
}
