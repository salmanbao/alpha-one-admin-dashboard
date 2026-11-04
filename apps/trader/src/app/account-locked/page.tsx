import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AccountLockedPage } from "../../modules/onboarding/pages/account-locked-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountLockedPage />
    </Suspense>
  );
}
