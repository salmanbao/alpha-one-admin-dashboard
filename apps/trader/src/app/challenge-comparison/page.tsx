import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ChallengeComparisonPage } from "../../modules/marketplace/pages/challenge-comparison-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChallengeComparisonPage />
    </Suspense>
  );
}
