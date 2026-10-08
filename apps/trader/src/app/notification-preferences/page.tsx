import { Suspense } from "react";
import { NotificationPreferencesPage } from "../../modules/account/pages/notification-preferences-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NotificationPreferencesPage />
    </Suspense>
  );
}
