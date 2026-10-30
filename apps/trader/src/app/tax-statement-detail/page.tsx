import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TaxStatementDetailPage } from "../../modules/finance/pages/tax-statement-detail-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TaxStatementDetailPage />
    </Suspense>
  );
}
