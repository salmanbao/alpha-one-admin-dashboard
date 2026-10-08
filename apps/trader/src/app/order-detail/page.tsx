import { Suspense } from "react";
import { OrderDetailPage } from "../../modules/trading/pages/order-detail-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrderDetailPage />
    </Suspense>
  );
}
