import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AccountVerification1Page } from "../../modules/onboarding/pages/account-verification-1-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountVerification1Page />
    </Suspense>
  );
}
