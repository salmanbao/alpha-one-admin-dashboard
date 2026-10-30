import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { MyChallengesPage } from "../../modules/marketplace/pages/my-challenges-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyChallengesPage />
    </Suspense>
  );
}
