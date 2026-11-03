import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ScalingPlanPage } from "../../modules/payouts/pages/scaling-plan-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ScalingPlanPage />
    </Suspense>
  );
}
