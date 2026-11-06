import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PromoErrorPage } from "../../modules/marketplace/pages/promo-error-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PromoErrorPage />
    </Suspense>
  );
}
