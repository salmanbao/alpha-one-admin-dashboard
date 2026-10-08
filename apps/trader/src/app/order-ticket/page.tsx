import { Suspense } from "react";
import { OrderTicketPage } from "../../modules/trading/pages/order-ticket-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OrderTicketPage />
    </Suspense>
  );
}
