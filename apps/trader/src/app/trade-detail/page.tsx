import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradeDetailPage } from "../../modules/trading/pages/trade-detail-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradeDetailPage />
    </Suspense>
  );
}
