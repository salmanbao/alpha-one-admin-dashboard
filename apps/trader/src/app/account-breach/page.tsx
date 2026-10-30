import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AccountBreachPage } from "../../modules/onboarding/pages/account-breach-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountBreachPage />
    </Suspense>
  );
}
