import { Suspense } from "react";
import { CompetitionsPage } from "../../modules/community/pages/competitions-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompetitionsPage />
    </Suspense>
  );
}
