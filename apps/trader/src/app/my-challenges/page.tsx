import { Suspense } from "react";
import { MyChallengesPage } from "../../modules/marketplace/pages/my-challenges-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyChallengesPage />
    </Suspense>
  );
}
