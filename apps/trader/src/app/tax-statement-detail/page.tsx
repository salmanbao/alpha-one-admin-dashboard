import { Suspense } from "react";
import { TaxStatementDetailPage } from "../../modules/finance/pages/tax-statement-detail-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TaxStatementDetailPage />
    </Suspense>
  );
}
