import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { LoginPage } from "../../modules/onboarding/pages/login-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LoginPage />
    </Suspense>
  );
}
