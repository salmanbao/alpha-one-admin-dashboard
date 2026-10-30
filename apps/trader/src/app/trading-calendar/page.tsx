import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradingCalendarPage } from "../../modules/trading/pages/trading-calendar-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradingCalendarPage />
    </Suspense>
  );
}
