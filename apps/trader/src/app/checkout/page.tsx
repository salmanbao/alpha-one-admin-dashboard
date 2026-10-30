import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { CheckoutPage } from "../../modules/marketplace/pages/checkout-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CheckoutPage />
    </Suspense>
  );
}
