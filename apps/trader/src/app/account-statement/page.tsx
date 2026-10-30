import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AccountStatementPage } from "../../modules/finance/pages/account-statement-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountStatementPage />
    </Suspense>
  );
}
