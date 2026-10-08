import { Suspense } from "react";
import { TradeReplayPage } from "../../modules/trading/pages/trade-replay-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TradeReplayPage />
    </Suspense>
  );
}
