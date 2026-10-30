import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { HelpCenterPage } from "../../modules/support/pages/help-center-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HelpCenterPage />
    </Suspense>
  );
}
