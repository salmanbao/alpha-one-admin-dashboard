import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { CheckoutFailurePage } from "../../modules/marketplace/pages/checkout-failure-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CheckoutFailurePage />
    </Suspense>
  );
}
