import { Suspense } from "react";
import { EvaluationPassedPage } from "../../modules/onboarding/pages/evaluation-passed-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EvaluationPassedPage />
    </Suspense>
  );
}
