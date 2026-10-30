import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { MarketWatchPage } from "../../modules/trading/pages/market-watch-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketWatchPage />
    </Suspense>
  );
}
