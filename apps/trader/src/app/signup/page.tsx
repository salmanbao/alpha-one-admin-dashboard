import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { SignupPage } from "../../modules/onboarding/pages/signup-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SignupPage />
    </Suspense>
  );
}