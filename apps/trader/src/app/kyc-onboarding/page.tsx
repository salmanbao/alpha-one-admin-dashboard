import { Suspense } from "react";
import { KycOnboardingPage } from "../../modules/onboarding/pages/kyc-onboarding-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KycOnboardingPage />
    </Suspense>
  );
}
