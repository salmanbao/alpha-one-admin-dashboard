import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ResetPasswordPage } from "../../modules/onboarding/pages/reset-password-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResetPasswordPage />
    </Suspense>
  );
}