import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { InvoiceDetailPage } from "../../modules/finance/pages/invoice-detail-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InvoiceDetailPage />
    </Suspense>
  );
}
