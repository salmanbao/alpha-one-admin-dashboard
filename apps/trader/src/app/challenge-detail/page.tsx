import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ChallengeDetailPage } from "../../modules/marketplace/pages/challenge-detail-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ChallengeDetailPage />
    </Suspense>
  );
}
