import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PurchaseCompletedPage } from "../../modules/marketplace/pages/purchase-completed-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PurchaseCompletedPage />
    </Suspense>
  );
}
