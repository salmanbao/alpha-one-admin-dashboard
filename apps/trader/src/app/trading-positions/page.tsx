import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { OpenPositionsPage } from "../../modules/trading/pages/open-positions-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <OpenPositionsPage />
    </Suspense>
  );
}
