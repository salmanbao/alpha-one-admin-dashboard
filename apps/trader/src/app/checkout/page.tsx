import { Suspense } from "react";
import { CheckoutPage } from "../../modules/marketplace/pages/checkout-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutPage />
    </Suspense>
  );
}
