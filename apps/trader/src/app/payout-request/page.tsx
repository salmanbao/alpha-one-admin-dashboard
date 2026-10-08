import { Suspense } from "react";
import { PayoutRequestPage } from "../../modules/payouts/pages/payout-request-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PayoutRequestPage />
    </Suspense>
  );
}
