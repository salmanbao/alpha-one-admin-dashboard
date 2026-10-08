import { Suspense } from "react";
import { AccountVerification1Page } from "../../modules/onboarding/pages/account-verification-1-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountVerification1Page />
    </Suspense>
  );
}
