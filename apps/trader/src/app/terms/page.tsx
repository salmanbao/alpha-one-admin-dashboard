import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { TermsPage } from "../../modules/support/pages/terms-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TermsPage />
    </Suspense>
  );
}
