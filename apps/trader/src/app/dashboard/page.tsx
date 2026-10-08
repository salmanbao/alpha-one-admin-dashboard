import { Suspense } from "react";
import { DashboardPage } from "../../modules/dashboard/pages/dashboard-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  );
}
