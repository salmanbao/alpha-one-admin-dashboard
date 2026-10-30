import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { AccountSettingsPage } from "../../modules/account/pages/account-settings-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccountSettingsPage />
    </Suspense>
  );
}
