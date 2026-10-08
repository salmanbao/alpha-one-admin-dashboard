import { Suspense } from "react";
import { PayoutEligibilityPage } from "../../modules/payouts/pages/payout-eligibility-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PayoutEligibilityPage />
    </Suspense>
  );
}
