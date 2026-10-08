import { Suspense } from "react";
import { ReferralDashboardPage } from "../../modules/community/pages/referral-dashboard-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReferralDashboardPage />
    </Suspense>
  );
}
