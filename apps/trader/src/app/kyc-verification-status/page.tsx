import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { KycVerificationStatusPage } from "../../modules/onboarding/pages/kyc-verification-status-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <KycVerificationStatusPage />
    </Suspense>
  );
}
