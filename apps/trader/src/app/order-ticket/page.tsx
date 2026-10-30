import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { OrderTicketPage } from "../../modules/trading/pages/order-ticket-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OrderTicketPage />
    </Suspense>
  );
}
