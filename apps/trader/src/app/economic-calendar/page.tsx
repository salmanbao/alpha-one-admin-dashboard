import { Suspense } from "react";
import { EconomicCalendarPage } from "../../modules/trading/pages/economic-calendar-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EconomicCalendarPage />
    </Suspense>
  );
}
