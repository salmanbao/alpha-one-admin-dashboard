import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { RiskConsultationPage } from "../../modules/support/pages/risk-consultation-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RiskConsultationPage />
    </Suspense>
  );
}
