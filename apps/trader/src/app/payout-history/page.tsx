import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PayoutHistoryPage } from "../../modules/payouts/pages/payout-history-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PayoutHistoryPage />
    </Suspense>
  );
}
