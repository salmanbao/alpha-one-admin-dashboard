import { Suspense } from "react";
import { MarketWatchPage } from "../../modules/trading/pages/market-watch-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MarketWatchPage />
    </Suspense>
  );
}
