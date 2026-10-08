import { Suspense } from "react";
import { InvoiceDetailPage } from "../../modules/finance/pages/invoice-detail-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <InvoiceDetailPage />
    </Suspense>
  );
}
