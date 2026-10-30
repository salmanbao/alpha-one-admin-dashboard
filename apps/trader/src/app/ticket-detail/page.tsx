import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TicketDetailPage } from "../../modules/support/pages/ticket-detail-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TicketDetailPage />
    </Suspense>
  );
}
