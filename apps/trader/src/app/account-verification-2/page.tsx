import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AccountVerification2Page } from "../../modules/onboarding/pages/account-verification-2-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountVerification2Page />
    </Suspense>
  );
}
