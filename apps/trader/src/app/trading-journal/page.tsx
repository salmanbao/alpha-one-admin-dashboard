import { Suspense } from "react";
import { TradingJournalPage } from "../../modules/trading/pages/trading-journal-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TradingJournalPage />
    </Suspense>
  );
}
