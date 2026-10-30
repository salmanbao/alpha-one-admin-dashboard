import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { CompetitionsPage } from "../../modules/community/pages/competitions-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CompetitionsPage />
    </Suspense>
  );
}
