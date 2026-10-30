import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PayoutDetailPage } from "../../modules/payouts/pages/payout-detail-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PayoutDetailPage />
    </Suspense>
  );
}
