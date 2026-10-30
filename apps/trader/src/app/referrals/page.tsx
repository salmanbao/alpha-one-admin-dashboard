import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ReferralDashboardPage } from "../../modules/community/pages/referral-dashboard-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReferralDashboardPage />
    </Suspense>
  );
}
