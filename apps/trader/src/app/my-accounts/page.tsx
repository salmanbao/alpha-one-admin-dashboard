import { Suspense } from "react";
import { MyAccountsPage } from "../../modules/accounts/pages/my-accounts-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyAccountsPage />
    </Suspense>
  );
}
