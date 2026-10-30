import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AccountDetailPage } from "../../modules/accounts/pages/account-detail-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountDetailPage />
    </Suspense>
  );
}
