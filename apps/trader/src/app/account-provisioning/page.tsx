import { Suspense } from "react";
import { AccountProvisioningPage } from "../../modules/onboarding/pages/account-provisioning-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountProvisioningPage />
    </Suspense>
  );
}
