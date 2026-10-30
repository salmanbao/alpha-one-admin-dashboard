import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TaxDocumentsPage } from "../../modules/finance/pages/tax-documents-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TaxDocumentsPage />
    </Suspense>
  );
}
