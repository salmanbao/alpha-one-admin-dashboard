import { Suspense } from "react";
import { RiskDashboardPage } from "../../modules/trading/pages/risk-dashboard-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RiskDashboardPage />
    </Suspense>
  );
}
