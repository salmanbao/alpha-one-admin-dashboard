import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { KycOnboardingPage } from "../../modules/onboarding/pages/kyc-onboarding-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <KycOnboardingPage />
    </Suspense>
  );
}
