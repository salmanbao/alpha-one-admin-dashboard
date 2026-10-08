import { Suspense } from "react";
import { ChallengeDetailPage } from "../../modules/marketplace/pages/challenge-detail-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChallengeDetailPage />
    </Suspense>
  );
}
