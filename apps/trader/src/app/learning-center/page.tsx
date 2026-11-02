import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { LearningCenterPage } from "../../modules/support/pages/learning-center-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LearningCenterPage />
    </Suspense>
  );
}
