import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AccountProvisioningPage } from "../../modules/onboarding/pages/account-provisioning-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountProvisioningPage />
    </Suspense>
  );
}
