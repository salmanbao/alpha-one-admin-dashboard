import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { MarketplacePage } from "../../modules/marketplace/pages/marketplace-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MarketplacePage />
    </Suspense>
  );
}
