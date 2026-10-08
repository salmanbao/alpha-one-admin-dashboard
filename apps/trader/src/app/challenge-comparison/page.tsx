import { Suspense } from "react";
import { ChallengeComparisonPage } from "../../modules/marketplace/pages/challenge-comparison-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ChallengeComparisonPage />
    </Suspense>
  );
}
