import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { SupportPage } from "../../modules/support/pages/support-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SupportPage />
    </Suspense>
  );
}
