import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TradingJournalPage } from "../../modules/trading/pages/trading-journal-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TradingJournalPage />
    </Suspense>
  );
}
