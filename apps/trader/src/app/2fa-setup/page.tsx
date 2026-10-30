import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TwoFactorSetupPage } from "../../modules/account/pages/two-factor-setup-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TwoFactorSetupPage />
    </Suspense>
  );
}
