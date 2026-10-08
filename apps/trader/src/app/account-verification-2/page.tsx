import { Suspense } from "react";
import { AccountVerification2Page } from "../../modules/onboarding/pages/account-verification-2-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountVerification2Page />
    </Suspense>
  );
}
