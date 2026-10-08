import { Suspense } from "react";
import { MarketplacePage } from "../../modules/marketplace/pages/marketplace-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MarketplacePage />
    </Suspense>
  );
}
