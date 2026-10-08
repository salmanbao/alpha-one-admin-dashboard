import { Suspense } from "react";
import { LeaderboardPage } from "../../modules/community/pages/leaderboard-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LeaderboardPage />
    </Suspense>
  );
}
