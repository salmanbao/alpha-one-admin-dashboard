import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { ForgotPasswordPage } from "../../modules/onboarding/pages/forgot-password-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ForgotPasswordPage />
    </Suspense>
  );
}
