import { Suspense } from "react";
import { AccountBreachPage } from "../../modules/onboarding/pages/account-breach-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountBreachPage />
    </Suspense>
  );
}
