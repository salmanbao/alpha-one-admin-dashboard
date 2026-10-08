import { Suspense } from "react";
import { WithdrawalMethodsPage } from "../../modules/payouts/pages/withdrawal-methods-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WithdrawalMethodsPage />
    </Suspense>
  );
}
