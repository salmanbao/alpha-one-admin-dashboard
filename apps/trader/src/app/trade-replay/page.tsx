import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradeReplayPage } from "../../modules/trading/pages/trade-replay-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradeReplayPage />
    </Suspense>
  );
}
