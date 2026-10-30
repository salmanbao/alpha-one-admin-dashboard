import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { MyAccountsPage } from "../../modules/accounts/pages/my-accounts-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyAccountsPage />
    </Suspense>
  );
}
