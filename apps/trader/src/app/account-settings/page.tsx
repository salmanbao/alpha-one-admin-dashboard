import { Suspense } from "react";
import { AccountSettingsPage } from "../../modules/account/pages/account-settings-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AccountSettingsPage />
    </Suspense>
  );
}
