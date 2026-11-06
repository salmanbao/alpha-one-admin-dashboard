import { Suspense } from "react";
import { PageSkeleton } from "@/components/shell/page-skeleton";
import { CheckoutValidationPage } from "../../modules/marketplace/pages/checkout-validation-page";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CheckoutValidationPage />
    </Suspense>
  );
}
