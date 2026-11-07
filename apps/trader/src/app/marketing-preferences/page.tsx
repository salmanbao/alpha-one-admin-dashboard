import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { MarketingPreferencesPage } from "../../modules/account/pages/marketing-preferences-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketingPreferencesPage />
    </Suspense>
  );
}
