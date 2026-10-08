import { Suspense } from "react";
import { AccountDetailPage } from "../../modules/accounts/pages/account-detail-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountDetailPage />
    </Suspense>
  );
}
