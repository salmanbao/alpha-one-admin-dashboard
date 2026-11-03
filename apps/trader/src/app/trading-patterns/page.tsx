import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradingPatternsPage } from "../../modules/trading/pages/trading-patterns-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradingPatternsPage />
    </Suspense>
  );
}
