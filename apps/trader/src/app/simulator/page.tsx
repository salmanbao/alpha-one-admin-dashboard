import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradingSimulatorPage } from "../../modules/trading/pages/trading-simulator-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradingSimulatorPage />
    </Suspense>
  );
}
