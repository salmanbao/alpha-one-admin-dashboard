import { Suspense } from "react";
import { PayoutDetailPage } from "../../modules/payouts/pages/payout-detail-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PayoutDetailPage />
    </Suspense>
  );
}
