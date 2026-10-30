import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PayoutRequestPage } from "../../modules/payouts/pages/payout-request-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PayoutRequestPage />
    </Suspense>
  );
}
