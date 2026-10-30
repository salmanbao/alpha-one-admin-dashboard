import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { EconomicCalendarPage } from "../../modules/trading/pages/economic-calendar-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EconomicCalendarPage />
    </Suspense>
  );
}
