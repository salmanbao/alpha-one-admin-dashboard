import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { RiskDashboardPage } from "../../modules/trading/pages/risk-dashboard-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RiskDashboardPage />
    </Suspense>
  );
}
