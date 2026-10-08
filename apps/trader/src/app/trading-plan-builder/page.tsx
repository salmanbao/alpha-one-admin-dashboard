import { Suspense } from "react";
import { TradingPlanBuilderPage } from "../../modules/trading/pages/trading-plan-builder-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TradingPlanBuilderPage />
    </Suspense>
  );
}
