import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PayoutEligibilityPage } from "../../modules/payouts/pages/payout-eligibility-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PayoutEligibilityPage />
    </Suspense>
  );
}
