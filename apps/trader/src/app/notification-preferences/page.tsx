import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { NotificationPreferencesPage } from "../../modules/account/pages/notification-preferences-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificationPreferencesPage />
    </Suspense>
  );
}
