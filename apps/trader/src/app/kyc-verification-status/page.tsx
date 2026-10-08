import { Suspense } from "react";
import { KycVerificationStatusPage } from "../../modules/onboarding/pages/kyc-verification-status-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <KycVerificationStatusPage />
    </Suspense>
  );
}
