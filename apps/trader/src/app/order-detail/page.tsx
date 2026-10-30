import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { OrderDetailPage } from "../../modules/trading/pages/order-detail-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderDetailPage />
    </Suspense>
  );
}
