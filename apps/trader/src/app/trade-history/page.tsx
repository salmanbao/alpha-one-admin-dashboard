import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradeHistoryPage } from "../../modules/trading/pages/trade-history-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradeHistoryPage />
    </Suspense>
  );
}
