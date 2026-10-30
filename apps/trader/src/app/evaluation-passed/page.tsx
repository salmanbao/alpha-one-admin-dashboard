import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { EvaluationPassedPage } from "../../modules/onboarding/pages/evaluation-passed-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EvaluationPassedPage />
    </Suspense>
  );
}
