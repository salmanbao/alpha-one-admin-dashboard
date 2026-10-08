import { Suspense } from "react";
import { TwoFactorSetupPage } from "../../modules/account/pages/two-factor-setup-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TwoFactorSetupPage />
    </Suspense>
  );
}
