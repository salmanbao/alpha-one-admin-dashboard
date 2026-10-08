import { Suspense } from "react";
import { StateAdaptiveDashboardPage } from "../../modules/dashboard/pages/state-adaptive-dashboard-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StateAdaptiveDashboardPage />
    </Suspense>
  );
}
