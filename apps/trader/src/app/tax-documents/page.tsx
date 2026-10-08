import { Suspense } from "react";
import { TaxDocumentsPage } from "../../modules/finance/pages/tax-documents-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TaxDocumentsPage />
    </Suspense>
  );
}
