import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { StateAdaptiveDashboardPage } from "../../modules/dashboard/pages/state-adaptive-dashboard-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StateAdaptiveDashboardPage />
    </Suspense>
  );
}
