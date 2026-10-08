import { Suspense } from "react";
import { RiskConsultationPage } from "../../modules/support/pages/risk-consultation-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RiskConsultationPage />
    </Suspense>
  );
}
