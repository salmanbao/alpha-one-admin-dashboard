import { Suspense } from "react";
import { PayoutHistoryPage } from "../../modules/payouts/pages/payout-history-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PayoutHistoryPage />
    </Suspense>
  );
}
