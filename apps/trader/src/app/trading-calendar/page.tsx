import { Suspense } from "react";
import { TradingCalendarPage } from "../../modules/trading/pages/trading-calendar-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TradingCalendarPage />
    </Suspense>
  );
}
