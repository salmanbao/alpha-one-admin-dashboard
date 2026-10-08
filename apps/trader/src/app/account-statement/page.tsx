import { Suspense } from "react";
import { AccountStatementPage } from "../../modules/finance/pages/account-statement-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountStatementPage />
    </Suspense>
  );
}
