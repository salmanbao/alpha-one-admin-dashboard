import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { LeaderboardPage } from "../../modules/community/pages/leaderboard-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeaderboardPage />
    </Suspense>
  );
}
