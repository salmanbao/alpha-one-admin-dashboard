import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { WithdrawalMethodsPage } from "../../modules/payouts/pages/withdrawal-methods-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WithdrawalMethodsPage />
    </Suspense>
  );
}
