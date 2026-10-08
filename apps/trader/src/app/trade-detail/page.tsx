import { Suspense } from "react";
import { TradeDetailPage } from "../../modules/trading/pages/trade-detail-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TradeDetailPage />
    </Suspense>
  );
}
