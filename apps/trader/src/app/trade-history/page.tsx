import { Suspense } from "react";
import { TradeHistoryPage } from "../../modules/trading/pages/trade-history-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TradeHistoryPage />
    </Suspense>
  );
}
