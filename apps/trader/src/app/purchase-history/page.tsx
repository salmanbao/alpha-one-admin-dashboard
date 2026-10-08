import { Suspense } from "react";
import { PurchaseHistoryPage } from "../../modules/marketplace/pages/purchase-history-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PurchaseHistoryPage />
    </Suspense>
  );
}
