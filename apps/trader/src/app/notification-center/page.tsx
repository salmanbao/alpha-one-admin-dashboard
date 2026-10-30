import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { NotificationCenterPage } from "../../modules/account/pages/notification-center-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificationCenterPage />
    </Suspense>
  );
}
