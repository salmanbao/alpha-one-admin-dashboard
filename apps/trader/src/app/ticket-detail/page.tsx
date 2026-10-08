import { Suspense } from "react";
import { TicketDetailPage } from "../../modules/support/pages/ticket-detail-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TicketDetailPage />
    </Suspense>
  );
}
