import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ObjectivesPage } from "../../modules/accounts/pages/objectives-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ObjectivesPage />
    </Suspense>
  );
}
