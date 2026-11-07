import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { RewardsCatalogPage } from "../../modules/promo/rewards-catalog-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RewardsCatalogPage />
    </Suspense>
  );
}
