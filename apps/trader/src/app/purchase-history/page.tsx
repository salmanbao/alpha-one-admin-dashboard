import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PurchaseHistoryPage } from "../../modules/marketplace/pages/purchase-history-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PurchaseHistoryPage />
    </Suspense>
  );
}
