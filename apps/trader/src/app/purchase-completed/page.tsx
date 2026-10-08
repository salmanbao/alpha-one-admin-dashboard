import { Suspense } from "react";
import { PurchaseCompletedPage } from "../../modules/marketplace/pages/purchase-completed-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PurchaseCompletedPage />
    </Suspense>
  );
}
