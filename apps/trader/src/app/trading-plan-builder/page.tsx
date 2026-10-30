import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradingPlanBuilderPage } from "../../modules/trading/pages/trading-plan-builder-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradingPlanBuilderPage />
    </Suspense>
  );
}
