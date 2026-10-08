import { Suspense } from "react";
import { NotificationCenterPage } from "../../modules/account/pages/notification-center-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NotificationCenterPage />
    </Suspense>
  );
}
